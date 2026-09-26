// All the thinking. Pure functions, no network, fully testable.
import {
  BUSY_LEVELS, DELAYED_IF_MINUTES, LOAD_FACTOR, SEATS, SEATS_UNKNOWN, TURNAROUND_MIN, WIDEBODY,
} from "./config.js";
import type { Flight } from "./types.js";

const MIN = 60_000;
const mins = (ms: number) => Math.round(ms / MIN);

export function seatsFor(model?: string): number {
  if (!model) return SEATS_UNKNOWN;
  for (const [re, n] of SEATS) if (re.test(model)) return n;
  return SEATS_UNKNOWN;
}
export const passengers = (model?: string) => Math.round(seatsFor(model) * LOAD_FACTOR);

export function delayMinutes(f: Flight): number | null {
  const d = f.departure;
  if (d.scheduled == null || d.best == null) return null;
  return mins(d.best - d.scheduled);
}

/** Who else is in the terminal around your time: flights leaving 2h before to 1h after yours. */
export function busyness(board: Flight[], yourDeparture: number, airlineIata = "EY") {
  const from = yourDeparture - 120 * MIN, to = yourDeparture + 60 * MIN;
  const inWindow = board.filter((f) => f.departure.scheduled != null && f.departure.scheduled >= from && f.departure.scheduled <= to);
  const airline = inWindow.filter((f) => f.airlineIata === airlineIata);
  const airlinePax = airline.reduce((s, f) => s + passengers(f.model), 0);
  const allPax = inWindow.reduce((s, f) => s + passengers(f.model), 0);
  const bigJets = airline.filter((f) => /A380/i.test(f.model ?? "")).length;
  const level = airlinePax >= BUSY_LEVELS.busy ? "busy" : airlinePax < BUSY_LEVELS.quiet ? "quiet" : "normal";
  return { level, airlineFlights: airline.length, airlinePax, allFlights: inWindow.length, allPax, a380s: bigJets };
}

/** How the airport is doing today: departures in the last 2 hours. */
export function airportDelays(board: Flight[], now: number) {
  const recent = board.filter((f) => f.departure.scheduled != null && f.departure.scheduled >= now - 120 * MIN && f.departure.scheduled <= now);
  const known = recent.map(delayMinutes).filter((d): d is number => d != null);
  const late = known.filter((d) => d >= DELAYED_IF_MINUTES);
  return {
    checked: known.length,
    late: late.length,
    share: known.length ? late.length / known.length : 0,
    avgLateMinutes: late.length ? Math.round(late.reduce((a, b) => a + b, 0) / late.length) : 0,
  };
}

/** The same aircraft's last flight into our airport before your departure. */
export function findInbound(aircraftDay: Flight[], homeIata: string, yourDeparture: number): Flight | undefined {
  return aircraftDay
    .filter((f) => f.arrival.airportIata === homeIata && f.arrival.scheduled != null && f.arrival.scheduled < yourDeparture)
    .sort((a, b) => b.arrival.scheduled! - a.arrival.scheduled!)[0];
}

/**
 * If the incoming plane lands late, does that actually push your flight?
 * Only if it leaves less than the minimum turnaround time on the ground.
 */
export function knockOn(inbound: Flight | undefined, yourScheduled: number, model?: string) {
  if (!inbound || inbound.arrival.best == null || inbound.arrival.scheduled == null) return null;
  const lateBy = mins(inbound.arrival.best - inbound.arrival.scheduled);
  const turn = WIDEBODY.test(model ?? "") ? TURNAROUND_MIN.widebody : TURNAROUND_MIN.narrowbody;
  const earliestOut = inbound.arrival.best + turn * MIN;
  return {
    inboundNumber: inbound.number,
    from: inbound.departure.airportName ?? inbound.departure.airportIata ?? "?",
    lateBy,
    groundMinutes: mins(yourScheduled - inbound.arrival.best),
    turnaround: turn,
    pushesYourFlightBy: Math.max(0, mins(earliestOut - yourScheduled)),
  };
}

export type Risk = "low" | "medium" | "high";
const up = (r: Risk): Risk => (r === "low" ? "medium" : "high");

export function delayRisk(
  yourDelay: number | null,
  k: ReturnType<typeof knockOn>,
  airport: ReturnType<typeof airportDelays>,
) {
  const reasons: string[] = [];
  let risk: Risk = "low";

  if (yourDelay != null && yourDelay >= DELAYED_IF_MINUTES) {
    return { risk: "high" as Risk, reasons: [`Already showing ${yourDelay} min late.`] };
  }
  if (k) {
    if (k.pushesYourFlightBy >= 30) risk = "high";
    else if (k.pushesYourFlightBy >= 10) risk = "medium";
    if (k.lateBy >= 10) {
      reasons.push(
        k.pushesYourFlightBy > 0
          ? `Your plane is coming from ${k.from} ${k.lateBy} min late, leaving too little ground time. Likely ~${k.pushesYourFlightBy} min delay.`
          : `Your plane is coming from ${k.from} ${k.lateBy} min late, but still has ${k.groundMinutes} min on the ground. Should be fine.`,
      );
    }
  }
  if (airport.checked >= 5 && airport.share >= 0.4 && airport.avgLateMinutes >= 20) {
    risk = up(risk);
    reasons.push(`Bad day at the airport: ${airport.late} of the last ${airport.checked} departures left late (avg ${airport.avgLateMinutes} min).`);
  } else if (airport.checked >= 5) {
    reasons.push(`Airport running normally: ${airport.late} of the last ${airport.checked} departures late.`);
  }
  if (!reasons.length) reasons.push("Nothing unusual so far.");
  return { risk, reasons };
}
