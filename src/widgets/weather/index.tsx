import { useEffect } from "react";
import { WidgetShell } from "../../components/WidgetShell";
import { useProvider } from "../../core/use-provider";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;

interface WeatherData {
  city: string;
  country?: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isDay: number;
  unit: string;
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
      <svg
        className="text-amber-500 h-9 w-9"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ) : (
      <svg
        className="text-indigo-400 h-9 w-9"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }

  if (code >= 1 && code <= 3) {
    return (
      <svg
        className="h-9 w-9 text-neutral-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      </svg>
    );
  }

  if ((code >= 51 && code <= 65) || (code >= 80 && code <= 82)) {
    return (
      <svg
        className="h-9 w-9 text-accent-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <line x1="16" y1="13" x2="16" y2="21" />
        <line x1="8" y1="13" x2="8" y2="21" />
        <line x1="12" y1="15" x2="12" y2="23" />
        <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
      </svg>
    );
  }

  if (code >= 71 && code <= 75) {
    return (
      <svg
        className="text-sky-300 h-9 w-9"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
        <line x1="8" y1="16" x2="8.01" y2="16" />
        <line x1="8" y1="20" x2="8.01" y2="20" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
        <line x1="12" y1="22" x2="12.01" y2="22" />
        <line x1="16" y1="16" x2="16.01" y2="16" />
        <line x1="16" y1="20" x2="16.01" y2="20" />
      </svg>
    );
  }

  return (
    <svg
      className="text-amber-500 h-9 w-9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
    </svg>
  );
}

export function WeatherWidget({ instance, editMode }: WidgetProps) {
  const city = String(instance.settings.city || "New York").trim();

  const { payload, loading, refresh } = useProvider<WeatherData>(instance.id);
  const weather = payload?.data;

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
      headerSlot={
        <svg
          className="h-3.5 w-3.5 text-fg-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
        </svg>
      }
    >
      <div className="flex h-full flex-col justify-between py-1 select-none">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center p-3 text-center">
            <span className="text-xs text-error">{error}</span>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-2 rounded bg-surface-raised px-2 py-1 text-[11px] text-fg hover:bg-line/40"
            >
              Retry
            </button>
          </div>
        ) : loading && !weather ? (
          <div className="flex h-full items-center justify-center text-xs text-fg-muted italic">
            Fetching weather...
          </div>
        ) : weather ? (
          <>
            {/* Main Weather Info */}
            <div className="flex items-center justify-between px-1 pt-1">
              <div className="flex flex-col">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-fg">
                    {weather.temperature}
                  </span>
                  <span className="text-lg font-medium text-fg-muted">{weather.unit}</span>
                </div>
                <span className="text-xs font-medium text-fg/80">
                  {getWeatherDescription(weather.weatherCode)}
                </span>
                <span className="text-[10px] text-fg-muted">
                  Feels like {weather.apparentTemperature}
                  {weather.unit}
                </span>
              </div>

              <div className="pr-1">
                <WeatherIcon code={weather.weatherCode} isDay={weather.isDay} />
              </div>
            </div>

            {/* Atmosphere Details Pill */}
            <div className="mt-auto grid grid-cols-2 gap-2 border-t border-line/40 pt-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-fg-muted">
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                </svg>
                <span>Humidity:</span>
                <span className="font-mono font-medium text-fg">{weather.humidity}%</span>
              </div>

              <div className="flex items-center gap-1.5 text-fg-muted">
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
                </svg>
                <span>Wind:</span>
                <span className="font-mono font-medium text-fg">{weather.windSpeed} km/h</span>
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
