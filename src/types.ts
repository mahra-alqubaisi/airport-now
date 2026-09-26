export interface Movement {
  airportIata?: string;   // the other airport (destination for departures)
  airportName?: string;
  countryCode?: string;
  lat?: number;
  lon?: number;
  scheduled?: number;     // ms since epoch
  best?: number;          // latest known real/expected time (falls back to scheduled)
  live?: boolean;         // true only if the data had a real or updated time
  terminal?: string;
  gate?: string;
}
export interface Flight {
  number: string;
  airlineIata?: string;
  airlineName?: string;
  status?: string;
  model?: string;
  reg?: string;
  departure: Movement;
  arrival: Movement;
}
