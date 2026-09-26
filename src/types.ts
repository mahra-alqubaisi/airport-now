export interface Movement {
  airportIata?: string;   // the other airport (destination for departures)
  airportName?: string;
  scheduled?: number;     // ms since epoch
  best?: number;          // latest known real/expected time
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
