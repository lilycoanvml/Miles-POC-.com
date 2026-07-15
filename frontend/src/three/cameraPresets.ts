import * as THREE from "three";

/** Camera framings, mapped to configuration/exploration steps. */
export type View = "hero" | "front" | "side" | "rear" | "wheel" | "interior" | "trunk";

export interface Preset {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

function worldPos(scene: THREE.Object3D, name: string): THREE.Vector3 | null {
  let found: THREE.Vector3 | null = null;
  scene.traverse((o) => {
    if (!found && o.name === name) {
      found = new THREE.Vector3();
      o.getWorldPosition(found);
    }
  });
  return found;
}

/**
 * Derive camera presets from the model's real geometry, so framing is orientation-agnostic:
 *  - front direction is inferred from the Headlights node relative to the body centre
 *  - the wheel close-up aims at WheelFrLeft, the interior at Dash/SteeringWheel
 * Offsets are tunable constants — verify framing on first run and adjust the multipliers.
 */
export function computePresets(scene: THREE.Object3D): Record<View, Preset> {
  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const up = new THREE.Vector3(0, 1, 0);

  const headlights = worldPos(scene, "Headlights");
  const front = headlights ? headlights.clone().sub(center) : new THREE.Vector3(0, 0, 1);
  front.y = 0;
  if (front.lengthSq() < 1e-6) front.set(0, 0, 1);
  front.normalize();
  const right = new THREE.Vector3().crossVectors(up, front).normalize();

  const wheel = worldPos(scene, "WheelFrLeft") ?? center.clone();
  const sw = worldPos(scene, "SteeringWheel");
  const dash = worldPos(scene, "Dash") ?? sw ?? center.clone();

  // Driver-side lateral direction, inferred from the steering wheel's offset from centre.
  let driver = (sw ? sw.clone().sub(center) : right.clone());
  driver.sub(front.clone().multiplyScalar(driver.dot(front))); // strip the fore/aft component
  driver.y = 0;
  if (driver.lengthSq() < 1e-6) driver.copy(right);
  driver.normalize();

  // Interior framing: aim between dash and wheel; sit back + toward the passenger side + up,
  // giving a ~45° cross-cabin 3/4 that shows the door, part of the seat, the dash and full wheel.
  const interiorLook = dash.clone().lerp(sw ?? dash, 0.5).add(up.clone().multiplyScalar(size.y * 0.03));

  return {
    // Full 3/4 front (exterior colour reveal) — pulled back so the whole car sits clear of the chat
    hero: {
      pos: center.clone()
        .add(front.clone().multiplyScalar(maxDim * 1.5))
        .add(right.clone().multiplyScalar(maxDim * 0.95))
        .add(up.clone().multiplyScalar(size.y * 0.7)),
      look: center.clone().add(up.clone().multiplyScalar(size.y * 0.1)),
    },
    // Straight-on front: grille / headlights
    front: {
      pos: center.clone()
        .add(front.clone().multiplyScalar(maxDim * 1.7))
        .add(up.clone().multiplyScalar(size.y * 0.4)),
      look: center.clone().add(front.clone().multiplyScalar(size.z * 0.3)).add(up.clone().multiplyScalar(size.y * 0.1)),
    },
    // Full profile (silhouette)
    side: {
      pos: center.clone()
        .add(right.clone().multiplyScalar(maxDim * 1.7))
        .add(up.clone().multiplyScalar(size.y * 0.45)),
      look: center.clone().add(up.clone().multiplyScalar(size.y * 0.1)),
    },
    // Straight-on rear: taillights / Ford badge
    rear: {
      pos: center.clone()
        .add(front.clone().multiplyScalar(-maxDim * 1.7))
        .add(up.clone().multiplyScalar(size.y * 0.4)),
      look: center.clone().add(front.clone().multiplyScalar(-size.z * 0.3)).add(up.clone().multiplyScalar(size.y * 0.1)),
    },
    // Rear 3/4 framed on the open tailgate / cargo area
    trunk: {
      pos: center.clone()
        .add(front.clone().multiplyScalar(-maxDim * 1.25))
        .add(right.clone().multiplyScalar(-maxDim * 0.7))
        .add(up.clone().multiplyScalar(size.y * 0.85)),
      look: center.clone().add(front.clone().multiplyScalar(-size.z * 0.25)).add(up.clone().multiplyScalar(size.y * 0.2)),
    },
    // Front-wheel close-up
    wheel: {
      pos: wheel.clone()
        .add(front.clone().multiplyScalar(maxDim * 0.45))
        .add(right.clone().multiplyScalar(maxDim * 0.30))
        .add(up.clone().multiplyScalar(size.y * 0.15)),
      look: wheel.clone(),
    },
    // Cross-cabin 3/4: occupant eye-level on the passenger side, ~45° toward the driver dash/wheel
    // (close enough to clear the seat headrest, low enough to read as a seated viewpoint)
    interior: {
      pos: interiorLook.clone()
        .add(front.clone().multiplyScalar(-maxDim * 0.13))
        .add(driver.clone().multiplyScalar(-maxDim * 0.17))
        .add(up.clone().multiplyScalar(size.y * 0.15)),
      look: interiorLook,
    },
  };
}
