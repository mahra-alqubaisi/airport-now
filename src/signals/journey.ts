// Your personal airport timeline: what closes when, how long each step should take today, and what to do now.
import { ETIHAD, QUEUES, US_AIRPORTS, type Profile } from "../config.js";
import { localHM } from "../summary.js";
import type { Signal } from "./types.js";

type Busy = "quiet" | "normal" | "busy";
const MIN = 60_000;

export interface JourneyInput {
  now: number;
  departure: number;
  destinationIata?: string;
  destinationCountry?: string;
  busy: Busy;
  walkMinutes: number;
  trafficMinutes: number | null;
  profile: Profile;
}

export function journeySignal(i: JourneyInput): Signal {
  const p = i.profile;
  const us = i.destinationCountry === "US" || US_AIRPORTS.includes(i.destinationIata ?? "");
  const premium = p.cabin !== "economy";
  const at = (minsBefore: number) => i.departure - minsBefore * MIN;

  // Deadlines (Etihad's rules)
  const gateCloses = at(ETIHAD.gateClose);
  const deskCloses = at(us ? ETIHAD.us.counterClose : ETIHAD.counterClose[p.cabin]);
  const preclearanceBy = us ? at(ETIHAD.us.preclearance[p.cabin]) : null;
  const deskOpens = at(ETIHAD.countersOpenHours * 60);
  const onlineOpens = at(ETIHAD.onlineCheckInOpensHours * 60);

  // Today's step times
  const needsDesk = p.bags === "checked" || !p.checkedInOnline;
  const deskQueue = !needsDesk ? 0
    : premium ? QUEUES.premium[i.busy]
    : p.checkedInOnline ? QUEUES.bagDrop[i.busy] : QUEUES.counter[i.busy];
  const security = Math.max(5, QUEUES.security[i.busy] - (p.eGate ? QUEUES.eGateSaves : 0));
  const pre = us ? QUEUES.usPreclearance[i.busy] : 0;

  // Work backwards from the gate, then respect every deadline on the way.
  let arriveBy = gateCloses - (p.gateBufferMinutes + i.walkMinutes + pre + security + deskQueue + QUEUES.kerbToDesk) * MIN;
  if (needsDesk) arriveBy = Math.min(arriveBy, deskCloses - (deskQueue + QUEUES.kerbToDesk) * MIN);
  if (preclearanceBy) arriveBy = Math.min(arriveBy, preclearanceBy - (security + deskQueue + QUEUES.kerbToDesk) * MIN);
  if (needsDesk) arriveBy = Math.max(arriveBy, deskOpens); // no point arriving before the desks open
  const leaveBy = i.trafficMinutes != null ? arriveBy - i.trafficMinutes * MIN : null;

  const actions: string[] = [];
  let level: Signal["level"] = "ok";
  if (!p.checkedInOnline && i.now >= onlineOpens && i.now < deskCloses) {
    actions.push("Online check-in is open. Do it now to use the faster bag drop.");
    level = "watch";
  }
  if (i.now > arriveBy) {
    level = i.now > (needsDesk ? deskCloses : gateCloses) - 5 * MIN ? "alert" : "watch";
    actions.push(needsDesk && i.now > deskCloses ? "Check-in has closed." : "You're past the ideal time to be at the airport. Go now.");
  }

  const steps = [
    needsDesk ? `${p.checkedInOnline ? "Bag drop" : "Check-in desk"} ~${deskQueue} min` : "No desk needed (online, hand luggage)",
    `security & immigration ~${security} min${p.eGate ? " (e-gates)" : ""}`,
    ...(us ? [`US preclearance ~${pre} min`] : []),
    `walk ~${i.walkMinutes} min`,
  ];
  return {
    id: "journey",
    label: "Your timing",
    level,
    headline: `Be at the airport by ${localHM(arriveBy)}${leaveBy != null ? ` (leave by ${localHM(leaveBy)})` : ""}`,
    reasons: [
      ...actions,
      `${steps.join(", ")}, ${p.gateBufferMinutes} min spare at the gate.`,
      `${needsDesk ? `${us ? "US check-in" : "Check-in"} closes ${localHM(deskCloses)}, ` : ""}${preclearanceBy ? `preclearance by ${localHM(preclearanceBy)}, ` : ""}gate closes ${localHM(gateCloses)}.`,
      "Queue times are rough estimates for how busy it is.",
    ],
    data: { arriveBy, leaveBy, deskCloses: needsDesk ? deskCloses : null, gateCloses, preclearanceBy, deskQueue, security, preclearance: pre, walk: i.walkMinutes, us, busy: i.busy, profile: p },
  };
}
