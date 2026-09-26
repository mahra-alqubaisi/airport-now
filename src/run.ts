// One check: fetch the data it needs (as cheaply as possible), build every signal, save a snapshot.
import { DEMO_PROFILE, type Profile, DEFAULT_ORIGIN, HOME_AIRPORT, HOME_AIRPORT_COORDS, HOME_UTC_OFFSET_HOURS, INBOUND_LOOKAHEAD_HOURS, TRAFFIC_LOOKAHEAD_HOURS } from "./config.js";
import type { Source } from "./aerodatabox.js";
import { airportDelays, delayMinutes, delayRisk, findInbound, knockOn } from "./analyze.js";
import { parseDepartures, parseFlights } from "./parse.js";
import { airportSignal } from "./signals/airport.js";
import { delaySignal } from "./signals/delay.js";
import { flightSignal } from "./signals/flight.js";
import { gateSignal } from "./signals/gate.js";
import { journeySignal } from "./signals/journey.js";
import { inboundSignal } from "./signals/inbound.js";
import { pressureSignal } from "./signals/pressure.js";
import { trafficSignal } from "./signals/traffic.js";
import { destinationWeatherSignal, homeWeatherSignal } from "./signals/weather.js";
import type { TrafficSource } from "./traffic.js";
import type { Forecast, WeatherSource } from "./weather.js";
import type { Signal } from "./signals/types.js";
import type { Snapshot, Store } from "./store.js";
import { summary } from "./summary.js";
import type { Flight } from "./types.js";

const H = 3_600_000;
const local = (ms: number) => new Date(ms + HOME_UTC_OFFSET_HOURS * H).toISOString();
const stamp = (ms: number) => local(ms).slice(0, 16);   // YYYY-MM-DDTHH:mm, what the board wants
const norm = (s: string) => s.replace(/\s+/g, "").toUpperCase();

export interface Options {
  store?: Store;
  weather?: WeatherSource;
  traffic?: TrafficSource;
  origin?: { lat: number; lon: number; label: string };
  profile?: Profile;
}

/** Great-circle distance in km. */
function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Free sources can fail; a failed extra signal must never break the check. */
async function safely<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

export async function airportNow(src: Source, flightNumber: string, date: string, now: number, opts: Options = {}) {
  const { store } = opts;
  let requests = 0;
  const call = <T>(p: Promise<T>) => { requests++; return p; };

  // 1. The departures board from 2h ago to 10h ahead: usually contains your flight too, so one request often does it all.
  const board = parseDepartures(await call(src.departures(HOME_AIRPORT, stamp(now - 2 * H), stamp(now + 10 * H))), HOME_AIRPORT);
  let flight: Flight | undefined = board.find((f) =>
    norm(f.number) === norm(flightNumber) && f.departure.scheduled != null && local(f.departure.scheduled).slice(0, 10) === date);

  // 2. Not on the board (e.g. days away): ask for the flight directly.
  if (!flight) {
    const found = parseFlights(await call(src.flight(flightNumber, date)));
    flight = found.find((f) => f.departure.airportIata === HOME_AIRPORT) ?? found[0];
  }
  if (!flight || flight.departure.scheduled == null) throw new Error(`Couldn't find ${flightNumber} on ${date}.`);
  const dep = flight.departure.scheduled;

  // 3. Board around your departure: reuse the first one if it already covers it.
  const covered = dep >= now && dep <= now + 9 * H;
  const around = covered ? board
    : parseDepartures(await call(src.departures(HOME_AIRPORT, stamp(dep - 2 * H), stamp(dep + H))), HOME_AIRPORT);

  // 4. Your plane's previous flight: only when assigned and departure is close.
  const assigned = Boolean(flight.reg);
  const looked = assigned && dep - now <= INBOUND_LOOKAHEAD_HOURS * H && dep > now - H;
  const inbound = looked ? findInbound(parseFlights(await call(src.aircraftDay(flight.reg!, date))), HOME_AIRPORT, dep) : undefined;

  // 5. Signals.
  const yourDelay = delayMinutes(flight);
  const k = looked ? knockOn(inbound, dep, flight.model) : null;
  const airport = airportDelays(board, now);
  const inboundSig = inboundSignal(k, assigned, looked);
  const airportSig = airportSignal(airport);
  const missing = [
    ...(inboundSig.level === "unknown" ? ["your plane"] : []),
    ...(airportSig.level === "unknown" ? ["how other departures are running"] : []),
  ];
  // 6. Weather at both ends (free, no allowance used).
  const city = flight.arrival.airportName ?? flight.arrival.airportIata ?? "Destination";
  let homeWx: Forecast | null = null, destWx: Forecast | null = null, landing: number | null = null, estimated = false;
  if (opts.weather) {
    const w = opts.weather;
    const destCoords = flight.arrival.lat != null && flight.arrival.lon != null
      ? { lat: flight.arrival.lat, lon: flight.arrival.lon }
      : await safely(w.locate(city, flight.arrival.countryCode));
    landing = flight.arrival.scheduled ?? null;
    if (landing == null && destCoords) {
      // Not in the data: estimate from distance. Planes don't fly the straight line (+6%), ~830 km/h,
      // plus 35 min for taxi, climb and approach. Checked against EY 61's real schedule (7h40 to London).
      landing = dep + Math.round(((distanceKm(HOME_AIRPORT_COORDS, destCoords) * 1.06) / 830) * 60 + 35) * 60_000;
      estimated = true;
    }
    [homeWx, destWx] = await Promise.all([
      safely(w.forecast(HOME_AIRPORT_COORDS.lat, HOME_AIRPORT_COORDS.lon)),
      destCoords ? safely(w.forecast(destCoords.lat, destCoords.lon)) : Promise.resolve(null),
    ]);
  }
  const homeWxSig = homeWeatherSignal(homeWx, dep);
  const destWxSig = destinationWeatherSignal(destWx, city, landing, estimated, (homeWxSig.data as { tempC?: number }).tempC ?? null);

  // 7. Traffic, only close to leaving.
  let trafficSig: Signal | undefined;
  if (opts.traffic) {
    const origin = opts.origin ?? DEFAULT_ORIGIN;
    trafficSig = dep - now > TRAFFIC_LOOKAHEAD_HOURS * H
      ? trafficSignal(null, origin.label, `Checked in the last ${TRAFFIC_LOOKAHEAD_HOURS} hours before departure`)
      : trafficSignal(await safely(opts.traffic.route(origin, HOME_AIRPORT_COORDS)), origin.label, "Traffic service didn't answer");
  }

  // 8. Delay risk, now including weather.
  const risk = delayRisk(yourDelay, k && k.known ? k : null, airport);
  if (homeWxSig.level === "alert") {
    risk.risk = risk.risk === "low" ? "medium" : "high";
    risk.reasons.push(`Weather in Abu Dhabi: ${homeWxSig.reasons[0]}`);
  }
  if (destWxSig.level === "watch") risk.reasons.push(`Weather at ${city}: ${destWxSig.reasons[0]}`);

  // 9. Gate walk and your personal timing.
  const pressureSig = pressureSignal(around, dep, flight.airlineIata ?? "EY");
  const pd = pressureSig.data as { level: "quiet" | "normal" | "busy"; rush: boolean };
  const gateSig = gateSignal(flight.departure.gate, flight.departure.terminal);
  const journeySig = journeySignal({
    now, departure: dep,
    destinationIata: flight.arrival.airportIata, destinationCountry: flight.arrival.countryCode,
    busy: pd.rush ? "busy" : pd.level,
    walkMinutes: (gateSig.data as { walkMinutes: number }).walkMinutes,
    trafficMinutes: trafficSig && trafficSig.level !== "unknown" ? (trafficSig.data as { minutes: number }).minutes : null,
    profile: opts.profile ?? DEMO_PROFILE,
  });

  const signals: Signal[] = [
    flightSignal(flight, yourDelay),
    journeySig,
    pressureSig,
    delaySignal(risk, missing),
    inboundSig,
    airportSig,
    gateSig,
    ...(opts.weather ? [homeWxSig, destWxSig] : []),
    ...(trafficSig ? [trafficSig] : []),
  ];

  const snapshot: Snapshot = { takenAt: new Date(now).toISOString(), flight: flight.number, date, signals, unitsUsed: requests * 2 };
  store?.save(snapshot);
  return { flight, signals, snapshot, requests, text: summary(signals) };
}
