// Flight data from AeroDataBox (free plan on RapidAPI), or sample files with --mock.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const HOST = "aerodatabox.p.rapidapi.com";

export interface Source {
  flight(number: string, date: string): Promise<any>;
  aircraftDay(reg: string, date: string): Promise<any>;
  departures(airport: string, fromLocal: string, toLocal: string): Promise<any>;
}

export function mockSource(): Source {
  const load = (f: string) => JSON.parse(readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8"));
  return {
    flight: async () => load("flight.json"),
    aircraftDay: async () => load("aircraft-day.json"),
    departures: async () => load("departures.json"),
  };
}

export function liveSource(saveRaw: boolean): Source {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("Set RAPIDAPI_KEY first (your free AeroDataBox key from RapidAPI).");
  let n = 0;
  async function get(path: string, label: string) {
    const res = await fetch(`https://${HOST}${path}`, {
      headers: { "x-rapidapi-key": key!, "x-rapidapi-host": HOST },
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    if (saveRaw) {
      mkdirSync("raw", { recursive: true });
      writeFileSync(`raw/${++n}-${label}.json`, text);
    }
    if (res.status === 204 || !text) return null;
    if (!res.ok) throw new Error(`AeroDataBox ${res.status} on ${label}: ${text.slice(0, 200)}`);
    return JSON.parse(text);
  }
  const q = "withAircraftImage=false&withLocation=false";
  return {
    flight: (num, date) => get(`/flights/number/${encodeURIComponent(num.replace(/\s+/g, ""))}/${date}?${q}`, "flight"),
    aircraftDay: (reg, date) => get(`/flights/reg/${encodeURIComponent(reg)}/${date}?${q}`, "aircraft-day"),
    departures: (airport, from, to) =>
      get(
        `/flights/airports/iata/${airport}/${from}/${to}?direction=Departure&withLeg=false&withCancelled=true&withCodeshared=false&withCargo=false&withPrivate=false`,
        "departures",
      ),
  };
}
