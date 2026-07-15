import { LINEUP, lineupImage, type LineupItem } from "../config/lineup";

/**
 * Landing / model picker. Cards are positioned in a staircase cascade via CSS slot classes
 * (.slot-a … .slot-h). Clicking a card nudges the conversation toward that model.
 */
function ModelCard({ item, onPick }: { item: LineupItem; onPick: (label: string) => void }) {
  return (
    <button
      className={`model-card slot-${item.slot} size-${item.size}`}
      onClick={() => onPick(item.label)}
      title={item.label}
    >
      <div className="model-year">2026</div>
      <div className="model-label">{item.label}</div>
      <div className="model-img" style={{ backgroundImage: `url(${lineupImage(item.id)})` }} />
    </button>
  );
}

export function LineupScreen({ onPick }: { onPick: (label: string) => void }) {
  return (
    <div className="lineup">
      <div className="lineup-bg" />
      <div className="lineup-stage">
        {LINEUP.map((it) => <ModelCard key={it.id} item={it} onPick={onPick} />)}
      </div>
    </div>
  );
}
