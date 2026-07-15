import type { StageState } from "../types";
import { ConfiguratorStage } from "../three/ConfiguratorStage";
import type { View } from "../three/cameraPresets";

interface Props {
  stage: StageState;
  view: View;
  onOpenInfotainment: () => void;
}

/** Full-bleed 3D stage with the Ford hero chrome (title top-left, scroll hint bottom-right). */
export function ConfiguratorScreen({ stage, view, onOpenInfotainment }: Props) {
  return (
    <div className="configurator">
      <ConfiguratorStage stage={stage} view={view} />
      <div className="hero-title">
        <div className="eyebrow">2026 FORD</div>
        <div className="display hero-model">F-150</div>
      </div>
      {view === "interior" && (
        <button className="info-trigger" onClick={onOpenInfotainment}>
          ▸ Explore the infotainment
        </button>
      )}
      <div className="scroll-hint">Scroll to Discover</div>
    </div>
  );
}
