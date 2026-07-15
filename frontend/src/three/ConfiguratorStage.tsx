import { ContactShadows, Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import type { StageState } from "../types";
import { CarModel, MODEL_URL } from "./CarModel";
import { computePresets, type View } from "./cameraPresets";
import { DEFAULT_RIG } from "./rig";

/**
 * Smoothly flies the camera to the preset for the current step (hero / wheel / interior).
 * Reads the shared (cached) GLB scene to compute framings from real node positions.
 * The user can still orbit; the rig only drives transitions when `view` changes.
 */
function CameraRig({ view }: { view: View }) {
  const { scene } = useGLTF(MODEL_URL);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as any;
  const presets = useMemo(() => computePresets(scene), [scene]);

  useFrame(() => {
    const goal = presets[view];
    if (!goal) return;
    camera.position.lerp(goal.pos, 0.045);
    if (controls?.target) {
      controls.target.lerp(goal.look, 0.045);
      controls.update();
    }
  });
  return null;
}

/**
 * Real-time PBR stage: studio IBL + ACES tone mapping + contact shadows + step-driven camera.
 * NOTE: <Environment preset="studio"> fetches an HDRI from the drei CDN. For offline / Cloud Run,
 * ship an .hdr in /public and use <Environment files="/studio.hdr" />.
 */
export function ConfiguratorStage({ stage, view }: { stage: StageState; view: View }) {
  const hasModel = Boolean(stage.model);
  return (
    <div className="stage">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [5, 2, 6], fov: 35, near: 0.1, far: 5000 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        <color attach="background" args={["#e7e8ea"]} />
        <Suspense fallback={null}>
          <Environment preset="studio" />
          {hasModel && (
            <>
              <CarModel
                exteriorColor={stage.exteriorColor}
                wheel={stage.wheel}
                interior={stage.interior}
                rig={stage.rig ?? DEFAULT_RIG}
              />
              <CameraRig view={view} />
            </>
          )}
          <ContactShadows position={[0, -0.01, 0]} opacity={0.45} scale={16} blur={2.6} far={8} />
        </Suspense>
        <OrbitControls
          makeDefault
          enableDamping
          enablePan={false}
          rotateSpeed={0.75}
          zoomSpeed={0.75}
          minDistance={0.3}
          maxDistance={50}
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI / 2.02}
        />
      </Canvas>
      {!hasModel && (
        <div className="stage-empty">The car will appear here once Miles reveals it.</div>
      )}
    </div>
  );
}
