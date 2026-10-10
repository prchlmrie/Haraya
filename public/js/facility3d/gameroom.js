// Arcade & Game Hall: billiards, a PS5-style console lounge, table tennis,
// arcade cabinets, an indoor golf simulator with a putting green, and a
// baseball batting cage (only the cage, no field).
import {
  THREE, T, F, mat, block, soft, cylinder, METALS, buildShell, onWall, at, addSun,
  tag, glow, hemi, pointLight, ledBar, animator, playOnce, canvasTexture, signTexture, liveScreen,
  screen, concrete, felt, turf, netMaterial,
} from './kit.js';

const W = 28, D = 18, H = 5;
const TAU = Math.PI * 2;

// ---------- billiards ----------

const BALL_COLORS = ['#f2c230', '#1f4ea8', '#c62828', '#5b2a86', '#ef6c00', '#2e7d32', '#7b1f1f', '#111111'];

function ballTexture(color, stripe) {
  return canvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = stripe ? '#f7f4ec' : color; ctx.fillRect(0, 0, w, h);
    if (stripe) { ctx.fillStyle = color; ctx.fillRect(0, h * 0.28, w, h * 0.44); }
    ctx.fillStyle = '#f7f4ec';
    ctx.beginPath(); ctx.ellipse(w * 0.25, h / 2, 7, 10, 0, 0, TAU); ctx.fill();
  });
}

function billiardTable({ feltMat, wood, pocketMat, ballMats, cueMat }) {
  const g = new THREE.Group();
  g.add(block(2.6, 0.2, 1.45, wood, 0, 0.6, 0));
  for (const x of [-1.15, 0, 1.15]) for (const z of [-0.6, 0.6]) g.add(cylinder(0.07, 0.09, 0.6, wood, x, 0, z, 12));
  g.add(block(2.3, 0.02, 1.17, feltMat, 0, 0.8, 0));
  for (const s of [-1, 1]) {
    g.add(block(2.3, 0.045, 0.05, feltMat, 0, 0.82, s * 0.6));
    g.add(block(0.05, 0.045, 1.17, feltMat, s * 1.17, 0.82, 0));
    g.add(block(2.6, 0.06, 0.14, wood, 0, 0.8, s * 0.655));
    g.add(block(0.15, 0.06, 1.45, wood, s * 1.225, 0.8, 0));
  }
  for (const x of [-1.16, 0, 1.16]) for (const z of [-0.6, 0.6]) g.add(cylinder(0.055, 0.055, 0.012, pocketMat, x, 0.858, z, 16));
  const r = 0.0285, y = 0.82 + r;
  const rack = [];
  for (let row = 0; row < 5; row++) for (let k = 0; k <= row; k++) rack.push([0.55 + row * r * 1.74, (k - row / 2) * r * 2.02]);
  const balls = [];
  const order = [0, 9, 1, 10, 7, 2, 11, 3, 12, 4, 13, 5, 14, 6, 8];
  rack.forEach(([x, z], i) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), ballMats[order[i]]);
    b.position.set(x, y, z);
    b.castShadow = true;
    g.add(b);
    balls.push({ mesh: b, home: new THREE.Vector3(x, y, z) });
  });
  const cue = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat({ color: '#f7f4ec', roughness: 0.2 }));
  cue.position.set(-0.6, y, 0);
  cue.castShadow = true;
  g.add(cue);
  balls.push({ mesh: cue, home: cue.position.clone(), cue: true });
  const stick = cylinder(0.006, 0.014, 1.45, cueMat, 0, 0, 0, 10);
  stick.rotation.z = Math.PI / 2;
  stick.rotation.y = 0.35;
  stick.position.set(-0.2, 0.87, 0.4);
  g.add(stick);
  return { group: g, balls };
}

function cueRack(wood, cueMat) {
  const g = new THREE.Group();
  g.add(block(1.1, 1.5, 0.05, wood, 0, 0.3, 0));
  g.add(block(1.1, 0.06, 0.14, wood, 0, 0.35, 0.05));
  for (let i = 0; i < 7; i++) {
    const c = cylinder(0.007, 0.014, 1.45, cueMat, -0.45 + i * 0.15, 0.36, 0.06, 10);
    g.add(c);
  }
  return g;
}

// ---------- console lounge ----------

function consolePS({ white, black, ledMat }) {
  const g = new THREE.Group();
  g.add(block(0.09, 0.39, 0.26, black, 0, 0.02, 0));
  for (const s of [-1, 1]) {
    const wing = soft(0.025, 0.41, 0.29, white, s * 0.055, 0.02, 0, 0.012);
    wing.rotation.z = s * 0.04;
    g.add(wing);
  }
  g.add(block(0.004, 0.36, 0.004, ledMat, 0.046, 0.035, 0.13));
  g.add(cylinder(0.08, 0.08, 0.02, black, 0, 0, 0, 20));
  return g;
}

function controller(white, black) {
  const g = new THREE.Group();
  g.add(soft(0.15, 0.03, 0.07, white, 0, 0, 0, 0.012));
  for (const s of [-1, 1]) {
    const grip = soft(0.045, 0.028, 0.08, white, s * 0.055, 0, 0.04, 0.012);
    grip.rotation.y = s * 0.35;
    g.add(grip);
    g.add(cylinder(0.011, 0.011, 0.012, black, s * 0.03, 0.028, 0.02, 10));
  }
  g.add(block(0.06, 0.004, 0.035, black, 0, 0.03, -0.012));
  return g;
}

function gamingChair(shell, accent, metal) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const leg = block(0.04, 0.03, 0.32, metal, 0, 0.06, 0.16);
    const arm = new THREE.Group();
    arm.add(leg);
    arm.rotation.y = (i / 5) * TAU;
    g.add(arm);
    const a = (i / 5) * TAU;
    g.add(cylinder(0.03, 0.03, 0.05, metal, Math.sin(a) * 0.3, 0.01, Math.cos(a) * 0.3, 10));
  }
  g.add(cylinder(0.03, 0.03, 0.36, metal, 0, 0.08, 0, 12));
  g.add(soft(0.52, 0.1, 0.5, shell, 0, 0.44, 0, 0.04));
  for (const s of [-1, 1]) g.add(soft(0.08, 0.1, 0.46, accent, s * 0.23, 0.5, 0, 0.03));
  const back = new THREE.Group();
  back.add(soft(0.52, 0.85, 0.1, shell, 0, 0, 0, 0.04));
  for (const s of [-1, 1]) back.add(soft(0.07, 0.75, 0.12, accent, s * 0.23, 0.05, 0.02, 0.03));
  back.add(soft(0.26, 0.14, 0.08, accent, 0, 0.72, 0.05, 0.03));
  back.position.set(0, 0.52, -0.25);
  back.rotation.x = -0.12;
  g.add(back);
  for (const s of [-1, 1]) {
    g.add(block(0.04, 0.22, 0.04, metal, s * 0.3, 0.5, 0));
    g.add(soft(0.08, 0.04, 0.26, shell, s * 0.3, 0.72, 0.02, 0.015));
  }
  return g;
}

// ---------- table tennis ----------

function tableTennis({ top, frame, net, paddleMats }) {
  const g = new THREE.Group();
  g.add(block(2.74, 0.04, 1.525, top, 0, 0.72, 0));
  for (const x of [-1.1, 1.1]) for (const z of [-0.6, 0.6]) g.add(block(0.05, 0.72, 0.05, frame, x, 0, z));
  for (const x of [-1.1, 1.1]) g.add(block(0.05, 0.05, 1.2, frame, x, 0.1, 0));
  const n = new THREE.Mesh(new THREE.PlaneGeometry(1.83, 0.1525), net);
  n.rotation.y = Math.PI / 2;
  n.position.set(0, 0.76 + 0.076, 0);
  g.add(n);
  for (const s of [-1, 1]) g.add(block(0.02, 0.17, 0.02, frame, 0, 0.74, s * 0.915));
  g.add(block(0.01, 0.012, 1.83, mat({ color: '#f5f5f5' }), 0, 0.905, 0));
  paddleMats.forEach((m, i) => {
    const p = new THREE.Group();
    p.add(cylinder(0.075, 0.075, 0.012, m, 0, 0, 0, 24));
    p.add(block(0.03, 0.012, 0.1, mat({ color: '#b98552' }), 0, 0, 0.11));
    p.position.set(i ? 0.9 : -0.9, 0.765, i ? -0.3 : 0.35);
    p.rotation.y = i ? 2.4 : -0.6;
    g.add(p);
  });
  return g;
}

function tennisTop() {
  return canvasTexture(512, 286, (ctx, w, h) => {
    ctx.fillStyle = '#1f4e8a'; ctx.fillRect(0, 0, w, h);
    T.addNoise(ctx, w, h, 8, T.rng(151));
    ctx.strokeStyle = '#f5f5f5'; ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
  });
}

// ---------- arcade ----------

function arcadeCabinet({ side, trim, screenTex, marqueeTex, panel, accent }) {
  const g = new THREE.Group();
  const profile = new THREE.Shape([[-0.4, 0], [0.38, 0], [0.38, 0.92], [0.24, 1.02], [0.1, 1.7], [0.18, 1.78], [0.18, 1.98], [-0.4, 1.98]].map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(profile, { depth: 0.04, bevelEnabled: false });
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(geo, side);
    m.rotation.y = -Math.PI / 2;
    m.position.x = s * 0.36 + (s > 0 ? 0.04 : 0);
    m.castShadow = true;
    g.add(m);
  }
  g.add(block(0.68, 1.98, 0.04, trim, 0, 0, -0.38));
  g.add(block(0.8, 0.03, 0.6, trim, 0, 1.98, -0.11));
  g.add(block(0.68, 0.92, 0.04, trim, 0, 0, 0.36));
  g.add(block(0.2, 0.25, 0.01, glow('#ffcc33', 1.2, { color: '#2a2000' }), 0, 0.35, 0.385));
  const deck = block(0.7, 0.05, 0.2, panel, 0, 0, 0);
  deck.position.set(0, 0.95, 0.3);
  deck.rotation.x = 0.6;
  g.add(deck);
  g.add(cylinder(0.008, 0.008, 0.06, METALS.black(), -0.15, 1.0, 0.28, 8));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), mat({ color: accent, roughness: 0.3 }));
  knob.position.set(-0.15, 1.07, 0.28);
  g.add(knob);
  for (let i = 0; i < 4; i++) g.add(cylinder(0.014, 0.014, 0.012, glow(['#ff3b3b', '#3bb2ff', '#ffe03b', '#3bff7a'][i], 1.4), 0.02 + (i % 2) * 0.07, 1.0 + (i > 1 ? 0.02 : 0), 0.3 - (i > 1 ? 0.04 : 0), 10));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.42), mat({ map: screenTex, emissive: '#ffffff', emissiveMap: screenTex, emissiveIntensity: 1.2 }));
  scr.position.set(0, 1.36, 0.16);
  scr.rotation.x = -0.2;
  g.add(scr);
  g.add(block(0.68, 0.7, 0.02, mat({ color: '#050505' }), 0, 1.02, 0.08));
  const marquee = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.18), mat({ map: marqueeTex, emissive: '#ffffff', emissiveMap: marqueeTex, emissiveIntensity: 1.3 }));
  marquee.position.set(0, 1.88, 0.185);
  g.add(marquee);
  return { group: g, marquee: marquee.material };
}

// ---------- golf ----------

function golfBag(bagMat, metal) {
  const g = new THREE.Group();
  const bag = cylinder(0.13, 0.12, 0.85, bagMat, 0, 0, 0, 20);
  g.add(bag);
  g.add(cylinder(0.14, 0.14, 0.08, METALS.black(), 0, 0.82, 0, 20));
  const heads = [mat({ color: '#1b1b1b', roughness: 0.3 }), metal];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    const x = Math.cos(a) * 0.07, z = Math.sin(a) * 0.07;
    const h = 1.0 + (i % 3) * 0.06;
    g.add(cylinder(0.006, 0.006, h - 0.6, metal, x, 0.6, z, 6));
    const head = i < 2 ? soft(0.11, 0.08, 0.1, heads[0], x, h, z, 0.03) : block(0.08, 0.05, 0.02, heads[1], x, h, z);
    g.add(head);
  }
  g.rotation.z = 0.12;
  return g;
}

// ---------- scene ----------

export default function build() {
  const group = new THREE.Group();
  const anim = animator();
  const steel = mat({ color: '#2b2e33', metalness: 0.6, roughness: 0.4 });
  const darkWood = mat({ map: T.woodGrain('#3a2416', { seed: 152 }), roughness: 0.45 });
  const white = mat({ color: '#f2f3f5', roughness: 0.35 });
  const black = mat({ color: '#141518', roughness: 0.35 });
  let clock = 0;

  group.add(buildShell({
    W, D, H,
    floorMat: mat({ map: concrete('#8f8c87', { repeat: [W / 4, D / 4] }), roughness: 0.35, metalness: 0.05 }),
    wallMat: mat({ map: T.wallpaper('#2f3238', { seed: 153, stripe: 0, repeat: [1, 1] }), roughness: 0.85 }),
    ceilingMat: mat({ color: '#1e2024', roughness: 0.95 }),
    trimMat: mat({ color: '#111', roughness: 0.5 }),
    walls: {},
    windowStyle: {},
  }));
  const neonColors = { back: '#ff3b8d', front: '#3bd6ff', left: '#8f5bff', right: '#3bff9a' };
  for (const [side, len] of [['back', W], ['front', W], ['left', D], ['right', D]]) {
    group.add(onWall(block(len - 0.2, 0.025, 0.02, glow(neonColors[side], 2.2)), side, { W, D }, 0, 2.7, 0.012));
  }
  const neonSign = (text, color, w, h) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTexture(text, { width: 1024, height: 256, color, neon: true, font: '700 130px "Segoe UI", Arial' }), transparent: true, toneMapped: false }));
    m.userData.noPick = true;
    return m;
  };

  // Billiards (back-left)
  const ballMats = [...BALL_COLORS.map((c) => mat({ map: ballTexture(c, false), roughness: 0.15 })), ...BALL_COLORS.slice(0, 7).map((c) => mat({ map: ballTexture(c, true), roughness: 0.15 }))];
  const feltMat = mat({ map: felt('#1f5f8a', { repeat: [2, 1] }), roughness: 0.95 });
  const cueMat = mat({ map: T.woodGrain('#c9a46a', { seed: 154, repeat: [1, 4] }), roughness: 0.4 });
  const billiards = new THREE.Group();
  const tables = [];
  for (const z of [-6.4, -2.6]) {
    const t = billiardTable({ feltMat, wood: darkWood, pocketMat: mat({ color: '#0a0a0a' }), ballMats, cueMat });
    billiards.add(at(t.group, -10, 0, z));
    tables.push(t);
    const lamp = new THREE.Group();
    lamp.add(block(1.9, 0.05, 0.12, steel, 0, -0.05, 0));
    for (const x of [-0.65, 0, 0.65]) {
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.18, 24, 1, true), mat({ color: '#1d3b2a', roughness: 0.4, side: THREE.DoubleSide }));
      shade.position.set(x, -0.18, 0);
      lamp.add(shade);
      const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), glow('#fff1d6', 2.2));
      bulb.rotation.x = Math.PI / 2;
      bulb.position.set(x, -0.26, 0);
      lamp.add(bulb);
    }
    for (const x of [-0.9, 0.9]) lamp.add(cylinder(0.004, 0.004, 3.2, steel, x, -0.05, 0, 4));
    lamp.position.set(-10, H - 3.2 + 0.05, z);
    billiards.add(lamp);
    pointLight(group, [-10, 1.6, z], '#fff1d6', 6, 5);
  }
  billiards.add(onWall(cueRack(darkWood, cueMat), 'left', { W, D }, -4.5, 0, 0.04));
  group.add(tag(billiards, 'billiards'));
  group.add(onWall(neonSign('BILLIARDS', '#5bd1ff', 3.2, 0.8), 'back', { W, D }, -10, 3.7, 0.03));

  // Console gaming lounge (front-left)
  const lounge = new THREE.Group();
  const racing = (ctx, w, h, t) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    sky.addColorStop(0, '#1b2a6b'); sky.addColorStop(1, '#ff8a5b');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * 0.5);
    ctx.fillStyle = '#2f6b3a'; ctx.fillRect(0, h * 0.5, w, h * 0.5);
    ctx.fillStyle = '#3a3a40';
    ctx.beginPath(); ctx.moveTo(w * 0.47, h * 0.5); ctx.lineTo(w * 0.53, h * 0.5); ctx.lineTo(w * 0.95, h); ctx.lineTo(w * 0.05, h); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const k = ((i / 8 + t * 0.9) % 1);
      const y = h * 0.5 + k * k * h * 0.5;
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(w / 2 - 1 - k * 4, y, 2 + k * 8, 2 + k * 10);
      ctx.fillStyle = i % 2 ? '#e53935' : '#f5f5f5';
      ctx.fillRect(w * (0.47 - k * 0.42) - k * 10, y, 4 + k * 10, 2 + k * 8);
      ctx.fillRect(w * (0.53 + k * 0.42), y, 4 + k * 10, 2 + k * 8);
    }
    const cx = w / 2 + Math.sin(t * 1.3) * w * 0.12;
    ctx.fillStyle = '#e53935'; ctx.fillRect(cx - 26, h - 46, 52, 30);
    ctx.fillStyle = '#111'; ctx.fillRect(cx - 30, h - 22, 14, 10); ctx.fillRect(cx + 16, h - 22, 14, 10);
    ctx.fillStyle = '#9fd7ff'; ctx.fillRect(cx - 16, h - 44, 32, 9);
    ctx.fillStyle = '#fff'; ctx.font = '700 14px "Segoe UI", Arial'; ctx.fillText(`LAP 2/3   ${Math.round(180 + Math.sin(t) * 20)} km/h`, 10, 20);
  };
  const football = (ctx, w, h, t) => {
    ctx.fillStyle = '#2e7d32'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#2e7d32' : '#338a37'; ctx.fillRect((i * w) / 8, 0, w / 8, h); }
    ctx.strokeStyle = '#eef'; ctx.lineWidth = 2; ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.beginPath(); ctx.moveTo(w / 2, 10); ctx.lineTo(w / 2, h - 10); ctx.stroke();
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 24, 0, TAU); ctx.stroke();
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i < 5 ? '#1e88e5' : '#e53935';
      const x = w * (0.2 + (i % 5) * 0.15) + Math.sin(t * 1.4 + i) * 14, y = h * (i < 5 ? 0.35 : 0.65) + Math.cos(t * 1.1 + i * 2) * 18;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w / 2 + Math.sin(t * 2) * 60, h / 2 + Math.cos(t * 1.7) * 30, 3.5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, 120, 24);
    ctx.fillStyle = '#fff'; ctx.font = '700 13px "Segoe UI", Arial'; ctx.fillText('AUR 2 - 1 MNL', 10, 17);
  };
  let tvMode = 0;
  const tvs = [0, 1].map((i) => liveScreen((ctx, w, h, t) => ((i + tvMode) % 2 ? football : racing)(ctx, w, h, t), { width: 320, height: 180, fps: 15 }));
  const consoleKit = { white, black, ledMat: glow('#3b8bff', 2.2) };
  const loungeFabric = mat({ map: T.fabric('#3a3f4a', { seed: 155 }), roughness: 0.9 });
  [2.9, 6.6].forEach((z, i) => {
    lounge.add(onWall(screen(2.0, tvs[i].texture), 'left', { W, D }, z, 1.65, 0.03));
    lounge.add(onWall(F.consoleUnit({ wood: darkWood, handle: steel, w: 1.8, h: 0.5, d: 0.42 }), 'left', { W, D }, z, 0, 0.22));
    const c1 = consolePS(consoleKit); c1.position.set(-W / 2 + 0.3, 0.5, z - 0.6); c1.rotation.y = Math.PI / 2; lounge.add(c1);
    const c2 = consolePS(consoleKit); c2.position.set(-W / 2 + 0.3, 0.5, z + 0.6); c2.rotation.y = Math.PI / 2; lounge.add(c2);
    for (const s of [-1, 1]) lounge.add(at(gamingChair(black, mat({ color: i ? '#3bd6ff' : '#e53935', roughness: 0.4 }), steel), -W / 2 + 2.1, 0, z + s * 0.55, -Math.PI / 2));
    lounge.add(at(F.sofa({ width: 2.3, fabric: loungeFabric, legsMat: steel, pillows: [mat({ color: '#8f5bff' }), mat({ color: '#3bd6ff' })] }), -W / 2 + 4.3, 0, z, -Math.PI / 2));
    const table = F.coffeeTable({ top: darkWood, legsMat: steel, w: 0.9, d: 0.5 });
    lounge.add(at(table, -W / 2 + 3.15, 0, z, Math.PI / 2));
    for (const s of [-1, 1]) lounge.add(at(controller(white, black), -W / 2 + 3.15, 0.42, z + s * 0.18, -Math.PI / 2 + s * 0.3));
  });
  lounge.add(at(F.rug({ w: 5.2, d: 7.6, material: mat({ map: T.carpet('#24262d', { seed: 156, repeat: [4, 6] }), roughness: 1 }) }), -W / 2 + 2.8, 0, 4.75));
  group.add(tag(lounge, 'gaming'));
  group.add(onWall(neonSign('GAME ON', '#b48bff', 2.6, 0.65), 'left', { W, D }, 4.75, 3.5, 0.03));
  pointLight(group, [-11.5, 2.4, 4.75], '#7fb7ff', 5, 8);

  // Table tennis (back-centre)
  const tennis = new THREE.Group();
  tennis.add(at(tableTennis({ top: mat({ map: tennisTop(), roughness: 0.6 }), frame: steel, net: netMaterial([24, 2], 'rgba(240,240,240,0.95)'), paddleMats: [mat({ color: '#c62828', roughness: 0.7 }), mat({ color: '#151515', roughness: 0.7 })] }), -1.4, 0, -5.6));
  const pingBall = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10), mat({ color: '#ff9f1c', roughness: 0.4 }));
  pingBall.position.set(-1.4 + 0.5, 0.762, -5.6 + 0.3);
  tennis.add(pingBall);
  const barrier = mat({ map: signTexture('HARAYA · TABLE TENNIS', { width: 1024, height: 256, bg: '#1f4e8a', color: '#ffffff', font: '600 80px "Segoe UI", Arial' }), roughness: 0.6 });
  for (const x of [-4.6, -2.6, -0.2, 1.8]) tennis.add(block(1.9, 0.7, 0.04, barrier, x, 0, -2.2));
  group.add(tag(tennis, 'tennis'));
  group.add(onWall(neonSign('TABLE TENNIS', '#ff6bb5', 3.6, 0.9), 'back', { W, D }, -1.4, 3.7, 0.03));

  // Arcade cabinets along the front wall
  const games = [
    (ctx, w, h, t) => {
      ctx.fillStyle = '#05050f'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { ctx.fillStyle = '#fff'; ctx.fillRect((i * 53) % w, (i * 37 + t * 60) % h, 2, 2); }
      for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) {
        ctx.fillStyle = ['#ff3b8d', '#3bd6ff', '#3bff9a'][r];
        ctx.fillRect(30 + c * 28 + Math.sin(t * 1.5) * 20, 26 + r * 22, 16, 10);
      }
      const sx = w / 2 + Math.sin(t * 2) * 80;
      ctx.fillStyle = '#ffe03b'; ctx.beginPath(); ctx.moveTo(sx, h - 34); ctx.lineTo(sx - 12, h - 14); ctx.lineTo(sx + 12, h - 14); ctx.closePath(); ctx.fill();
      ctx.fillRect(sx - 1, h - 34 - ((t * 200) % (h - 40)), 2, 8);
    },
    (ctx, w, h, t) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#2a4bff'; ctx.lineWidth = 4;
      for (let i = 0; i < 4; i++) ctx.strokeRect(14 + i * 22, 14 + i * 16, w - 28 - i * 44, h - 28 - i * 32);
      ctx.fillStyle = '#ffd6a0';
      for (let i = 0; i < 20; i++) ctx.fillRect(30 + i * 10, h / 2 - 1, 3, 3);
      const px = 30 + ((t * 50) % (w - 60));
      const mouth = Math.abs(Math.sin(t * 10)) * 0.7;
      ctx.fillStyle = '#ffe03b'; ctx.beginPath(); ctx.moveTo(px, h / 2); ctx.arc(px, h / 2, 10, mouth, TAU - mouth); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(px - 40, h / 2, 9, Math.PI, 0); ctx.fillRect(px - 49, h / 2, 18, 9); ctx.fill();
    },
    (ctx, w, h, t) => {
      ctx.fillStyle = '#0d0d1a'; ctx.fillRect(0, 0, w, h);
      const cell = 14, cols = 10, ox = (w - cols * cell) / 2;
      ctx.strokeStyle = '#333'; ctx.strokeRect(ox, 0, cols * cell, h);
      const colors = ['#ff3b3b', '#3bd6ff', '#ffe03b', '#3bff9a', '#b48bff'];
      for (let r = 0; r < 4; r++) for (let c = 0; c < cols; c++) if ((r * 7 + c * 3) % 5) { ctx.fillStyle = colors[(r + c) % 5]; ctx.fillRect(ox + c * cell + 1, h - (r + 1) * cell + 1, cell - 2, cell - 2); }
      const fy = (t * 40) % (h - 4 * cell);
      ctx.fillStyle = '#ff8a3d';
      for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [1, 1]]) ctx.fillRect(ox + (3 + dx) * cell + 1, fy + dy * cell + 1, cell - 2, cell - 2);
    },
  ];
  let creditUntil = -1;
  const arcadeScreens = games.map((draw) => liveScreen((ctx, w, h, t) => {
    draw(ctx, w, h, t);
    if (clock < creditUntil && Math.floor(t * 4) % 2) {
      ctx.fillStyle = '#fff'; ctx.font = '700 18px "Courier New", monospace'; ctx.textAlign = 'center';
      ctx.fillText('PLAYER 1 START', w / 2, h / 2 + 40); ctx.textAlign = 'left';
    }
  }, { width: 256, height: 196, fps: 12 }));
  const marquees = [['GALAXY RAID', '#3bd6ff'], ['MAZE MUNCH', '#ffe03b'], ['BLOCK DROP', '#ff3b8d']].map(([t, c]) => signTexture(t, { width: 512, height: 140, bg: '#0b0b14', color: c, neon: true, font: '800 64px "Segoe UI", Arial' }));
  const arcade = new THREE.Group();
  const marqueeMats = [];
  const sideMats = ['#8f1d3a', '#1d3a8f', '#1d6b3a'].map((c) => mat({ color: c, roughness: 0.45 }));
  for (let i = 0; i < 7; i++) {
    const a = arcadeCabinet({ side: sideMats[i % 3], trim: black, screenTex: arcadeScreens[i % 3].texture, marqueeTex: marquees[i % 3], panel: mat({ color: '#222', roughness: 0.5 }), accent: ['#ff3b3b', '#3bd6ff', '#ffe03b'][i % 3] });
    arcade.add(onWall(a.group, 'front', { W, D }, -4.6 + i * 1.05, 0, 0.45));
    marqueeMats.push(a.marquee);
  }
  group.add(tag(arcade, 'arcade'));
  group.add(onWall(neonSign('ARCADE', '#3bd6ff', 3.0, 0.75), 'front', { W, D }, -1.45, 3.3, 0.03));
  pointLight(group, [-1.4, 2.6, 7.4], '#ff6bd5', 4, 7);

  // Social high tables in the middle
  for (const x of [-2.6, 0.4]) {
    const t = new THREE.Group();
    t.add(cylinder(0.4, 0.4, 0.04, darkWood, 0, 1.04, 0, 32));
    t.add(cylinder(0.04, 0.04, 1.04, steel, 0, 0, 0, 12));
    t.add(cylinder(0.25, 0.28, 0.03, steel, 0, 0, 0, 24));
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU;
      t.add(at(F.barStool({ seat: mat({ color: ['#e53935', '#3bd6ff', '#8f5bff'][k], roughness: 0.5 }), metal: steel }), Math.sin(a) * 0.62, 0, Math.cos(a) * 0.62));
    }
    group.add(at(t, x, 0, 3.4));
  }

  // Golf simulator bay (back-right)
  const golf = new THREE.Group();
  const golfState = { start: -100, drift: 0, carry: 200 };
  const golfScreen = liveScreen((ctx, w, h, t) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.45);
    sky.addColorStop(0, '#5f9fe0'); sky.addColorStop(1, '#cfe6f7');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * 0.45);
    ctx.fillStyle = '#5d8f6b'; ctx.beginPath(); ctx.moveTo(0, h * 0.45);
    for (let x = 0; x <= w; x += 32) ctx.lineTo(x, h * 0.4 - Math.sin(x * 0.02) * 12 - Math.sin(x * 0.05) * 6);
    ctx.lineTo(w, h * 0.45); ctx.fill();
    ctx.fillStyle = '#3e7d3a'; ctx.fillRect(0, h * 0.45, w, h * 0.55);
    ctx.fillStyle = '#6fbf5a';
    ctx.beginPath(); ctx.moveTo(w * 0.46, h * 0.46); ctx.lineTo(w * 0.54, h * 0.46); ctx.lineTo(w * 0.85, h); ctx.lineTo(w * 0.15, h); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; const y = h * 0.46 + (i / 6) ** 2 * h * 0.54; ctx.fillRect(0, y, w, 6 + i * 3); }
    ctx.fillStyle = '#8fd77a'; ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.475, 34, 7, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 14; i++) { ctx.fillStyle = '#2d5a33'; ctx.beginPath(); ctx.arc(i * 40 + 10, h * 0.43, 14 + (i % 3) * 4, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.475); ctx.lineTo(w * 0.5, h * 0.4); ctx.stroke();
    ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.4); ctx.lineTo(w * 0.5 + 14 + Math.sin(t * 4) * 2, h * 0.41); ctx.lineTo(w * 0.5, h * 0.42); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(10, 10, 170, 50);
    ctx.fillStyle = '#fff'; ctx.font = '700 15px "Segoe UI", Arial'; ctx.fillText('HOLE 7 · PAR 4 · 385 yd', 18, 30);
    ctx.font = '400 13px "Segoe UI", Arial'; ctx.fillText('Wind 6 mph →   Haraya Links (sim)', 18, 50);
    const s = clock - golfState.start;
    if (s >= 0 && s < 6) {
      const u = Math.min(1, s / 2.6);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.beginPath();
      let bx = 0, by = 0;
      for (let k = 0; k <= 30; k++) {
        const v = (k / 30) * u;
        bx = w / 2 + golfState.drift * v * v * w * 0.18;
        by = h * 0.97 - v * h * 0.5 - Math.sin(Math.PI * v) * h * 0.42;
        if (k === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
      }
      ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 4 - u * 2.5, 0, TAU); ctx.fill();
      if (u >= 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(w / 2 - 110, h * 0.62, 220, 44);
        ctx.fillStyle = '#ffe03b'; ctx.font = '700 18px "Segoe UI", Arial'; ctx.textAlign = 'center';
        ctx.fillText(`CARRY ${golfState.carry} yd · TOTAL ${golfState.carry + 17} yd`, w / 2, h * 0.62 + 28);
        ctx.textAlign = 'left';
      }
    }
  }, { width: 512, height: 300, fps: 20 });
  const golfScreenMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 2.95), mat({ map: golfScreen.texture, emissive: '#ffffff', emissiveMap: golfScreen.texture, emissiveIntensity: 0.9, roughness: 0.9 }));
  golfScreenMesh.position.set(6.2, 1.85, -D / 2 + 0.12);
  golf.add(golfScreenMesh);
  const padMat = mat({ color: '#1b1d21', roughness: 0.8 });
  for (const x of [3.25, 9.15]) golf.add(block(0.1, 3.5, 6.0, padMat, x, 0, -D / 2 + 3.0));
  golf.add(block(6.0, 0.5, 0.1, padMat, 6.2, 3.3, -D / 2 + 6.0));
  const golfSign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.42), mat({ map: signTexture('GOLF SIMULATOR', { width: 1024, height: 136, color: '#ffffff', font: '700 84px "Segoe UI", Arial' }), transparent: true, emissive: '#ffffff', emissiveIntensity: 0.3 }));
  golfSign.position.set(6.2, 3.55, -D / 2 + 6.06);
  golf.add(golfSign);
  const bayTurf = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 7.0), mat({ map: turf('#3f7d3a', { repeat: [3, 4] }), roughness: 1 }));
  bayTurf.rotation.x = -Math.PI / 2;
  bayTurf.position.set(6.2, 0.004, -D / 2 + 3.5);
  bayTurf.receiveShadow = true;
  golf.add(bayTurf);
  golf.add(soft(1.5, 0.04, 1.5, mat({ map: turf('#5aa34d', { repeat: [2, 2], seed: 157 }), roughness: 1 }), 6.2, 0, -3.4, 0.01));
  golf.add(cylinder(0.008, 0.012, 0.05, mat({ color: '#e53935' }), 6.2, 0.04, -3.6, 8));
  const golfBall = new THREE.Mesh(new THREE.SphereGeometry(0.021, 16, 12), mat({ color: '#ffffff', roughness: 0.3 }));
  const teePos = new THREE.Vector3(6.2, 0.111, -3.6);
  golfBall.position.copy(teePos);
  golf.add(golfBall);
  golf.add(at(golfBag(mat({ color: '#1f3b5a', roughness: 0.5 }), METALS.chrome()), 4.1, 0, -3.0));
  const tray = new THREE.Group();
  tray.add(block(0.4, 0.06, 0.3, steel, 0, 0, 0));
  for (let i = 0; i < 12; i++) tray.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.021, 10, 8), mat({ color: '#fff', roughness: 0.3 })), -0.15 + (i % 6) * 0.06, 0.08, -0.06 + Math.floor(i / 6) * 0.1));
  golf.add(at(tray, 7.3, 0, -3.1));
  const projector = new THREE.Group();
  projector.add(block(0.45, 0.16, 0.38, white, 0, -0.5, 0));
  projector.add(cylinder(0.01, 0.01, 0.34, steel, 0, -0.34, 0, 6));
  projector.add(cylinder(0.05, 0.05, 0.03, glow('#cfe6ff', 1.5), 0, -0.42, -0.2, 16));
  projector.children.at(-1).rotation.x = Math.PI / 2;
  projector.position.set(6.2, H, -2.4);
  golf.add(projector);
  const kiosk = new THREE.Group();
  kiosk.add(cylinder(0.025, 0.025, 1.0, steel, 0, 0, 0, 10));
  kiosk.add(cylinder(0.2, 0.2, 0.02, steel, 0, 0, 0, 20));
  const tablet = block(0.28, 0.2, 0.02, black, 0, 0, 0);
  tablet.position.set(0, 1.05, 0);
  tablet.rotation.x = -0.6;
  kiosk.add(tablet);
  golf.add(at(kiosk, 8.4, 0, -3.0));
  group.add(tag(golf, 'golf'));
  pointLight(group, [6.2, 3.0, -3.6], '#ffffff', 5, 7);

  // Putting green (front-right)
  const putting = new THREE.Group();
  const greenShape = new THREE.Shape();
  greenShape.absellipse(0, 0, 2.6, 3.0, 0, TAU, false, 0);
  const greenTex = turf('#4f9d43', { repeat: [0.45, 0.45], stripes: 8, seed: 158 });
  const green = new THREE.Mesh(new THREE.ExtrudeGeometry(greenShape, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.04, bevelSegments: 2, curveSegments: 48 }), mat({ map: greenTex, roughness: 1 }));
  green.rotation.x = -Math.PI / 2;
  green.receiveShadow = true;
  putting.add(green);
  const fringe = new THREE.Mesh(new THREE.CircleGeometry(1, 48), mat({ map: turf('#2f6b2c', { repeat: [3, 3], seed: 159 }), roughness: 1 }));
  fringe.rotation.x = -Math.PI / 2;
  fringe.scale.set(2.95, 3.35, 1);
  fringe.position.y = 0.003;
  putting.add(fringe);
  const cups = [[-0.9, -1.4], [1.0, -0.3], [-0.4, 1.6]];
  cups.forEach(([x, z], i) => {
    const cup = new THREE.Mesh(new THREE.CircleGeometry(0.054, 24), mat({ color: '#0b0b0b' }));
    cup.rotation.x = -Math.PI / 2;
    cup.position.set(x, 0.037, z);
    putting.add(cup);
    putting.add(cylinder(0.006, 0.006, 1.2, white, x, 0.05, z, 6));
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), mat({ map: signTexture(String(i + 1), { width: 128, height: 86, bg: '#e53935', color: '#fff', font: '700 64px Arial' }), side: THREE.DoubleSide }));
    flag.position.set(x + 0.15, 1.15, z);
    putting.add(flag);
  });
  const puttBall = new THREE.Mesh(new THREE.SphereGeometry(0.021, 16, 12), mat({ color: '#fff', roughness: 0.3 }));
  const puttStart = new THREE.Vector3(1.4, 0.056, 1.9);
  puttBall.position.copy(puttStart);
  putting.add(puttBall);
  for (const [x, z] of [[0.3, 0.9], [-1.5, -0.2], [0.6, -1.9]]) putting.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.021, 12, 10), mat({ color: '#fff', roughness: 0.3 })), x, 0.056, z));
  const putterRack = new THREE.Group();
  putterRack.add(block(0.5, 0.05, 0.2, steel, 0, 0, 0));
  for (let i = 0; i < 3; i++) {
    putterRack.add(cylinder(0.007, 0.007, 0.9, steel, -0.15 + i * 0.15, 0.05, 0, 6));
    putterRack.add(block(0.1, 0.03, 0.03, METALS.chrome(), -0.15 + i * 0.15, 0.05, 0.03));
  }
  putting.add(at(putterRack, 2.4, 0, -2.6, -0.6));
  putting.position.set(6.3, 0, 4.0);
  group.add(tag(putting, 'putting'));

  // Batting cage (right side) - cage only, no field
  const cage = new THREE.Group();
  const CX0 = 9.8, CX1 = 13.8, CZ0 = -8.6, CZ1 = 5.4, CH = 4.2;
  const CXM = (CX0 + CX1) / 2, CL = CZ1 - CZ0;
  const cageTurf = new THREE.Mesh(new THREE.PlaneGeometry(CX1 - CX0, CL), mat({ map: turf('#2f6b35', { repeat: [2, 7], seed: 160 }), roughness: 1 }));
  cageTurf.rotation.x = -Math.PI / 2;
  cageTurf.position.set(CXM, 0.005, (CZ0 + CZ1) / 2);
  cageTurf.receiveShadow = true;
  cage.add(cageTurf);
  const netPlane = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), netMaterial([w / 1.1, h / 1.1], 'rgba(25,25,25,0.95)'));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    cage.add(m);
    return m;
  };
  netPlane(CL, CH, CX1, CH / 2, (CZ0 + CZ1) / 2, -Math.PI / 2);
  netPlane(4.0 - 0.05, CH, CXM, CH / 2, CZ0, 0);
  netPlane(4.0 - 0.05, CH, CXM, CH / 2, CZ1, Math.PI);
  const doorZ0 = 4.0, doorZ1 = 5.0, plateZ = 3.0;
  netPlane(doorZ0 - CZ0, CH, CX0, CH / 2, (CZ0 + doorZ0) / 2, Math.PI / 2);
  netPlane(CZ1 - doorZ1, CH, CX0, CH / 2, (CZ1 + doorZ1) / 2, Math.PI / 2);
  netPlane(doorZ1 - doorZ0, CH - 2.3, CX0, 2.3 + (CH - 2.3) / 2, (doorZ0 + doorZ1) / 2, Math.PI / 2);
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(4.0, CL), netMaterial([4.0 / 1.1, CL / 1.1], 'rgba(25,25,25,0.95)'));
  roof.rotation.x = Math.PI / 2;
  roof.position.set(CXM, CH, (CZ0 + CZ1) / 2);
  cage.add(roof);
  const pole = mat({ color: '#3a3d42', metalness: 0.6, roughness: 0.4 });
  for (const x of [CX0, CX1]) {
    for (let z = CZ0; z <= CZ1 + 0.01; z += CL / 4) cage.add(cylinder(0.04, 0.04, CH, pole, x, 0, z, 10));
    const top = cylinder(0.035, 0.035, CL, pole, 0, 0, 0, 8);
    top.rotation.x = Math.PI / 2;
    top.position.set(x, CH, (CZ0 + CZ1) / 2);
    cage.add(top);
  }
  for (const z of [CZ0, CZ1]) {
    const top = cylinder(0.035, 0.035, 4.0, pole, 0, 0, 0, 8);
    top.rotation.z = Math.PI / 2;
    top.position.set(CXM, CH, z);
    cage.add(top);
  }
  for (const z of [doorZ0, doorZ1]) cage.add(cylinder(0.035, 0.035, CH, pole, CX0, 0, z, 10));
  // Home plate and batter's boxes
  const plateShape = new THREE.Shape([[-0.216, 0], [0.216, 0], [0.216, 0.216], [0, 0.432], [-0.216, 0.216]].map(([x, y]) => new THREE.Vector2(x, y)));
  const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(plateShape, { depth: 0.01, bevelEnabled: false }), mat({ color: '#f5f5f5', roughness: 0.6 }));
  plate.rotation.x = Math.PI / 2;
  plate.position.set(CXM, 0.016, plateZ);
  cage.add(plate);
  const chalk = mat({ color: '#f5f5f5', roughness: 0.9 });
  for (const s of [-1, 1]) {
    const bx = CXM + s * 0.6;
    for (const [w, d, dx, dz] of [[0.04, 1.8, -0.45, 0], [0.04, 1.8, 0.45, 0], [0.94, 0.04, 0, -0.9], [0.94, 0.04, 0, 0.9]]) cage.add(block(w, 0.006, d, chalk, bx + dx * 0.9, 0.006, plateZ - 0.15 + dz));
  }
  // Pitching machine with protective screen
  const machine = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const leg = cylinder(0.02, 0.02, 0.95, pole, 0, 0, 0, 8);
    const a = (i / 3) * TAU;
    leg.position.set(Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25);
    leg.rotation.set(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25);
    machine.add(leg);
  }
  machine.add(block(0.42, 0.16, 0.5, mat({ color: '#c62828', roughness: 0.4 }), 0, 0.85, 0));
  const wheels = [];
  for (const y of [1.25, 0.81]) {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 28), mat({ color: '#1a1a1a', roughness: 0.6 }));
    tire.rotation.z = Math.PI / 2;
    wheel.add(tire);
    wheel.add(block(0.09, 0.03, 0.3, steel, 0, -0.015, 0));
    wheel.position.set(0, y, 0.1);
    machine.add(wheel);
    wheels.push(wheel);
  }
  machine.add(block(0.5, 0.6, 0.06, steel, 0, 0.72, -0.12));
  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.08, 0.3, 20, 1, true), mat({ color: '#d0d4d8', metalness: 0.4, roughness: 0.4, side: THREE.DoubleSide }));
  hopper.position.set(0, 1.62, -0.15);
  machine.add(hopper);
  for (let i = 0; i < 9; i++) machine.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.037, 12, 10), mat({ color: '#f5f2ea', roughness: 0.5 })), (i % 3 - 1) * 0.08, 1.68 + Math.floor(i / 3) * 0.03, -0.15 + ((i * 7) % 3 - 1) * 0.06));
  machine.position.set(CXM, 0, -5.4);
  cage.add(machine);
  const screenFrame = new THREE.Group();
  const frameMat = mat({ color: '#d0d4d8', metalness: 0.5, roughness: 0.4 });
  for (const x of [-1, 1]) screenFrame.add(cylinder(0.025, 0.025, 2.1, frameMat, x, 0, 0, 8));
  for (const y of [0.02, 2.1]) { const bar = cylinder(0.025, 0.025, 2.0, frameMat, 0, 0, 0, 8); bar.rotation.z = Math.PI / 2; bar.position.y = y; screenFrame.add(bar); }
  const screenNet = netMaterial([2, 2], 'rgba(15,15,15,0.95)');
  for (const [w, h, x, y] of [[0.8, 2.08, -0.6, 1.06], [0.8, 2.08, 0.6, 1.06], [0.4, 0.72, 0, 1.74], [0.4, 0.76, 0, 0.4]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenNet);
    p.position.set(x, y, 0);
    screenFrame.add(p);
  }
  screenFrame.position.set(CXM, 0, -4.5);
  cage.add(screenFrame);
  const bucket = new THREE.Group();
  bucket.add(cylinder(0.17, 0.14, 0.38, mat({ color: '#e65100', roughness: 0.5 }), 0, 0, 0, 20));
  for (let i = 0; i < 6; i++) bucket.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.037, 12, 10), mat({ color: '#f5f2ea', roughness: 0.5 })), Math.sin(i) * 0.07, 0.4, Math.cos(i) * 0.07));
  cage.add(at(bucket, CXM + 0.9, 0, -4.9));
  const pitchBall = new THREE.Mesh(new THREE.SphereGeometry(0.037, 14, 10), mat({ color: '#f5f2ea', roughness: 0.5 }));
  pitchBall.visible = false;
  cage.add(pitchBall);
  // Bats, helmets and sign outside the cage
  const batRack = new THREE.Group();
  batRack.add(block(1.2, 0.08, 0.3, darkWood, 0, 0, 0));
  batRack.add(block(1.2, 0.06, 0.12, darkWood, 0, 0.75, -0.08));
  for (let i = 0; i < 6; i++) {
    const bat = cylinder(0.034, 0.012, 0.84, mat({ color: i % 2 ? '#c9a46a' : '#2b2b2b', roughness: 0.4 }), -0.5 + i * 0.2, 0.08, 0, 12);
    bat.rotation.x = 0.08;
    batRack.add(bat);
  }
  const shelf = new THREE.Group();
  shelf.add(block(1.2, 0.9, 0.35, darkWood, 0, 0, 0));
  for (let i = 0; i < 3; i++) {
    const helmet = new THREE.Group();
    helmet.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 12, 0, TAU, 0, Math.PI / 2), mat({ color: ['#1f4ea8', '#c62828', '#111'][i], roughness: 0.25 })));
    helmet.add(block(0.2, 0.012, 0.1, mat({ color: '#111' }), 0, 0, 0.14));
    helmet.position.set(-0.4 + i * 0.4, 0.9, 0);
    shelf.add(helmet);
  }
  cage.add(at(batRack, 13.3, 0, 6.3, -Math.PI / 2));
  cage.add(at(shelf, 13.3, 0, 7.7, -Math.PI / 2));
  const cageSign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.6), mat({ map: signTexture('BATTING CAGE', { width: 1024, height: 180, bg: '#111', color: '#3bff9a', font: '800 96px "Segoe UI", Arial', sub: 'RESERVATION REQUIRED · 30 MIN (SAMPLE)' }), emissive: '#ffffff', emissiveIntensity: 0.25, side: THREE.DoubleSide }));
  cageSign.position.set(CXM, 3.7, CZ1 + 0.03);
  cageSign.rotation.y = 0;
  cage.add(cageSign);
  group.add(tag(cage, 'cage'));
  pointLight(group, [CXM, 3.6, -1.0], '#ffffff', 6, 10);

  // Hall desk and entrance
  const desk = new THREE.Group();
  desk.add(block(2.0, 1.05, 0.6, darkWood, 0, 0, 0));
  desk.add(block(2.1, 0.04, 0.7, mat({ color: '#111', roughness: 0.3 }), 0, 1.05, 0));
  desk.add(block(2.0, 0.03, 0.01, glow('#3bd6ff', 2), 0, 0.5, 0.305));
  desk.add(block(0.4, 0.28, 0.02, black, -0.5, 1.09, -0.15));
  group.add(at(desk, 3.6, 0, 7.6, Math.PI));
  group.add(onWall(F.door({ wood: black, handle: steel, frameMat: steel, w: 1.6, h: 2.6 }), 'front', { W, D }, 6.6, 0, 0));

  // Lighting
  for (const z of [-6, -1, 4]) for (const x of [-10, -3.5, 3, 11.8]) {
    const l = ledBar(3.2, '#f4f6ff', 2.4);
    l.position.set(x, H, z);
    group.add(l);
  }
  hemi(group, '#e8eeff', '#3a3530', 0.65);
  addSun(group, { color: '#ffffff', intensity: 1.4, position: [2, H - 0.2, 5], target: [0, 0, -2], size: 15, near: 0.1, far: 20 });

  // ---------- animations ----------
  anim.add((dt) => {
    clock += dt;
    tvs.forEach((s) => s.update(clock));
    arcadeScreens.forEach((s) => s.update(clock));
    golfScreen.update(clock);
  });

  let breaking = false, broken = false;
  const breakRack = () => {
    if (breaking) return;
    breaking = true;
    tables.forEach((t, ti) => {
      const r = T.rng(Math.floor(Math.random() * 1e6));
      const from = t.balls.map((b) => b.mesh.position.clone());
      const to = t.balls.map((b) => (broken ? b.home.clone() : new THREE.Vector3((r() - 0.5) * 2.05, b.home.y, (r() - 0.5) * 0.95)));
      playOnce(anim, broken ? 0.9 : 1.8, (k, e) => {
        t.balls.forEach((b, i) => {
          b.mesh.position.lerpVectors(from[i], to[i], e);
          b.mesh.rotation.x += (1 - e) * 0.3;
          b.mesh.rotation.z += (1 - e) * 0.2;
        });
      }, () => { if (ti === tables.length - 1) { broken = !broken; breaking = false; } });
    });
  };

  let rallying = false;
  const rally = () => {
    if (rallying) return;
    rallying = true;
    const base = new THREE.Vector3(-1.4, 0.76, -5.6);
    const hops = 6;
    let i = 0;
    const next = () => {
      if (i >= hops) { pingBall.position.set(base.x + 0.5, 0.762, base.z + 0.3); rallying = false; return; }
      const dir = i % 2 ? -1 : 1;
      const z0 = (i % 3 - 1) * 0.35, z1 = ((i + 1) % 3 - 1) * 0.35;
      playOnce(anim, 0.55, (k) => {
        const x = -1.45 * dir + 2.9 * dir * k;
        const bounceAt = 0.72;
        const y = k < bounceAt ? 0.95 - 0.19 * (k / bounceAt) ** 2 + Math.sin((k / bounceAt) * Math.PI) * 0.12 : 0.76 + Math.sin(((k - bounceAt) / (1 - bounceAt)) * Math.PI) * 0.22;
        pingBall.position.set(base.x + x, y, base.z + z0 + (z1 - z0) * k);
      }, () => { i++; next(); });
    };
    next();
  };

  const insertCredit = () => {
    creditUntil = clock + 4;
    playOnce(anim, 4, (k) => { for (const m of marqueeMats) m.emissiveIntensity = 1.3 + (Math.floor(k * 16) % 2) * 1.2; }, () => { for (const m of marqueeMats) m.emissiveIntensity = 1.3; });
  };

  let swinging = false;
  const swing = () => {
    if (swinging) return;
    swinging = true;
    golfState.drift = (Math.random() - 0.5) * 1.2;
    golfState.carry = 180 + Math.round(Math.random() * 60);
    const target = new THREE.Vector3(6.2 + golfState.drift * 0.8, 1.7, -D / 2 + 0.14);
    playOnce(anim, 0.32, (k) => {
      golfBall.position.lerpVectors(teePos, target, k);
      golfBall.position.y += Math.sin(k * Math.PI) * 0.3;
    }, () => {
      golfBall.visible = false;
      golfState.start = clock;
      let wait = 3.2;
      anim.add((dt) => {
        wait -= dt;
        if (wait > 0) return true;
        golfBall.position.copy(teePos);
        golfBall.visible = true;
        swinging = false;
        return false;
      });
    });
  };

  let putting2 = false;
  const putt = () => {
    if (putting2) return;
    putting2 = true;
    const cup = new THREE.Vector3(cups[1][0], 0.056, cups[1][1]);
    const start = puttStart.clone();
    playOnce(anim, 2.2, (k, e) => {
      puttBall.position.lerpVectors(start, cup, e);
      puttBall.position.x += Math.sin(e * Math.PI) * 0.18;
      puttBall.rotation.x -= 0.25 * (1 - e);
      if (k > 0.97) puttBall.position.y = 0.056 - (k - 0.97) * 2.5;
    }, () => {
      let wait = 1.5;
      anim.add((dt) => {
        wait -= dt;
        if (wait > 0) return true;
        puttBall.position.copy(puttStart);
        putting2 = false;
        return false;
      });
    });
  };

  let pitching = false;
  const pitch = () => {
    if (pitching) return;
    pitching = true;
    const from = new THREE.Vector3(CXM, 1.03, -5.15);
    let spin = 0;
    const spinner = (dt) => { spin += dt; wheels[0].rotation.x -= dt * 30; wheels[1].rotation.x += dt * 30; return spin < 1.6; };
    anim.add(spinner);
    pitchBall.visible = true;
    pitchBall.position.copy(from);
    playOnce(anim, 0.75, (k) => {
      const z = from.z + (CZ1 - 0.15 - from.z) * k;
      const t = (z - from.z) / (plateZ - from.z);
      const y = from.y + Math.sin(Math.min(1, t) * Math.PI) * 0.18 - Math.max(0, t) * 0.25;
      pitchBall.position.set(CXM + Math.sin(k * 2) * 0.03, Math.max(0.05, y), z);
    }, () => {
      const fall = pitchBall.position.clone();
      playOnce(anim, 0.4, (k) => { pitchBall.position.set(fall.x, Math.max(0.037, fall.y - fall.y * k * k), fall.z - k * 0.2); }, () => {
        let wait = 0.8;
        anim.add((dt) => { wait -= dt; if (wait > 0) return true; pitchBall.visible = false; pitching = false; return false; });
      });
    });
  };

  const hotspots = [
    {
      id: 'billiards', label: 'Billiards', position: [-10, 1.5, -4.5],
      title: 'Billiard tables', text: 'Two 8-ft tables with blue cloth, a full set of balls, cues on the wall rack and green pendant lamps. Free for hotel guests (sample rule).',
      view: { position: [-7.4, 2.2, -1.2], target: [-10, 0.8, -4.4] },
      action: { label: 'Break the rack', run: breakRack },
    },
    {
      id: 'gaming', label: 'Console lounge', position: [-12.4, 2.8, 4.75],
      title: 'Console gaming lounge', text: 'Two big-screen stations with PS5-style consoles, wireless controllers, racing-style gaming chairs and sofas. Games shown are generic demo footage.',
      view: { position: [-8.0, 1.8, 4.75], target: [-13.0, 1.3, 4.75] },
      action: { label: 'Switch games', run: () => { tvMode++; } },
    },
    {
      id: 'tennis', label: 'Table tennis', position: [-1.4, 1.5, -5.6],
      title: 'Table tennis', text: 'A full-size table with net, paddles and balls behind low barriers. Paddles are available at the hall desk.',
      view: { position: [-1.4, 2.0, -1.4], target: [-1.4, 0.7, -5.8] },
      action: { label: 'Play a rally', run: rally },
    },
    {
      id: 'arcade', label: 'Arcade', position: [-1.45, 2.35, D / 2 - 0.6],
      title: 'Arcade cabinets', text: 'Seven retro-style cabinets with original made-up games (Galaxy Raid, Maze Munch, Block Drop) on free play. No coins or tokens needed.',
      view: { position: [-1.4, 1.7, 5.0], target: [-1.4, 1.3, 9] },
      action: { label: 'Insert free-play credit', run: insertCredit },
    },
    {
      id: 'golf', label: 'Golf simulator', position: [6.2, 2.4, -5.0],
      title: 'Indoor golf simulator', text: 'A projection screen with a simulated course, a hitting mat with tee, a bag of clubs and a ball tray. Reserve 30-minute slots at the hall desk (sample rule).',
      view: { position: [6.2, 1.7, -0.6], target: [6.2, 1.4, -8.0] },
      action: { label: 'Take a swing', run: swing },
    },
    {
      id: 'putting', label: 'Putting green', position: [6.3, 1.2, 4.0],
      title: 'Putting green', text: 'A three-hole artificial putting green with flags, balls and putters. Free to use.',
      view: { position: [8.6, 1.8, 7.6], target: [6.8, 0.1, 3.6] },
      action: { label: 'Putt a ball', run: putt },
    },
    {
      id: 'cage', label: 'Batting cage', position: [CXM, 2.6, 0],
      title: 'Baseball batting cage', text: 'A fully netted batting cage (cage only, no field) with turf, home plate, a two-wheel pitching machine behind a protective screen, bats and helmets. Reservation required (sample rule).',
      view: { position: [CXM - 0.2, 1.6, 5.1], target: [CXM, 1.1, -4.5] },
      action: { label: 'Pitch a ball', run: pitch },
    },
  ];

  return {
    group, hotspots,
    bounds: { W, D, H },
    exposure: 1.0,
    envIntensity: 0.3,
    walkSpeed: 2.8,
    update: anim.update,
    viewpoints: [
      { id: 'overview', label: 'Overview', position: [2.0, 4.4, 8.4], target: [-1.5, 0.4, -3.0] },
      { id: 'billiards', label: 'Billiards', position: hotspots[0].view.position, target: hotspots[0].view.target },
      { id: 'gaming', label: 'Console lounge', position: hotspots[1].view.position, target: hotspots[1].view.target },
      { id: 'tennis', label: 'Table tennis', position: hotspots[2].view.position, target: hotspots[2].view.target },
      { id: 'arcade', label: 'Arcade', position: hotspots[3].view.position, target: hotspots[3].view.target },
      { id: 'golf', label: 'Golf simulator', position: hotspots[4].view.position, target: hotspots[4].view.target },
      { id: 'putting', label: 'Putting green', position: hotspots[5].view.position, target: hotspots[5].view.target },
      { id: 'cage', label: 'Batting cage', position: hotspots[6].view.position, target: hotspots[6].view.target },
    ],
  };
}
