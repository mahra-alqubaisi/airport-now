// Shows the next Etihad departures from Abu Dhabi, so you can pick a real flight number.
//   npx tsx src/list.ts            → next 12 hours (1 request)
//   npx tsx src/list.ts --mock     → sample data
import { HOME_AIRPORT, HOME_UTC_OFFSET_HOURS } from "./config.js";
import { liveSource, mockSource } from "./aerodatabox.js";
import { Budget } from "./budget.js";
import { parseDepartures } from "./parse.js";
import { localHM } from "./summary.js";

const H = 3_600_000;
const stamp = (ms: number) => new Date(ms + HOME_UTC_OFFSET_HOURS * H).toISOString().slice(0, 16);
const dateOf = (ms: number) => new Date(ms + HOME_UTC_OFFSET_HOURS * H).toISOString().slice(0, 10);

const mock = process.argv.includes("--mock");
const now = mock ? Date.parse("2026-10-14T08:00:00+04:00") : Date.now();

try {
  const src = mock ? mockSource() : liveSource(process.argv.includes("--raw"), new Budget());
  const board = parseDepartures(await src.departures(HOME_AIRPORT, stamp(now), stamp(now + 12 * H - 60_000)), HOME_AIRPORT);
  const ey = board
    .filter((f) => f.airlineIata === "EY" && f.departure.scheduled != null && f.departure.scheduled >= now)
    .sort((a, b) => a.departure.scheduled! - b.departure.scheduled!);

  if (!ey.length) {
    console.log("No Etihad departures found in the next 12 hours.");
  } else {
    console.log(`Next Etihad departures from Abu Dhabi (${ey.length}):\n`);
    for (const f of ey) {
      const t = f.departure.scheduled!;
      const to = f.arrival.airportName ?? f.arrival.airportIata ?? "?";
      console.log(`${dateOf(t)}  ${localHM(t)}  ${f.number.padEnd(8)} ${to.padEnd(18)} ${f.model ?? ""}`);
    }
    const first = ey[0];
    console.log(`\nTry one:  npx tsx src/cli.ts ${first.number.replace(/\s+/g, "")} ${dateOf(first.departure.scheduled!)} --raw`);
  }
} catch (e) {
  console.error("❌", (e as Error).message);
  process.exit(1);
}
