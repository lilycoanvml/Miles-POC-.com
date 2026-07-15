import * as THREE from "three";

export interface RigState {
  doors: boolean;
  trunk: boolean;
  spinWheelsUntil: number; // performance.now() ms
}

export const DEFAULT_RIG: RigState = { doors: false, trunk: false, spinWheelsUntil: 0 };

type DoorId = "DoorFrLeft" | "DoorFrRight" | "DoorRearLeft" | "DoorRearRight";

// The artist placed each door's NODE ORIGIN at its hinge, so we rotate the
// node about its own origin around +Y. Door meshes on the left side extend
// in -X (inboard); opening (outboard) needs negative rotation.
const DOOR_SIGN: Record<DoorId, number> = {
  DoorFrLeft:   -1,
  DoorRearLeft: -1,
  DoorFrRight:  +1,
  DoorRearRight:+1,
};
const DOOR_OPEN_RAD = THREE.MathUtils.degToRad(62);
const TRUNK_OPEN_RAD = THREE.MathUtils.degToRad(70);
const WHEEL_SPIN_RAD_PER_SEC = 14;

interface Hinge {
  node: THREE.Object3D;
  axis: THREE.Vector3;
  openAngle: number;
  current: number;
}

function makeHinge(scene: THREE.Object3D, name: string, axis: THREE.Vector3, openAngle: number): Hinge | null {
  const node = scene.getObjectByName(name);
  if (!node) return null;
  return { node, axis, openAngle, current: 0 };
}

export class Rig {
  private doors: Hinge[] = [];
  private trunk: Hinge | null = null;
  private wheels: { node: THREE.Object3D; spin: number }[] = [];

  constructor(scene: THREE.Object3D) {
    for (const id of ["DoorFrLeft", "DoorFrRight", "DoorRearLeft", "DoorRearRight"] as DoorId[]) {
      const h = makeHinge(scene, id, new THREE.Vector3(0, 1, 0), DOOR_SIGN[id] * DOOR_OPEN_RAD);
      if (h) this.doors.push(h);
    }
    this.trunk = makeHinge(scene, "DoorTrunk", new THREE.Vector3(1, 0, 0), TRUNK_OPEN_RAD);
    for (const wn of ["WheelFrLeft", "WheelFrRight", "WheelRearLeft", "WheelRearRight"]) {
      const node = scene.getObjectByName(wn);
      if (node) this.wheels.push({ node, spin: 0 });
    }
  }

  private apply(h: Hinge, target: number, dt: number) {
    const k = 1 - Math.exp(-dt * 6);
    h.current += (target - h.current) * k;
    h.node.quaternion.setFromAxisAngle(h.axis, h.current);
  }

  update(state: RigState, dt: number) {
    for (const h of this.doors) this.apply(h, state.doors ? h.openAngle : 0, dt);
    if (this.trunk) this.apply(this.trunk, state.trunk ? this.trunk.openAngle : 0, dt);
    if (performance.now() < state.spinWheelsUntil) {
      for (const w of this.wheels) {
        w.spin += dt * WHEEL_SPIN_RAD_PER_SEC;
        w.node.rotation.x = w.spin;
      }
    }
  }
}
