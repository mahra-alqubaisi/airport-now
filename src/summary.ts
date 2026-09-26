import { HOME_UTC_OFFSET_HOURS } from "./config.js";
import type { airportDelays, busyness, delayRisk } from "./analyze.js";
import type { Flight } from "./types.js";

export const localHM = (ms: number) =>
  new Date(ms + HOME_UTC_OFFSET_HOURS * 3_600_000).toISOString().slice(11, 16);

const n = (x: number) => x.toLocaleString("en-US");

export function summary(args: {
  flight: Flight;
  yourDelay: number | null;
  busy: ReturnType<typeof busyness>;
  airport: ReturnType<typeof airportDelays>;
  risk: ReturnType<typeof delayRisk>;
}) {
  const { flight: f, busy, risk } = args;
  const dep = f.departure;
  const lines: string[] = [];
  const to = f.arrival.airportName ?? f.arrival.airportIata ?? "?";
  const when = dep.scheduled != null ? localHM(dep.scheduled) : "?";
  const moved = args.yourDelay && args.yourDelay >= 5 && dep.best != null ? ` (now ${localHM(dep.best)})` : "";
  lines.push(`✈️ ${f.number} to ${to}, ${when}${moved}${f.model ? ` · ${f.model}` : ""}`);

  const icon = busy.level === "busy" ? "🔴" : busy.level === "normal" ? "🟡" : "🟢";
  lines.push(
    `${icon} Check-in ${busy.level}: ~${n(busy.airlinePax)} Etihad passengers on ${busy.airlineFlights} flights around yours` +
      (busy.a380s ? ` (${busy.a380s} A380${busy.a380s > 1 ? "s" : ""})` : "") +
      `. ~${n(busy.allPax)} people through security in total.`,
  );

  const rIcon = risk.risk === "high" ? "🔴" : risk.risk === "medium" ? "🟡" : "🟢";
  lines.push(`${rIcon} Delay risk ${risk.risk}. ${risk.reasons.join(" ")}`);

  const where = [dep.terminal && `Terminal ${dep.terminal}`, dep.gate && `Gate ${dep.gate}`].filter(Boolean).join(", ");
  if (where) lines.push(`📍 ${where}`);
  lines.push("(Passenger numbers are estimates from aircraft size.)");
  return lines.join("\n");
}
