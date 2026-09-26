// Every check is saved. That's what makes "what changed", the replay page and history possible.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Signal } from "./signals/types.js";

export interface Snapshot {
  takenAt: string;        // ISO time of the check
  flight: string;         // e.g. "EY 61"
  date: string;           // local departure date
  signals: Signal[];
  unitsUsed: number;      // data allowance spent on this check
}

const safe = (s: string) => s.replace(/\s+/g, "");

export class Store {
  constructor(private dir = "data") {}
  private historyFile(flight: string, date: string) { return join(this.dir, "history", `${date}-${safe(flight)}.json`); }

  history(flight: string, date: string): Snapshot[] {
    const f = this.historyFile(flight, date);
    return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : [];
  }
  previous(flight: string, date: string): Snapshot | undefined {
    return this.history(flight, date).at(-1);
  }
  save(s: Snapshot) {
    mkdirSync(join(this.dir, "history"), { recursive: true });
    const all = [...this.history(s.flight, s.date), s];
    writeFileSync(this.historyFile(s.flight, s.date), JSON.stringify(all, null, 1));
    writeFileSync(join(this.dir, "latest.json"), JSON.stringify(s, null, 1));
  }
}
