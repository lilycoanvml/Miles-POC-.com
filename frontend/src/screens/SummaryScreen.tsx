import type { BookingDetails, Budget, StageState } from "../types";
import { buildSummary, OFFERS, PRICING, STANDARD_FEATURES } from "../config/spec";
import { ConfiguratorStage } from "../three/ConfiguratorStage";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

/**
 * Final reveal — the "build summary" page: the configured 3D truck on the left, and the YOUR BUILD
 * spec panel on the right. Details the user shared during booking (name, location, appointment)
 * appear as blocks under the vehicle title as they're collected.
 */
export function SummaryScreen({
  stage, details, budget, runningTotal,
}: {
  stage: StageState;
  details?: BookingDetails;
  budget?: Budget | null;
  runningTotal?: number | null;
}) {
  const b = buildSummary(stage);
  const blocks = detailBlocks(details);
  const total = runningTotal ?? null;
  const max = budget?.max ?? null;
  const over = total != null && max != null && total > max;

  return (
    <div className="summary">
      <div className="summary-inner">
        {/* Left: the configured 3D vehicle */}
        <section className="summary-viewer">
          <ConfiguratorStage stage={stage} view="hero" />
        </section>

        {/* Right: YOUR BUILD */}
        <aside className="summary-build">
          <div className="eyebrow">2026 FORD</div>
          <h1 className="display summary-title">F-150</h1>

          {blocks.length > 0 && (
            <div className="detail-blocks">
              {blocks.map((d) => (
                <div key={d.k} className="detail-block">
                  <span className="detail-k">{d.k}</span>
                  <span className="detail-v">{d.v}</span>
                </div>
              ))}
            </div>
          )}

          <div className="build-section">
            <h2>YOUR BUILD</h2>
            <div className="build-model">{b.model}</div>
          </div>

          <div className="build-section">
            <h3>ESSENTIALS</h3>
            <Row k="Trim" v={b.trim} note="Edit Trim" />
            <Row k="Powertrain" v={b.powertrain} note="Standard with Model" />
            <Row k="Exterior" v={b.exterior} note="Edit Exterior" />
            <Row k="Interior" v={b.interior} note="Edit Interior" />
            <Row k="Wheels" v={b.wheel} note="Edit Wheels" />
          </div>

          <div className="build-section">
            <h3>STANDARD FEATURES</h3>
            <ul className="feature-list">
              {STANDARD_FEATURES.map((f) => <li key={f}>{f}</li>)}
            </ul>
          </div>

          <div className="build-section">
            <h3>ESTIMATED PRICING</h3>
            <Row k="Purchase estimate" v={PRICING.purchaseEstimate} />
            <Row k="Lease estimate" v={PRICING.leaseEstimate} />
            <div className="build-total">
              <span>Total as Built</span>
              <strong>{total != null ? usd(total) : PRICING.totalAsBuilt}</strong>
            </div>
            {max != null && (
              <div className={`budget-status ${over ? "is-over" : "is-in"}`}>
                {over
                  ? `${usd((total ?? 0) - max)} over your ${usd(max)} budget — I can find the same feel for less.`
                  : `Within your ${usd(max)} budget ✓`}
              </div>
            )}
          </div>

          <div className="build-section">
            <h3>SPECIAL OFFERS</h3>
            {OFFERS.map((o) => (
              <div key={o.title} className="offer">
                <div className="offer-tag">{o.tag}</div>
                <div className="offer-title">{o.title}</div>
                <div className="offer-detail">{o.detail}</div>
                <div className="offer-expires">Expires {o.expires}</div>
              </div>
            ))}
          </div>

          <div className="build-cta">
            <button className="nav-btn nav-ghost build-ghost">Save Build</button>
            <button className="cta build-solid">Request Build from Dealer</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Ordered, present-only user details to render as blocks under the title. */
function detailBlocks(d?: BookingDetails): { k: string; v: string }[] {
  if (!d) return [];
  const out: { k: string; v: string }[] = [];
  if (d.name) out.push({ k: "Name", v: d.name });
  if (d.location) out.push({ k: "Location", v: d.location });
  if (d.retailer) out.push({ k: "Dealer", v: d.retailer });
  if (d.date) out.push({ k: "Date", v: d.date });
  if (d.time) out.push({ k: "Time", v: d.time });
  if (d.email) out.push({ k: "Email", v: d.email });
  return out;
}

function Row({ k, v, note }: { k: string; v: string; note?: string }) {
  return (
    <div className="build-row">
      <div className="build-row-main">
        <span className="build-k">{k}</span>
        <span className="build-v">{v}</span>
      </div>
      {note && <span className="build-note">{note}</span>}
    </div>
  );
}
