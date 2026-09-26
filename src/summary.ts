import { HOME_UTC_OFFSET_HOURS } from "./config.js";
import type { Level, Signal } from "./signals/types.js";

export const localHM = (ms: number) =>
  new Date(ms + HOME_UTC_OFFSET_HOURS * 3_600_000).toISOString().slice(11, 16);

const icon: Record<Level, string> = { ok: "🟢", watch: "🟡", alert: "🔴", unknown: "⚪" };
const special: Record<string, string> = { journey: "⏰", gate: "🚶" };

/** Plain-text view of all signals, for the terminal. */
export function summary(signals: Signal[]) {
  const by = (id: string) => signals.find((s) => s.id === id);
  const lines: string[] = [];
  const f = by("flight");
  if (f) lines.push(`✈️ ${f.headline}`);
  for (const id of ["journey", "pressure", "delay", "inbound", "airport", "gate", "traffic", "weatherHome", "weatherDest"]) {
    const s = by(id);
    if (!s) continue;
    // Keep the terminal view short: the dashboard shows every reason.
    const why = id === "pressure" ? s.reasons.filter((r) => r.includes("departure wave"))
      : id === "journey" ? s.reasons.filter((r) => !r.startsWith("Queue times"))
      : id === "delay" ? s.reasons.filter((r) => !r.startsWith("Airport running normally"))
      : s.reasons;
    const prefix = ["pressure", "delay", "journey", "gate"].includes(id) ? "" : `${s.label}: `;
    lines.push(`${s.level === "ok" || s.level === "unknown" ? special[id] ?? icon[s.level] : icon[s.level]} ${prefix}${s.headline}${why.length ? `. ${why.join(" ")}` : ""}`);
  }
  lines.push("(Passenger numbers are estimates from aircraft size.)");
  return lines.join("\n");
}
