// Everything tunable lives here.

export const HOME_AIRPORT = "AUH";
export const HOME_UTC_OFFSET_HOURS = 4; // UAE, no daylight saving
export const LOAD_FACTOR = 0.8;          // assume planes are ~80% full

/** Rough seat counts by aircraft model. Matched top to bottom, first hit wins. */
export const SEATS: [RegExp, number][] = [
  [/A380/i, 490],
  [/777-?9/i, 400],
  [/777/i, 350],
  [/787-?10/i, 307],
  [/787/i, 290],
  [/A350-?1000/i, 371],
  [/A350/i, 330],
  [/A330/i, 270],
  [/767/i, 220],
  [/A321/i, 190],
  [/A320|A319|737/i, 165],
  [/E1[79]\d|E2|CRJ|ATR|Dash/i, 90],
];
export const SEATS_UNKNOWN = 200;

/** Estimated Etihad passengers around your departure → how busy check-in feels. */
export const BUSY_LEVELS = { quiet: 1500, busy: 3000 }; // below quiet = quiet, at/above busy = busy

/** Minimum time a plane needs on the ground between flights. */
export const TURNAROUND_MIN = { widebody: 75, narrowbody: 45 };
export const WIDEBODY = /A380|777|787|A350|A330|767|747/i;

export const DELAYED_IF_MINUTES = 15;

/** 8+ big Etihad jets around your flight = a departure wave. */
export const RUSH_WIDEBODIES = 8;

/** Only look up your plane's previous flight in the last few hours (saves the free allowance). */
export const INBOUND_LOOKAHEAD_HOURS = 4;

/** AeroDataBox free plan: 600 units a month, flight endpoints cost 2 units each. */
export const BUDGET = { monthlyUnits: 600, unitsPerRequest: 2, reserve: 20 };

/** Abu Dhabi Zayed International (from the flight data). */
export const HOME_AIRPORT_COORDS = { lat: 24.433, lon: 54.6511 };

/** Public demo starting point. Your real home goes in the ORIGIN_LAT / ORIGIN_LON environment variables, never in code. */
export const DEFAULT_ORIGIN = { lat: 24.4667, lon: 54.3667, label: "Abu Dhabi city centre" };

/** Traffic only matters close to leaving. */
export const TRAFFIC_LOOKAHEAD_HOURS = 5;

/** Weather that affects operations. */
export const WEATHER = { lowVisibilityM: 3000, veryLowVisibilityM: 1000, strongGustKmh: 60 };
