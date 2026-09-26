// Live traffic from TomTom's free developer plan (needs TOMTOM_KEY).
export interface Route { minutes: number; usualMinutes: number | null; freeFlowMinutes: number | null; delayMinutes: number }
export interface TrafficSource { route(from: { lat: number; lon: number }, to: { lat: number; lon: number }): Promise<Route> }

const m = (s: unknown) => (typeof s === "number" ? Math.round(s / 60) : null);

export function parseRoute(j: any): Route {
  const s = j?.routes?.[0]?.summary;
  if (!s) throw new Error("TomTom returned no route");
  return {
    minutes: m(s.travelTimeInSeconds)!,
    usualMinutes: m(s.historicTrafficTravelTimeInSeconds),
    freeFlowMinutes: m(s.noTrafficTravelTimeInSeconds),
    delayMinutes: m(s.trafficDelayInSeconds) ?? 0,
  };
}

export function liveTraffic(key: string): TrafficSource {
  return {
    route: async (a, b) => {
      const url = `https://api.tomtom.com/routing/1/calculateRoute/${a.lat},${a.lon}:${b.lat},${b.lon}/json` +
        `?key=${encodeURIComponent(key)}&traffic=true&travelMode=car&computeTravelTimeFor=all`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`TomTom ${res.status}`);
      return parseRoute(await res.json());
    },
  };
}

export function mockTraffic(r: Partial<Route> = {}): TrafficSource {
  return { route: async () => ({ minutes: 29, usualMinutes: 22, freeFlowMinutes: 20, delayMinutes: 7, ...r }) };
}
