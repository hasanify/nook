import { Cloud, CloudRain, CloudSnow, Drop, Moon, Sun, Wind } from "@phosphor-icons/react";
import { useEffect } from "react";

import { WidgetShell } from "@/components/WidgetShell";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";
import { useProvider } from "@/core/use-provider";

import manifestJson from "./manifest.json";

const manifest = manifestJson as Manifest;

interface WeatherData {
  city: string;
  country?: string;
  temperature: number;
  apparentTemperature?: number;
  apparent_temperature?: number;
  humidity: number;
  windSpeed?: number;
  wind_speed?: number;
  weatherCode?: number;
  weather_code?: number;
  isDay?: number;
  is_day?: number;
  unit: string;
  windUnit?: string;
  wind_unit?: string;
}

function getWeatherDescription(code: number): string {
  switch (code) {
    case 0:
      return "Clear sky";
    case 1:
      return "Mainly clear";
    case 2:
      return "Partly cloudy";
    case 3:
      return "Overcast";
    case 45:
    case 48:
      return "Foggy";
    case 51:
    case 53:
    case 55:
      return "Drizzle";
    case 61:
    case 63:
    case 65:
      return "Rain";
    case 71:
    case 73:
    case 75:
      return "Snow";
    case 80:
    case 81:
    case 82:
      return "Rain showers";
    case 95:
    case 96:
    case 99:
      return "Thunderstorm";
    default:
      return "Clear";
  }
}

function WeatherIcon({ code, isDay }: { code: number; isDay: number }) {
  if (code === 0) {
    return isDay ? (
      <Sun className="text-amber-500 block-9 inline-9" weight="fill" />
    ) : (
      <Moon className="text-indigo-400 block-9 inline-9" weight="fill" />
    );
  }

  if (code >= 1 && code <= 3) {
    return <Cloud className="text-neutral-400 block-9 inline-9" weight="fill" />;
  }

  if ((code >= 51 && code <= 65) || (code >= 80 && code <= 82)) {
    return <CloudRain className="text-accent-500 block-9 inline-9" weight="fill" />;
  }

  if (code >= 71 && code <= 75) {
    return <CloudSnow className="text-sky-300 block-9 inline-9" weight="fill" />;
  }

  return <Sun className="text-amber-500 block-9" weight="fill" />;
}

export function WeatherWidget({ instance, editMode }: WidgetProps) {
  const city = String(instance.settings.city || "New York").trim();

  const { payload, loading, refresh } = useProvider<WeatherData>(instance.id);
  const weather = payload?.data;

  const windSpeed = weather ? (weather.windSpeed ?? weather.wind_speed ?? 0) : 0;
  const windUnit = weather
    ? (weather.windUnit ?? weather.wind_unit ?? (weather.unit === "°F" ? "mph" : "km/h"))
    : "km/h";
  const apparentTemperature = weather
    ? (weather.apparentTemperature ?? weather.apparent_temperature ?? weather.temperature)
    : 0;
  const weatherCode = weather ? (weather.weatherCode ?? weather.weather_code ?? 0) : 0;
  const isDay = weather ? (weather.isDay ?? weather.is_day ?? 1) : 1;

  // On mount or when city/unit settings change, request fresh weather data if none exists
  useEffect(() => {
    if (!payload) {
      void refresh();
    }
  }, [payload, refresh]);

  const error = (() => {
    if (!city) return "Set location in Settings";
    if (!payload) return null;
    if (payload.status === "error") return payload.message || "Failed to fetch weather";
    if (payload.status === "not-found") return payload.message || `Location "${city}" not found`;
    if (payload.status === "offline" && !weather) return "Offline — cannot reach weather service";
    return null;
  })();

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      title={
        weather?.city
          ? `${weather.city}${weather.country ? `, ${weather.country}` : ""}`
          : manifest.name
      }
      resizable={manifest.resizable}
      minSize={manifest.minSize}
      defaultSize={manifest.defaultSize}
    >
      <div className="flex flex-col justify-between select-none min-block-full">
        {error ? (
          <div className="flex flex-col items-center justify-center p-3 text-center block-full">
            <span className="text-xs text-error">{error}</span>
            <button
              type="button"
              onClick={() => void refresh()}
              className="
                mbs-2 rounded-sm bg-surface-raised px-2 py-1 text-[11px] text-fg
                hover:bg-line/40
              "
            >
              Retry
            </button>
          </div>
        ) : loading && !weather ? (
          <div className="flex items-center justify-center text-xs text-fg-muted italic block-full">
            Fetching weather...
          </div>
        ) : weather ? (
          <>
            {/* Main Weather Info */}
            <div className="flex items-center justify-between px-1 pbs-1">
              <div className="flex flex-col">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-fg">
                    {weather.temperature}
                  </span>
                  <span className="text-lg font-medium text-fg-muted">{weather.unit}</span>
                </div>
                <span className="text-xs font-medium text-fg/80">
                  {getWeatherDescription(weatherCode)}
                </span>
                <span className="text-[10px] text-fg-muted">
                  Feels like {apparentTemperature}
                  {weather.unit}
                </span>
              </div>

              <div className="pe-1">
                <WeatherIcon code={weatherCode} isDay={isDay} />
              </div>
            </div>

            {/* Atmosphere Details Pill */}
            <div className="mbs-auto grid grid-cols-2 gap-2 border-bs border-line/40 pbs-2 pbe-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-fg-muted">
                <Drop className="shrink-0 text-accent-500 block-3.5 inline-3.5" weight="fill" />
                <span>Humidity:</span>
                <span className="font-mono font-medium text-fg">{weather.humidity}%</span>
              </div>

              <div className="flex items-center gap-1.5 text-fg-muted">
                <Wind className="shrink-0 text-accent-500 block-3.5 inline-3.5" />
                <span>Wind:</span>
                <span className="font-mono font-medium text-fg">
                  {windSpeed} {windUnit}
                </span>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </WidgetShell>
  );
}

const module: WidgetModule = {
  manifest,
  component: WeatherWidget,
  defaultSettings: {
    city: "New York",
    unit: "celsius",
  },
  defaultState: {},
};

export default module;
