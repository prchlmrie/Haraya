// Procedural room layouts for the three categories. Coordinates: room centred
// on the origin, floor at y = 0, X = width, Z = depth (back wall at -D/2,
// entrance wall at +D/2). Each builder returns the scene graph plus the
// guided-tour viewpoints and the camera bounds.
import * as THREE from 'three';
import * as T from './textures.js';
import * as F from './furniture.js';

const { mat, block, soft } = F;

// ---------- room shell ----------

/** Wall pieces around openings; inner face at local z = 0, facing +Z. UVs are in metres / tile. */
function wallMesh(L, H, t, material, openings, tile) {
  const g = new THREE.Group();
  const piece = (x0, x1, y0, y1) => {
    if (x1 - x0 < 0.001 || y1 - y0 < 0.001) return;
    const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, t);
    const uv = geo.attributes.uv;
    for (let i = 16; i < 20; i++) {
      uv.setXY(i, (x0 + L / 2 + uv.getX(i) * (x1 - x0)) / tile, (y0 + uv.getY(i) * (y1 - y0)) / tile);
    }
    const m = new THREE.Mesh(geo, material);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, -t / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  };
  let cursor = -L / 2;
  for (const o of [...openings].sort((a, b) => a.center - b.center)) {
    const l = o.center - o.width / 2, r = o.center + o.width / 2;
    piece(cursor, l, 0, H);
    piece(l, r, 0, o.sill);
    piece(l, r, o.sill + o.height, H);
    cursor = r;
  }
  piece(cursor, L / 2, 0, H);
  return g;
}

/** X ranges along a wall not interrupted by openings overlapping the band [y0, y1]. */
function freeRanges(L, openings, y0, y1) {
  const blocked = openings.filter((o) => o.sill < y1 && o.sill + o.height > y0).sort((a, b) => a.center - b.center);
  const out = [];
  let cursor = -L / 2;
  for (const o of blocked) {
    const l = o.center - o.width / 2;
    if (l > cursor) out.push([cursor, l]);
    cursor = Math.max(cursor, o.center + o.width / 2);
  }
  if (cursor < L / 2) out.push([cursor, L / 2]);
  return out;
}

function windowParts(o, L, H, t, { frame, glass, view, curtain, sheer, rod }) {
  const g = new THREE.Group();
  const l = o.center - o.width / 2, r = o.center + o.width / 2, top = o.sill + o.height;
  const fw = 0.06;
  g.add(block(o.width + fw * 2, fw, t + 0.02, frame, o.center, top, -t / 2));
  g.add(block(o.width + fw * 2, fw, t + 0.02, frame, o.center, o.sill - (o.sill > 0 ? fw : 0), -t / 2));
  for (const x of [l - fw / 2, r + fw / 2]) g.add(block(fw, o.height, t + 0.02, frame, x, o.sill, -t / 2));
  const panes = o.panes ?? Math.max(1, Math.round(o.width / 1.2));
  for (let i = 1; i < panes; i++) g.add(block(0.04, o.height, 0.06, frame, l + (o.width / panes) * i, o.sill, -t / 2));
  if (o.sill > 0.05) g.add(block(o.width + 0.2, 0.03, 0.2, frame, o.center, o.sill - 0.03, 0.06));
  const glassMesh = new THREE.Mesh(new THREE.PlaneGeometry(o.width, o.height), glass);
  glassMesh.position.set(o.center, o.sill + o.height / 2, -t / 2);
  g.add(glassMesh);

  // Painted landscape outside the window, large enough to fill every viewing angle.
  const vw = Math.max(o.width * 3.2, 14), vh = vw / 2;
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(vw, vh), view);
  backdrop.position.set(o.center, o.sill + o.height / 2 + vh * 0.05, -t - 4.5);
  g.add(backdrop);

  if (curtain) {
    const railY = Math.min(H - 0.08, top + 0.15);
    const cw = Math.min(1.1, o.width * 0.3);
    const ch = railY - 0.03;
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, Math.min(o.width + cw * 2 + 0.3, L - 0.04), 8), rod);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(o.center, railY, 0.14);
    g.add(rail);
    for (const s of [-1, 1]) {
      const c = F.curtain({ width: cw, height: ch, material: curtain, folds: 6 });
      const offset = Math.min(o.width / 2 + cw / 2 - 0.1, L / 2 - Math.abs(o.center) - cw / 2 - 0.03);
      c.position.set(o.center + s * offset, railY, 0.16);
      g.add(c);
    }
    if (sheer) {
      const sh = F.curtain({ width: o.width * 0.35, height: ch, material: sheer, folds: 8 });
      sh.position.set(o.center - o.width * 0.32, railY, 0.1);
      g.add(sh);
    }
  }
  return g;
}

/**
 * Builds floor, ceiling and four walls. `walls` maps back/front/left/right to
 * { openings: [{ center, width, sill, height }] } in wall-local coordinates
 * (local +X is: back → +x, front → -x, left → -z, right → +z).
 */
export function buildShell({ W, D, H, floorMat, wallMat, ceilingMat, trimMat, walls, windowStyle, tile = 1, crown = false, wainscot }) {
  const shell = new THREE.Group();
  const t = 0.14;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  shell.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  ceiling.receiveShadow = true;
  shell.add(ceiling);
  // Thin slab above the ceiling so sunlight cannot leak through it.
  shell.add(block(W + 2 * t, 0.1, D + 2 * t, ceilingMat, 0, H, 0));

  const placements = {
    back: { L: W, pos: [0, 0, -D / 2], ry: 0 },
    front: { L: W, pos: [0, 0, D / 2], ry: Math.PI },
    left: { L: D, pos: [-W / 2, 0, 0], ry: Math.PI / 2 },
    right: { L: D, pos: [W / 2, 0, 0], ry: -Math.PI / 2 },
  };
  for (const [side, p] of Object.entries(placements)) {
    const openings = walls[side]?.openings ?? [];
    const g = new THREE.Group();
    g.add(wallMesh(p.L + (side === 'back' || side === 'front' ? 2 * t : 0), H, t, wallMat, openings, tile));
    for (const o of openings) g.add(windowParts(o, p.L, H, t, windowStyle));
    for (const [x0, x1] of freeRanges(p.L, openings, 0, 0.12)) g.add(block(x1 - x0, 0.11, 0.02, trimMat, (x0 + x1) / 2, 0, 0.01));
    if (crown) for (const [x0, x1] of freeRanges(p.L, openings, H - 0.12, H)) g.add(block(x1 - x0, 0.1, 0.06, trimMat, (x0 + x1) / 2, H - 0.1, 0.03));
    if (wainscot) {
      for (const [x0, x1] of freeRanges(p.L, openings, 0, wainscot.height)) {
        g.add(block(x1 - x0, wainscot.height - 0.11, 0.015, wainscot.material, (x0 + x1) / 2, 0.11, 0.008));
        g.add(block(x1 - x0, 0.035, 0.035, trimMat, (x0 + x1) / 2, wainscot.height, 0.018));
        const panels = Math.floor((x1 - x0) / 0.7);
        for (let i = 0; i < panels; i++) {
          const cx = x0 + ((x1 - x0) / panels) * (i + 0.5);
          g.add(block(((x1 - x0) / panels) - 0.16, wainscot.height - 0.36, 0.01, wainscot.material, cx, 0.22, 0.02));
        }
      }
    }
    g.position.set(...p.pos);
    g.rotation.y = p.ry;
    shell.add(g);
  }
  return shell;
}

/** Places an object against a wall, facing into the room. */
export function onWall(obj, side, { W, D }, along, y = 0, offset = 0) {
  const o = obj;
  if (side === 'back') { o.position.set(along, y, -D / 2 + offset); o.rotation.y = 0; }
  if (side === 'front') { o.position.set(along, y, D / 2 - offset); o.rotation.y = Math.PI; }
  if (side === 'left') { o.position.set(-W / 2 + offset, y, along); o.rotation.y = Math.PI / 2; }
  if (side === 'right') { o.position.set(W / 2 - offset, y, along); o.rotation.y = -Math.PI / 2; }
  return o;
}

/** Wraps meshes in a group so wall placement keeps their own offsets. */
export function grp(...objects) {
  const g = new THREE.Group();
  g.add(...objects);
  return g;
}

export function at(obj, x, y, z, ry = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  return obj;
}

export function addSun(group, { color, intensity, position, target, size, near = 0.5, far = 40 }) {
  const sun = new THREE.DirectionalLight(color, intensity);
  sun.position.set(...position);
  sun.target.position.set(...target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -size;
  cam.right = cam.top = size;
  cam.near = near;
  cam.far = far;
  group.add(sun, sun.target);
  return sun;
}

export function ceilingLights(group, H, points) {
  for (const [x, z] of points) {
    const l = F.recessedLight();
    l.position.set(x, H - 0.005, z);
    group.add(l);
  }
}

export function commonMaterials({ view }) {
  return {
    glass: mat({ color: '#dfeaf0', roughness: 0.03, metalness: 0.2, transparent: true, opacity: 0.12, depthWrite: false }),
    view: new THREE.MeshBasicMaterial({ map: T.viewTexture(view), toneMapped: false, color: '#e8e8e8' }),
    linen: mat({ map: T.fabric('#f7f5f1', { seed: 2, repeat: [4, 4] }), roughness: 0.95 }),
    pillow: mat({ map: T.fabric('#fbfaf7', { seed: 5 }), roughness: 0.95 }),
    ceiling: mat({ color: '#f6f3ee', roughness: 0.95 }),
  };
}

// ---------- Economy ----------

function economy() {
  const W = 4.4, D = 5.4, H = 2.7;
  const group = new THREE.Group();
  const c = commonMaterials({ view: 'garden' });
  const wood = mat({ map: T.woodGrain('#7a5536', { seed: 4 }), roughness: 0.6 });
  const brass = F.METALS.gold();
  const trim = mat({ color: '#f1ece4', roughness: 0.6 });

  group.add(buildShell({
    W, D, H,
    floorMat: mat({ map: T.woodPlanks('#9a6d47', { seed: 8, repeat: [W / 2, D / 2] }), roughness: 0.55 }),
    wallMat: mat({ map: T.wallpaper('#e8dfd1', { seed: 3, stripe: 0, repeat: [1, 1] }), roughness: 0.95 }),
    ceilingMat: c.ceiling,
    trimMat: trim,
    walls: { back: { openings: [{ center: 0.4, width: 1.8, sill: 0.6, height: 1.6, panes: 2 }] } },
    windowStyle: { frame: trim, glass: c.glass, view: c.view, rod: brass, curtain: mat({ map: T.fabric('#5f7466', { seed: 9 }), roughness: 0.95 }), sheer: mat({ color: '#fbf8f2', transparent: true, opacity: 0.55, roughness: 1 }) },
  }));

  // Sleeping area — queen bed against the left wall
  group.add(at(F.bed({ width: 1.55, frame: wood, linen: c.linen, pillow: c.pillow, throwMat: mat({ map: T.fabric('#2f4d4a', { seed: 12 }) }), headboard: 'panel', height: 1.05 }), -1.05, 0, 0, Math.PI / 2));
  for (const z of [-1.18, 1.18]) {
    group.add(at(F.nightstand({ wood, handle: brass }), -1.93, 0, z, Math.PI / 2));
    group.add(at(F.tableLamp({ base: brass, light: 2.2 }), -1.93, 0.55, z));
  }
  group.add(onWall(F.framedArt({ w: 1.0, h: 0.6, texture: T.artwork(31), frame: wood }), 'left', { W, D }, 0, 1.75, 0.02));
  group.add(at(F.rug({ w: 1.5, d: 2.2, material: mat({ map: T.carpet('#c9b79c', { seed: 4, repeat: [2, 3] }), roughness: 1 }) }), 0.35, 0, 0, Math.PI / 2));

  // Work & media wall
  group.add(onWall(F.desk({ wood, legsMat: wood, w: 1.15 }), 'right', { W, D }, -1.55, 0, 0.29));
  group.add(at(F.chair({ wood, seat: mat({ map: T.fabric('#c8b59a', { seed: 3 }) }) }), 1.45, 0, -1.55, Math.PI / 2));
  group.add(at(F.tableLamp({ base: F.METALS.black(), light: 0, height: 0.45 }), 1.95, 0.75, -1.95));
  group.add(at(F.books({}), 1.95, 0.75, -1.3, 0.3));
  group.add(onWall(F.consoleUnit({ wood, handle: brass, w: 1.2, h: 0.5 }), 'right', { W, D }, 0.55, 0, 0.23));
  group.add(onWall(F.tv({ width: 1.0 }), 'right', { W, D }, 0.55, 1.35, 0.03));

  // Entrance: door, wardrobe, mini fridge
  group.add(onWall(F.door({ wood, handle: brass, frameMat: trim }), 'front', { W, D }, 1.35, 0, 0.0));
  group.add(onWall(F.wardrobe({ wood, handle: brass, w: 1.1 }), 'front', { W, D }, -1.55, 0, 0.3));
  group.add(onWall(F.miniFridge({ body: mat({ color: '#efefef', roughness: 0.4 }), handle: F.METALS.chrome() }), 'front', { W, D }, -0.7, 0, 0.24));
  group.add(at(F.plant({ pot: mat({ color: '#d9cbb5', roughness: 0.9 }) }), -1.85, 0, -2.3));

  ceilingLights(group, H, [[-1, -1.2], [1, -1.2], [-1, 1.2], [1, 1.2]]);
  const ceilingFill = new THREE.PointLight('#ffe8c8', 6, 0, 2);
  ceilingFill.position.set(0, H - 0.3, 0.4);
  group.add(ceilingFill);
  group.add(new THREE.HemisphereLight('#fff6ea', '#7a6a58', 0.7));
  addSun(group, { color: '#fff1d8', intensity: 3, position: [3, 6, -9], target: [0, 0, 0.5], size: 6 });

  return {
    group,
    bounds: { W, D, H },
    exposure: 1.0,
    viewpoints: [
      { id: 'entrance', label: 'Entrance', position: [1.75, 1.75, 2.35], target: [-0.7, 0.75, -0.9] },
      { id: 'bed', label: 'Queen bed', position: [0.95, 1.3, 1.35], target: [-1.4, 0.65, -0.2] },
      { id: 'window', label: 'Garden window', position: [0.1, 1.5, 1.1], target: [0.35, 1.3, -2.7] },
      { id: 'desk', label: 'Work desk & TV', position: [-0.4, 1.45, -0.6], target: [2.0, 0.95, -0.6] },
      { id: 'door', label: 'Wardrobe & door', position: [-0.3, 1.6, -1.7], target: [-0.1, 1.1, 2.7] },
    ],
  };
}

// ---------- Deluxe ----------

function deluxe() {
  const W = 6.2, D = 6.2, H = 2.9;
  const group = new THREE.Group();
  const c = commonMaterials({ view: 'bay' });
  const walnut = mat({ map: T.woodGrain('#5a3d2b', { seed: 14 }), roughness: 0.45 });
  const gold = F.METALS.gold();
  const trim = mat({ color: '#f4efe7', roughness: 0.5 });
  const velvet = mat({ map: T.fabric('#3e5560', { seed: 21 }), roughness: 0.85 });
  const linenSofa = mat({ map: T.fabric('#d9cfc0', { seed: 22 }), roughness: 0.95 });

  group.add(buildShell({
    W, D, H, crown: true,
    floorMat: mat({ map: T.woodPlanks('#6e4a32', { seed: 10, planks: 10, repeat: [W / 2, D / 2] }), roughness: 0.4 }),
    wallMat: mat({ map: T.wallpaper('#e7ddce', { seed: 6, stripe: 0.025, repeat: [1, 1] }), roughness: 0.9 }),
    ceilingMat: c.ceiling,
    trimMat: trim,
    wainscot: { height: 0.95, material: mat({ color: '#d9cdbb', roughness: 0.7 }) },
    walls: { back: { openings: [{ center: 0.3, width: 3.6, sill: 0.35, height: 2.25, panes: 3 }] } },
    windowStyle: { frame: trim, glass: c.glass, view: c.view, rod: gold, curtain: mat({ map: T.fabric('#8a7a66', { seed: 25 }), roughness: 0.9 }), sheer: mat({ color: '#fbf8f2', transparent: true, opacity: 0.5, roughness: 1 }) },
  }));

  // King bed with tufted headboard
  group.add(at(F.bed({
    width: 1.9, frame: walnut, linen: c.linen, pillow: c.pillow,
    throwMat: mat({ map: T.fabric('#9c7b55', { seed: 30 }) }),
    headboard: 'panel', headboardMat: mat({ map: T.tufted('#cbbfae'), roughness: 0.9 }), height: 1.3,
  }), -1.9, 0, -0.4, Math.PI / 2));
  for (const z of [-1.78, 0.98]) {
    group.add(at(F.nightstand({ wood: walnut, handle: gold, drawers: 2, w: 0.55, h: 0.6 }), -2.82, 0, z, Math.PI / 2));
    group.add(at(F.tableLamp({ base: gold, light: 2.5, height: 0.6 }), -2.82, 0.6, z));
  }
  for (const z of [-1.0, 0.2]) group.add(onWall(F.framedArt({ w: 0.75, h: 0.55, texture: T.artwork(40 + z * 10), frame: gold }), 'left', { W, D }, z, 2.1, 0.02));
  group.add(at(F.rug({ w: 3.2, d: 3.6, material: mat({ map: T.carpet('#b9a992', { seed: 6, repeat: [3, 3] }), roughness: 1 }) }), -1.3, 0, -0.4));
  group.add(at(soft(0.45, 0.45, 1.5, velvet, 0, 0, 0, 0.05), -0.55, 0, -0.4));

  // Lounge by the bay window
  group.add(at(F.sofa({ width: 2.1, fabric: linenSofa, legsMat: gold, pillows: [velvet, mat({ map: T.fabric('#b08d59', { seed: 31 }) })] }), 2.6, 0, -1.3, -Math.PI / 2));
  group.add(at(F.coffeeTable({ top: mat({ map: T.marble('#efe9df', '#a99c88', { repeat: [1, 1] }), roughness: 0.2 }), legsMat: gold, w: 1.0, d: 0.6 }), 1.55, 0, -1.3, Math.PI / 2));
  group.add(at(F.vaseWithFlowers({ vase: mat({ color: '#2f4858', roughness: 0.2 }) }), 1.55, 0.42, -1.45));
  group.add(at(F.armchair({ fabric: velvet, legsMat: gold }), 0.55, 0, -2.25, 0.9));
  group.add(at(F.floorLamp({ base: gold, light: 3 }), 2.75, 0, -2.55));
  group.add(at(F.rug({ w: 2.4, d: 2.2, material: mat({ map: T.carpet('#d8cbb6', { seed: 9, repeat: [2, 2] }), roughness: 1 }) }), 1.7, 0.003, -1.4));

  // Media console, minibar & mirror
  group.add(onWall(F.consoleUnit({ wood: walnut, handle: gold, w: 1.6 }), 'right', { W, D }, 1.6, 0, 0.23));
  group.add(onWall(F.tv({ width: 1.25 }), 'right', { W, D }, 1.6, 1.45, 0.03));
  group.add(onWall(F.mirror({ w: 0.7, h: 1.6, frame: gold }), 'front', { W, D }, -0.15, 0.6, 0.02));

  // Desk & wardrobe near the entrance
  group.add(onWall(F.desk({ wood: walnut, legsMat: gold, w: 1.2 }), 'front', { W, D }, -1.6, 0, 0.29));
  group.add(at(F.chair({ wood: walnut, seat: velvet }), -1.6, 0, 2.45, 0));
  group.add(at(F.tableLamp({ base: gold, light: 0, height: 0.45 }), -2.05, 0.75, 2.8));
  group.add(onWall(F.wardrobe({ wood: walnut, handle: gold, w: 1.3, h: 2.3 }), 'left', { W, D }, 2.25, 0, 0.3));
  group.add(onWall(F.door({ wood: walnut, handle: gold, frameMat: trim }), 'front', { W, D }, 1.65, 0, 0));
  group.add(at(F.plant({ pot: mat({ color: '#2b2b2b', roughness: 0.5 }), scale: 1.2 }), -2.75, 0, -2.75));

  ceilingLights(group, H, [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5], [0, 0]]);
  const fill = new THREE.PointLight('#ffe6c4', 9, 0, 2);
  fill.position.set(0, H - 0.3, 0.6);
  group.add(fill);
  group.add(new THREE.HemisphereLight('#fff3e2', '#6e5d4c', 0.6));
  addSun(group, { color: '#fff0d6', intensity: 3.2, position: [-4, 7, -10], target: [0, 0, 0.5], size: 7 });

  return {
    group,
    bounds: { W, D, H },
    exposure: 1.0,
    viewpoints: [
      { id: 'entrance', label: 'Entrance', position: [2.5, 1.85, 2.7], target: [-0.8, 0.8, -0.9] },
      { id: 'bed', label: 'King bed', position: [0.7, 1.35, 1.4], target: [-2.3, 0.8, -0.4] },
      { id: 'lounge', label: 'Lounge', position: [-0.4, 1.4, 0.4], target: [2.4, 0.6, -1.5] },
      { id: 'window', label: 'Bay view', position: [0.3, 1.55, 0.9], target: [0.3, 1.4, -3.1] },
      { id: 'desk', label: 'Desk & entrance', position: [0.6, 1.6, -1.4], target: [-1.4, 1.0, 3.0] },
    ],
  };
}

// ---------- VIP Suite ----------

function vip() {
  const W = 9.6, D = 7.6, H = 3.1;
  const group = new THREE.Group();
  const c = commonMaterials({ view: 'sunset' });
  const oak = mat({ map: T.woodGrain('#3f2a1d', { seed: 41 }), roughness: 0.4 });
  const gold = F.METALS.gold();
  const trim = mat({ color: '#f5f1ea', roughness: 0.4 });
  const marbleMat = mat({ map: T.marble('#f3efe8', '#b5a891', { seed: 5, repeat: [1.5, 1.5] }), roughness: 0.15 });
  const boucle = mat({ map: T.fabric('#ece5d8', { seed: 51 }), roughness: 1 });
  const velvet = mat({ map: T.fabric('#1f3340', { seed: 52 }), roughness: 0.85 });
  const caramel = mat({ map: T.fabric('#a87a4f', { seed: 53 }), roughness: 0.8 });

  group.add(buildShell({
    W, D, H, crown: true,
    floorMat: mat({ map: T.woodPlanks('#b48a62', { seed: 12, planks: 12, repeat: [W / 2.5, D / 2.5] }), roughness: 0.35 }),
    wallMat: mat({ map: T.wallpaper('#efe8dc', { seed: 9, stripe: 0, repeat: [1, 1] }), roughness: 0.85 }),
    ceilingMat: c.ceiling,
    trimMat: trim,
    walls: { back: { openings: [{ center: 0, width: 8.8, sill: 0, height: 2.85, panes: 6 }] } },
    windowStyle: { frame: F.METALS.black(), glass: c.glass, view: c.view, rod: gold, curtain: mat({ map: T.fabric('#cdbfa9', { seed: 55 }), roughness: 0.9 }) },
  }));

  // Bedroom: platform bed with walnut slat feature wall
  for (let i = 0; i < 22; i++) {
    group.add(block(0.06, H - 0.1, 0.05, oak, -W / 2 + 0.04, 0, -2.5 + i * 0.15));
  }
  group.add(at(F.bed({
    width: 2.0, length: 2.15, frame: oak, linen: c.linen, pillow: c.pillow,
    throwMat: caramel, headboard: 'platform', headboardMat: mat({ map: T.tufted('#d6c8b2', { repeat: [5, 2] }), roughness: 0.95 }), height: 1.15,
  }), -3.35, 0, -0.85, Math.PI / 2));
  for (const z of [-2.75, 1.05]) {
    group.add(at(F.nightstand({ wood: oak, handle: gold, drawers: 2, w: 0.6, h: 0.5 }), -4.3, 0, z, Math.PI / 2));
    group.add(at(F.tableLamp({ base: gold, light: 2.5, height: 0.6 }), -4.3, 0.5, z));
  }
  group.add(at(soft(0.5, 0.45, 1.8, velvet, 0, 0, 0, 0.06), -1.75, 0, -0.85));
  group.add(at(F.rug({ w: 3.4, d: 4.0, material: mat({ map: T.carpet('#d7ccbc', { seed: 15, repeat: [3, 3] }), roughness: 1 }) }), -2.9, 0, -0.85));

  // Living area
  group.add(at(F.rug({ w: 3.8, d: 3.4, material: mat({ map: T.carpet('#8a7864', { seed: 16, repeat: [3, 3] }), roughness: 1 }) }), 2.85, 0, -0.6));
  group.add(at(F.sofa({ width: 2.9, depth: 1.0, fabric: boucle, legsMat: gold, pillows: [velvet, caramel] }), 1.2, 0, -0.6, Math.PI / 2));
  group.add(at(F.coffeeTable({ top: marbleMat, legsMat: gold, w: 1.1, round: true, h: 0.38 }), 2.75, 0, -0.6));
  group.add(at(F.books({}), 2.7, 0.38, -0.55, 0.4));
  group.add(at(F.armchair({ fabric: velvet, legsMat: gold, w: 0.85 }), 2.9, 0, -2.25, 0));
  group.add(at(F.armchair({ fabric: velvet, legsMat: gold, w: 0.85 }), 2.9, 0, 1.05, Math.PI));
  group.add(at(F.floorLamp({ base: gold, light: 3 }), 1.0, 0, -2.4));
  group.add(onWall(F.consoleUnit({ wood: oak, handle: gold, w: 2.0, h: 0.5 }), 'right', { W, D }, -0.6, 0, 0.23));
  group.add(onWall(F.tv({ width: 1.6 }), 'right', { W, D }, -0.6, 1.5, 0.03));
  for (const z of [-2.2, 1.0]) group.add(onWall(F.wallSconce({ metal: gold, light: 0 }), 'right', { W, D }, z, 1.8, 0));

  // Dining & bar
  group.add(at(F.diningTable({ top: marbleMat, legsMat: oak, w: 1.6, d: 0.9 }), 2.4, 0, 2.55));
  for (const [x, z, r] of [[1.95, 1.85, 0], [2.85, 1.85, 0], [1.95, 3.25, Math.PI], [2.85, 3.25, Math.PI]]) {
    group.add(at(F.chair({ wood: oak, seat: caramel }), x, 0, z, r));
  }
  group.add(at(F.vaseWithFlowers({ vase: gold, bloom: '#f6e7e3' }), 2.4, 0.77, 2.55));
  group.add(onWall(grp(block(1.8, 1.05, 0.6, oak), block(1.9, 0.04, 0.7, marbleMat, 0, 1.05, 0.02)), 'right', { W, D }, 2.6, 0, 0.3));
  for (const z of [2.0, 2.6, 3.2]) group.add(at(F.barStool({ seat: velvet, metal: gold }), 3.95, 0, z, Math.PI / 2));

  // Bath corner behind a glass partition
  group.add(block(2.7, 0.03, 2.3, marbleMat, -3.45, 0, 2.65));
  group.add(at(F.bathtub({ body: mat({ color: '#fbfaf7', roughness: 0.15 }), metal: gold }), -3.3, 0.03, 2.75));
  const partitionGlass = mat({ color: '#d9e6ea', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.4), partitionGlass);
  pane.position.set(-3.5, 1.2, 1.5);
  group.add(pane);
  const frosted = mat({ color: '#f4f1ec', roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  const band = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), frosted);
  band.position.set(-3.5, 1.15, 1.505);
  group.add(band);
  group.add(block(2.6, 0.03, 0.04, gold, -3.5, 2.4, 1.5));
  group.add(block(2.6, 0.03, 0.04, gold, -3.5, 0, 1.5));
  group.add(block(0.04, 2.43, 0.04, gold, -2.2, 0, 1.5));
  group.add(at(F.plant({ pot: mat({ color: '#e7dfd2', roughness: 0.6 }), scale: 1.1 }), -4.4, 0.03, 3.35));
  group.add(onWall(F.framedArt({ w: 1.2, h: 0.8, texture: T.artwork(77), frame: gold }), 'front', { W, D }, 3.45, 1.7, 0.02));

  // Entrance & decor
  group.add(onWall(F.door({ wood: oak, handle: gold, frameMat: trim, w: 1.05, h: 2.4 }), 'front', { W, D }, 0.2, 0, 0));
  group.add(onWall(F.framedArt({ w: 1.4, h: 0.9, texture: T.artwork(88), frame: gold }), 'front', { W, D }, -2.4, 1.75, 0.02));
  group.add(at(F.plant({ pot: mat({ color: '#1e1e1e', roughness: 0.4 }), scale: 1.4 }), 4.4, 0, -3.3));
  group.add(at(F.plant({ pot: mat({ color: '#1e1e1e', roughness: 0.4 }), scale: 1.2 }), -0.3, 0, -3.3));

  // Ceiling: cove lighting, chandelier, dining pendants
  for (const [len, x, z, ry] of [[W - 1.2, 0, -D / 2 + 0.6, 0], [W - 1.2, 0, D / 2 - 0.6, 0], [D - 1.2, -W / 2 + 0.6, 0, Math.PI / 2], [D - 1.2, W / 2 - 0.6, 0, Math.PI / 2]]) {
    const s = F.coveStrip(len);
    s.position.set(x, H - 0.02, z);
    s.rotation.y = ry;
    group.add(s);
  }
  const chand = F.chandelier({ metal: gold, light: 10 });
  chand.position.set(2.75, H, -0.6);
  group.add(chand);
  for (const [x, l] of [[2.0, 4], [2.8, 0]]) {
    const p = F.pendant({ metal: gold, light: l, drop: 0.75 });
    p.position.set(x, H, 2.55);
    group.add(p);
  }
  ceilingLights(group, H, [[-3, -2.2], [-3, 0.6], [-0.5, -1], [-0.5, 1.8], [-3.4, 2.7]]);
  const fill = new THREE.PointLight('#ffe2bd', 10, 0, 2);
  fill.position.set(-2.8, H - 0.4, -0.6);
  group.add(fill);
  group.add(new THREE.HemisphereLight('#ffe9d6', '#5c4a3c', 0.55));
  addSun(group, { color: '#ffb877', intensity: 3.4, position: [4, 4.5, -11], target: [0, 0, 0.8], size: 9 });

  return {
    group,
    bounds: { W, D, H },
    exposure: 1.05,
    viewpoints: [
      { id: 'overview', label: 'Suite overview', position: [1.3, 2.25, 3.45], target: [-0.6, 0.85, -1.6] },
      { id: 'bedroom', label: 'Bedroom', position: [-0.6, 1.45, 0.9], target: [-3.7, 0.8, -1.0] },
      { id: 'living', label: 'Living room', position: [0.5, 1.55, 1.2], target: [4.1, 1.0, -0.9] },
      { id: 'view', label: 'Panoramic view', position: [0.2, 1.6, 1.4], target: [0.6, 1.5, -3.8] },
      { id: 'bath', label: 'Soaking tub', position: [-0.9, 1.65, 2.2], target: [-3.6, 0.45, 2.95] },
      { id: 'dining', label: 'Dining & bar', position: [0.3, 1.65, 0.4], target: [3.3, 0.85, 2.7] },
    ],
  };
}

export const ROOM_BUILDERS = { ECONOMY: economy, DELUXE: deluxe, VIP: vip };
