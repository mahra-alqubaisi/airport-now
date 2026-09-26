import type { delayRisk } from "../analyze.js";
import type { Signal } from "./types.js";

export function delaySignal(r: ReturnType<typeof delayRisk>, missingPieces: string[]): Signal {
  const level = r.risk === "high" ? "alert" : r.risk === "medium" ? "watch" : "ok";
  const sofar = r.risk === "low" && missingPieces.length ? " so far" : "";
  return {
    id: "delay",
    label: "Delay risk",
    level,
    headline: `Delay risk ${r.risk}${sofar}`,
    reasons: [...r.reasons, ...(sofar ? [`Still unknown: ${missingPieces.join(", ")}.`] : [])],
    data: { risk: r.risk, missing: missingPieces },
  };
}
