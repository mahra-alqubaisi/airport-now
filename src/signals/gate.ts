import { WALK } from "../config.js";
import type { Signal } from "./types.js";

/** Walking time from security to a gate, from our own table. */
export function walkMinutes(gate: string | null | undefined): { minutes: number; bus: boolean; known: boolean } {
  if (!gate) return { minutes: WALK.unknownGate, bus: false, known: false };
  const m = /^([A-Z])\s*-?\s*(\d+)/i.exec(gate.trim());
  if (!m) return { minutes: WALK.unknownGate, bus: false, known: false };
  const pier = m[1].toUpperCase(), num = Number(m[2]);
  if (pier === "E" || pier === "F") return { minutes: WALK.busGate, bus: true, known: true };
  const row = WALK.byNumber.find((r) => num <= r.upTo)!;
  return { minutes: row.minutes, bus: false, known: true };
}

export function gateSignal(gate: string | null | undefined, terminal: string | null | undefined): Signal {
  const w = walkMinutes(gate);
  const where = [terminal && `Terminal ${terminal}`, gate && `Gate ${gate}`].filter(Boolean).join(", ");
  if (!w.known) {
    return { id: "gate", label: "Gate", level: "unknown", headline: `${where || "Terminal A"}: gate not announced yet`,
      reasons: [`Assuming ~${w.minutes} min walk from security until it is.`], data: { gate: gate ?? null, walkMinutes: w.minutes, known: false } };
  }
  const far = w.bus || w.minutes >= WALK.farWalk;
  return {
    id: "gate", label: "Gate", level: far ? "watch" : "ok",
    headline: `${where}: ~${w.minutes} min walk from security${w.bus ? " + bus to the plane" : ""}`,
    reasons: far ? [w.bus ? "Bus gate: boarding takes longer." : "One of the far gates."] : [],
    data: { gate, walkMinutes: w.minutes, bus: w.bus, known: true },
  };
}
