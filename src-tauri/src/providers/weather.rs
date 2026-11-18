use super::{ProviderPayload, ProviderStatus};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherData {
    pub city: String,
    pub country: Option<String>,
    pub temperature: i32,
    pub apparent_temperature: i32,
    pub humidity: i32,
    pub wind_speed: i32,
    pub weather_code: i32,
    pub is_day: i32,
    pub unit: String,
    pub wind_unit: String,
}

pub async fn fetch_weather(
    client: &reqwest::Client,
    city: &str,
    unit_str: &str,
) -> ProviderPayload {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let clean_city = city.trim();
    if clean_city.is_empty() {
        return ProviderPayload {
            status: ProviderStatus::Error,
            message: Some("Location is required".to_string()),
            data: None,
            updated_at: now,
        };
    }

    info!("Fetching weather for '{}' (unit: {})", clean_city, unit_str);

    // 1. Geocode city name to lat/lon via Open-Meteo Geocoding API
    let geo_res = match client
        .get("https://geocoding-api.open-meteo.com/v1/search")
        .query(&[
            ("name", clean_city),
            ("count", "1"),
            ("language", "en"),
            ("format", "json"),
        ])
        .header("User-Agent", "Nook-Desktop-Widgets/1.0")
        .send()
        .await
    {
        Ok(res) => res,
        Err(e) => {
            warn!("Failed to reach geocoding service: {}", e);
            return ProviderPayload {
                status: ProviderStatus::Offline,
                message: Some("Failed to reach weather service (offline)".to_string()),
                data: None,
                updated_at: now,
            };
        }
    };

    if !geo_res.status().is_success() {
        return ProviderPayload {
            status: ProviderStatus::Error,
            message: Some(format!("Geocoding API error (HTTP {})", geo_res.status())),
            data: None,
            updated_at: now,
        };
    }

    let geo_json = match geo_res.json::<serde_json::Value>().await {
        Ok(j) => j,
        Err(e) => {
            return ProviderPayload {
                status: ProviderStatus::Error,
                message: Some(format!("Failed to parse geocoding response: {}", e)),
                data: None,
                updated_at: now,
            };
        }
    };

    let results = match geo_json.get("results").and_then(|v| v.as_array()) {
        Some(arr) if !arr.is_empty() => arr,
        _ => {
            return ProviderPayload {
                status: ProviderStatus::NotFound,
                message: Some(format!("Location '{}' not found", clean_city)),
                data: None,
                updated_at: now,
            };
        }
    };

    let first_match = &results[0];
    let lat = match first_match.get("latitude").and_then(|v| v.as_f64()) {
        Some(l) => l,
        None => {
            return ProviderPayload {
                status: ProviderStatus::Error,
                message: Some("Invalid geocoding coordinates".to_string()),
                data: None,
                updated_at: now,
            };
        }
    };
    let lon = match first_match.get("longitude").and_then(|v| v.as_f64()) {
        Some(l) => l,
        None => {
            return ProviderPayload {
                status: ProviderStatus::Error,
                message: Some("Invalid geocoding coordinates".to_string()),
                data: None,
                updated_at: now,
            };
        }
    };
    let matched_name = first_match
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or(clean_city)
        .to_string();
    let country = first_match
        .get("country")
        .and_then(|v| v.as_str())
        .map(String::from);

    // 2. Fetch current weather forecast
    let is_fahrenheit = unit_str.eq_ignore_ascii_case("fahrenheit");
    let mut query_params = vec![
        ("latitude", lat.to_string()),
        ("longitude", lon.to_string()),
        (
            "current",
            "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m".to_string(),
        ),
    ];
    if is_fahrenheit {
        query_params.push(("temperature_unit", "fahrenheit".to_string()));
        query_params.push(("wind_speed_unit", "mph".to_string()));
    }

    let forecast_res = match client
        .get("https://api.open-meteo.com/v1/forecast")
        .query(&query_params)
        .header("User-Agent", "Nook-Desktop-Widgets/1.0")
        .send()
        .await
    {
        Ok(res) => res,
        Err(e) => {
            warn!("Failed to reach forecast service: {}", e);
            return ProviderPayload {
                status: ProviderStatus::Offline,
                message: Some("Failed to reach weather service (offline)".to_string()),
                data: None,
                updated_at: now,
            };
        }
    };

    if !forecast_res.status().is_success() {
        return ProviderPayload {
            status: ProviderStatus::Error,
            message: Some(format!(
                "Weather API error (HTTP {})",
                forecast_res.status()
            )),
            data: None,
            updated_at: now,
        };
    }

    let forecast_json = match forecast_res.json::<serde_json::Value>().await {
        Ok(j) => j,
        Err(e) => {
            return ProviderPayload {
                status: ProviderStatus::Error,
                message: Some(format!("Failed to parse weather forecast response: {}", e)),
                data: None,
                updated_at: now,
            };
        }
    };

    let current = match forecast_json.get("current") {
        Some(c) => c,
        None => {
            return ProviderPayload {
                status: ProviderStatus::Error,
                message: Some("Weather response missing current conditions".to_string()),
                data: None,
                updated_at: now,
            };
        }
    };

    let temp = current
        .get("temperature_2m")
        .and_then(|v| v.as_f64())
        .map(|v| v.round() as i32)
        .unwrap_or(0);
    let app_temp = current
        .get("apparent_temperature")
        .and_then(|v| v.as_f64())
        .map(|v| v.round() as i32)
        .unwrap_or(0);
    let humidity = current
        .get("relative_humidity_2m")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32)
        .unwrap_or(0);
    let wind = current
        .get("wind_speed_10m")
        .and_then(|v| v.as_f64())
        .map(|v| v.round() as i32)
        .unwrap_or(0);
    let weather_code = current
        .get("weather_code")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32)
        .unwrap_or(0);
    let is_day = current
        .get("is_day")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32)
        .unwrap_or(1);

    let (unit_display, wind_unit_display) = if is_fahrenheit {
        ("°F".to_string(), "mph".to_string())
    } else {
        ("°C".to_string(), "km/h".to_string())
    };

    let data = WeatherData {
        city: matched_name,
        country,
        temperature: temp,
        apparent_temperature: app_temp,
        humidity,
        wind_speed: wind,
        weather_code,
        is_day,
        unit: unit_display,
        wind_unit: wind_unit_display,
    };

    ProviderPayload {
        status: ProviderStatus::Ok,
        message: None,
        data: serde_json::to_value(data).ok(),
        updated_at: now,
    }
}
