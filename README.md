# airport-now

A personal agent that tells me what Abu Dhabi airport is really like before my flight:
how busy check-in will be, whether my flight is likely to be delayed, and why.

## Step 1 (this code)

Given a flight number and date, it:

- **Estimates how busy check-in is.** Counts Etihad flights leaving from 2 hours before to 1 hour
  after mine, and turns aircraft size into an estimated passenger count (an A380 is not an A320).
- **Finds my plane before it arrives.** Looks up the same aircraft's previous flight into Abu Dhabi.
  If it's landing late, it checks whether the plane still has enough time on the ground
  (75 min for big jets, 45 for small ones) before calling it a delay.
- **Reads the airport's mood.** How many departures in the last 2 hours left late, and by how much.
- **Combines it into low / medium / high delay risk, with reasons.** No fake percentages.

All the timing and counting is plain code. Nothing is guessed by an AI.

## Run it

    npm install
    npm run demo        # sample data, no account needed
    npm run check       # 21 scenario checks

Live data (free AeroDataBox plan on RapidAPI):

    export RAPIDAPI_KEY="your-key"
    npm run live -- EY19 2026-10-14 --raw

`--raw` saves the raw answers in `./raw` so any mismatch with real data can be fixed.
One live run uses 3 requests.

## Next steps

2. Traffic from home (TomTom free tier) and weather at both ends (Open-Meteo, free)
3. WhatsApp messages
4. Automatic checks on a schedule, only messaging when something changes
5. Seat-map screenshot reader: how full is the flight, are the bassinet rows taken
