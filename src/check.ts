import { mockWeather, parseForecast, type WeatherSource } from "./weather.js";
import { mockTraffic } from "./traffic.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Budget } from "./budget.js";
import { Store } from "./store.js";
// Scenario checks for the thinking part. No network.
import { airportDelays, busyness, delayRisk, findInbound, knockOn, seatsFor } from "./analyze.js";
import { parseDepartures, parseFlights } from "./parse.js";
import { mockSource } from "./aerodatabox.js";
import { airportNow } from "./run.js";
import type { Flight } from "./types.js";

let failed = 0;
const ok = (c: boolean, m: string) => { console.log(c ? "  PASS " : "  FAIL ", m); if (!c) failed++; };
const T = (hhmm: string) => Date.parse(`2026-10-14T${hhmm}:00+04:00`);
const MIN = 60_000;

const inbound = (sched: string, actualLate: number): Flight => ({
  number: "EY 998", departure: { airportIata: "LHR", airportName: "London" },
  arrival: { airportIata: "AUH", scheduled: T(sched), best: T(sched) + actualLate * MIN, live: true },
});
const board = (lates: number[]): Flight[] => lates.map((d, i) => ({
  number: `X ${i}`, departure: { scheduled: T("06:00") + i * 10 * MIN, best: T("06:00") + i * 10 * MIN + d * MIN, live: true },
  arrival: {},
}));

console.log("Aircraft sizes");
ok(seatsFor("Boeing 777-300ER") === 350 && seatsFor("Boeing 777-9") === 400, "777-300ER vs 777-9 told apart");
ok(seatsFor("Airbus A350-1000") === 371 && seatsFor("Airbus A350-900") === 330, "A350-1000 vs A350-900 told apart");
ok(seatsFor(undefined) === 200 && seatsFor("Mystery Jet") === 200, "unknown model falls back to 200");

console.log("Incoming plane");
const dep = T("11:40");
ok(knockOn(inbound("08:00", 35), dep, "Boeing 787-9")!.pushesYourFlightBy === 0,
  "35 min late but lands 08:35 → 3h on the ground → no knock-on");
ok(knockOn(inbound("10:10", 35), dep, "Boeing 787-9")!.pushesYourFlightBy === 20,
  "35 min late, lands 10:45, needs 75 min → pushes you ~20 min");
ok(knockOn(inbound("10:10", 35), dep, "Airbus A320")!.pushesYourFlightBy === 0,
  "same timing on a small jet (45 min turnaround) → fine");
ok(knockOn(undefined, dep) === null, "no incoming flight known → no guess");
const legs: Flight[] = [
  { number: "A", departure: {}, arrival: { airportIata: "AUH", scheduled: T("04:00") } },
  { number: "B", departure: {}, arrival: { airportIata: "AUH", scheduled: T("10:00") } },
  { number: "C", departure: {}, arrival: { airportIata: "AUH", scheduled: T("13:00") } },
  { number: "D", departure: {}, arrival: { airportIata: "LHR", scheduled: T("11:00") } },
];
ok(delayRisk(null, knockOn({ ...inbound("10:10", 0), arrival: { airportIata: "AUH", scheduled: T("10:10") } }, dep), airportDelays([], T("08:00")))
  .reasons[0].includes("No live timing"), "incoming plane found but no live time → says so, doesn't guess");
ok(findInbound(legs, "AUH", dep)?.number === "B", "picks the latest arrival into AUH before your flight, ignores later ones");

console.log("Delay risk");
const calm = airportDelays(board([0, 5, 20, 0, 0, 3]), T("08:00"));
const bad = airportDelays(board([45, 30, 0, 60, 25, 0]), T("08:00"));
ok(calm.late === 1 && calm.checked === 6, "calm day counted: 1 of 6 late");
ok(bad.late === 4 && bad.avgLateMinutes === 40, "bad day counted: 4 of 6 late, avg 40");
ok(delayRisk(null, knockOn(inbound("08:00", 35), dep, "787"), calm).risk === "low", "late plane with lots of ground time + calm airport → low");
ok(delayRisk(null, knockOn(inbound("10:10", 35), dep, "787"), calm).risk === "medium", "tight turnaround → medium");
ok(delayRisk(null, knockOn(inbound("10:10", 35), dep, "787"), bad).risk === "high", "tight turnaround + bad airport day → high");
ok(delayRisk(null, knockOn(inbound("10:30", 60), dep, "787"), calm).risk === "high", "plane 60 min late, lands 11:30 → high");
ok(delayRisk(25, null, calm).risk === "high", "your own flight already 25 min late → high");
ok(delayRisk(null, null, airportDelays([], T("08:00"))).reasons[0] === "Nothing unusual so far.", "no data at all → low, says so");

console.log("Missing data is not good news");
ok(delayRisk(null, null, airportDelays([], T("08:00")), false).reasons[0].startsWith("Your exact plane isn't assigned yet"),
  "plane not assigned yet (real case: EY 61, 4h before) → says so");
const unknown: Flight[] = Array.from({ length: 10 }, (_, i) => ({
  number: `U ${i}`, departure: { scheduled: T("06:30") + i * 5 * MIN, best: T("06:30") + i * 5 * MIN }, arrival: {},
}));
const u = airportDelays(unknown, T("08:00"));
ok(u.recent === 10 && u.checked === 0, "10 departures without live times → 0 counted, not 10 on time");
ok(delayRisk(null, null, u).reasons[0].startsWith("Can't judge the airport yet"), "says it can't judge instead of 'running normally'");
const mixed = airportDelays([...unknown, ...board([0, 30, 0])], T("08:00"));
ok(mixed.checked === 3 && mixed.late === 1, "mixed board: only the 3 with live times are counted");

console.log("Messy data");
ok(parseFlights(null).length === 0 && parseDepartures({}, "AUH").length === 0, "empty responses don't crash");
const half = parseFlights([{ number: "EY  19", departure: { airport: { iata: "AUH" } }, arrival: {} }]);
ok(half[0].number === "EY 19" && half[0].departure.scheduled === undefined, "missing times stay missing, not zero");
ok(busyness([], dep).level === "quiet", "empty board → quiet, no crash");

console.log("Full sample run");
const counting = () => {
  const src = mockSource(); const calls: string[] = [];
  return { calls, src: {
    flight: (a: string, b: string) => { calls.push("flight"); return src.flight(a, b); },
    aircraftDay: (a: string, b: string) => { calls.push("aircraft"); return src.aircraftDay(a, b); },
    departures: (a: string, b: string, c: string) => { calls.push("board"); return src.departures(a, b, c); },
  } };
};
const sig = (r: { signals: { id: string }[] }, id: string) => r.signals.find((x) => x.id === id) as any;
const c1 = counting();
const r = await airportNow(c1.src, "EY 999", "2026-10-14", T("08:00"));
ok(sig(r, "pressure").data.airlineFlights === 9 && sig(r, "pressure").data.a380s === 2, "9 Etihad flights around yours, 2 A380s (the 09:10 one excluded)");
ok(sig(r, "inbound").data.pushesYourFlightBy === 20 && sig(r, "delay").data.risk === "medium", "sample trip: medium risk from the late incoming plane");
ok(r.signals.map((x) => x.id).join() === "flight,pressure,delay,inbound,airport", "five signals, same shape, fixed order");

console.log("Saving the free allowance");
ok(c1.calls.join() === "board,aircraft", "flight found on the board: no separate flight lookup (2 requests, not 3)");
const c2 = counting();
const early = await airportNow(c2.src, "EY 999", "2026-10-14", T("08:00") - 26 * 60 * MIN);
ok(c2.calls.join() === "board,flight,board", "flight a day away: looks it up, fetches the board around it, skips the plane");
ok(sig(early, "inbound").headline === "Not checked yet", "says the plane wasn't checked yet, and why");
ok(sig(early, "delay").headline === "Delay risk low so far", "risk says 'so far' while pieces are missing");

const dir = mkdtempSync(join(tmpdir(), "airport-now-"));
const budget = new Budget(dir, () => new Date("2026-09-26T12:00:00Z"));
ok(budget.left() === 600, "new month starts with 600 units");
for (let i = 0; i < 290; i++) budget.spend(1);
ok(budget.left() === 20 && !budget.canSpend(1), "stops at the 20-unit reserve instead of running dry");
ok(new Budget(dir, () => new Date("2026-10-01T00:00:00Z")).left() === 600, "resets when the month changes");

console.log("Snapshots");
const store = new Store(dir);
await airportNow(mockSource(), "EY 999", "2026-10-14", T("08:00"), { store });
await airportNow(mockSource(), "EY 999", "2026-10-14", T("09:00"), { store });
ok(store.history("EY 999", "2026-10-14").length === 2, "every check is kept in the flight's history");
ok(store.previous("EY 999", "2026-10-14")!.takenAt === new Date(T("09:00")).toISOString(), "previous() returns the latest check");

console.log("Weather and traffic");
const wxWith = (auh: (h: number) => [number, number, number, number]): WeatherSource => ({
  // [weather code, visibility m, gust km/h, temp C] per local hour on 14 Oct in Abu Dhabi; London from the sample
  forecast: async (lat) => lat < 35
    ? parseForecast({ utc_offset_seconds: 14400, hourly: {
        time: Array.from({ length: 24 }, (_, h) => `2026-10-14T${String(h).padStart(2, "0")}:00`),
        weather_code: Array.from({ length: 24 }, (_, h) => auh(h)[0]), visibility: Array.from({ length: 24 }, (_, h) => auh(h)[1]),
        wind_gusts_10m: Array.from({ length: 24 }, (_, h) => auh(h)[2]), temperature_2m: Array.from({ length: 24 }, (_, h) => auh(h)[3]),
        precipitation_probability: Array(24).fill(0) } })
    : mockWeather().forecast(lat, 0),
  locate: mockWeather().locate,
});
const w1 = await airportNow(mockSource(), "EY 999", "2026-10-14", T("08:00"), { weather: mockWeather() });
ok(sig(w1, "weatherHome").level === "ok" && sig(w1, "weatherHome").headline.includes("clear"), "sample: morning haze has cleared by 11:40 → fine");
ok(sig(w1, "weatherDest").reasons.some((r: string) => r.includes("jacket")) && sig(w1, "weatherDest").reasons.some((r: string) => r.includes("Umbrella")),
  "London at landing: much colder and rainy → jacket + umbrella");
ok(sig(w1, "weatherDest").headline.includes("~"), "landing time estimated from distance is marked with ~");
const fog = await airportNow(mockSource(), "EY 999", "2026-10-14", T("08:00"), { weather: wxWith(() => [45, 400, 10, 29]) });
ok(sig(fog, "weatherHome").level === "alert", "fog at departure (400 m) → alert");
ok(sig(fog, "delay").data.risk === "high" && sig(fog, "delay").reasons.some((r: string) => r.startsWith("Weather in Abu Dhabi")),
  "fog pushes delay risk up a level (medium → high) and says why");
const dust = await airportNow(mockSource(), "EY 999", "2026-10-14", T("08:00"), { weather: wxWith(() => [3, 2200, 65, 41]) });
ok(sig(dust, "weatherHome").level === "watch" && sig(dust, "delay").data.risk === "medium", "dusty and gusty → worth knowing, but doesn't change risk");
const broken: WeatherSource = { forecast: async () => { throw new Error("down"); }, locate: async () => { throw new Error("down"); } };
const nb = await airportNow(mockSource(), "EY 999", "2026-10-14", T("08:00"), { weather: broken });
ok(sig(nb, "weatherHome").level === "unknown" && sig(nb, "delay").data.risk === "medium", "weather service down → shown as unknown, check still works");
const t1 = await airportNow(mockSource(), "EY 999", "2026-10-14", T("08:00"), { traffic: mockTraffic({ minutes: 41, usualMinutes: 22 }) });
ok(sig(t1, "traffic").level === "watch" && sig(t1, "traffic").reasons[0].startsWith("19 min slower"), "traffic 19 min worse than usual → worth knowing");
const t2 = await airportNow(mockSource(), "EY 999", "2026-10-14", T("08:00") - 26 * 60 * MIN, { traffic: mockTraffic() });
ok(sig(t2, "traffic").level === "unknown", "flight a day away → traffic not checked yet (it would be meaningless)");

console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
process.exit(failed ? 1 : 0);
