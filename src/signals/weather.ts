import { WEATHER } from "../config.js";
import { describe, hourAt, type Forecast } from "../weather.js";
import type { Signal } from "./types.js";

const hm = (at: number, offsetSeconds: number) => new Date(at + offsetSeconds * 1000).toISOString().slice(11, 16);
const km = (m: number | null) => (m == null ? "?" : m >= 10_000 ? "10+ km" : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);

/** Abu Dhabi around departure: only what can affect operations (fog, dust, storms, gusts). */
export function homeWeatherSignal(f: Forecast | null, departure: number): Signal {
  const base = { id: "weatherHome", label: "Abu Dhabi weather" };
  const h = f && hourAt(f, departure);
  if (!f || !h) return { ...base, level: "unknown", headline: "No forecast for departure time", reasons: [], data: {} };

  const reasons: string[] = [];
  let level: Signal["level"] = "ok";
  const vis = h.visibilityM;
  if (vis != null && vis < WEATHER.veryLowVisibilityM) {
    level = "alert";
    reasons.push(`Visibility ~${km(vis)}: fog or dust. Departures often slow down in this.`);
  } else if (vis != null && vis < WEATHER.lowVisibilityM) {
    level = "watch";
    reasons.push(`Reduced visibility (~${km(vis)}), likely haze, dust or mist.`);
  }
  if (h.code >= 95) { level = "alert"; reasons.push("Thunderstorms forecast."); }
  if (h.gustKmh != null && h.gustKmh >= WEATHER.strongGustKmh) {
    if (level === "ok") level = "watch";
    reasons.push(`Strong gusts (${Math.round(h.gustKmh)} km/h), which can kick up dust.`);
  }
  return {
    ...base, level,
    headline: `${hm(departure, f.utcOffsetSeconds)}: ${Math.round(h.tempC)}°, ${describe(h.code)}, visibility ${km(vis)}`,
    reasons,
    data: { ...h },
  };
}

/** Destination around landing: what to prepare for, plus anything that could disrupt the arrival. */
export function destinationWeatherSignal(f: Forecast | null, city: string, landing: number | null, landingEstimated: boolean, homeTempC: number | null): Signal {
  const base = { id: "weatherDest", label: `${city} weather` };
  const h = f && landing != null ? hourAt(f, landing) : undefined;
  if (!f || !h || landing == null) return { ...base, label: "Destination weather", level: "unknown", headline: "No forecast for landing time", reasons: [], data: {} };

  const reasons: string[] = [];
  let level: Signal["level"] = "ok";
  if (h.code >= 95 || (h.code >= 71 && h.code <= 77) || h.code === 85 || h.code === 86) { level = "watch"; reasons.push(`${describe(h.code)} around landing, which can cause arrival delays.`); }
  if (h.gustKmh != null && h.gustKmh >= WEATHER.strongGustKmh) { level = "watch"; reasons.push(`Strong gusts (${Math.round(h.gustKmh)} km/h) at landing.`); }
  if (homeTempC != null && homeTempC - h.tempC >= 12) reasons.push(`${Math.round(homeTempC - h.tempC)}° colder than Abu Dhabi. Bring a jacket.`);
  if ((h.rainChance ?? 0) >= 50 || (h.code >= 51 && h.code <= 67) || (h.code >= 80 && h.code <= 82)) reasons.push("Rain likely. Umbrella.");
  return {
    ...base, level,
    headline: `Landing ${landingEstimated ? "~" : ""}${hm(landing, f.utcOffsetSeconds)} local: ${Math.round(h.tempC)}°, ${describe(h.code)}`,
    reasons,
    data: { ...h, landing, landingEstimated },
  };
}
