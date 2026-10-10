// Grand Ballroom: pillarless hall with three crystal chandeliers, a raised
// stage and LED wall, and three switchable room setups (wedding reception,
// formal banquet, corporate conference) built with instanced tables and
// chairs. `layouts` lets the explorer page switch setups from outside.
import {
  THREE, T, F, mat, block, cylinder, METALS, at, buildShell, addSun,
  tag, glow, animator, canvasTexture, signTexture, liveScreen, screen,
  instanced, place, boxGeo, cylGeo, noShadow,
} from './kit.js';

const W = 34, D = 26, H = 8;
const STAGE = { w: 12, d: 4, h: 0.8, z0: -D / 2, z1: -D / 2 + 4 };
const DANCE = { w: 10, d: 8, z: -4 };

const SETUPS = [
  { id: 'wedding', label: 'Wedding reception', uplight: '#ff9fb8', cove: '#ffd2dc' },
  { id: 'banquet', label: 'Formal banquet', uplight: '#ffbf66', cove: '#ffd9a0' },
  { id: 'conference', label: 'Corporate conference', uplight: '#6ea8ff', cove: '#cfe2ff' },
];
const CAPACITY = { wedding: 360, banquet: 480, conference: 600 };

// ---------- geometry builders (merged, for instancing) ----------

function chiavariGeos() {
  const frame = [];
  for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) frame.push(cylGeo(0.016, 0.014, 0.45, x, 0, z, 6));
  frame.push(boxGeo(0.42, 0.03, 0.42, 0, 0.44, 0));
  for (const x of [-0.19, 0.19]) frame.push(cylGeo(0.016, 0.016, 0.5, x, 0.46, -0.19, 6));
  for (const y of [0.62, 0.76, 0.92]) frame.push(boxGeo(0.4, 0.025, 0.025, 0, y, -0.19));
  for (const x of [-0.09, 0, 0.09]) frame.push(boxGeo(0.014, 0.3, 0.014, x, 0.62, -0.19));
  const cushion = [boxGeo(0.4, 0.05, 0.4, 0, 0.47, 0.01)];
  return { frame, cushion };
}

function conferenceChairGeos() {
  const frame = [];
  for (const [x, z] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.2], [0.2, 0.2]]) frame.push(cylGeo(0.014, 0.014, 0.44, x, 0, z, 6));
  for (const x of [-0.2, 0.2]) frame.push(cylGeo(0.014, 0.014, 0.5, x, 0.44, -0.2, 6));
  const cushion = [boxGeo(0.46, 0.08, 0.45, 0, 0.42, 0.01), boxGeo(0.46, 0.44, 0.07, 0, 0.55, -0.21)];
  return { frame, cushion };
}

function candelabraGeos() {
  const metal = [cylGeo(0.07, 0.09, 0.03, 0, 0, 0, 12), cylGeo(0.012, 0.018, 0.42, 0, 0.03, 0, 8), boxGeo(0.44, 0.015, 0.015, 0, 0.36, 0), boxGeo(0.015, 0.015, 0.44, 0, 0.36, 0)];
  const cups = [[0, 0.45, 0], [0.21, 0.37, 0], [-0.21, 0.37, 0], [0, 0.37, 0.21], [0, 0.37, -0.21]];
  for (const [x, y, z] of cups) metal.push(cylGeo(0.022, 0.012, 0.03, x, y, z, 8));
  const candles = cups.map(([x, y, z]) => cylGeo(0.012, 0.012, 0.16, x, y + 0.03, z, 8));
  const flames = cups.map(([x, y, z]) => new THREE.SphereGeometry(0.014, 6, 6).scale(1, 1.8, 1).translate(x, y + 0.22, z));
  return { metal, candles, flames };
}

function parquetTexture() {
  return canvasTexture(512, 512, (ctx, S) => {
    const r = T.rng(401);
    const n = 8, s = S / n;
    const tones = ['#9a6a3e', '#b07c4a', '#875a33', '#c08d58'];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const vertical = (x + y) % 2 === 0;
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = T.shade(tones[Math.floor(r() * tones.length)], (r() - 0.5) * 0.08);
        if (vertical) ctx.fillRect(x * s + (k * s) / 4, y * s, s / 4 - 1, s - 1);
        else ctx.fillRect(x * s, y * s + (k * s) / 4, s - 1, s / 4 - 1);
      }
    }
    T.addNoise(ctx, S, S, 10, r);
  }, { repeat: [2.5, 2] });
}

function washTexture() {
  return canvasTexture(64, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(w * 0.42, h); ctx.lineTo(w * 0.58, h); ctx.lineTo(w, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
  });
}

function crystalChandelier({ gold, crystal, bulb, seed }) {
  const g = new THREE.Group();
  const r = T.rng(seed);
  g.add(cylinder(0.03, 0.03, 1.0, gold, 0, -1.0, 0, 8));
  g.add(cylinder(0.25, 0.08, 0.12, gold, 0, -0.08, 0, 16));
  const drops = [];
  const rings = [[1.25, -1.3, 44], [0.9, -1.75, 34], [0.55, -2.15, 24]];
  for (const [rad, y, n] of rings) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.025, 8, 64), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const len = 3 + Math.floor(r() * 3);
      for (let k = 0; k < len; k++) drops.push(place(Math.cos(a) * rad, y - 0.08 - k * 0.1, Math.sin(a) * rad, a, k === len - 1 ? 1.4 : 1));
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const arm = cylinder(0.012, 0.012, rad, gold, 0, 0, 0, 6);
      arm.rotation.z = Math.PI / 2;
      arm.rotation.y = -a;
      arm.position.set(Math.cos(a) * rad / 2, y, Math.sin(a) * rad / 2);
      g.add(arm);
    }
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6).scale(1, 1.6, 1), bulb);
    b.position.set(Math.cos(a) * 1.25, -1.22, Math.sin(a) * 1.25);
    g.add(b);
  }
  const dropGeo = new THREE.OctahedronGeometry(0.035, 0).scale(1, 1.7, 1);
  g.add(instanced([dropGeo], crystal, drops, { cast: false, receive: false }));
  const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0).scale(1, 2, 1), crystal);
  finial.position.y = -2.55;
  g.add(finial);
  return noShadow(g);
}

// ---------- room ----------

export default function build() {
  const group = new THREE.Group();
  const anim = animator();
  const gold = METALS.gold();
  const silver = METALS.chrome();
  const cream = mat({ color: '#efe6d6', roughness: 0.7 });
  const linen = mat({ map: T.fabric('#f7f3ec', { seed: 402, repeat: [2, 2] }), roughness: 0.95 });

  const shell = buildShell({
    W, D, H, tile: 1.5,
    floorMat: mat({ map: T.carpet('#3d2f4a', { seed: 403, repeat: [12, 9] }), roughness: 1 }),
    wallMat: mat({ map: T.wallpaper('#efe5d3', { seed: 404, stripe: 0.02, repeat: [10, 2] }), roughness: 0.8 }),
    ceilingMat: mat({ color: '#f4eee4', roughness: 0.85 }),
    trimMat: gold,
    walls: {},
    crown: true,
    wainscot: { height: 1.1, material: cream },
  });
  group.add(shell);

  // Coffered ceiling with domes over the chandeliers
  const beamMat = mat({ color: '#eadfcb', roughness: 0.6 });
  const beams = [];
  for (let x = -W / 2 + 4.25; x < W / 2; x += 4.25) beams.push(new THREE.Matrix4().compose(new THREE.Vector3(x, H - 0.35, 0), new THREE.Quaternion(), new THREE.Vector3(1, 1, D / 0.3)));
  for (let z = -D / 2 + 4.33; z < D / 2; z += 4.33) beams.push(new THREE.Matrix4().compose(new THREE.Vector3(0, H - 0.35, z), new THREE.Quaternion(), new THREE.Vector3(W / 0.3, 1, 1)));
  group.add(instanced([boxGeo(0.3, 0.35, 0.3)], beamMat, beams, { cast: false }));
  const coveStrips = [];
  const coveMat = glow('#ffd9a0', 1.6);
  for (const [len, x, z, ry] of [[W - 0.6, 0, -D / 2 + 0.25, 0], [W - 0.6, 0, D / 2 - 0.25, 0], [D - 0.6, -W / 2 + 0.25, 0, Math.PI / 2], [D - 0.6, W / 2 - 0.25, 0, Math.PI / 2]]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.05), coveMat);
    s.position.set(x, H - 0.45, z);
    s.rotation.y = ry;
    coveStrips.push(s);
    group.add(s);
  }

  // Chandeliers
  const crystal = mat({ color: '#ffffff', metalness: 0.15, roughness: 0.04, emissive: '#fff1dc', emissiveIntensity: 0.35, envMapIntensity: 2.5 });
  const bulb = glow('#ffe2b0', 2.6);
  const chandelierLights = [];
  const chandeliers = new THREE.Group();
  [-6.2, 0.3, 6.8].forEach((z, i) => {
    const c = crystalChandelier({ gold, crystal, bulb, seed: 410 + i });
    c.position.set(0, H, z);
    chandeliers.add(c);
    const dome = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.08, 10, 64), beamMat);
    dome.rotation.x = Math.PI / 2;
    dome.position.set(0, H - 0.05, z);
    chandeliers.add(dome);
    const domeGlow = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.02, 6, 64), coveMat);
    domeGlow.rotation.x = Math.PI / 2;
    domeGlow.position.set(0, H - 0.12, z);
    chandeliers.add(domeGlow);
    const l = new THREE.PointLight('#ffd9a8', 30, 18, 2);
    l.position.set(0, H - 2.4, z);
    group.add(l);
    chandelierLights.push(l);
  });
  group.add(tag(chandeliers, 'chandeliers'));
  // Side chandelier pairs (smaller ring fixtures)
  for (const x of [-11.5, 11.5]) for (const z of [-5, 5]) {
    const c = F.chandelier({ metal: gold, light: 0, drop: 0.9, radius: 0.6 });
    c.position.set(x, H, z);
    group.add(noShadow(c));
  }

  // Wall mirrors, sconces and uplight washes
  const washTex = washTexture();
  const washMat = new THREE.MeshBasicMaterial({ map: washTex, color: SETUPS[0].uplight, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const uplightMat = glow(SETUPS[0].uplight, 2);
  const walls = new THREE.Group();
  const mirrorFrame = gold;
  const mirrorGlass = mat({ color: '#e4e7ea', metalness: 0.75, roughness: 0.1, envMapIntensity: 3.5 });
  const addWallBay = (x, z, ry, mirror) => {
    const g = new THREE.Group();
    if (mirror) {
      const m = F.mirror({ w: 1.5, h: 3.2, frame: mirrorFrame });
      m.children[1].material = mirrorGlass;
      g.add(at(m, 0, 3.1, 0.04));
    }
    const wash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 4.6), washMat);
    wash.position.set(mirror ? 1.6 : 0, 2.4, 0.05);
    wash.userData.noPick = true;
    g.add(wash);
    g.add(block(0.22, 0.12, 0.16, uplightMat, mirror ? 1.6 : 0, 0.01, 0.12));
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    walls.add(g);
  };
  for (const z of [-8, -3.5, 1, 5.5, 10]) {
    addWallBay(-W / 2 + 0.02, z, Math.PI / 2, true);
    addWallBay(W / 2 - 0.02, -z, -Math.PI / 2, true);
  }
  for (const x of [-13, -4.5, 4.5, 13]) addWallBay(x, D / 2 - 0.02, Math.PI, false);
  for (const x of [-12, -8, 8, 12]) addWallBay(x, -D / 2 + 0.02, 0, false);
  for (const x of [-W / 2 + 0.1, W / 2 - 0.1]) for (const z of [-5.75, -1.25, 3.25, 7.75]) {
    const sc = F.wallSconce({ metal: gold, light: 0 });
    sc.position.set(x, 2.3, z);
    sc.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    walls.add(noShadow(sc));
  }
  group.add(tag(walls, 'chandeliers'));
  const uplights = [-1, 1].flatMap((s) => [-6, 4].map((z) => {
    const l = new THREE.PointLight(SETUPS[0].uplight, 4, 9, 2);
    l.position.set(s * (W / 2 - 0.6), 0.4, z);
    group.add(l);
    return l;
  }));

  // Entrance doors on the front wall, VIP room door by the stage
  const doorWood = mat({ map: T.woodGrain('#6b4a30', { seed: 405 }), roughness: 0.5 });
  const entrance = new THREE.Group();
  for (const x of [-8, 0, 8]) {
    const g = new THREE.Group();
    for (const s of [-0.6, 0.6]) g.add(at(F.door({ wood: doorWood, handle: gold, frameMat: gold, w: 1.15, h: 2.8 }), s, 0, 0));
    g.add(block(2.8, 0.5, 0.06, gold, 0, 2.95, 0.02));
    entrance.add(at(g, x, 0, D / 2 - 0.06, Math.PI));
  }
  const vip = new THREE.Group();
  vip.add(F.door({ wood: doorWood, handle: gold, frameMat: gold, w: 1.1, h: 2.5 }));
  const vipSign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.3), mat({ map: signTexture('BRIDAL / VIP ROOM', { width: 512, height: 110, color: '#8e6f42', bg: '#f4ecdf', font: '600 52px Georgia, serif' }) }));
  vipSign.position.set(0, 2.85, 0.04);
  vip.add(vipSign);
  entrance.add(at(vip, -W / 2 + 0.06, 0, -10.8, Math.PI / 2));
  group.add(tag(entrance, 'entrance'));

  // ---------- stage and LED wall ----------
  const stage = new THREE.Group();
  const stageTop = mat({ map: T.woodPlanks('#3a2a20', { seed: 406, planks: 8, repeat: [4, 2] }), roughness: 0.5 });
  stage.add(block(STAGE.w, STAGE.h, STAGE.d, stageTop, 0, 0, (STAGE.z0 + STAGE.z1) / 2));
  stage.add(block(STAGE.w + 0.04, 0.06, 0.04, gold, 0, STAGE.h - 0.06, STAGE.z1));
  const skirt = new THREE.Mesh(new THREE.PlaneGeometry(STAGE.w, STAGE.h), mat({ map: T.fabric('#6b1f2a', { seed: 407, repeat: [10, 1] }), roughness: 0.9 }));
  skirt.position.set(0, STAGE.h / 2, STAGE.z1 + 0.005);
  stage.add(skirt);
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    stage.add(block(1.4, STAGE.h - k * 0.27, 0.3, stageTop, s * (STAGE.w / 2 - 0.9), 0, STAGE.z1 + 0.15 + k * 0.3));
  }
  let activeId = SETUPS[0].id;
  const led = liveScreen((ctx, w, h, t) => {
    const theme = {
      wedding: { bg: ['#f6d6dc', '#e9b7c2'], ink: '#7a4a52', title: 'Celebrating Love', sub: 'Wedding Reception · sample' },
      banquet: { bg: ['#1b2440', '#0e1326'], ink: '#e2c48c', title: 'Gala Banquet', sub: 'An evening of fine dining · sample' },
      conference: { bg: ['#123a6b', '#0b2140'], ink: '#ffffff', title: 'Annual Business Forum', sub: 'Welcome · Keynote at 9:00 AM · sample' },
    }[activeId];
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, theme.bg[0]); g.addColorStop(1, theme.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = (i * 97 + t * 14 * (i % 3 + 1)) % w, y = (i * 53 + Math.sin(t + i) * 10 + h) % h;
      ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.25 * (0.5 + 0.5 * Math.sin(t * 2 + i))})`;
      ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = theme.ink;
    ctx.font = `600 ${activeId === 'conference' ? 34 : 42}px Georgia, serif`;
    ctx.fillText(theme.title, w / 2, h / 2);
    ctx.font = '17px "Segoe UI", Arial';
    ctx.fillText(theme.sub, w / 2, h / 2 + 34);
    ctx.fillStyle = theme.ink;
    ctx.fillRect(w / 2 - 50, h / 2 - 50, 100, 2);
  }, { width: 512, height: 288, fps: 10 });
  const ledWall = screen(9.6, led.texture, { frame: '#0a0a0a', intensity: 0.9 });
  ledWall.position.set(0, STAGE.h + 0.4 + 2.7, STAGE.z0 + 0.12);
  stage.add(ledWall);
  const drapeMat = mat({ map: T.fabric('#e9dcc6', { seed: 408, repeat: [4, 4] }), roughness: 0.95 });
  for (const s of [-1, 1]) {
    const c = F.curtain({ width: 1.6, height: H - 0.5, material: drapeMat, folds: 6 });
    c.position.set(s * 5.7, H - 0.4, STAGE.z0 + 0.3);
    stage.add(c);
  }
  group.add(tag(stage, 'stage'));

  // Dance floor (portable parquet, wedding setup only) and mirror ball
  const dance = new THREE.Group();
  const danceFloor = new THREE.Mesh(new THREE.PlaneGeometry(DANCE.w, DANCE.d), mat({ map: parquetTexture(), roughness: 0.35, metalness: 0.05 }));
  danceFloor.rotation.x = -Math.PI / 2;
  danceFloor.position.set(0, 0.012, DANCE.z);
  danceFloor.receiveShadow = true;
  dance.add(danceFloor);
  for (const [w, d, x, z] of [[DANCE.w + 0.1, 0.06, 0, DANCE.z - DANCE.d / 2], [DANCE.w + 0.1, 0.06, 0, DANCE.z + DANCE.d / 2], [0.06, DANCE.d, -DANCE.w / 2, DANCE.z], [0.06, DANCE.d, DANCE.w / 2, DANCE.z]]) {
    dance.add(block(w, 0.02, d, gold, x, 0, z));
  }
  const glintMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const glints = [];
  for (let i = 0; i < 40; i++) glints.push({ a: Math.random() * Math.PI * 2, r: 0.5 + Math.random() * 4, y: 0 });
  const glintMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.09, 10).rotateX(-Math.PI / 2), glintMat, glints.length);
  glintMesh.userData.noPick = true;
  glintMesh.frustumCulled = false;
  dance.add(glintMesh);
  group.add(tag(dance, 'dance'));
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 2), mat({ color: '#e6e9ee', metalness: 1, roughness: 0.12, flatShading: true }));
  ball.position.set(0, H - 1.6, DANCE.z - 1);
  group.add(cylinder(0.01, 0.01, 1.25, silver, 0, H - 1.25, DANCE.z - 1, 4));
  group.add(tag(ball, 'dance'));

  // ---------- setups ----------
  const setups = {};
  const chiavari = chiavariGeos();
  const confChair = conferenceChairGeos();

  // Wedding reception: rounds of 10, head table on stage, floral arch, cake
  {
    const g = new THREE.Group();
    const tables = [];
    for (const x of [-13.8, -10.8, -7.8, 7.8, 10.8, 13.8]) for (const z of [-6.5, -3, 0.5]) tables.push([x, z]);
    for (const z of [4.2, 7.6]) for (let x = -12.6; x <= 12.7; x += 3.6) tables.push([x, z]);
    const tableM = [], chairs = [], plates = [], centre = [], blooms = [];
    for (const [tx, tz] of tables) {
      tableM.push(place(tx, 0, tz));
      centre.push(place(tx, 0.76, tz));
      blooms.push(place(tx, 1.25, tz));
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        chairs.push(place(tx + Math.cos(a) * 1.22, 0, tz + Math.sin(a) * 1.22, Math.atan2(-Math.cos(a), -Math.sin(a))));
        plates.push(place(tx + Math.cos(a) * 0.68, 0.765, tz + Math.sin(a) * 0.68));
      }
    }
    // Head table on stage, facing the guests
    const headZ = STAGE.z1 - 1.0;
    g.add(block(7.2, 0.76, 0.9, linen, 0, STAGE.h, headZ));
    g.add(block(7.25, 0.02, 0.92, mat({ color: '#e7b9c4' }), 0, STAGE.h + 0.62, headZ));
    for (let k = 0; k < 12; k++) {
      const x = -3.3 + k * 0.6;
      chairs.push(place(x, STAGE.h, headZ - 0.75, 0));
      plates.push(place(x, STAGE.h + 0.765, headZ - 0.18));
    }
    g.add(instanced([cylGeo(0.92, 0.98, 0.76, 0, 0, 0, 28)], linen, tableM));
    g.add(instanced([cylGeo(0.93, 0.93, 0.02, 0, 0.74, 0, 28)], mat({ color: '#e7b9c4', roughness: 0.8 }), tableM, { cast: false }));
    g.add(instanced([cylGeo(0.12, 0.12, 0.01, 0, 0, 0, 16)], mat({ color: '#ffffff', roughness: 0.3 }), plates, { cast: false }));
    g.add(instanced([cylGeo(0.05, 0.07, 0.42, 0, 0, 0, 10)], mat({ color: '#dfeaf0', transparent: true, opacity: 0.55, roughness: 0.05 }), centre, { cast: false }));
    g.add(instanced([new THREE.IcosahedronGeometry(0.2, 1)], mat({ color: '#f3c6d1', roughness: 0.7, flatShading: true }), blooms));
    g.add(instanced(chiavari.frame, gold, chairs));
    g.add(instanced(chiavari.cushion, mat({ color: '#f6efe4', roughness: 0.9 }), chairs));
    // Floral arch on stage
    const arch = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.05, 8, 48, Math.PI), mat({ color: '#f4f0ea' }));
    arch.position.set(0, STAGE.h, STAGE.z0 + 1.3);
    g.add(arch);
    const archFlowers = [];
    const fr = T.rng(420);
    for (let i = 0; i < 160; i++) {
      const a = fr() * Math.PI;
      archFlowers.push(place(Math.cos(a) * 2.0 + (fr() - 0.5) * 0.25, STAGE.h + Math.sin(a) * 2.0 + (fr() - 0.5) * 0.25, STAGE.z0 + 1.3 + (fr() - 0.5) * 0.2, fr() * 3, 0.6 + fr() * 0.6));
    }
    const half = archFlowers.length / 2;
    g.add(instanced([new THREE.IcosahedronGeometry(0.12, 0)], mat({ color: '#f6f0ea', flatShading: true }), archFlowers.slice(0, half), { cast: false }));
    g.add(instanced([new THREE.IcosahedronGeometry(0.11, 0)], mat({ color: '#e99aae', flatShading: true }), archFlowers.slice(half), { cast: false }));
    // Three-tier cake
    const cake = new THREE.Group();
    cake.add(cylinder(0.5, 0.55, 0.76, linen, 0, 0, 0, 24));
    for (const [r, y, h] of [[0.32, 0.76, 0.22], [0.24, 0.98, 0.2], [0.16, 1.18, 0.18]]) cake.add(cylinder(r, r, h, mat({ color: '#fbf6ee', roughness: 0.6 }), 0, y, 0, 24));
    cake.add(cylinder(0.04, 0.06, 0.1, mat({ color: '#e99aae' }), 0, 1.36, 0, 10));
    g.add(at(cake, 0, 0, 1.6));
    setups.wedding = g;
  }

  // Formal banquet: long tables with runners, candelabra and place settings
  {
    const g = new THREE.Group();
    const rowsX = [-14, -10, -6, -2, 2, 6, 10, 14];
    const z0 = -7, z1 = 9, len = z1 - z0;
    const chairs = [], plates = [], candles = [];
    for (const x of rowsX) {
      g.add(block(1.2, 0.76, len, linen, x, 0, (z0 + z1) / 2));
      g.add(block(0.4, 0.005, len - 0.2, mat({ color: '#c9a46a', metalness: 0.4, roughness: 0.5 }), x, 0.76, (z0 + z1) / 2));
      for (let z = z0 + 0.4; z <= z1 - 0.3; z += 0.64) for (const s of [-1, 1]) {
        chairs.push(place(x + s * 0.88, 0, z, s > 0 ? -Math.PI / 2 : Math.PI / 2));
        plates.push(place(x + s * 0.38, 0.765, z));
      }
      for (let z = z0 + 2; z < z1 - 1; z += 4) candles.push(place(x, 0.765, z));
    }
    const headZ = STAGE.z1 - 1.0;
    g.add(block(8.4, 0.76, 0.9, linen, 0, STAGE.h, headZ));
    for (let k = 0; k < 12; k++) { chairs.push(place(-3.3 + k * 0.6, STAGE.h, headZ - 0.75, 0)); plates.push(place(-3.3 + k * 0.6, STAGE.h + 0.765, headZ - 0.18)); }
    for (const x of [-2.4, 2.4]) candles.push(place(x, STAGE.h + 0.765, headZ + 0.1));
    const lectern = new THREE.Group();
    lectern.add(block(0.6, 1.1, 0.45, doorWood, 0, 0, 0));
    lectern.add(block(0.66, 0.04, 0.5, doorWood, 0, 1.1, 0.02).rotateX(-0.25));
    g.add(at(lectern, 4.9, STAGE.h, STAGE.z1 - 0.5, -0.3));
    g.add(instanced([cylGeo(0.12, 0.12, 0.01, 0, 0, 0, 16)], mat({ color: '#ffffff', roughness: 0.3 }), plates, { cast: false }));
    const cg = candelabraGeos();
    g.add(instanced(cg.metal, gold, candles));
    g.add(instanced(cg.candles, mat({ color: '#fbf7ee', roughness: 0.6 }), candles, { cast: false }));
    g.add(instanced(cg.flames, glow('#ffb347', 3), candles, { cast: false, receive: false }));
    g.add(instanced(chiavari.frame, mat({ color: '#2a1d15', roughness: 0.4, metalness: 0.2 }), chairs));
    g.add(instanced(chiavari.cushion, mat({ color: '#6b1f2a', roughness: 0.9 }), chairs));
    setups.banquet = g;
  }

  // Corporate conference: theatre-style rows, panel table, lectern, AV desk
  {
    const g = new THREE.Group();
    const chairs = [];
    for (let i = 0; i < 12; i++) {
      const z = -6.6 + i * 0.95;
      for (let k = 0; k < 25; k++) for (const s of [-1, 1]) chairs.push(place(s * (1.2 + 0.275 + k * 0.55), 0, z, Math.PI));
    }
    g.add(instanced(confChair.frame, METALS.black(), chairs));
    g.add(instanced(confChair.cushion, mat({ color: '#203a5c', roughness: 0.9 }), chairs));
    const navy = mat({ map: T.fabric('#1d2f4d', { seed: 409, repeat: [4, 1] }), roughness: 0.9 });
    const panelZ = STAGE.z1 - 1.3;
    g.add(block(5, 0.76, 0.8, navy, -1.2, STAGE.h, panelZ));
    const panelChairs = [-3, -1.8, -0.6, 0.6].map((x) => place(x, STAGE.h, panelZ - 0.7, 0));
    g.add(instanced(confChair.frame, METALS.black(), panelChairs));
    g.add(instanced(confChair.cushion, mat({ color: '#203a5c', roughness: 0.9 }), panelChairs));
    for (const x of [-3, -1.8, -0.6, 0.6]) {
      g.add(cylinder(0.035, 0.035, 0.22, mat({ color: '#dfeaf0', transparent: true, opacity: 0.6 }), x, STAGE.h + 0.76, panelZ + 0.15, 10));
      g.add(block(0.18, 0.08, 0.03, mat({ color: '#f4f4f4' }), x, STAGE.h + 0.76, panelZ + 0.36));
    }
    const lectern = new THREE.Group();
    lectern.add(block(0.65, 1.1, 0.5, navy, 0, 0, 0));
    lectern.add(block(0.7, 0.04, 0.55, doorWood, 0, 1.1, 0));
    lectern.add(cylinder(0.006, 0.006, 0.35, METALS.black(), 0, 1.14, 0.12, 4));
    g.add(at(lectern, 4.2, STAGE.h, STAGE.z1 - 0.8, -0.35));
    // AV desk and registration tables at the back
    const av = new THREE.Group();
    av.add(block(3.2, 0.76, 0.9, navy, 0, 0, 0));
    for (const x of [-0.9, 0, 0.9]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), glow(x ? '#3c7bd9' : '#5ad19a', 1.1));
      m.position.set(x, 0.98, -0.2);
      m.rotation.y = Math.PI;
      av.add(m);
      av.add(block(0.5, 0.32, 0.02, METALS.black(), x, 0.82, -0.18));
    }
    g.add(at(av, 0, 0, 9.0));
    for (const s of [-1, 1]) {
      const reg = new THREE.Group();
      reg.add(block(2.4, 0.76, 0.7, navy, 0, 0, 0));
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 2.0), mat({
        map: canvasTexture(128, 300, (ctx, w, h) => {
          ctx.fillStyle = '#123a6b'; ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.font = '600 15px "Segoe UI", Arial';
          ctx.fillText('REGISTRATION', w / 2, 50);
          ctx.fillStyle = '#e2c48c'; ctx.fillRect(20, 64, w - 40, 3);
          ctx.fillStyle = '#cfe2ff'; ctx.font = '13px "Segoe UI", Arial'; ctx.fillText('Business Forum', w / 2, 96); ctx.fillText('(sample)', w / 2, 116);
        }), roughness: 0.7,
      }));
      banner.position.set(1.6, 1.0, -0.2);
      reg.add(banner);
      g.add(at(reg, s * 9, 0, 10.8, Math.PI));
    }
    setups.conference = g;
  }
  for (const s of SETUPS) { setups[s.id].visible = false; group.add(tag(setups[s.id], 'tables')); }

  // ---------- lighting ----------
  const hemi = new THREE.HemisphereLight('#fff4e6', '#5a4a3e', 0.7);
  group.add(hemi);
  const key = addSun(group, { color: '#fff1dc', intensity: 0.9, position: [3, 22, 4], target: [0, 0, 0], size: 18, near: 4, far: 40 });

  const LIGHTS = [
    { id: 'bright', label: 'Bright' },
    { id: 'evening', label: 'Evening' },
    { id: 'party', label: 'Party' },
  ];
  let lightMode = 0;
  const applyLights = () => {
    const id = LIGHTS[lightMode].id;
    const k = { bright: 1, evening: 0.45, party: 0.12 }[id];
    hemi.intensity = 0.7 * k + 0.05;
    key.intensity = 0.9 * k;
    for (const l of chandelierLights) l.intensity = 30 * Math.max(k, 0.15);
    crystal.emissiveIntensity = 0.35 + (1 - k) * 0.4;
    bulb.emissiveIntensity = 2.6 * Math.max(k, 0.35);
    for (const l of uplights) l.intensity = id === 'bright' ? 4 : 10;
    washMat.opacity = id === 'bright' ? 0.45 : 0.85;
    glintMat.opacity = id === 'party' && activeId === 'wedding' ? 0.9 : 0;
    if (group.parent) group.parent.environmentIntensity = 0.35 * Math.max(k, 0.25);
    if (id !== 'party') applySetupColors();
  };

  const applySetupColors = () => {
    const s = SETUPS.find((x) => x.id === activeId);
    washMat.color.set(s.uplight);
    uplightMat.emissive.set(s.uplight);
    coveMat.emissive.set(s.cove);
    for (const l of uplights) l.color.set(s.uplight);
  };

  const selectSetup = (id) => {
    if (!setups[id]) return;
    activeId = id;
    for (const s of SETUPS) setups[s.id].visible = s.id === id;
    dance.visible = id === 'wedding';
    ball.visible = id !== 'conference';
    applySetupColors();
    applyLights();
  };
  selectSetup(activeId);

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  anim.add((dt, t) => {
    led.update(t);
    ball.rotation.y += dt * 0.4;
    if (LIGHTS[lightMode].id === 'party') {
      tint.setHSL((t * 0.07) % 1, 0.85, 0.6);
      washMat.color.copy(tint);
      uplightMat.emissive.copy(tint);
      uplights.forEach((l, i) => l.color.setHSL((t * 0.07 + i * 0.25) % 1, 0.85, 0.6));
      if (dance.visible) {
        glints.forEach((g, i) => {
          const a = g.a + t * 0.5;
          dummy.position.set(Math.cos(a) * g.r, 0.02, DANCE.z - 1 + Math.sin(a) * g.r * 0.8);
          dummy.updateMatrix();
          glintMesh.setMatrixAt(i, dummy.matrix);
        });
        glintMesh.instanceMatrix.needsUpdate = true;
      }
    }
  });

  const describe = {
    wedding: 'Round tables of ten with blush linens and floral centrepieces surround the parquet dance floor. The wedding party sits at a head table on stage in front of a floral arch, with the cake beside the dance floor.',
    banquet: 'Eight long banquet tables run the length of the room with gold runners, candelabra and full place settings, plus a head table and lectern on stage for speeches.',
    conference: 'Theatre-style rows of 600 padded chairs with a centre aisle face the stage, panel table, lectern and LED wall. Registration desks sit by the doors and the AV desk at the back.',
  };
  const next = () => SETUPS[(SETUPS.findIndex((s) => s.id === activeId) + 1) % SETUPS.length];
  const activeSetup = () => SETUPS.find((s) => s.id === activeId);

  const hotspots = [
    {
      id: 'tables', label: 'Room setup', position: [-10.8, 1.9, -3],
      get title() { return `Setup: ${activeSetup().label}`; },
      get text() { return `${describe[activeId]} Maximum ${CAPACITY[activeId]} guests in this setup.`; },
      view: { position: [-4.5, 3.6, 9.5], target: [-6, 0.6, -3] },
      action: {
        get label() { return `Switch to ${next().label.toLowerCase()}`; },
        run: () => selectSetup(next().id),
      },
    },
    {
      id: 'chandeliers', label: 'Chandeliers', position: [0, H - 2.9, 0.3],
      title: 'Crystal chandeliers', text: 'Three tiered crystal chandeliers hang in coffered domes along the centre of the room, with ring chandeliers, mirrored wall bays, sconces and colour-matched uplights. Try evening and party lighting.',
      view: { position: [5.5, 2.2, 6.5], target: [0, 5.6, 0] },
      action: {
        get label() { return `Lighting: ${LIGHTS[(lightMode + 1) % LIGHTS.length].label}`; },
        run: () => { lightMode = (lightMode + 1) % LIGHTS.length; applyLights(); },
      },
    },
    {
      id: 'stage', label: 'Stage & LED wall', position: [0, STAGE.h + 6.0, STAGE.z0 + 0.6],
      title: 'Stage and LED wall', text: 'A 12 × 4 m carpeted stage with side steps, framed by ivory drapes, in front of a 9.6 m LED wall that shows the event title or presentation slides. A built-in sound system and lectern microphone are included.',
      view: { position: [0, 2.2, 0.5], target: [0, 2.6, -12] },
    },
    {
      id: 'dance', label: 'Dance floor', position: [0, 0.9, DANCE.z],
      title: 'Parquet dance floor', text: 'A 10 × 8 m portable parquet dance floor under a mirror ball, laid for receptions and galas and removed for conference setups. Switch to party lighting for moving glints.',
      view: { position: [6.5, 2.4, 2.5], target: [0, 0.4, DANCE.z] },
    },
    {
      id: 'entrance', label: 'Foyer & VIP room', position: [0, 3.6, D / 2 - 0.4],
      title: 'Foyer doors & VIP room', text: 'Three pairs of doors open onto the pre-function foyer for cocktail receptions and registration. A private bridal / VIP holding room connects directly to the stage side of the ballroom.',
      view: { position: [0, 2.0, 6.5], target: [0, 1.8, D / 2] },
    },
    {
      id: 'book', label: 'Book this venue', position: [10.8, 1.9, 7.6],
      title: 'Book the Grand Ballroom', text: 'Send a booking request for your wedding, debut, gala or conference. Our events team checks the date for conflicts and confirms by email (simulated, no payment is taken).',
      view: { position: [6.0, 2.6, 11.5], target: [10.8, 0.8, 5] },
      action: { label: 'Book This Venue', run: () => { location.href = `/events.html?book=BALLROOM&setup=${activeId}`; } },
    },
  ];

  return {
    group, hotspots,
    bounds: { W, D, H },
    exposure: 0.95,
    envIntensity: 0.35,
    walkSpeed: 3.0,
    update: anim.update,
    layouts: {
      label: 'Room setup',
      items: SETUPS.map(({ id, label }) => ({ id, label })),
      get active() { return activeId; },
      select: selectSetup,
    },
    viewpoints: [
      { id: 'overview', label: 'Overview', position: [13.5, 5.6, 11], target: [-1, 0.8, -3] },
      { id: 'entrance', label: 'From the doors', position: [0, 1.7, 11.8], target: [0, 2.2, -10] },
      { id: 'dance', label: 'Dance floor', position: hotspots[3].view.position, target: hotspots[3].view.target },
      { id: 'stage', label: 'From the stage', position: [0, STAGE.h + 1.7, STAGE.z1 - 0.4], target: [0, 1.2, 8] },
      { id: 'chandeliers', label: 'Chandeliers', position: hotspots[1].view.position, target: hotspots[1].view.target },
      { id: 'side', label: 'Side view', position: [-15.5, 2.4, 10.5], target: [2, 1, -4] },
    ],
  };
}
