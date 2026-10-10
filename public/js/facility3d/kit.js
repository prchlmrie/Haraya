// Shared building blocks for the amenity scenes: re-exports of the room kit,
// extra procedural textures, animation helpers and hotspot tagging.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from '../room3d/textures.js';
import * as F from '../room3d/furniture.js';

export { THREE, T, F };
export { buildShell, onWall, grp, at, addSun, ceilingLights } from '../room3d/rooms.js';
export const { mat, block, soft, cylinder, METALS } = F;

const { makeCanvas, toTexture, shade, addNoise, rng } = T;

// ---------- scene helpers ----------

/** Marks an object (and everything inside it) as the clickable target for a hotspot. */
export function tag(obj, hotspotId) {
  obj.userData.hotspot = hotspotId;
  return obj;
}

export function noShadow(obj) {
  obj.traverse((o) => { o.castShadow = false; });
  return obj;
}

/** Plain emissive material for screens, signs and light fixtures. */
export function glow(color, intensity = 1.5, opts = {}) {
  return mat({ color: '#ffffff', emissive: color, emissiveIntensity: intensity, roughness: 0.4, ...opts });
}

export function hemi(group, sky = '#ffffff', ground = '#6b5a48', intensity = 0.6) {
  group.add(new THREE.HemisphereLight(sky, ground, intensity));
}

export function pointLight(group, [x, y, z], color = '#ffd9a8', intensity = 6, distance = 8) {
  const p = new THREE.PointLight(color, intensity, distance, 2);
  p.position.set(x, y, z);
  group.add(p);
  return p;
}

/** Linear LED ceiling fixture (origin at its centre on the ceiling). */
export function ledBar(length, color = '#fff4e2', intensity = 2.2) {
  const g = new THREE.Group();
  g.add(block(length + 0.04, 0.04, 0.1, mat({ color: '#2a2a2a', metalness: 0.5, roughness: 0.4 }), 0, -0.04, 0));
  const tube = new THREE.Mesh(new THREE.BoxGeometry(length, 0.012, 0.07), glow(color, intensity));
  tube.position.y = -0.046;
  g.add(tube);
  return noShadow(g);
}

/** Simple time-based animation list; each entry returns false when it is finished. */
export function animator() {
  const items = new Set();
  return {
    add(fn) { items.add(fn); return fn; },
    update(dt, t) { for (const fn of items) if (fn(dt, t) === false) items.delete(fn); },
  };
}

/** Plays `fn(k)` with k going 0 → 1 over `seconds`, eased out. */
export function playOnce(anim, seconds, fn, done) {
  let elapsed = 0;
  anim.add((dt) => {
    elapsed += dt;
    const k = Math.min(1, elapsed / seconds);
    fn(k, 1 - Math.pow(1 - k, 3));
    if (k >= 1) { done?.(); return false; }
    return true;
  });
}

// ---------- textures ----------

export function canvasTexture(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const [c, ctx] = makeCanvas(w, h);
  draw(ctx, w, h);
  return toTexture(c, repeat, { srgb });
}

/** Square ceramic or mosaic tiles with grout lines. */
export function tiles(base, grout, { count = 8, repeat = [1, 1], seed = 5, vary = 0.06 } = {}) {
  return canvasTexture(512, 512, (ctx, S) => {
    const r = rng(seed);
    const s = S / count;
    ctx.fillStyle = grout;
    ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) {
      ctx.fillStyle = shade(base, (r() - 0.5) * vary);
      ctx.fillRect(x * s + 1.5, y * s + 1.5, s - 3, s - 3);
    }
    addNoise(ctx, S, S, 8, r);
  }, { repeat });
}

/** Speckled rubber gym flooring. */
export function rubber(base = '#2b2d30', { repeat = [6, 6], seed = 31 } = {}) {
  return canvasTexture(256, 256, (ctx, S) => {
    const r = rng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = ['#5a5f66', '#7b8188', '#1a1b1d', '#4a4e54'][Math.floor(r() * 4)];
      ctx.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, S, S);
  }, { repeat });
}

export function concrete(base = '#9a9792', { repeat = [4, 4], seed = 37 } = {}) {
  return canvasTexture(512, 512, (ctx, S) => {
    const r = rng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${0.02 + r() * 0.04})`;
      ctx.beginPath();
      ctx.arc(r() * S, r() * S, 20 + r() * 90, 0, Math.PI * 2);
      ctx.fill();
    }
    addNoise(ctx, S, S, 12, r);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.strokeRect(0, 0, S, S);
  }, { repeat });
}

export function felt(base = '#1f6b45', { repeat = [1, 1], seed = 41 } = {}) {
  return canvasTexture(256, 256, (ctx, S) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    addNoise(ctx, S, S, 16, rng(seed));
  }, { repeat });
}

/** Artificial turf with mown stripes. */
export function turf(base = '#3f7d3a', { repeat = [4, 4], stripes = 0, seed = 43 } = {}) {
  return canvasTexture(256, 256, (ctx, S) => {
    const r = rng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    if (stripes) {
      ctx.fillStyle = shade(base, 0.05);
      for (let i = 0; i < stripes; i += 2) ctx.fillRect(0, (S / stripes) * i, S, S / stripes);
    }
    for (let i = 0; i < 2500; i++) {
      ctx.fillStyle = r() > 0.5 ? shade(base, 0.08) : shade(base, -0.08);
      ctx.fillRect(r() * S, r() * S, 1, 2 + r() * 2);
    }
  }, { repeat });
}

/** Transparent netting (use with alphaTest). */
export function netting({ cells = 16, color = 'rgba(20,20,20,0.95)', repeat = [4, 2] } = {}) {
  const tex = canvasTexture(256, 256, (ctx, S) => {
    ctx.clearRect(0, 0, S, S);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    const s = S / cells;
    for (let i = 0; i <= cells; i++) {
      ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(S, i * s); ctx.stroke();
    }
  }, { repeat });
  return tex;
}

export function netMaterial(repeat, color) {
  return mat({ map: netting({ repeat, color }), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.9 });
}

/** Tileable ripple normal map for water. */
export function waterNormals({ repeat = [3, 3] } = {}) {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const h = new Float32Array(S * S);
  const waves = [[3, 2, 1, 0.3], [5, -4, 0.6, 1.7], [-7, 6, 0.4, 2.4], [11, 9, 0.25, 0.9], [-13, 5, 0.18, 3.1]];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0;
    for (const [kx, ky, a, p] of waves) v += a * Math.sin(((kx * x + ky * y) / S) * Math.PI * 2 + p);
    h[y * S + x] = v;
  }
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = h[y * S + ((x + 1) % S)] - h[y * S + ((x - 1 + S) % S)];
    const dy = h[((y + 1) % S) * S + x] - h[((y - 1 + S) % S) * S + x];
    const n = new THREE.Vector3(-dx * 2.2, -dy * 2.2, 1).normalize();
    const i = (y * S + x) * 4;
    img.data[i] = (n.x * 0.5 + 0.5) * 255;
    img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
    img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, repeat, { srgb: false });
}

/** Light web pattern projected on the pool floor (tileable). */
export function caustics({ repeat = [3, 3] } = {}) {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x / S) * Math.PI * 2, v = (y / S) * Math.PI * 2;
    const a = Math.sin(u * 3 + Math.sin(v * 2) * 1.6) + Math.sin(v * 4 + Math.sin(u * 3) * 1.3) + Math.sin((u + v) * 2 + Math.cos(u * 5));
    const k = Math.pow(1 - Math.min(1, Math.abs(a) / 1.1), 4);
    const i = (y * S + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = k * 255;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, repeat);
}

/** Text sign; `neon` adds a soft glow around the letters. */
export function signTexture(text, { width = 1024, height = 256, color = '#c9a46a', bg = 'transparent', font = '600 120px "Segoe UI", Arial, sans-serif', neon = false, sub } = {}) {
  return canvasTexture(width, height, (ctx, W, H) => {
    if (bg !== 'transparent') { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font;
    if (neon) { ctx.shadowColor = color; ctx.shadowBlur = 30; }
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, sub ? H * 0.42 : H / 2);
    if (neon) ctx.fillText(text, W / 2, sub ? H * 0.42 : H / 2);
    if (sub) {
      ctx.shadowBlur = 0;
      ctx.font = font.replace(/\d+px/, `${Math.round(parseInt(font.match(/(\d+)px/)[1], 10) * 0.32)}px`);
      ctx.fillText(sub, W / 2, H * 0.8);
    }
  }, { repeat: [1, 1] });
}

/**
 * Canvas texture redrawn at a capped frame rate (TV, arcade and simulator
 * screens). `draw(ctx, w, h, t)` paints one frame.
 */
export function liveScreen(draw, { width = 256, height = 160, fps = 12 } = {}) {
  const [c, ctx] = makeCanvas(width, height);
  const texture = toTexture(c, [1, 1]);
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  let last = -1;
  draw(ctx, width, height, 0);
  return {
    texture,
    update(t) {
      if (t - last < 1 / fps) return;
      last = t;
      draw(ctx, width, height, t);
      texture.needsUpdate = true;
    },
  };
}

/** Large painted panorama wrapped around outdoor scenes. */
export function panorama(kind = 'bay') {
  const t = T.viewTexture(kind);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

/** Sky dome plus a painted horizon cylinder for outdoor scenes. */
export function skyDome({ top = '#5f93c9', horizon = '#dce9f2', view = 'bay', radius = 60 } = {}) {
  const g = new THREE.Group();
  const sky = canvasTexture(16, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, top);
    grad.addColorStop(0.5, horizon);
    grad.addColorStop(1, horizon);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.25, 32, 16), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, toneMapped: false, fog: false }));
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, radius * 0.8, 48, 1, true),
    new THREE.MeshBasicMaterial({ map: panorama(view), side: THREE.BackSide, toneMapped: false, color: '#ececec' }),
  );
  band.position.y = -radius * 0.08;
  const sea = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshBasicMaterial({ color: '#2d5873', toneMapped: false }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = band.position.y - radius * 0.4 + 0.01;
  for (const m of [dome, band, sea]) { m.userData.noPick = true; m.renderOrder = -1; g.add(m); }
  return g;
}

/** Row of bottles for back-bar shelves (origin at the shelf surface). */
export function bottleRow(width, { seed = 3, spacing = 0.11 } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  const palette = ['#3d5a2a', '#6b3a1f', '#c9a46a', '#d8e4e8', '#7a1f2b', '#2a3d5a', '#8a6a2a'];
  const mats = palette.map((c) => mat({ color: c, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }));
  const label = mat({ color: '#f1ead9', roughness: 0.8 });
  const count = Math.floor(width / spacing);
  for (let i = 0; i < count; i++) {
    const h = 0.24 + r() * 0.1;
    const rad = 0.03 + r() * 0.012;
    const x = -width / 2 + spacing * (i + 0.5);
    const m = mats[Math.floor(r() * mats.length)];
    g.add(cylinder(rad, rad, h * 0.7, m, x, 0, 0, 12));
    g.add(cylinder(rad * 0.32, rad, h * 0.3, m, x, h * 0.7, 0, 12));
    g.add(cylinder(rad + 0.002, rad + 0.002, h * 0.22, label, x, h * 0.22, 0, 12));
  }
  return noShadow(g);
}

// ---------- small shared props ----------

/** Alpha-tested palm frond texture. */
export function leafTexture() {
  return canvasTexture(128, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#4f6b2c';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(w / 2, h); ctx.lineTo(w / 2, 0); ctx.stroke();
    for (let y = h - 30; y > 10; y -= 9) {
      const t = 1 - y / h;
      const len = (w / 2 - 4) * Math.sin(Math.min(1, t * 1.1) * Math.PI) * 0.95 + 6;
      ctx.strokeStyle = ['#3f6b2a', '#4c7a30', '#5d8a38'][Math.floor(y / 9) % 3];
      ctx.lineWidth = 5;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(w / 2, y); ctx.lineTo(w / 2 + s * len, y - 22); ctx.stroke();
      }
    }
  });
}

/** Slightly leaning palm tree (origin at the base of the trunk). */
export function palm(height, trunkMat, leafMat, seed) {
  const g = new THREE.Group();
  const r = rng(seed);
  const segs = 7;
  const lean = (r() - 0.5) * 0.5;
  let x = 0, y = 0;
  for (let i = 0; i < segs; i++) {
    const segH = height / segs;
    const ang = lean * (i / segs);
    const s = cylinder(0.1 + (segs - i) * 0.006, 0.12 + (segs - i) * 0.006, segH * 1.05, trunkMat, x, y, 0, 10);
    s.rotation.z = -ang;
    g.add(s);
    x += Math.sin(ang) * segH;
    y += Math.cos(ang) * segH;
  }
  const crown = new THREE.Group();
  crown.position.set(x, y, 0);
  const L = 2.3;
  for (let i = 0; i < 10; i++) {
    const geo = new THREE.PlaneGeometry(0.85, L, 2, 10);
    geo.translate(0, L / 2, 0);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const px = pos.getX(k), py = pos.getY(k), t = py / L;
      pos.setXYZ(k, px * (1 - t * 0.35), -0.9 * t * t - Math.abs(px) * 0.25 + 0.25 * t, py);
    }
    geo.computeVertexNormals();
    const leaf = new THREE.Mesh(geo, leafMat);
    leaf.rotation.y = (i / 10) * Math.PI * 2 + r() * 0.3;
    leaf.rotation.x = -0.15 + r() * 0.3;
    leaf.castShadow = true;
    crown.add(leaf);
  }
  g.add(crown);
  return g;
}

/**
 * Merges several geometries (each already transformed) into one and draws it
 * at every matrix in `matrices` with a single InstancedMesh.
 */
export function instanced(geometries, material, matrices, { cast = true, receive = true } = {}) {
  const geo = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries.map((g) => g.index ? g.toNonIndexed() : g));
  const mesh = new THREE.InstancedMesh(geo, material, Math.max(1, matrices.length));
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.count = matrices.length;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/** Placement matrix: position, Y rotation and optional uniform scale. */
export function place(x, y, z, ry = 0, s = 1) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s, s, s));
}

/** Box geometry positioned by its bottom-centre (for merging). */
export function boxGeo(w, h, d, x = 0, y = 0, z = 0) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
}

export function cylGeo(rt, rb, h, x = 0, y = 0, z = 0, seg = 16) {
  return new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y + h / 2, z);
}

/** Wall-mounted flat screen showing a live texture (origin at its centre). */
export function screen(width, texture, { frame = '#111', intensity = 1.1 } = {}) {
  const g = new THREE.Group();
  const h = width * 0.5625;
  g.add(block(width + 0.04, h + 0.04, 0.05, mat({ color: frame, roughness: 0.4 }), 0, -h / 2 - 0.02, 0));
  const s = new THREE.Mesh(new THREE.PlaneGeometry(width, h), mat({ map: texture, emissive: '#ffffff', emissiveMap: texture, emissiveIntensity: intensity, roughness: 0.3 }));
  s.position.z = 0.026;
  g.add(s);
  return g;
}

export function glassPanel(w, h, opts = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat({ color: '#dfeaf0', roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, ...opts }));
  m.userData.noPick = true;
  return m;
}

export function towelStack(color = '#f7f4ee', count = 4) {
  const g = new THREE.Group();
  const m = mat({ map: T.fabric(color, { seed: 61, repeat: [2, 2] }), roughness: 1 });
  for (let i = 0; i < count; i++) g.add(soft(0.38, 0.07, 0.28, m, 0, i * 0.072, 0, 0.03));
  return g;
}

export function rolledTowel(color = '#f7f4ee') {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 16), mat({ map: T.fabric(color, { seed: 63 }), roughness: 1 }));
  m.rotation.z = Math.PI / 2;
  m.castShadow = true;
  return m;
}
