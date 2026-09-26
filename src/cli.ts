// npm run demo                       → sample data, no key needed
// npm run live -- EY19 2026-10-14    → real data (needs RAPIDAPI_KEY)
//   add --raw to save the raw responses in ./raw for debugging
import { liveSource, mockSource } from "./aerodatabox.js";
import { airportNow } from "./run.js";

const args = process.argv.slice(2);
const mock = args.includes("--mock");
const raw = args.includes("--raw");
const [num, date] = args.filter((a) => !a.startsWith("--"));

try {
  const result = mock
    ? await airportNow(mockSource(), "EY 999", "2026-10-14", Date.parse("2026-10-14T08:00:00+04:00"))
    : await (async () => {
        if (!num || !date) throw new Error("Usage: npm run live -- <flight number> <YYYY-MM-DD>");
        return airportNow(liveSource(raw), num, date, Date.now());
      })();
  console.log(result.text);
} catch (e) {
  console.error("❌", (e as Error).message);
  process.exit(1);
}
