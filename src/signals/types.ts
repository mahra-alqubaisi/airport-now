// Every signal reports in the same shape, so the agent can compare and reason over them.
export type Level = "ok" | "watch" | "alert" | "unknown";

export interface Signal {
  id: string;          // stable key, e.g. "pressure"
  label: string;       // for the dashboard
  level: Level;        // ok = fine, watch = worth knowing, alert = act, unknown = not enough data
  headline: string;    // one line for a human
  reasons: string[];   // why
  data: Record<string, unknown>; // the numbers behind it
}
