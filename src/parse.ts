// Turns AeroDataBox responses into plain Flight objects.
// Written defensively: any field can be missing.
import type { Flight, Movement } from "./types.js";

function time(t: any): number | undefined {
  const s: string | undefined = t?.utc;
  if (!s) return undefined;
  const ms = Date.parse(s.replace(" ", "T"));
  return Number.isNaN(ms) ? undefined : ms;
}

function movement(m: any): Movement {
  const scheduled = time(m?.scheduledTime);
  const real = time(m?.runwayTime) ?? time(m?.actualTime) ?? time(m?.revisedTime) ?? time(m?.predictedTime);
  return {
    airportIata: m?.airport?.iata,
    airportName: m?.airport?.municipalityName ?? m?.airport?.name,
    countryCode: m?.airport?.countryCode,
    lat: m?.airport?.location?.lat,
    lon: m?.airport?.location?.lon,
    scheduled,
    best: real ?? scheduled,
    live: real != null,
    terminal: m?.terminal ?? undefined,
    gate: m?.gate ?? undefined,
  };
}

function base(f: any) {
  return {
    number: String(f?.number ?? "?").replace(/\s+/g, " ").trim(),
    airlineIata: f?.airline?.iata,
    airlineName: f?.airline?.name,
    status: f?.status,
    model: f?.aircraft?.model,
    reg: f?.aircraft?.reg,
  };
}

/** Flight status / flights-by-registration responses: departure + arrival objects. */
export function parseFlights(json: any): Flight[] {
  const list = Array.isArray(json) ? json : [];
  return list.map((f) => ({ ...base(f), departure: movement(f.departure), arrival: movement(f.arrival) }));
}

/** Airport board (FIDS) departures: one "movement" at our airport, the other end in movement.airport. */
export function parseDepartures(json: any, homeIata: string): Flight[] {
  const list = Array.isArray(json?.departures) ? json.departures : [];
  return list.map((f: any) => {
    const m = f.movement ?? f.departure ?? {};
    const here = movement(m);
    return {
      ...base(f),
      departure: { ...here, airportIata: homeIata, airportName: undefined },
      arrival: {
        airportIata: m?.airport?.iata, airportName: m?.airport?.municipalityName ?? m?.airport?.name,
        countryCode: m?.airport?.countryCode, lat: m?.airport?.location?.lat, lon: m?.airport?.location?.lon,
      },
    };
  });
}
