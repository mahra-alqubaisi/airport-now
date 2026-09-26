import type { Flight } from "../types.js";
import { localHM } from "../summary.js";
import type { Signal } from "./types.js";

export function flightSignal(f: Flight, yourDelay: number | null): Signal {
  const dep = f.departure;
  const to = f.arrival.airportName ?? f.arrival.airportIata ?? "?";
  const when = dep.scheduled != null ? localHM(dep.scheduled) : "?";
  const late = yourDelay != null && yourDelay >= 5;
  return {
    id: "flight",
    label: "Your flight",
    level: late ? (yourDelay! >= 15 ? "alert" : "watch") : "ok",
    headline: `${f.number} to ${to}, ${when}${late && dep.best != null ? ` (now ${localHM(dep.best)})` : ""}${f.model ? ` · ${f.model}` : ""}`,
    reasons: late ? [`Showing ${yourDelay} min late.`] : [],
    data: {
      number: f.number, to, model: f.model ?? null, aircraft: f.reg ?? null,
      scheduled: dep.scheduled ?? null, expected: dep.live ? dep.best ?? null : null,
      terminal: dep.terminal ?? null, gate: dep.gate ?? null, delayMinutes: yourDelay,
    },
  };
}
