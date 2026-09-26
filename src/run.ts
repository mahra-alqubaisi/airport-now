// Fetch → analyze → summary. Used by the CLI and the checks.
import { HOME_AIRPORT, HOME_UTC_OFFSET_HOURS } from "./config.js";
import type { Source } from "./aerodatabox.js";
import { airportDelays, busyness, delayMinutes, delayRisk, findInbound, knockOn } from "./analyze.js";
import { parseDepartures, parseFlights } from "./parse.js";
import { summary } from "./summary.js";

const H = 3_600_000;
const localStamp = (ms: number) => new Date(ms + HOME_UTC_OFFSET_HOURS * H).toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm

export async function airportNow(src: Source, flightNumber: string, date: string, now: number) {
  const flights = parseFlights(await src.flight(flightNumber, date));
  const flight = flights.find((f) => f.departure.airportIata === HOME_AIRPORT) ?? flights[0];
  if (!flight || flight.departure.scheduled == null) throw new Error(`Couldn't find ${flightNumber} on ${date}.`);
  const dep = flight.departure.scheduled;

  // One board request covers both "how did the last 2 hours go" and "who's around my flight".
  // The board allows at most 12 hours per request.
  let from = Math.min(now - 2 * H, dep - 2 * H);
  const to = dep + 1 * H;
  if (to - from > 12 * H) from = to - 12 * H;
  const board = parseDepartures(await src.departures(HOME_AIRPORT, localStamp(from), localStamp(to)), HOME_AIRPORT);

  const inbound = flight.reg
    ? findInbound(parseFlights(await src.aircraftDay(flight.reg, date)), HOME_AIRPORT, dep)
    : undefined;

  const yourDelay = delayMinutes(flight);
  const busy = busyness(board, dep, flight.airlineIata ?? "EY");
  const airport = airportDelays(board, now);
  const k = knockOn(inbound, dep, flight.model);
  const risk = delayRisk(yourDelay, k, airport);
  return { flight, board, inbound, knock: k, busy, airport, risk, text: summary({ flight, yourDelay, busy, airport, risk }) };
}
