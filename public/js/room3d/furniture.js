// Procedural furniture kit. Every builder returns a THREE.Group whose origin is
// at floor level, centred, with its "front" facing +Z. Units are metres.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const mat = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, ...opts });

export const METALS = {
  gold: () => mat({ color: '#c9a46a', metalness: 1, roughness: 0.28 }),
  chrome: () => mat({ color: '#d9dcdf', metalness: 1, roughness: 0.15 }),
  black: () => mat({ color: '#1b1b1b', metalness: 0.6, roughness: 0.4 }),
};

function shadow(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

/** Box placed by its bottom-centre. */
export function block(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material));
  m.position.set(x, y + h / 2, z);
  return m;
}

/** Soft rounded box placed by its bottom-centre (cushions, mattresses, upholstery). */
export function soft(w, h, d, material, x = 0, y = 0, z = 0, radius = 0.04) {
  const r = Math.min(radius, w / 2, h / 2, d / 2);
  const m = shadow(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), material));
  m.position.set(x, y + h / 2, z);
  return m;
}

export function cylinder(rTop, rBottom, h, material, x = 0, y = 0, z = 0, segments = 24) {
  const m = shadow(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material));
  m.position.set(x, y + h / 2, z);
  return m;
}

function legs(group, w, d, h, material, inset = 0.05, radius = 0.025) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    group.add(cylinder(radius, radius * 0.8, h, material, sx * (w / 2 - inset), 0, sz * (d / 2 - inset), 10));
  }
}

// ---------- sleeping ----------

export function bed({ width = 1.6, length = 2.05, frame, linen, throwMat, pillow, headboard = 'panel', headboardMat, height = 1.1 }) {
  const g = new THREE.Group();
  const baseH = headboard === 'platform' ? 0.22 : 0.3;
  if (headboard === 'platform') {
    g.add(block(width + 0.5, baseH, length + 0.35, frame, 0, 0, 0.05));
  } else {
    g.add(block(width + 0.06, baseH, length + 0.04, frame, 0, 0.08, 0));
    legs(g, width, length, 0.08, frame, 0.08, 0.03);
  }
  const mattressY = baseH + (headboard === 'platform' ? 0 : 0.08);
  g.add(soft(width, 0.26, length, linen, 0, mattressY, 0, 0.06));
  g.add(soft(width + 0.04, 0.05, length * 0.38, throwMat, 0, mattressY + 0.24, length * 0.22, 0.02));
  const pillowCount = width > 1.7 ? 3 : 2;
  for (let i = 0; i < pillowCount; i++) {
    const px = (i - (pillowCount - 1) / 2) * (width / pillowCount);
    const p = soft(width / pillowCount - 0.08, 0.16, 0.42, pillow, px, mattressY + 0.24, -length / 2 + 0.32, 0.07);
    p.rotation.x = -0.25;
    g.add(p);
  }
  if (headboard !== 'none') {
    const hb = headboardMat ?? frame;
    const hbW = headboard === 'platform' ? width + 1.0 : width + 0.2;
    g.add(soft(hbW, height, 0.1, hb, 0, headboard === 'platform' ? 0 : 0.1, -length / 2 - 0.06, 0.03));
  }
  return g;
}

export function nightstand({ wood, handle, drawers = 1, w = 0.5, h = 0.55, d = 0.42 }) {
  const g = new THREE.Group();
  g.add(block(w, h - 0.08, d, wood, 0, 0.08, 0));
  legs(g, w, d, 0.08, wood, 0.04, 0.02);
  for (let i = 0; i < drawers; i++) {
    const dh = (h - 0.14) / drawers;
    const y = 0.11 + i * dh;
    g.add(block(w - 0.04, dh - 0.03, 0.01, wood, 0, y, d / 2 + 0.005));
    g.add(block(0.12, 0.012, 0.015, handle, 0, y + dh / 2 - 0.015, d / 2 + 0.017));
  }
  return g;
}

/** Table lamp with an optional warm point light inside the shade. */
export function tableLamp({ base, shadeColor = '#f3e6cf', light = 6, height = 0.55 }) {
  const g = new THREE.Group();
  g.add(cylinder(0.07, 0.09, 0.03, base, 0, 0, 0));
  g.add(cylinder(0.015, 0.015, height * 0.6, base, 0, 0.03, 0, 8));
  const shadeMat = mat({ color: shadeColor, emissive: '#ffcf8a', emissiveIntensity: 0.55, side: THREE.DoubleSide, roughness: 0.9 });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.22, 28, 1, true), shadeMat);
  shade.position.y = height * 0.6 + 0.12;
  g.add(shade);
  if (light) {
    const p = new THREE.PointLight('#ffcf94', light, 4.5, 2);
    p.position.y = height * 0.6 + 0.1;
    g.add(p);
  }
  return g;
}

export function floorLamp({ base, shadeColor = '#efe4d2', light = 8 }) {
  const g = new THREE.Group();
  g.add(cylinder(0.16, 0.18, 0.03, base, 0, 0, 0));
  g.add(cylinder(0.015, 0.015, 1.45, base, 0, 0.03, 0, 8));
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, 0.3, 28, 1, true),
    mat({ color: shadeColor, emissive: '#ffcf8a', emissiveIntensity: 0.5, side: THREE.DoubleSide, roughness: 0.9 }),
  );
  shade.position.y = 1.55;
  g.add(shade);
  if (light) {
    const p = new THREE.PointLight('#ffcf94', light, 6, 2);
    p.position.y = 1.5;
    g.add(p);
  }
  return g;
}

export function wallSconce({ metal, light = 3 }) {
  const g = new THREE.Group();
  g.add(block(0.08, 0.2, 0.03, metal, 0, -0.1, 0));
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 20), mat({ color: '#fff3dc', emissive: '#ffd59a', emissiveIntensity: 1.2 }));
  glow.position.set(0, 0, 0.1);
  g.add(glow);
  if (light) {
    const p = new THREE.PointLight('#ffd29a', light, 3, 2);
    p.position.set(0, 0, 0.2);
    g.add(p);
  }
  return g;
}

// ---------- seating & tables ----------

export function chair({ wood, seat }) {
  const g = new THREE.Group();
  legs(g, 0.44, 0.44, 0.45, wood, 0.03, 0.018);
  g.add(soft(0.46, 0.06, 0.46, seat, 0, 0.45, 0, 0.02));
  g.add(soft(0.44, 0.45, 0.05, seat, 0, 0.5, -0.21, 0.02));
  return g;
}

export function armchair({ fabric, legsMat, w = 0.8 }) {
  const g = new THREE.Group();
  legs(g, w, 0.78, 0.12, legsMat, 0.06, 0.02);
  g.add(soft(w, 0.3, 0.78, fabric, 0, 0.12, 0, 0.06));
  g.add(soft(w - 0.2, 0.12, 0.6, fabric, 0, 0.42, 0.05, 0.05));
  g.add(soft(w, 0.5, 0.16, fabric, 0, 0.36, -0.31, 0.06));
  for (const s of [-1, 1]) g.add(soft(0.13, 0.25, 0.78, fabric, s * (w / 2 - 0.065), 0.36, 0, 0.05));
  return g;
}

export function sofa({ width = 2.1, depth = 0.9, fabric, legsMat, cushionMat, arms = 'both', pillows = [] }) {
  const g = new THREE.Group();
  legs(g, width, depth, 0.12, legsMat, 0.08, 0.02);
  g.add(soft(width, 0.28, depth, fabric, 0, 0.12, 0, 0.05));
  const armW = 0.16;
  const leftArm = arms === 'both' || arms === 'left';
  const rightArm = arms === 'both' || arms === 'right';
  const inner = width - (leftArm ? armW : 0) - (rightArm ? armW : 0);
  const innerX = ((leftArm ? armW : 0) - (rightArm ? armW : 0)) / 2;
  const seats = Math.max(1, Math.round(inner / 0.75));
  for (let i = 0; i < seats; i++) {
    const cw = inner / seats;
    g.add(soft(cw - 0.02, 0.14, depth - 0.22, cushionMat ?? fabric, innerX - inner / 2 + cw * (i + 0.5), 0.4, 0.08, 0.05));
    g.add(soft(cw - 0.04, 0.42, 0.18, cushionMat ?? fabric, innerX - inner / 2 + cw * (i + 0.5), 0.46, -depth / 2 + 0.18, 0.07));
  }
  g.add(soft(width, 0.55, 0.16, fabric, 0, 0.36, -depth / 2 + 0.08, 0.06));
  if (leftArm) g.add(soft(armW, 0.3, depth, fabric, -width / 2 + armW / 2, 0.4, 0, 0.05));
  if (rightArm) g.add(soft(armW, 0.3, depth, fabric, width / 2 - armW / 2, 0.4, 0, 0.05));
  pillows.forEach((m, i) => {
    const p = soft(0.42, 0.42, 0.12, m, innerX + (i % 2 ? 1 : -1) * (inner / 2 - 0.3), 0.55, -depth / 2 + 0.3, 0.06);
    p.rotation.x = -0.25;
    p.rotation.z = (i % 2 ? -1 : 1) * 0.1;
    g.add(p);
  });
  return g;
}

export function coffeeTable({ top, legsMat, w = 1.1, d = 0.6, h = 0.42, round = false }) {
  const g = new THREE.Group();
  if (round) {
    g.add(cylinder(w / 2, w / 2, 0.04, top, 0, h - 0.04, 0, 40));
    g.add(cylinder(0.05, 0.12, h - 0.04, legsMat, 0, 0, 0, 16));
  } else {
    g.add(block(w, 0.04, d, top, 0, h - 0.04, 0));
    legs(g, w, d, h - 0.04, legsMat, 0.05, 0.018);
    g.add(block(w - 0.1, 0.02, d - 0.1, top, 0, 0.12, 0));
  }
  return g;
}

export function desk({ wood, legsMat, w = 1.2, d = 0.55, h = 0.75 }) {
  const g = new THREE.Group();
  g.add(block(w, 0.035, d, wood, 0, h - 0.035, 0));
  g.add(block(0.4, 0.14, d - 0.04, wood, w / 2 - 0.22, h - 0.175, 0));
  legs(g, w, d, h - 0.035, legsMat, 0.03, 0.016);
  return g;
}

export function diningTable({ top, legsMat, w = 1.6, d = 0.9 }) {
  const g = new THREE.Group();
  g.add(block(w, 0.05, d, top, 0, 0.72, 0));
  for (const s of [-1, 1]) {
    g.add(block(0.06, 0.72, d - 0.2, legsMat, s * (w / 2 - 0.2), 0, 0));
  }
  return g;
}

export function barStool({ seat, metal }) {
  const g = new THREE.Group();
  g.add(cylinder(0.18, 0.2, 0.02, metal, 0, 0, 0));
  g.add(cylinder(0.022, 0.022, 0.66, metal, 0, 0.02, 0, 10));
  g.add(soft(0.38, 0.07, 0.38, seat, 0, 0.68, 0, 0.03));
  return g;
}

// ---------- storage & media ----------

export function wardrobe({ wood, handle, w = 1.2, h = 2.2, d = 0.6 }) {
  const g = new THREE.Group();
  g.add(block(w, h, d, wood, 0, 0, 0));
  g.add(block(0.006, h - 0.1, 0.01, mat({ color: '#2a2017' }), 0, 0.05, d / 2 + 0.004));
  for (const s of [-1, 1]) g.add(block(0.02, 0.4, 0.02, handle, s * 0.06, h * 0.45, d / 2 + 0.015));
  return g;
}

export function consoleUnit({ wood, handle, w = 1.6, h = 0.55, d = 0.45 }) {
  const g = new THREE.Group();
  g.add(block(w, h - 0.1, d, wood, 0, 0.1, 0));
  legs(g, w, d, 0.1, handle, 0.06, 0.015);
  const doors = Math.round(w / 0.5);
  for (let i = 0; i < doors; i++) {
    const x = -w / 2 + (w / doors) * (i + 0.5);
    g.add(block(w / doors - 0.02, h - 0.16, 0.01, wood, x, 0.13, d / 2 + 0.005));
    g.add(block(0.1, 0.012, 0.015, handle, x, h - 0.12, d / 2 + 0.015));
  }
  return g;
}

/** Wall-mounted flat-screen TV (origin at its centre; place on a wall). */
export function tv({ width = 1.1 }) {
  const g = new THREE.Group();
  const h = width * 0.5625;
  g.add(shadow(new THREE.Mesh(new THREE.BoxGeometry(width + 0.03, h + 0.03, 0.04), mat({ color: '#111', roughness: 0.4 })), true, false));
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(width, h),
    mat({ color: '#0d1620', roughness: 0.15, metalness: 0.4, emissive: '#122a3d', emissiveIntensity: 0.35 }),
  );
  screen.position.z = 0.021;
  g.add(screen);
  return g;
}

export function miniFridge({ body, handle }) {
  const g = new THREE.Group();
  g.add(block(0.48, 0.55, 0.48, body, 0, 0, 0));
  g.add(block(0.02, 0.3, 0.02, handle, 0.19, 0.15, 0.25));
  return g;
}

// ---------- textiles & decor ----------

export function rug({ w, d, material }) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), material);
  m.position.y = 0.006;
  m.receiveShadow = true;
  g.add(m);
  return g;
}

/** Gathered curtain panel made from a rippled plane (origin at top centre). */
export function curtain({ width = 0.9, height = 2.4, material, folds = 7 }) {
  const geo = new THREE.PlaneGeometry(width, height, folds * 8, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, Math.sin((x / width) * folds * Math.PI * 2) * 0.05);
  }
  geo.computeVertexNormals();
  const m = shadow(new THREE.Mesh(geo, material));
  m.material.side = THREE.DoubleSide;
  m.position.y = -height / 2;
  const g = new THREE.Group();
  g.add(m);
  return g;
}

export function framedArt({ w = 0.7, h = 0.9, texture, frame }) {
  const g = new THREE.Group();
  g.add(shadow(new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, h + 0.06, 0.03), frame), true, false));
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat({ map: texture, roughness: 0.85 }));
  art.position.z = 0.016;
  g.add(art);
  return g;
}

export function mirror({ w = 0.8, h = 1.1, frame }) {
  const g = new THREE.Group();
  g.add(shadow(new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.03), frame), true, false));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat({ color: '#c9d3da', metalness: 1, roughness: 0.04 }));
  glass.position.z = 0.016;
  g.add(glass);
  return g;
}

export function plant({ pot, leaf, scale = 1 }) {
  const g = new THREE.Group();
  g.add(cylinder(0.17 * scale, 0.13 * scale, 0.4 * scale, pot, 0, 0, 0, 20));
  const leafMat = leaf ?? mat({ color: '#3f6b3a', roughness: 0.8, flatShading: true });
  const leafGeo = new THREE.IcosahedronGeometry(0.16 * scale, 0);
  const spots = [[0, 0.75, 0, 1.3], [0.12, 0.62, 0.06, 1], [-0.13, 0.65, -0.05, 1.05], [0.04, 0.95, -0.08, 1.1], [-0.06, 0.88, 0.1, 0.9], [0.1, 1.08, 0.04, 0.8]];
  for (const [x, y, z, s] of spots) {
    const m = shadow(new THREE.Mesh(leafGeo, leafMat));
    m.position.set(x * scale, y * scale, z * scale);
    m.scale.setScalar(s);
    m.rotation.set(x * 10, y * 7, z * 5);
    g.add(m);
  }
  g.add(cylinder(0.012 * scale, 0.012 * scale, 0.5 * scale, mat({ color: '#4a3b2a' }), 0, 0.35 * scale, 0, 6));
  return g;
}

export function vaseWithFlowers({ vase, bloom = '#f3efe6' }) {
  const g = new THREE.Group();
  const prof = [[0.0, 0], [0.06, 0], [0.08, 0.06], [0.05, 0.18], [0.04, 0.24], [0.05, 0.27]].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(shadow(new THREE.Mesh(new THREE.LatheGeometry(prof, 24), vase)));
  const stem = mat({ color: '#4d6b3c' });
  const petal = mat({ color: bloom, roughness: 0.6 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const s = cylinder(0.004, 0.004, 0.22, stem, Math.cos(a) * 0.02, 0.24, Math.sin(a) * 0.02, 5);
    g.add(s);
    const b = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), petal));
    b.position.set(Math.cos(a) * 0.05, 0.47 + (i % 2) * 0.03, Math.sin(a) * 0.05);
    g.add(b);
  }
  return g;
}

export function books({ colors = ['#7b2e2e', '#2c4058', '#b08d59', '#3c5a46'] }) {
  const g = new THREE.Group();
  let y = 0;
  colors.forEach((c, i) => {
    const h = 0.035 + (i % 2) * 0.01;
    const b = block(0.26 - i * 0.02, h, 0.19, mat({ color: c }), (i % 2) * 0.01, y, 0);
    b.rotation.y = (i - 1.5) * 0.08;
    g.add(b);
    y += h;
  });
  return g;
}

// ---------- bath ----------

export function bathtub({ body, metal }) {
  const g = new THREE.Group();
  const outer = [[0.0, 0.0], [0.52, 0.0], [0.62, 0.15], [0.66, 0.58], [0.6, 0.6], [0.56, 0.2], [0.46, 0.08], [0.0, 0.08]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const tub = shadow(new THREE.Mesh(new THREE.LatheGeometry(outer, 48), body));
  tub.scale.set(1.35, 1, 0.75);
  g.add(tub);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.55, 40), mat({ color: '#a9cfd8', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.7 }));
  water.rotation.x = -Math.PI / 2;
  water.scale.set(1.35, 0.75, 1);
  water.position.y = 0.42;
  g.add(water);
  const spout = cylinder(0.02, 0.02, 0.9, metal, -0.95, 0, 0, 10);
  g.add(spout);
  const arm = block(0.25, 0.03, 0.03, metal, -0.83, 0.9, 0);
  g.add(arm);
  return g;
}

// ---------- architecture helpers ----------

export function door({ wood, handle, frameMat, w = 0.95, h = 2.15 }) {
  const g = new THREE.Group();
  g.add(block(w + 0.14, h + 0.08, 0.04, frameMat, 0, 0, 0));
  g.add(block(w, h, 0.05, wood, 0, 0, 0.02));
  for (const [y, ph] of [[0.25, 0.8], [1.2, 0.8]]) g.add(block(w - 0.3, ph, 0.01, wood, 0, y, 0.05));
  const lever = block(0.14, 0.02, 0.03, handle, w / 2 - 0.15, 1.02, 0.07);
  g.add(lever);
  g.add(cylinder(0.03, 0.03, 0.02, handle, w / 2 - 0.1, 1.02, 0.05));
  return g;
}

export function recessedLight() {
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), new THREE.MeshBasicMaterial({ color: '#fff6e6' }));
  m.rotation.x = Math.PI / 2;
  return m;
}

/** Emissive cove-light strip (origin at its centre). */
export function coveStrip(length, color = '#ffd9a8', intensity = 1.6) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.02, 0.04),
    mat({ color: '#fff', emissive: color, emissiveIntensity: intensity }),
  );
}

export function pendant({ metal, glow = '#ffe2b0', light = 6, drop = 0.7 }) {
  const g = new THREE.Group();
  g.add(cylinder(0.004, 0.004, drop, metal, 0, -drop, 0, 4));
  const shade = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat({ color: '#c9a46a', metalness: 1, roughness: 0.3, side: THREE.DoubleSide }));
  shade.position.y = -drop - 0.14;
  g.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), mat({ color: '#fff', emissive: glow, emissiveIntensity: 2.5 }));
  bulb.position.y = -drop - 0.12;
  g.add(bulb);
  if (light) {
    const p = new THREE.PointLight('#ffd7a0', light, 5, 2);
    p.position.y = -drop - 0.15;
    g.add(p);
  }
  return g;
}

/** Ring chandelier for the VIP suite (origin at ceiling). */
export function chandelier({ metal, light = 14, drop = 0.8, radius = 0.45 }) {
  const g = new THREE.Group();
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const rod = cylinder(0.004, 0.004, drop, metal, Math.cos(a) * radius * 0.6, -drop, Math.sin(a) * radius * 0.6, 4);
    g.add(rod);
  }
  for (const [r, y] of [[radius, -drop], [radius * 0.7, -drop - 0.14]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.018, 10, 64), metal);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 6, 64), mat({ color: '#fff', emissive: '#ffdcae', emissiveIntensity: 2.2 }));
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = y - 0.022;
    g.add(glowRing);
  }
  if (light) {
    const p = new THREE.PointLight('#ffd9a8', light, 8, 2);
    p.position.y = -drop - 0.3;
    g.add(p);
  }
  return g;
}
