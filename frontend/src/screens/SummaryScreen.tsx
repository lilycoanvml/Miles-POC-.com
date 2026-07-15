import type { StageState } from "../types";
import {
  buildSummary,
  GALLERY,
  OFFERS,
  PRICING,
  STANDARD_FEATURES,
} from "../config/spec";

/**
 * Final reveal — the "build summary" page (matches the reference): a scrollable gallery on the
 * left and a YOUR BUILD spec panel on the right. Gallery tiles are placeholders until real
 * renders / canvas snapshots are wired in; the spec fields are driven by the live config.
 */
export function SummaryScreen({ stage }: { stage: StageState }) {
  const b = buildSummary(stage);

  return (
    <div className="summary">
      <div className="summary-inner">
        {/* Left: gallery */}
        <section className="summary-gallery">
          <div className="eyebrow">BUILD YOUR</div>
          <h1 className="display summary-title">F-150</h1>
          <div className="gallery-grid">
            {GALLERY.map((g) => (
              <div key={g.src} className={`gallery-tile ${g.wide ? "gallery-wide" : ""}`}>
                <img
                  src={g.src}
                  alt={g.label}
                  loading="lazy"
                  onError={(e) => { (e.currentTarget.style.display = "none"); }}
                />
                <span className="gallery-label">{g.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Right: YOUR BUILD */}
        <aside className="summary-build">
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
              <strong>{PRICING.totalAsBuilt}</strong>
            </div>
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
