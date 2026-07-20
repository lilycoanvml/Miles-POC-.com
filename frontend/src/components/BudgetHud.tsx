import type { Budget } from "../types";

/**
 * Persistent budget chip (miles3): running build total vs. the stated ceiling. Quiet by default,
 * turns red when the build climbs over budget so the number is never a surprise at checkout.
 * Renders nothing until a budget has been captured.
 */
export function BudgetHud({ budget, runningTotal }: { budget: Budget | null; runningTotal: number | null }) {
  const max = budget?.max;
  if (!max) return null;

  const total = runningTotal ?? 0;
  const over = total > max;
  const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

  return (
    <div className={`budget-hud ${over ? "is-over" : ""}`}>
      <div className="budget-hud-row">
        <span className="budget-hud-label">{over ? "Over budget" : "Your build"}</span>
        <span className="budget-hud-total">{usd(total)}</span>
      </div>
      <div className="budget-hud-bar">
        <div className="budget-hud-fill" style={{ width: `${Math.min(100, (total / max) * 100)}%` }} />
      </div>
      <div className="budget-hud-cap">
        {over ? `${usd(total - max)} over ` : ""}budget {usd(max)}
        {budget?.monthly ? ` · ~$${budget.monthly.toLocaleString("en-US")}/mo` : ""}
      </div>
    </div>
  );
}
