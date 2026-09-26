// Weather from Open-Meteo: free, no account, no key.
import { readFileSync } from "node:fs";

export interface Hour { at: number; tempC: number; code: number; visibilityM: number | null; gustKmh: number | null; rainChance: number | null }
export interface Forecast { utcOffsetSeconds: number; hours: Hour[] }
export interface WeatherSource {
  forecast(lat: number, lon: number): Promise<Forecast>;
  locate(name: string, countryCode?: string): Promise<{ lat: number; lon: number } | null>;
}

export function parseForecast(j: any): Forecast {
  const off = Number(j?.utc_offset_seconds ?? 0);
  const h = j?.hourly ?? {};
  const times: string[] = h.time ?? [];
  return {
    utcOffsetSeconds: off,
    hours: times.map((t, i) => ({
      at: Date.parse(t + ":00Z") - off * 1000,       // local time → real instant
      tempC: h.temperature_2m?.[i],
      code: h.weather_code?.[i],
      visibilityM: h.visibility?.[i] ?? null,
      gustKmh: h.wind_gusts_10m?.[i] ?? null,
      rainChance: h.precipitation_probability?.[i] ?? null,
    })),
  };
}

export function liveWeather(): WeatherSource {
  const get = async (url: string) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    return res.json();
  };
  return {
    forecast: async (lat, lon) => parseForecast(await get(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,weather_code,visibility,wind_gusts_10m,precipitation_probability&timezone=auto&forecast_days=16`)),
    locate: async (name, cc) => {
      const j = await get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json${cc ? `&countryCode=${cc}` : ""}`);
      const r = j?.results?.[0];
      return r ? { lat: r.latitude, lon: r.longitude } : null;
    },
  };
}

export function mockWeather(): WeatherSource {
  const load = (f: string) => JSON.parse(readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8"));
  return {
    forecast: async (lat) => parseForecast(load(lat < 35 ? "weather-auh.json" : "weather-lhr.json")),
    locate: async () => ({ lat: 51.47, lon: -0.46 }),
  };
}

/** WMO weather codes in plain words. */
export function describe(code: number): string {
  if (code === 0) return "clear";
  if (code <= 3) return "some cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return code >= 65 ? "heavy rain" : "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "showers";
  if (code === 85 || code === 86) return "snow showers";
  if (code >= 95) return "thunderstorms";
  return "mixed";
}

export function hourAt(f: Forecast, at: number): Hour | undefined {
  let best: Hour | undefined;
  for (const h of f.hours) if (!best || Math.abs(h.at - at) < Math.abs(best.at - at)) best = h;
  return best && Math.abs(best.at - at) <= 90 * 60_000 ? best : undefined;
}
