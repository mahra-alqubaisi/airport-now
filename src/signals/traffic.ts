import type { Route } from "../traffic.js";
import type { Signal } from "./types.js";

export function trafficSignal(r: Route | null, from: string, why?: string): Signal {
  const base = { id: "traffic", label: "Traffic to AUH" };
  if (!r) return { ...base, level: "unknown", headline: why ?? "Not checked", reasons: [], data: { from } };
  const usual = r.usualMinutes ?? r.freeFlowMinutes;
  const extra = usual != null ? r.minutes - usual : r.delayMinutes;
  const level = extra >= 30 ? "alert" : extra >= 10 ? "watch" : "ok";
  return {
    ...base, level,
    headline: `From ${from}: ${r.minutes} min${usual != null ? ` (usually ${usual})` : ""}`,
    reasons: extra >= 10 ? [`${extra} min slower than usual right now.`] : [],
    data: { ...r, from, extraMinutes: extra },
  };
}
