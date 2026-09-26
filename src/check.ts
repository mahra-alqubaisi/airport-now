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
  arrival: { airportIata: "AUH", scheduled: T(sched), best: T(sched) + actualLate * MIN },
});
const board = (lates: number[]): Flight[] => lates.map((d, i) => ({
  number: `X ${i}`, departure: { scheduled: T("06:00") + i * 10 * MIN, best: T("06:00") + i * 10 * MIN + d * MIN },
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

console.log("Messy data");
ok(parseFlights(null).length === 0 && parseDepartures({}, "AUH").length === 0, "empty responses don't crash");
const half = parseFlights([{ number: "EY  19", departure: { airport: { iata: "AUH" } }, arrival: {} }]);
ok(half[0].number === "EY 19" && half[0].departure.scheduled === undefined, "missing times stay missing, not zero");
ok(busyness([], dep).level === "quiet", "empty board → quiet, no crash");

console.log("Full sample run");
const r = await airportNow(mockSource(), "EY 999", "2026-10-14", T("08:00"));
ok(r.busy.airlineFlights === 9 && r.busy.a380s === 2, "9 Etihad flights around yours, 2 A380s (the 09:10 one excluded)");
ok(r.knock?.pushesYourFlightBy === 20 && r.risk.risk === "medium", "sample trip: medium risk from the late incoming plane");

console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
process.exit(failed ? 1 : 0);
