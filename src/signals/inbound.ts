import type { knockOn } from "../analyze.js";
import type { Signal } from "./types.js";

/** Your aircraft's previous flight: the strongest early warning for your own delay. */
export function inboundSignal(k: ReturnType<typeof knockOn>, aircraftAssigned: boolean, looked: boolean): Signal {
  const base = { id: "inbound", label: "Your plane" };
  if (!aircraftAssigned) {
    return { ...base, level: "unknown", headline: "Plane not assigned yet",
      reasons: ["Airlines usually assign the exact aircraft a few hours before departure."], data: { assigned: false } };
  }
  if (!looked) {
    return { ...base, level: "unknown", headline: "Not checked yet",
      reasons: ["Checked only in the last few hours before departure, to save the free data allowance."], data: { assigned: true } };
  }
  if (!k) {
    return { ...base, level: "ok", headline: "No incoming flight found",
      reasons: ["The plane may already be on the ground in Abu Dhabi."], data: { assigned: true, found: false } };
  }
  if (!k.known) {
    return { ...base, level: "unknown", headline: `${k.inboundNumber} from ${k.from}, no live timing yet`,
      reasons: [], data: { assigned: true, found: true, inbound: k.inboundNumber, from: k.from } };
  }
  const level = k.pushesYourFlightBy >= 30 ? "alert" : k.pushesYourFlightBy >= 10 || k.lateBy >= 20 ? "watch" : "ok";
  const headline = k.lateBy >= 10
    ? `${k.inboundNumber} from ${k.from}, ${k.lateBy} min late`
    : `${k.inboundNumber} from ${k.from}, on time`;
  const reasons = k.pushesYourFlightBy > 0
    ? [`Only ${k.groundMinutes} min on the ground; needs ~${k.turnaround}. Likely pushes your flight ~${k.pushesYourFlightBy} min.`]
    : k.lateBy >= 10 ? [`Still ${k.groundMinutes} min on the ground, enough for the ${k.turnaround}-min turnaround.`] : [];
  return { ...base, level, headline, reasons, data: { ...k, assigned: true, found: true } };
}
