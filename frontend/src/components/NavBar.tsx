const LINKS = ["VEHICLES", "SHOPPING TOOLS", "WHAT DRIVES US", "OWNERS"];

/** Simplified Ford blue-oval wordmark (placeholder — swap for the official asset). */
function FordMark({ color }: { color: string }) {
  return (
    <svg width="64" height="30" viewBox="0 0 128 56" aria-label="Ford" role="img">
      <ellipse cx="64" cy="28" rx="62" ry="26" fill="none" stroke={color} strokeWidth="2.5" />
      <text
        x="64"
        y="38"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="30"
        fontStyle="italic"
        fill={color}
      >
        Ford
      </text>
    </svg>
  );
}

export function NavBar({ theme }: { theme: "light" | "dark" }) {
  const color = theme === "dark" ? "#ffffff" : "#1a1a1a";
  return (
    <nav className={`nav nav-${theme}`} style={{ color }}>
      <div className="nav-left">
        {LINKS.map((l) => (
          <a key={l} className="nav-link" href="#">{l}</a>
        ))}
      </div>
      <div className="nav-logo"><FordMark color={color} /></div>
      <div className="nav-right">
        <span className="nav-loc">◎ 92602</span>
        <button className="nav-btn nav-ghost" style={{ borderColor: color, color }}>View Inventory</button>
        <button className="nav-btn nav-solid">Build Yours</button>
        <span className="nav-search" aria-hidden>⌕</span>
      </div>
    </nav>
  );
}
