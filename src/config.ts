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

/** Etihad's published check-in rules (etihad.com, 2025–26). Minutes before departure. */
export const ETIHAD = {
  onlineCheckInOpensHours: 48,
  countersOpenHours: 4,
  counterClose: { economy: 60, business: 45, first: 45 },
  us: { counterClose: 120, preclearance: { economy: 120, business: 90, first: 90 } },
  gateClose: 20,
};
export const US_AIRPORTS = ["JFK", "EWR", "ORD", "IAD", "BOS", "ATL", "CLT", "LAX", "SFO", "SEA", "DFW", "IAH", "MIA", "PHL"];

/**
 * Rough queue times (minutes) by how busy the airport is. Starting guesses, meant to be tuned from experience.
 * counter = airport check-in desk, bagDrop = self-service after online check-in, security = security + immigration.
 */
export const QUEUES = {
  counter: { quiet: 10, normal: 20, busy: 35 },
  bagDrop: { quiet: 5, normal: 10, busy: 15 },
  premium: { quiet: 5, normal: 5, busy: 10 },
  security: { quiet: 10, normal: 15, busy: 25 },
  eGateSaves: 5,
  usPreclearance: { quiet: 25, normal: 35, busy: 45 },
  kerbToDesk: 5,
};

/**
 * Walking time (minutes) from security to the gate, Terminal A. Rough starting table to be tuned from experience:
 * piers A–D spread out from the central core; higher gate numbers are further out; E and F are bus gates near B10.
 */
export const WALK = {
  byNumber: [ { upTo: 9, minutes: 6 }, { upTo: 19, minutes: 9 }, { upTo: 29, minutes: 12 }, { upTo: 39, minutes: 15 }, { upTo: 999, minutes: 19 } ],
  busGate: 10,        // walk to the bus gate area; the bus ride comes on top
  unknownGate: 13,    // average until the gate is announced
  farWalk: 15,        // flag as "long walk" from here
};

export type Cabin = "economy" | "business" | "first";
export interface Profile {
  cabin: Cabin;
  bags: "checked" | "hand";
  checkedInOnline: boolean;
  eGate: boolean;          // registered for the smart gates at immigration
  gateBufferMinutes: number; // how long before gate closing you like to be there
}
/** Used by the public demo. Your own goes in profile.json, which is never uploaded. */
export const DEMO_PROFILE: Profile = { cabin: "economy", bags: "checked", checkedInOnline: true, eGate: true, gateBufferMinutes: 15 };
