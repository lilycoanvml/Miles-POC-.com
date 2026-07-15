import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  BODY_MATERIAL,
  INTERIORS,
  LEATHER_MATERIALS,
  PAINTS,
  STITCH_MATERIALS,
  WHEELS,
  WHEEL_FACE_MATERIALS,
} from "../config/materials";
import { Rig, type RigState } from "./rig";

// PLACEHOLDER: this CX-5 GLB stands in for the F-150 Lariat until a real F-150 model is sourced.
// Drop the F-150 glTF into frontend/public/ and point MODEL_URL at it (and remap the material
// node names in config/materials.ts) — no other code changes needed.
export const MODEL_URL = "/2026_Mazda_CX-5_NonRigged.glb";
useGLTF.preload(MODEL_URL);

interface Props {
  exteriorColor?: string;
  wheel?: string;
  interior?: string;
  rig: RigState;
}

/** Run `fn` over every material in the scene whose name is in `names`. */
function forEachMaterial(
  scene: THREE.Object3D,
  names: string[],
  fn: (m: THREE.Material) => void
) {
  const set = new Set(names);
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      if (m && set.has(m.name)) fn(m);
    });
  });
}

export function CarModel({ exteriorColor, wheel, interior, rig }: Props) {
  const { scene } = useGLTF(MODEL_URL);
  const rigController = useMemo(() => new Rig(scene), [scene]);
  useFrame((_, dt) => rigController.update(rig, dt));

  // Upgrade the body paint to MeshPhysicalMaterial once, so we get a clearcoat layer
  // (MeshStandardMaterial has no clearcoat). Copy preserves existing maps.
  useEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m, i) => {
        if (m && m.name === BODY_MATERIAL && !(m as any).isMeshPhysicalMaterial) {
          const phys = new THREE.MeshPhysicalMaterial();
          phys.copy(m as THREE.MeshStandardMaterial);
          phys.name = BODY_MATERIAL;
          if (Array.isArray(mesh.material)) mesh.material[i] = phys;
          else mesh.material = phys;
        }
      });
    });
  }, [scene]);

  // Exterior paint
  useEffect(() => {
    if (!exteriorColor) return;
    const p = PAINTS[exteriorColor];
    if (!p) return;
    forEachMaterial(scene, [BODY_MATERIAL], (m) => {
      const pm = m as THREE.MeshPhysicalMaterial;
      pm.color.set(p.srgb);
      pm.metalness = p.metalness;
      pm.roughness = p.roughness;
      pm.clearcoat = p.clearcoat;
      pm.clearcoatRoughness = p.clearcoatRoughness;
      pm.needsUpdate = true;
    });
  }, [scene, exteriorColor]);

  // Wheel finish (single geometry — we drive finish, not 17"/19" size)
  useEffect(() => {
    if (!wheel) return;
    const w = WHEELS[wheel];
    if (!w) return;
    forEachMaterial(scene, WHEEL_FACE_MATERIALS, (m) => {
      const sm = m as THREE.MeshStandardMaterial;
      sm.color.set(w.srgb);
      sm.metalness = w.metalness;
      sm.roughness = w.roughness;
      sm.needsUpdate = true;
    });
  }, [scene, wheel]);

  // Interior leather + stitching
  useEffect(() => {
    if (!interior) return;
    const it = INTERIORS[interior];
    if (!it) return;
    forEachMaterial(scene, LEATHER_MATERIALS, (m) => {
      (m as THREE.MeshStandardMaterial).color.set(it.leatherSrgb);
      m.needsUpdate = true;
    });
    forEachMaterial(scene, STITCH_MATERIALS, (m) => {
      (m as THREE.MeshStandardMaterial).color.set(it.stitchSrgb);
      m.needsUpdate = true;
    });
  }, [scene, interior]);

  return <primitive object={scene} />;
}
