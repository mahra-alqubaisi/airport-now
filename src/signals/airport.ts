import type { airportDelays } from "../analyze.js";
import type { Signal } from "./types.js";

/** How AUH departures are performing right now. Missing times are unknown, never "on time". */
export function airportSignal(a: ReturnType<typeof airportDelays>): Signal {
  const base = { id: "airport", label: "Airport today" };
  if (a.checked < 5) {
    return { ...base, level: "unknown", headline: "Not enough live data to judge",
      reasons: [`Only ${a.checked} of the last ${a.recent} departures have live times.`], data: a };
  }
  const bad = a.share >= 0.4 && a.avgLateMinutes >= 20;
  return {
    ...base,
    level: bad ? "alert" : a.share >= 0.25 ? "watch" : "ok",
    headline: bad ? `Bad day: ${a.late} of ${a.checked} recent departures late` : `Running normally: ${a.late} of ${a.checked} recent departures late`,
    reasons: a.late ? [`Late ones average ${a.avgLateMinutes} min.`] : [],
    data: a,
  };
}
