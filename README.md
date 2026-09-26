# airport-now

A personal airport operations agent. It watches the real operational state of a flight from
Abu Dhabi (the airport, the incoming aircraft, how other departures are running) and explains
what it means for that specific trip.

## How it's built

Each signal is its own module and reports in the same shape (level, headline, reasons, data):

| Signal | What it tells you |
|---|---|
| `flight` | your flight, terminal, gate, and whether it's already running late |
| `pressure` | how crowded check-in will feel: Etihad flights around yours, weighted by aircraft size, and departure waves |
| `inbound` | your aircraft's previous flight: is it late, and does that leave too little time on the ground |
| `airport` | how other AUH departures are running right now |
| `delay` | low / medium / high, with reasons, and "so far" while pieces are still unknown. Fog or storms at AUH raise it a level |
| `weatherHome` | Abu Dhabi at departure time: only what affects operations (fog, dust, low visibility, storms, gusts) |
| `weatherDest` | destination at landing time: storms or gusts that could slow the arrival, plus what to pack |
| `traffic` | drive to AUH vs the usual time for that hour, only in the last 5 hours |

Every check can be saved as a snapshot (`data/history`), which is what "what changed since
last time" and the public replay page are built on.

**Rules it follows**
- Missing data is unknown, never good news.
- Passenger numbers are estimates from aircraft size, and it says so.
- All the counting and timing is plain code, not AI.
- It lives on the free AeroDataBox plan (600 units a month): one request when your flight is on
  the departures board, the incoming-plane lookup only in the last 4 hours, and a 20-unit reserve.

## Run it

    npm install
    npm run demo        # sample data, no account needed
    npm run check       # 45 scenario checks

With a free AeroDataBox key from RapidAPI:

    npx tsx src/list.ts                              # next Etihad departures
    npx tsx src/cli.ts EY61 2026-09-27 --save        # check one flight and save a snapshot

Weather comes from Open-Meteo (free, no key). Traffic needs a free TomTom key in `TOMTOM_KEY`.
The public version starts from Abu Dhabi city centre; a private starting point goes in
`ORIGIN_LAT`, `ORIGIN_LON` and `ORIGIN_LABEL`, never in the code.

## Coming next

A personal profile (bags, online check-in), gate walking times,
the agent loop (check on a schedule, compare with last time, notify only when something material
changes), a public dashboard, and a seat-map reader.
