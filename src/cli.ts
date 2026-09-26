// npm run demo                                   → sample data, no key needed
// npx tsx src/cli.ts EY61 2026-09-27              → real data (needs RAPIDAPI_KEY)
//   --raw   save raw responses in ./raw
//   --save  save a snapshot in ./data (history for "what changed" and the replay page)
import { liveSource, mockSource } from "./aerodatabox.js";
import { Budget } from "./budget.js";
import { airportNow } from "./run.js";
import { Store } from "./store.js";
import { liveTraffic, mockTraffic } from "./traffic.js";
import { liveWeather, mockWeather } from "./weather.js";

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const [num, date] = args.filter((a) => !a.startsWith("--"));

try {
  if (flag("--mock")) {
    const r = await airportNow(mockSource(), "EY 999", "2026-10-14", Date.parse("2026-10-14T08:00:00+04:00"),
      { weather: mockWeather(), traffic: mockTraffic() });
    console.log(r.text);
  } else {
    if (!num || !date) throw new Error("Usage: npx tsx src/cli.ts <flight number> <YYYY-MM-DD> [--save] [--raw]");
    const budget = new Budget();
    const tomtom = process.env.TOMTOM_KEY;
    const lat = Number(process.env.ORIGIN_LAT), lon = Number(process.env.ORIGIN_LON);
    const origin = lat && lon ? { lat, lon, label: process.env.ORIGIN_LABEL ?? "home" } : undefined;
    const r = await airportNow(liveSource(flag("--raw"), budget), num, date, Date.now(), {
      store: flag("--save") ? new Store() : undefined,
      weather: liveWeather(),
      traffic: tomtom ? liveTraffic(tomtom) : undefined,
      origin,
    });
    console.log(r.text);
    console.log(`\n(${r.requests} request${r.requests > 1 ? "s" : ""} · ${budget.left()} of 600 free units left this month${flag("--save") ? " · snapshot saved" : ""})`);
  }
} catch (e) {
  console.error("❌", (e as Error).message);
  process.exit(1);
}
