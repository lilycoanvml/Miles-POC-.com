/**
 * Calibrated PBR material presets, keyed to the ids in car_configurations.json (Ford F-150 Lariat).
 *
 * Ford publishes marketing colour names, not hex/paint physics — these are tuned starting points
 * derived from finish family (Metallic / Tinted Clearcoat / Tri-Coat / Solid) and reference imagery.
 * The `srgb` strings are authored in sRGB; three.js ColorManagement converts to linear at assignment.
 *
 * NOTE: the current GLB is a placeholder (a CX-5 body standing in for the F-150 until a real F-150
 * Lariat glTF is dropped in). The material NODE names below (CarPaint, WheelChrome, intLeather*, …)
 * belong to that placeholder GLB — remap them to the F-150 model's node names when it arrives.
 * Refine the numbers against official Ford swatches in a calibration pass — only the values change.
 */

export interface PaintPreset {
  srgb: string;            // base colour (sRGB hex)
  metalness: number;       // 0..1
  roughness: number;       // 0..1 (lower = glossier)
  clearcoat: number;       // 0..1 (the lacquer layer over the pigment)
  clearcoatRoughness: number;
  finish: "metallic" | "tinted-clearcoat" | "tri-coat" | "solid";
  name: string;
}

// Target material name in the GLB for the body paint.
export const BODY_MATERIAL = "CarPaint";

export const PAINTS: Record<string, PaintPreset> = {
  "agate-black": {
    name: "Agate Black Metallic", finish: "metallic",
    srgb: "#14171A", metalness: 0.7, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.06,
  },
  "oxford-white": {
    name: "Oxford White", finish: "solid",
    srgb: "#ECEDED", metalness: 0.2, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.12,
  },
  "iconic-silver": {
    name: "Iconic Silver Metallic", finish: "metallic",
    srgb: "#B4B8BB", metalness: 0.9, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.12,
  },
  "carbonized-gray": {
    name: "Carbonized Gray Metallic", finish: "metallic",
    srgb: "#565A5E", metalness: 0.9, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.15,
  },
  "avalanche": {
    name: "Avalanche", finish: "metallic",
    srgb: "#9BA0A3", metalness: 0.75, roughness: 0.45, clearcoat: 0.45, clearcoatRoughness: 0.18,
  },
  "marsh-gray": {
    name: "Marsh Gray", finish: "metallic",
    srgb: "#6E6E66", metalness: 0.7, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.2,
  },
  "antimatter-blue": {
    name: "Antimatter Blue Metallic", finish: "metallic",
    srgb: "#2B3A55", metalness: 0.85, roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.08,
  },
  "argon-blue": {
    name: "Argon Blue Metallic", finish: "metallic",
    srgb: "#3F6E9A", metalness: 0.85, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.08,
  },
  "ruby-red": {
    name: "Ruby Red Metallic Tinted Clearcoat", finish: "tinted-clearcoat",
    srgb: "#7E1420", metalness: 0.6, roughness: 0.24, clearcoat: 1.0, clearcoatRoughness: 0.04,
  },
  "star-white": {
    name: "Star White Metallic Tri-Coat", finish: "tri-coat",
    srgb: "#F0EFEA", metalness: 0.35, roughness: 0.3, clearcoat: 1.0, clearcoatRoughness: 0.05,
  },
};

/**
 * Wheel finishes. The placeholder GLB has ONE wheel geometry, so we drive *finish* (not 18/20/22"
 * size). We recolor the wheel-face materials; tyre/caliper/brake materials are left untouched.
 * Source real wheel meshes to represent size accurately when the F-150 model lands.
 */
export interface WheelPreset {
  srgb: string;
  metalness: number;
  roughness: number;
  name: string;
}
export const WHEEL_FACE_MATERIALS = ["WheelChrome", "WheelPaintBlack"];

export const WHEELS: Record<string, WheelPreset> = {
  "18-painted-aluminum": { name: "18\" Painted Aluminum", srgb: "#B9BDC1", metalness: 0.9,  roughness: 0.34 },
  "18-gloss-black":      { name: "18\" Gloss Black",       srgb: "#1A1C1E", metalness: 0.8,  roughness: 0.22 },
  "20-chrome-pvd":       { name: "20\" Chrome-Like PVD",   srgb: "#CDD0D2", metalness: 1.0,  roughness: 0.12 },
  "20-gloss-black":      { name: "20\" Gloss Black",       srgb: "#202225", metalness: 0.8,  roughness: 0.2  },
  "22-gloss-black":      { name: "22\" Gloss Black",       srgb: "#17181A", metalness: 0.82, roughness: 0.18 },
  "22-chrome":           { name: "22\" Chrome",            srgb: "#D3D6D8", metalness: 1.0,  roughness: 0.1  },
};

/**
 * Interior themes. The placeholder GLB exposes distinct upholstery materials with grain/normal
 * maps; we tint the base colours (keeping the maps) per chosen interior. Stitching is set for contrast.
 */
export interface InteriorPreset {
  leatherSrgb: string;
  stitchSrgb: string;
  name: string;
}
export const LEATHER_MATERIALS = [
  "intLeatherDark", "intLeatherLt", "intLeatherPlasticBMP",
  "intLeatherPerfLt", "intLeatherSteeringWheelBump",
];
export const STITCH_MATERIALS = ["intStitchesWhite", "intStitchesGrey", "intStitchesStWheel"];

export const INTERIORS: Record<string, InteriorPreset> = {
  "activex-slate":   { name: "ActiveX Medium Dark Slate", leatherSrgb: "#3A3E42", stitchSrgb: "#6A6E72" },
  "activex-black":   { name: "ActiveX Black",             leatherSrgb: "#191A1C", stitchSrgb: "#4A4B4D" },
  "activex-truffle": { name: "ActiveX Smoked Truffle",    leatherSrgb: "#4A3B33", stitchSrgb: "#8C6F5B" },
};
