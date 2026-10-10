// Grand Entrance Fountain: a three-tier fountain with particle water jets and
// programmable lights in the landscaped forecourt, in front of the hotel's
// covered drop-off (porte-cochère). Water shows and day / evening lighting
// can be switched from the hotspots.
import {
  THREE, T, mat, block, soft, cylinder, METALS, at, addSun,
  tag, glow, animator, tiles, waterNormals, signTexture, canvasTexture,
  skyDome, leafTexture, palm, turf, instanced, place, noShadow,
} from './kit.js';

const W = 32, D = 26, H = 16;
const FC = { x: 0, z: 2 };
const BASIN_R = 4.85, WATER_Y = 0.42;
const G = 9.8;

const SHOWS = [
  { id: 'classic', label: 'Classic' },
  { id: 'dance', label: 'Dancing jets' },
  { id: 'lights', label: 'Light show' },
];

function dropTexture() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(235,248,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/** Vertical streaks that scroll down an open cylinder to look like a falling water sheet. */
function sheetTexture() {
  return canvasTexture(128, 256, (ctx, w, h) => {
    const r = T.rng(7);
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      const x = r() * w, y = r() * h, len = 30 + r() * 90;
      ctx.strokeStyle = `rgba(255,255,255,${0.25 + r() * 0.6})`;
      ctx.lineWidth = 1 + r() * 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + len); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x, y - h + len); ctx.stroke();
    }
  }, { repeat: [8, 1] });
}

/**
 * Particle fountain. Each spec is a nozzle `{ origin, vel, spread, count, floor }`;
 * `power[i]` (0..1) scales the jet height and switches it off below 0.08.
 */
function jetSystem(specs) {
  const total = specs.reduce((n, s) => n + s.count, 0);
  const pos = new Float32Array(total * 3), vel = new Float32Array(total * 3), owner = new Uint16Array(total);
  let k = 0;
  specs.forEach((s, si) => { for (let i = 0; i < s.count; i++) owner[k++] = si; });
  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', attr);
  const material = new THREE.PointsMaterial({ map: dropTexture(), color: '#d2ecff', size: 0.24, transparent: true, opacity: 0.95, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.userData.noPick = true;
  const power = specs.map(() => 1);

  const spawn = (i, age) => {
    const s = specs[owner[i]], p = power[owner[i]], j = i * 3;
    if (p < 0.08) {
      pos[j] = s.origin[0]; pos[j + 1] = -5; pos[j + 2] = s.origin[2];
      vel[j] = vel[j + 1] = vel[j + 2] = 0;
      return;
    }
    const sp = Math.sqrt(p);
    const vx = s.vel[0] * sp + (Math.random() - 0.5) * s.spread;
    const vy = s.vel[1] * sp * (0.95 + Math.random() * 0.07);
    const vz = s.vel[2] * sp + (Math.random() - 0.5) * s.spread;
    pos[j] = s.origin[0] + vx * age;
    pos[j + 1] = s.origin[1] + vy * age - 0.5 * G * age * age;
    pos[j + 2] = s.origin[2] + vz * age;
    vel[j] = vx; vel[j + 1] = vy - G * age; vel[j + 2] = vz;
  };
  for (let i = 0; i < total; i++) spawn(i, Math.random() * 1.6);

  return {
    points, material, power,
    update(dt) {
      const step = Math.min(dt, 0.05);
      for (let i = 0; i < total; i++) {
        const j = i * 3;
        vel[j + 1] -= G * step;
        pos[j] += vel[j] * step;
        pos[j + 1] += vel[j + 1] * step;
        pos[j + 2] += vel[j + 2] * step;
        if (pos[j + 1] < specs[owner[i]].floor) spawn(i, Math.random() * step);
      }
      attr.needsUpdate = true;
    },
  };
}

function lathe(points, material, segments = 48) {
  const m = new THREE.Mesh(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function bench({ teak, iron }) {
  const g = new THREE.Group();
  for (const x of [-0.78, 0.78]) {
    g.add(block(0.06, 0.42, 0.5, iron, x, 0, 0));
    const back = block(0.05, 0.5, 0.06, iron, x, 0.42, -0.24);
    back.rotation.x = -0.18;
    g.add(back);
    g.add(block(0.06, 0.05, 0.42, iron, x, 0.62, 0.02));
  }
  for (let i = 0; i < 5; i++) g.add(block(1.8, 0.04, 0.085, teak, 0, 0.42, -0.2 + i * 0.1));
  for (let i = 0; i < 3; i++) {
    const s = block(1.8, 0.085, 0.035, teak, 0, 0.52 + i * 0.13, -0.27 - i * 0.022);
    s.rotation.x = -0.18;
    g.add(s);
  }
  return g;
}

function lampPost({ iron, lampGlass }) {
  const g = new THREE.Group();
  g.add(cylinder(0.16, 0.2, 0.35, iron, 0, 0, 0, 12));
  g.add(cylinder(0.05, 0.07, 3.3, iron, 0, 0.35, 0, 10));
  g.add(cylinder(0.12, 0.08, 0.1, iron, 0, 3.6, 0, 12));
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.11, 0.42, 6), lampGlass);
  lantern.position.y = 3.91;
  g.add(lantern);
  g.add(cylinder(0.02, 0.22, 0.16, iron, 0, 4.12, 0, 6));
  g.add(cylinder(0.025, 0.025, 0.14, iron, 0, 4.28, 0, 6));
  return g;
}

function shadeTree(leaf, bark, seed) {
  const g = new THREE.Group();
  const r = T.rng(seed);
  g.add(cylinder(0.14, 0.2, 2.6, bark, 0, 0, 0, 10));
  const geo = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(geo, leaf);
    const a = r() * Math.PI * 2, d = i ? 0.7 + r() * 0.6 : 0;
    m.position.set(Math.cos(a) * d, 3.1 + r() * 1.0, Math.sin(a) * d);
    m.scale.setScalar(0.9 + r() * 0.6);
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

function sedan() {
  const g = new THREE.Group();
  const paint = mat({ color: '#9aa4ae', metalness: 0.65, roughness: 0.3 });
  const glass = mat({ color: '#30485a', metalness: 0.5, roughness: 0.05 });
  const tyre = mat({ color: '#141414', roughness: 0.9 });
  g.add(soft(4.6, 0.75, 1.85, paint, 0, 0.3, 0, 0.18));
  g.add(soft(2.5, 0.6, 1.65, glass, -0.2, 0.95, 0, 0.2));
  for (const x of [-1.45, 1.45]) for (const z of [-0.85, 0.85]) {
    const w = cylinder(0.34, 0.34, 0.24, tyre, 0, -0.12, 0, 18);
    const holder = new THREE.Group();
    holder.add(w);
    holder.rotation.x = Math.PI / 2;
    holder.position.set(x, 0.34, z);
    g.add(holder);
  }
  for (const z of [-0.6, 0.6]) {
    g.add(block(0.04, 0.12, 0.35, glow('#fff6e0', 1.2), 2.3, 0.62, z));
    g.add(block(0.04, 0.1, 0.35, glow('#ff3b2f', 1.0), -2.3, 0.66, z));
  }
  return g;
}

function luggageCart(gold) {
  const g = new THREE.Group();
  g.add(block(1.1, 0.06, 0.6, mat({ color: '#6b1f2a', roughness: 0.8 }), 0, 0.22, 0));
  for (const x of [-0.5, 0.5]) for (const z of [-0.25, 0.25]) g.add(cylinder(0.06, 0.06, 0.04, mat({ color: '#222' }), x, 0.1, z, 10));
  for (const x of [-0.52, 0.52]) {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 8, 24, Math.PI), gold);
    arch.position.set(x, 1.55, 0);
    arch.rotation.y = Math.PI / 2;
    g.add(arch);
    for (const z of [-0.28, 0.28]) g.add(cylinder(0.02, 0.02, 1.3, gold, x, 0.25, z, 8));
  }
  g.add(cylinder(0.015, 0.015, 1.05, gold, 0, 1.83, 0, 6).rotateZ(Math.PI / 2));
  const cases = [['#2b3a4a', 0.7, 0.5, 0.25], ['#8a5a35', 0.55, 0.4, 0.22], ['#c9a46a', 0.45, 0.32, 0.2]];
  let y = 0.25;
  cases.forEach(([c, w, h, d], i) => { g.add(soft(w, h, d * 2, mat({ color: c, roughness: 0.6 }), (i - 1) * 0.08, y, 0, 0.04)); y += h; });
  return g;
}

export default function build() {
  const group = new THREE.Group();
  const anim = animator();
  const stone = mat({ map: tiles('#e7dfd0', '#d3c8b4', { count: 2, seed: 201, vary: 0.05 }), roughness: 0.7 });
  const stoneLathe = mat({ map: T.marble('#efe9de', '#c9bfae', { seed: 202, repeat: [4, 1] }), roughness: 0.45, side: THREE.DoubleSide });
  const iron = mat({ color: '#1d1f22', metalness: 0.6, roughness: 0.45 });
  const teak = mat({ map: T.woodGrain('#8a5a35', { seed: 203 }), roughness: 0.6 });
  const gold = METALS.gold();
  const lampGlass = glow('#ffd99a', 0.6, { color: '#fff3d6', transparent: true, opacity: 0.92 });

  const sky = skyDome({ top: '#5f97cf', horizon: '#eaf1f2', view: 'garden', radius: 70 });
  group.add(sky);
  const [dome, band] = sky.children;
  const daySky = dome.material.map;
  const eveningSky = canvasTexture(16, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0f1a38'); g.addColorStop(0.32, '#3a3f74'); g.addColorStop(0.47, '#d07c6c'); g.addColorStop(0.52, '#f2b07a'); g.addColorStop(1, '#f2b07a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });

  // ---------- ground: plaza paving, rosette and drop-off lane ----------
  const groundTex = tiles('#d9d0bf', '#c4b9a4', { count: 4, seed: 204, vary: 0.06 });
  groundTex.repeat.set(140 / 3, 140 / 3);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), mat({ map: groundTex, roughness: 0.85 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const rosette = canvasTexture(1024, 1024, (ctx, S) => {
    const c = S / 2;
    const rings = ['#cbbfa8', '#e8e0d0', '#9c8f7a', '#e8e0d0', '#cbbfa8', '#b3a690', '#ece5d8'];
    rings.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(c, c, c * (1 - i * 0.12), 0, Math.PI * 2); ctx.fill();
    });
    ctx.strokeStyle = 'rgba(80,70,55,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * c * 0.3, c + Math.sin(a) * c * 0.3); ctx.lineTo(c + Math.cos(a) * c, c + Math.sin(a) * c); ctx.stroke();
    }
    for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.arc(c, c, c * (1 - i * 0.12), 0, Math.PI * 2); ctx.stroke(); }
    T.addNoise(ctx, S, S, 10, T.rng(205));
  });
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(8.6, 72), mat({ map: rosette, roughness: 0.75 }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(FC.x, 0.006, FC.z);
  plaza.receiveShadow = true;
  group.add(plaza);

  const asphalt = mat({ map: canvasTexture(256, 256, (ctx, S) => {
    ctx.fillStyle = '#3a3c40'; ctx.fillRect(0, 0, S, S);
    T.addNoise(ctx, S, S, 22, T.rng(206));
  }, { repeat: [24, 2] }), roughness: 0.95 });
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(80, 4.6), asphalt);
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, 0.008, -10.4);
  lane.receiveShadow = true;
  group.add(lane);
  const paint = mat({ color: '#f1efe8', roughness: 0.8 });
  for (let i = 0; i < 7; i++) group.add(block(0.45, 0.004, 3.8, paint, -1.8 + i * 0.6, 0.008, -10.4));
  for (let x = -38; x < 38; x += 3) if (Math.abs(x) > 3) group.add(block(1.5, 0.004, 0.1, mat({ color: '#e7c35a' }), x, 0.008, -10.4));
  for (const z of [-8.05, -12.75]) group.add(block(80, 0.14, 0.22, stone, 0, 0, z));

  // ---------- hotel facade and porte-cochère ----------
  const facadeTex = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#d8d0c2'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const g = ctx.createLinearGradient(0, y * 64, 0, y * 64 + 50);
      g.addColorStop(0, '#6b8ca6'); g.addColorStop(1, '#2c4256');
      ctx.fillStyle = g;
      ctx.fillRect(x * 64 + 6, y * 64 + 8, 52, 46);
    }
  }, { repeat: [7, 3.5] });
  const facadeMat = mat({ map: facadeTex, roughness: 0.6 });
  group.add(block(70, 34, 1.2, facadeMat, 0, 5.4, -14.6));
  group.add(block(70, 5.4, 1.2, mat({ color: '#cbc2b2', roughness: 0.7 }), 0, 0, -14.55));
  const lobby = new THREE.Group();
  const frame = mat({ color: '#2b2b2b', metalness: 0.6, roughness: 0.4 });
  const lobbyGlass = mat({ color: '#2a3a46', metalness: 0.6, roughness: 0.08, emissive: '#ffcf8a', emissiveIntensity: 0.06 });
  lobby.add(block(14, 4.2, 0.06, lobbyGlass, 0, 0, 0));
  for (let i = 0; i <= 10; i++) lobby.add(block(0.08, 4.2, 0.1, frame, -7 + i * 1.4, 0, 0.04));
  lobby.add(block(14.2, 0.12, 0.14, frame, 0, 4.2, 0.04));
  const revolving = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.6, 32, 1, true, 0, Math.PI), mat({ color: '#cfe0ea', transparent: true, opacity: 0.25, roughness: 0.05, side: THREE.DoubleSide }));
  revolving.position.set(0, 1.3, 0.05);
  revolving.rotation.y = -Math.PI / 2;
  lobby.add(revolving);
  lobby.add(cylinder(1.35, 1.35, 0.25, gold, 0, 2.6, 0.05, 32));
  const wings = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const wing = block(1.25, 2.5, 0.03, mat({ color: '#d7e6ee', transparent: true, opacity: 0.3, roughness: 0.05 }), 0.62, 0.05, 0);
    const piv = new THREE.Group();
    piv.add(wing);
    piv.rotation.y = (i * Math.PI) / 2;
    wings.add(piv);
  }
  wings.position.set(0, 0, 0.6);
  lobby.add(wings);
  lobby.add(cylinder(0.05, 0.05, 2.6, gold, 0, 0, 0.6, 10));
  group.add(tag(at(lobby, 0, 0, -13.92), 'entrance'));
  anim.add((dt) => { wings.rotation.y += dt * 0.35; });

  const canopy = new THREE.Group();
  const bronze = mat({ color: '#3b2f25', metalness: 0.5, roughness: 0.4 });
  canopy.add(block(18, 0.55, 6.6, mat({ color: '#e9e3d8', roughness: 0.6 }), 0, 5.0, -10.9));
  canopy.add(block(18.2, 0.85, 0.22, bronze, 0, 4.85, -7.55));
  for (const x of [-8.4, 8.4]) for (const z of [-8.1]) {
    canopy.add(cylinder(0.32, 0.36, 5.0, stone, x, 0, z, 20));
    canopy.add(block(0.9, 0.3, 0.9, stone, x, 0, z));
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 0.75), mat({
    map: signTexture('HARAYA BAY', { width: 2048, height: 180, color: '#e2c48c', font: '600 118px Georgia, "Times New Roman", serif', sub: 'BY ZALDY LAND' }),
    transparent: true, emissive: '#e2c48c', emissiveIntensity: 0.25,
  }));
  sign.position.set(0, 5.27, -7.43);
  canopy.add(sign);
  for (let x = -7.5; x <= 7.5; x += 2.5) for (const z of [-12.6, -10.6, -8.6]) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), glow('#fff2d8', 1.6));
    d.rotation.x = Math.PI / 2;
    d.position.set(x, 4.99, z);
    canopy.add(d);
  }
  group.add(tag(canopy, 'entrance'));
  const canopyLights = [-4, 4].map((x) => {
    const l = new THREE.PointLight('#ffdcae', 0, 12, 2);
    l.position.set(x, 4.6, -10.6);
    group.add(l);
    return l;
  });

  group.add(tag(at(sedan(), -3.2, 0, -10.6), 'entrance'));
  group.add(tag(at(luggageCart(gold), 3.6, 0, -13.1, 0.2), 'entrance'));
  for (const x of [-6.2, -5.6, 5.6, 6.2]) group.add(at(stanchion(gold), x, 0, -13.2));
  // Accessible ramp and planters by the doors
  const ramp = block(2.2, 0.14, 1.6, stone, -10.6, 0, -13.2);
  group.add(tag(ramp, 'entrance'));
  for (const x of [-7.6, 7.6]) {
    const p = new THREE.Group();
    p.add(block(1.0, 0.8, 1.0, mat({ color: '#2b2b2b', roughness: 0.5 }), 0, 0, 0));
    const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), mat({ color: '#3f6b3a', roughness: 0.9, flatShading: true }));
    shrub.position.y = 1.35; shrub.scale.set(1, 1.3, 1); shrub.castShadow = true;
    p.add(shrub);
    group.add(at(p, x, 0, -13.2));
  }

  // Bollards along the kerb
  const bollardGlow = glow('#ffe8c0', 0.8);
  for (let x = -14; x <= 14; x += 2) {
    if (Math.abs(x) < 2.6) continue;
    group.add(cylinder(0.1, 0.11, 0.8, iron, x, 0, -7.75, 12));
    group.add(cylinder(0.105, 0.105, 0.06, bollardGlow, x, 0.68, -7.75, 12));
  }

  // ---------- fountain ----------
  const fountain = new THREE.Group();
  fountain.add(lathe([[BASIN_R, 0.03], [BASIN_R, 0.55], [BASIN_R + 0.05, 0.6], [5.3, 0.6], [5.38, 0.55], [5.38, 0]], stoneLathe, 96));
  const basinFloor = new THREE.Mesh(new THREE.CircleGeometry(BASIN_R, 72), mat({ map: tiles('#2f6f8f', '#bcd2da', { count: 14, seed: 207, vary: 0.15, repeat: [3, 3] }), roughness: 0.4 }));
  basinFloor.rotation.x = -Math.PI / 2;
  basinFloor.position.y = 0.04;
  fountain.add(basinFloor);
  // Pedestal, middle bowl, upper bowl and finial
  fountain.add(lathe([[0, 0], [0.75, 0], [0.75, 0.15], [0.55, 0.3], [0.42, 0.6], [0.38, 1.1], [0.5, 1.35], [0.3, 1.55], [0, 1.6]], stoneLathe));
  const bowl = (r, y) => lathe([[0, y - 0.32], [r * 0.25, y - 0.3], [r * 0.7, y - 0.16], [r, y - 0.02], [r + 0.06, y + 0.06], [r - 0.02, y + 0.08], [r - 0.06, y + 0.02], [0, y + 0.02]], stoneLathe, 72);
  fountain.add(bowl(2.15, 1.75));
  fountain.add(lathe([[0, 1.75], [0.32, 1.75], [0.26, 2.0], [0.2, 2.35], [0.3, 2.5], [0, 2.6]], stoneLathe));
  fountain.add(bowl(1.05, 2.85));
  fountain.add(lathe([[0, 2.85], [0.2, 2.85], [0.12, 3.0], [0.16, 3.12], [0.06, 3.3], [0.04, 3.36], [0, 3.36]], stoneLathe));
  group.add(tag(at(fountain, FC.x, 0, FC.z), 'fountain'));

  // Water surfaces
  const normals = waterNormals({ repeat: [3, 3] });
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: '#4fb6d2', roughness: 0.05, transparent: true, opacity: 0.6, depthWrite: false,
    normalMap: normals, normalScale: new THREE.Vector2(0.4, 0.4), clearcoat: 1, envMapIntensity: 1.6,
  });
  for (const [r, y] of [[BASIN_R, WATER_Y], [2.08, 1.8], [0.98, 2.9]]) {
    const w = new THREE.Mesh(new THREE.CircleGeometry(r, 64), waterMat);
    w.rotation.x = -Math.PI / 2;
    w.position.set(FC.x, y, FC.z);
    group.add(tag(w, 'fountain'));
  }
  // Overflow sheets falling from the bowl lips
  const sheetTex = sheetTexture();
  const sheetMat = new THREE.MeshStandardMaterial({ map: sheetTex, alphaMap: sheetTex, color: '#e8f6ff', transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, roughness: 0.2, emissive: '#bfe6ff', emissiveIntensity: 0.15 });
  for (const [rt, rb, top, bottom] of [[1.12, 1.2, 2.9, 1.8], [2.22, 2.36, 1.8, WATER_Y]]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, top - bottom, 72, 1, true), sheetMat);
    s.position.set(FC.x, (top + bottom) / 2, FC.z);
    s.userData.noPick = true;
    group.add(s);
  }

  // Jets: central plume, 12 arcing rim jets and 8 vertical ring jets
  const specs = [{ origin: [FC.x, 3.36, FC.z], vel: [0, 9.0, 0], spread: 0.9, count: 760, floor: 2.9 }];
  const RING = 12, VERT = 8;
  for (let i = 0; i < RING; i++) {
    const a = (i / RING) * Math.PI * 2;
    specs.push({ origin: [FC.x + Math.cos(a) * 4.6, 0.62, FC.z + Math.sin(a) * 4.6], vel: [-Math.cos(a) * 1.65, 5.9, -Math.sin(a) * 1.65], spread: 0.12, count: 90, floor: WATER_Y });
  }
  for (let i = 0; i < VERT; i++) {
    const a = (i / VERT) * Math.PI * 2 + Math.PI / VERT;
    specs.push({ origin: [FC.x + Math.cos(a) * 3.4, WATER_Y + 0.02, FC.z + Math.sin(a) * 3.4], vel: [0, 6.2, 0], spread: 0.18, count: 60, floor: WATER_Y });
  }
  const jets = jetSystem(specs);
  group.add(jets.points);
  // Nozzles
  const nozzleMat = METALS.chrome();
  for (const s of specs.slice(1)) group.add(cylinder(0.05, 0.06, 0.08, nozzleMat, s.origin[0], s.origin[1] - 0.08, s.origin[2], 10));

  // Underwater lights: emissive spots plus three coloured point lights
  const spotMat = glow('#fff1d6', 1.8);
  const spots = instanced([new THREE.CircleGeometry(0.13, 16).rotateX(-Math.PI / 2)], spotMat,
    specs.slice(1 + RING).map((s) => place(s.origin[0], 0.06, s.origin[2])), { cast: false, receive: false });
  spots.userData.noPick = true;
  group.add(spots);
  const fLights = [0, 1, 2].map((i) => {
    const a = (i / 3) * Math.PI * 2;
    const l = new THREE.PointLight('#fff1d6', 4, 9, 2);
    l.position.set(FC.x + Math.cos(a) * 2.8, 0.7, FC.z + Math.sin(a) * 2.8);
    group.add(l);
    return l;
  });
  const topLight = new THREE.PointLight('#fff1d6', 3, 7, 2);
  topLight.position.set(FC.x, 3.1, FC.z);
  group.add(topLight);

  // ---------- landscaping ----------
  const trunk = mat({ map: T.woodGrain('#7b6248', { seed: 208, repeat: [1, 4] }), roughness: 0.9 });
  const leafMat = mat({ map: leafTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 });
  const lawn = mat({ map: turf('#4b8a3f', { repeat: [3, 6], seed: 209 }), roughness: 0.95 });
  const hedgeMat = mat({ map: turf('#2f5f2c', { repeat: [6, 1], seed: 210 }), roughness: 1 });
  const gardens = new THREE.Group();
  for (const s of [-1, 1]) {
    const cx = s * 12.6;
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 17), lawn);
    bed.rotation.x = -Math.PI / 2;
    bed.position.set(cx, 0.012, 2.6);
    bed.receiveShadow = true;
    gardens.add(bed);
    for (const [w, d, x, z] of [[5.4, 0.45, cx, -6.1], [5.4, 0.45, cx, 11.3], [0.45, 17, cx - s * 2.6, 2.6]]) {
      gardens.add(soft(w, 0.55, d, hedgeMat, x, 0, z, 0.15));
    }
    [[-4.2, 5.2], [1.0, 4.4], [6.4, 5.0]].forEach(([z, h], i) => gardens.add(at(palm(h, trunk, leafMat, 211 + i + (s > 0 ? 5 : 0)), cx + s * 0.6, 0, z)));
  }
  // Flower clusters
  const r = T.rng(220);
  const flowerColors = ['#e7779a', '#f6f1e9', '#f2c14e', '#c2477a', '#f08a5d'];
  const flowerGeo = new THREE.IcosahedronGeometry(0.09, 0);
  flowerColors.forEach((c, ci) => {
    const mats = [];
    for (let i = 0; i < 110; i++) {
      const side = r() > 0.5 ? 1 : -1;
      mats.push(place(side * (11.2 + r() * 2.6), 0.18 + r() * 0.12, -5 + r() * 15.6, r() * 3, 0.8 + r() * 0.7));
    }
    const m = instanced([flowerGeo], mat({ color: c, roughness: 0.7, flatShading: true }), mats, { cast: false });
    gardens.add(m);
    if (ci === 0) {
      const shrubMats = [];
      for (let i = 0; i < 40; i++) {
        const side = i % 2 ? 1 : -1;
        shrubMats.push(place(side * (11.0 + r() * 3.0), 0.25, -5 + r() * 15.6, r() * 3, 0.35 + r() * 0.25));
      }
      gardens.add(instanced([new THREE.IcosahedronGeometry(1, 1)], mat({ color: '#3d6b35', roughness: 0.9, flatShading: true }), shrubMats));
    }
  });
  const leafy = mat({ color: '#4a7d3e', roughness: 0.9, flatShading: true });
  const bark = mat({ color: '#5b4632', roughness: 0.9 });
  gardens.add(at(shadeTree(leafy, bark, 230), -9.4, 0, 11.4));
  gardens.add(at(shadeTree(leafy, bark, 231), 9.4, 0, 11.4));
  group.add(tag(gardens, 'gardens'));

  // Planters with flowers between the benches
  const planterMat = mat({ color: '#d9cfbd', roughness: 0.6 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const p = new THREE.Group();
    p.add(cylinder(0.65, 0.5, 0.6, planterMat, 0, 0, 0, 24));
    p.add(cylinder(0.6, 0.6, 0.02, mat({ color: '#4a3a2a' }), 0, 0.6, 0, 24));
    for (let k = 0; k < 18; k++) {
      const b = new THREE.Mesh(flowerGeo, mat({ color: flowerColors[k % 5], flatShading: true }));
      const aa = k * 2.4, rr = 0.1 + (k % 6) * 0.08;
      b.position.set(Math.cos(aa) * rr, 0.7 + (k % 3) * 0.05, Math.sin(aa) * rr);
      b.scale.setScalar(1.3);
      p.add(b);
    }
    const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 1), leafy);
    shrub.position.y = 0.85; shrub.castShadow = true;
    p.add(shrub);
    group.add(tag(at(p, FC.x + Math.cos(a) * 7.6, 0, FC.z + Math.sin(a) * 7.6), 'gardens'));
  }

  // Benches facing the fountain
  const seating = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    if (Math.abs(Math.sin(a) + 1) < 0.2) continue;
    const x = FC.x + Math.cos(a) * 7.7, z = FC.z + Math.sin(a) * 7.7;
    seating.add(at(bench({ teak, iron }), x, 0, z, Math.atan2(-Math.cos(a), -Math.sin(a))));
  }
  group.add(tag(seating, 'seating'));

  // Lamp posts around the plaza
  const lamps = new THREE.Group();
  const lampLights = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = FC.x + Math.cos(a) * 9.4, z = FC.z + Math.sin(a) * 9.4;
    lamps.add(at(lampPost({ iron, lampGlass }), x, 0, z));
    if (i % 2 === 0) {
      const l = new THREE.PointLight('#ffd59a', 0, 11, 2);
      l.position.set(x, 3.9, z);
      group.add(l);
      lampLights.push(l);
    }
  }
  group.add(tag(lamps, 'lights'));

  // Information plinth
  const plinth = new THREE.Group();
  plinth.add(block(1.6, 0.9, 0.5, stone, 0, 0, 0));
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), mat({
    map: canvasTexture(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#26303a'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#c9a46a'; ctx.lineWidth = 6; ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = '#e2c48c'; ctx.textAlign = 'center';
      ctx.font = '600 44px Georgia, serif'; ctx.fillText('FOUNTAIN PLAZA', w / 2, 82);
      ctx.fillStyle = '#e8edf2'; ctx.font = '26px "Segoe UI", Arial';
      ctx.fillText('Water & light shows nightly', w / 2, 140);
      ctx.fillText('7:00 PM and 9:00 PM', w / 2, 176);
      ctx.fillStyle = '#9aa7b3'; ctx.font = '20px "Segoe UI", Arial'; ctx.fillText('Sample schedule', w / 2, 220);
    }), roughness: 0.5,
  }));
  plaque.position.set(0, 0.95, 0.12);
  plaque.rotation.x = -0.5;
  plinth.add(plaque);
  group.add(tag(at(plinth, FC.x + 2.6, 0, FC.z + 9.8, Math.PI), 'plazainfo'));

  // ---------- lighting and animation ----------
  const hemiLight = new THREE.HemisphereLight('#d7e9ff', '#c9b896', 0.85);
  group.add(hemiLight);
  const sun = addSun(group, { color: '#fff0d8', intensity: 3.0, position: [-16, 22, 14], target: [0, 0, 0], size: 22, near: 1, far: 80 });

  let show = 0;
  let evening = false;
  const warm = new THREE.Color('#fff1d6');
  const tint = new THREE.Color();
  anim.add((dt, t) => {
    normals.offset.x += dt * 0.03; normals.offset.y += dt * 0.02;
    sheetTex.offset.y += dt * 0.9;
    const mode = SHOWS[show].id;
    if (mode === 'classic') {
      jets.power.fill(1);
    } else {
      jets.power[0] = 0.55 + 0.45 * Math.sin(t * 0.9);
      for (let i = 0; i < RING; i++) jets.power[1 + i] = Math.max(0, Math.sin(t * 2.2 - (i / RING) * Math.PI * 2)) ** 0.6;
      for (let i = 0; i < VERT; i++) jets.power[1 + RING + i] = (Math.floor(t / 1.6) + i) % 2 ? 1 : 0.2;
    }
    if (mode === 'lights') {
      fLights.forEach((l, i) => l.color.setHSL((t * 0.08 + i / 3) % 1, 0.9, 0.55));
      topLight.color.setHSL((t * 0.08 + 0.5) % 1, 0.9, 0.6);
      spotMat.emissive.setHSL((t * 0.08) % 1, 0.9, 0.6);
      jets.material.color.copy(tint.setHSL((t * 0.08) % 1, 0.7, 0.86));
      sheetMat.emissive.setHSL((t * 0.08 + 0.33) % 1, 0.8, 0.5);
    }
    jets.update(dt);
  });

  const applyShow = () => {
    if (SHOWS[show].id === 'lights') return;
    for (const l of [...fLights, topLight]) l.color.copy(warm);
    spotMat.emissive.copy(warm);
    jets.material.color.set('#d2ecff');
    sheetMat.emissive.set('#bfe6ff');
  };

  const applyTime = () => {
    dome.material.map = evening ? eveningSky : daySky;
    dome.material.needsUpdate = true;
    band.material.color.set(evening ? '#6d5f78' : '#ececec');
    hemiLight.intensity = evening ? 0.22 : 0.85;
    sun.intensity = evening ? 0.45 : 3.0;
    sun.color.set(evening ? '#ffb27a' : '#fff0d8');
    if (group.parent) group.parent.environmentIntensity = evening ? 0.18 : 0.6;
    for (const l of lampLights) l.intensity = evening ? 9 : 0;
    for (const l of canopyLights) l.intensity = evening ? 10 : 0;
    for (const l of fLights) l.intensity = evening ? 9 : 4;
    topLight.intensity = evening ? 6 : 3;
    lampGlass.emissiveIntensity = evening ? 2.4 : 0.6;
    bollardGlow.emissiveIntensity = evening ? 2.0 : 0.8;
    lobbyGlass.emissiveIntensity = evening ? 0.35 : 0.06;
    sign.material.emissiveIntensity = evening ? 1.1 : 0.25;
    spotMat.emissiveIntensity = evening ? 3 : 1.8;
    sheetMat.emissiveIntensity = evening ? 0.45 : 0.15;
  };

  const hotspots = [
    {
      id: 'fountain', label: 'Grand fountain', position: [FC.x, 4.2, FC.z],
      title: 'Grand Entrance Fountain', text: 'A three-tier carved stone fountain: a 5-metre plume rises from the top bowl, water spills over two bowl lips, twelve rim jets arc inward and eight ring jets pulse in the basin.',
      view: { position: [FC.x + 9.5, 2.6, FC.z + 5.5], target: [FC.x, 2.2, FC.z] },
      action: {
        get label() { return `Water show: ${SHOWS[(show + 1) % SHOWS.length].label}`; },
        run: () => { show = (show + 1) % SHOWS.length; applyShow(); },
      },
    },
    {
      id: 'lights', label: 'Lighting', position: [FC.x + 9.4, 4.6, FC.z],
      title: 'Fountain & plaza lighting', text: 'Underwater LED spots light every jet, with colour-changing light shows in the evening. Cast-iron lanterns, glowing bollards and canopy downlights keep the forecourt bright after dark.',
      view: { position: [FC.x - 9.5, 2.2, FC.z + 5.0], target: [FC.x, 1.6, FC.z] },
      action: {
        get label() { return evening ? 'Switch to daytime' : 'Switch to evening'; },
        run: () => { evening = !evening; applyTime(); },
      },
    },
    {
      id: 'entrance', label: 'Hotel entrance', position: [0, 5.9, -9],
      title: 'Porte-cochère & lobby entrance', text: 'A covered drop-off lane for cars and the airport shuttle, a revolving door with side doors, luggage carts and a step-free ramp to the lobby. Bell staff are on duty 24 hours (sample).',
      view: { position: [4.5, 1.7, -3.5], target: [-1, 2.2, -12] },
    },
    {
      id: 'gardens', label: 'Gardens', position: [-12.6, 1.6, 2.6],
      title: 'Tropical gardens', text: 'Lawns edged with clipped hedges, coconut palms, flowering shrubs and seasonal blooms frame both sides of the plaza. Planting is illustrative.',
      view: { position: [-6.5, 1.7, 8], target: [-12.6, 1.2, 0.5] },
    },
    {
      id: 'seating', label: 'Seating', position: [FC.x + 7.1, 1.3, FC.z + 2.95],
      title: 'Plaza seating', text: 'Teak and cast-iron benches circle the fountain, and the wide stone rim of the basin doubles as extra seating. Shaded benches sit beneath the trees at the plaza edge.',
      view: { position: [FC.x + 7.0, 1.2, FC.z + 2.9], target: [FC.x, 1.4, FC.z] },
    },
    {
      id: 'plazainfo', label: 'Plaza events', position: [FC.x + 2.6, 1.7, FC.z + 9.8],
      title: 'Fountain Plaza events', text: 'The plaza hosts the nightly water-and-light shows, festive tree lightings and open-air gatherings for up to 250 guests (sample capacity). See scheduled plaza events on the Events page.',
      view: { position: [FC.x + 2.2, 1.6, FC.z + 7.2], target: [FC.x + 2.6, 0.9, FC.z + 9.8] },
      action: { label: 'See plaza events', run: () => { location.href = '/events.html?venue=PLAZA'; } },
    },
  ];

  return {
    group, hotspots,
    bounds: { W, D, H },
    exposure: 0.85,
    envIntensity: 0.6,
    walkSpeed: 3.2,
    update: anim.update,
    viewpoints: [
      { id: 'overview', label: 'Overview', position: [13, 7.5, 12], target: [0, 1.5, -1] },
      { id: 'fountain', label: 'Fountain', position: hotspots[0].view.position, target: hotspots[0].view.target },
      { id: 'entrance', label: 'Entrance', position: hotspots[2].view.position, target: hotspots[2].view.target },
      { id: 'arrival', label: 'Arrival view', position: [0, 1.65, -6.8], target: [0, 2.4, 6] },
      { id: 'gardens', label: 'Gardens', position: hotspots[3].view.position, target: hotspots[3].view.target },
      { id: 'bench', label: 'From a bench', position: hotspots[4].view.position, target: hotspots[4].view.target },
    ],
  };
}

function stanchion(gold) {
  const g = new THREE.Group();
  g.add(cylinder(0.16, 0.18, 0.05, gold, 0, 0, 0, 16));
  g.add(cylinder(0.025, 0.025, 0.95, gold, 0, 0.05, 0, 8));
  g.add(cylinder(0.05, 0.03, 0.08, gold, 0, 1.0, 0, 12));
  return noShadow(g);
}
