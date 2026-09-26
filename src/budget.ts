// Keeps count of the free AeroDataBox allowance so the agent never runs out mid-trip.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BUDGET } from "./config.js";

const month = (now = new Date()) => now.toISOString().slice(0, 7);

export class Budget {
  constructor(private dir = "data", private now = () => new Date()) {}
  private file() { return join(this.dir, "budget.json"); }

  used(): number {
    if (!existsSync(this.file())) return 0;
    const b = JSON.parse(readFileSync(this.file(), "utf8"));
    return b.month === month(this.now()) ? b.units : 0; // resets each month
  }
  left(): number { return BUDGET.monthlyUnits - this.used(); }
  canSpend(requests: number): boolean { return this.left() - requests * BUDGET.unitsPerRequest >= BUDGET.reserve; }
  spend(requests = 1) {
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(this.file(), JSON.stringify({ month: month(this.now()), units: this.used() + requests * BUDGET.unitsPerRequest }));
  }
}
