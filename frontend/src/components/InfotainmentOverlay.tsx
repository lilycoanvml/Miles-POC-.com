/**
 * Infotainment exploration overlay. Shows a SYNC 4 / centre-display image (CARPLAY_IMG, wired in
 * config/webImages.ts — currently empty, so it renders a framed placeholder) over the cabin.
 * Kept as an HTML overlay (not mapped onto the 3D screen mesh) so it's reliable regardless of
 * orbit angle. The descriptive copy comes from Miles in the chat.
 */
import { CARPLAY_IMG } from "../config/webImages";

export function InfotainmentOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="info-overlay" onClick={onClose}>
      <div className="info-frame" onClick={(e) => e.stopPropagation()}>
        {CARPLAY_IMG ? (
          <img src={CARPLAY_IMG} alt="Ford SYNC 4 centre display" />
        ) : (
          <div className="info-placeholder">Infotainment preview</div>
        )}
        <button className="info-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="info-caption">
        12&Prime; SYNC 4 centre display · voice · maps · media
      </div>
    </div>
  );
}
