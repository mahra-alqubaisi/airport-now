import { RUSH_WIDEBODIES, WIDEBODY } from "../config.js";
import { busyness } from "../analyze.js";
import type { Flight } from "../types.js";
import type { Signal } from "./types.js";

const n = (x: number) => x.toLocaleString("en-US");

/** How crowded check-in and security will feel around your flight. An estimate from aircraft size. */
export function pressureSignal(board: Flight[], yourDeparture: number, airlineIata = "EY"): Signal {
  const b = busyness(board, yourDeparture, airlineIata);
  const from = yourDeparture - 120 * 60_000, to = yourDeparture + 60 * 60_000;
  const widebodies = board.filter((f) =>
    f.airlineIata === airlineIata && WIDEBODY.test(f.model ?? "") &&
    f.departure.scheduled != null && f.departure.scheduled >= from && f.departure.scheduled <= to).length;
  const rush = widebodies >= RUSH_WIDEBODIES;

  const reasons = [
    `${b.airlineFlights} Etihad flights leave between 2 hours before and 1 hour after yours.`,
    ...(rush ? [`${widebodies} of them are big jets. This is a departure wave.`] : []),
    "Passenger numbers are estimates from aircraft size, not real bookings.",
  ];
  return {
    id: "pressure",
    label: "Airport pressure",
    level: b.level === "busy" || rush ? "watch" : "ok",
    headline: `Check-in ${b.level}${rush ? " (departure wave)" : ""}: ~${n(b.airlinePax)} Etihad passengers on ${b.airlineFlights} flights` +
      (b.a380s ? ` (${b.a380s} A380${b.a380s > 1 ? "s" : ""})` : "") + `, ~${n(b.allPax)} through security`,
    reasons,
    data: { ...b, widebodies, rush },
  };
}
