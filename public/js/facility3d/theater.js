// Haraya Theater: proscenium stage with red velvet curtains, a projection
// screen, raked seating in 12 rows split by two aisles, line-array speakers,
// a lighting truss and a control booth. Curtains, film preview and lighting
// modes are driven from the hotspots.
import {
  THREE, T, F, mat, block, cylinder, METALS, at, buildShell,
  tag, glow, animator, playOnce, canvasTexture, signTexture, liveScreen, screen,
  instanced, place, boxGeo, noShadow,
} from './kit.js';

const W = 24, D = 28, H = 11;
const STAGE = { top: 1.1, front: -7, back: -D / 2, open: 15.6, openH: 8.4 };
const ROWS = 12, ROW0 = -2.5, PITCH = 1.0, RISE = 0.24;
const SEAT_W = 0.55;
const rowZ = (i) => ROW0 + i * PITCH;
const rowY = (i) => (i < 2 ? 0 : (i - 1) * RISE);
const LETTERS = 'ABCDEFGHIJKL';

/** Seat x positions: 7 | aisle | 12 | aisle | 7. */
function seatXs() {
  const xs = [];
  for (let k = 0; k < 12; k++) xs.push(-3.3 + SEAT_W / 2 + k * SEAT_W);
  for (let k = 0; k < 7; k++) { const x = 4.5 + SEAT_W / 2 + k * SEAT_W; xs.push(x, -x); }
  return xs;
}

function seatGeometries() {
  const velvet = [
    boxGeo(0.46, 0.1, 0.44, 0, 0.4, 0.04),
    boxGeo(0.46, 0.56, 0.08, 0, 0, 0).rotateX(-0.16).translate(0, 0.45, -0.2),
  ];
  const frame = [
    boxGeo(0.05, 0.62, 0.46, -0.265, 0, 0), boxGeo(0.05, 0.62, 0.46, 0.265, 0, 0),
    boxGeo(0.07, 0.04, 0.4, -0.265, 0.62, 0.02), boxGeo(0.07, 0.04, 0.4, 0.265, 0.62, 0.02),
  ];
  return { velvet, frame };
}

function wheelchairTexture() {
  return canvasTexture(128, 128, (ctx, w) => {
    ctx.fillStyle = '#1f5fa8'; ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(60, 26, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(58, 42); ctx.lineTo(58, 72); ctx.lineTo(84, 72); ctx.lineTo(94, 98); ctx.stroke();
    ctx.beginPath(); ctx.arc(56, 86, 22, 0.2, Math.PI * 1.6); ctx.stroke();
  });
}

function speakerTexture() {
  return canvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#151515'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#262626';
    for (let y = 3; y < h; y += 5) for (let x = 3; x < w; x += 5) ctx.fillRect(x, y, 2, 2);
  });
}

export default function build() {
  const group = new THREE.Group();
  const anim = animator();
  const gold = METALS.gold();
  const blackMetal = METALS.black();
  const wood = mat({ map: T.woodGrain('#5a3a26', { seed: 301, repeat: [1, 3] }), roughness: 0.55 });
  const velvet = new THREE.MeshPhysicalMaterial({ map: T.fabric('#8a1020', { seed: 302, repeat: [6, 6] }), roughness: 0.85, sheen: 1, sheenColor: new THREE.Color('#ff7a86'), sheenRoughness: 0.45 });
  const seatVelvet = mat({ map: T.fabric('#7a1222', { seed: 303, repeat: [1, 1] }), roughness: 0.9 });
  const carpetTex = T.carpet('#3a1d28', { seed: 304, repeat: [12, 2] });
  const carpet = mat({ map: carpetTex, roughness: 1 });
  const wallFabric = mat({ map: T.fabric('#2a2228', { seed: 305, repeat: [8, 3] }), roughness: 0.95 });
  const blackDrape = mat({ map: T.fabric('#121214', { seed: 306, repeat: [4, 4] }), roughness: 1 });

  // ---------- room shell ----------
  const shell = buildShell({
    W, D, H, tile: 2,
    floorMat: mat({ map: T.carpet('#3a1d28', { seed: 307, repeat: [10, 12] }), roughness: 1 }),
    wallMat: wallFabric,
    ceilingMat: mat({ color: '#15182a', roughness: 0.95 }),
    trimMat: gold,
    walls: {},
    crown: true,
    wainscot: { height: 1.2, material: wood },
  });
  group.add(shell);

  // Ceiling downlights (house lights)
  const houseGlow = glow('#ffe7c4', 2.2);
  const dl = [];
  for (let x = -9; x <= 9; x += 3) for (let z = -2; z <= 12; z += 2.8) dl.push(place(x, H - 0.01, z));
  const downlights = instanced([new THREE.CircleGeometry(0.1, 14).rotateX(Math.PI / 2)], houseGlow, dl, { cast: false, receive: false });
  downlights.userData.noPick = true;
  group.add(downlights);

  // Acoustic clouds
  for (const [z, tilt] of [[1, 0.08], [5.5, 0.06], [10, 0.04]]) {
    const cloud = block(18, 0.12, 3.2, mat({ color: '#2a2f45', roughness: 0.9 }), 0, 9.9, z);
    cloud.rotation.x = tilt;
    group.add(noShadow(cloud));
  }

  // Side wall acoustic fins and sconces
  const fins = [];
  for (const s of [-1, 1]) for (let z = -2.6; z <= 13.2; z += 0.75) fins.push(place(s * (W / 2 - 0.13), 1.25, z));
  group.add(instanced([boxGeo(0.12, 7.6, 0.22)], wood, fins, { cast: false }));
  const sconceGlow = glow('#ffcf8f', 1.6);
  for (const s of [-1, 1]) for (const z of [-1.5, 3, 7.5, 12]) {
    const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.42, 12, 1, true), sconceGlow);
    sc.position.set(s * (W / 2 - 0.3), 4.6, z);
    group.add(noShadow(sc));
  }

  // ---------- stage ----------
  const stage = new THREE.Group();
  const stageFloor = mat({ map: T.woodPlanks('#2a211c', { seed: 308, planks: 10, repeat: [6, 3] }), roughness: 0.6 });
  stage.add(block(22, STAGE.top, STAGE.front - STAGE.back - 0.2, stageFloor, 0, 0, (STAGE.front + STAGE.back) / 2 - 0.1));
  const apron = new THREE.Mesh(new THREE.CylinderGeometry(STAGE.open / 2, STAGE.open / 2, STAGE.top, 64, 1, false, -Math.PI / 2, Math.PI), [stageFloor, stageFloor, stageFloor]);
  apron.scale.z = 0.3;
  apron.position.set(0, STAGE.top / 2, STAGE.front - 0.2);
  apron.castShadow = apron.receiveShadow = true;
  stage.add(apron);
  // Footlights along the apron edge
  const foot = [];
  for (let i = 0; i <= 24; i++) {
    const a = -Math.PI / 2 + (i / 24) * Math.PI;
    foot.push(place(Math.sin(a) * (STAGE.open / 2 - 0.15), STAGE.top + 0.01, STAGE.front - 0.2 + Math.cos(a) * (STAGE.open / 2 - 0.15) * 0.3, a));
  }
  const footGlow = glow('#ffe3b0', 2);
  stage.add(instanced([boxGeo(0.2, 0.04, 0.06)], footGlow, foot, { cast: false }));

  // Proscenium wall with gilded frame
  const pz = STAGE.front - 0.2;
  const procMat = mat({ color: '#3a1820', roughness: 0.8 });
  const sideW = (W - STAGE.open) / 2;
  for (const s of [-1, 1]) stage.add(block(sideW, H, 0.4, procMat, s * (STAGE.open / 2 + sideW / 2), 0, pz - 0.2));
  stage.add(block(STAGE.open, H - STAGE.top - STAGE.openH, 0.4, procMat, 0, STAGE.top + STAGE.openH, pz - 0.2));
  for (const s of [-1, 1]) stage.add(block(0.3, STAGE.openH + 0.3, 0.14, gold, s * (STAGE.open / 2 + 0.15), STAGE.top, pz + 0.05));
  stage.add(block(STAGE.open + 0.6, 0.3, 0.14, gold, 0, STAGE.top + STAGE.openH, pz + 0.05));
  const crest = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.9), mat({
    map: signTexture('HARAYA THEATER', { width: 1024, height: 230, color: '#e2c48c', font: '600 110px Georgia, serif' }), transparent: true,
  }));
  crest.position.set(0, STAGE.top + STAGE.openH + 0.85, pz + 0.13);
  stage.add(crest);

  // Black masking legs and back drape
  for (const s of [-1, 1]) for (const z of [-9, -11.5]) {
    const leg = F.curtain({ width: 2.2, height: STAGE.openH + 0.4, material: blackDrape, folds: 5 });
    leg.position.set(s * 6.8, STAGE.top + STAGE.openH + 0.4, z);
    stage.add(leg);
  }
  const backDrape = F.curtain({ width: 21, height: 9.6, material: blackDrape, folds: 24 });
  backDrape.position.set(0, H - 0.2, STAGE.back + 0.35);
  stage.add(backDrape);

  // Stage props: mic stand and monitor wedges
  stage.add(cylinder(0.16, 0.16, 0.02, blackMetal, 0, STAGE.top, -6.2, 16));
  stage.add(cylinder(0.012, 0.012, 1.45, blackMetal, 0, STAGE.top, -6.2, 6));
  stage.add(cylinder(0.025, 0.02, 0.12, mat({ color: '#333' }), 0, STAGE.top + 1.45, -6.2, 10));
  const spk = mat({ map: speakerTexture(), roughness: 0.7 });
  for (const x of [-2.2, 2.2]) {
    const wedge = block(0.7, 0.32, 0.45, spk, x, STAGE.top, -5.6);
    wedge.rotation.x = 0.5;
    stage.add(wedge);
  }
  group.add(tag(stage, 'stage'));

  // ---------- screen and curtains ----------
  let playing = false;
  const film = liveScreen((ctx, w, h, t) => {
    if (!playing) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1b1e2a'); g.addColorStop(1, '#0c0d12');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c9a46a'; ctx.textAlign = 'center';
      ctx.font = '600 40px Georgia, serif'; ctx.fillText('HARAYA THEATER', w / 2, h / 2 - 6);
      ctx.fillStyle = '#7d8492'; ctx.font = '18px "Segoe UI", Arial'; ctx.fillText('Screen ready', w / 2, h / 2 + 28);
      return;
    }
    const k = (t * 0.06) % 1;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#1d2b5a'); sky.addColorStop(0.55, '#d77a6a'); sky.addColorStop(1, '#f6c27a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff2c8';
    ctx.beginPath(); ctx.arc(w * 0.7, h * (0.62 + 0.1 * Math.sin(t * 0.3)), 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2440';
    for (let i = 0; i < 18; i++) {
      const bx = ((i * 47 - t * 22) % (w + 60) + w + 60) % (w + 60) - 30;
      const bh = 40 + ((i * 37) % 70);
      ctx.fillRect(bx, h * 0.78 - bh, 26, bh + h);
    }
    ctx.fillStyle = '#1a2238'; ctx.fillRect(0, h * 0.78, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.textAlign = 'center';
    ctx.font = '600 30px Georgia, serif'; ctx.fillText('Now showing', w / 2, 44);
    ctx.font = '18px "Segoe UI", Arial'; ctx.fillText('Family Movie Matinee · sample preview', w / 2, 72);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(40, h - 18, w - 80, 4);
    ctx.fillStyle = '#e2c48c'; ctx.fillRect(40, h - 18, (w - 80) * k, 4);
  }, { width: 512, height: 288, fps: 15 });
  const scr = screen(9, film.texture, { frame: '#050505', intensity: 0.35 });
  const screenFace = scr.children[1];
  scr.position.set(0, STAGE.top + 0.9 + 2.55, STAGE.back + 1.2);
  group.add(tag(scr, 'screen'));

  const curtains = [-1, 1].map((s) => {
    const c = F.curtain({ width: STAGE.open / 2 + 0.2, height: STAGE.openH, material: velvet, folds: 16 });
    c.position.set(s * (STAGE.open / 4), STAGE.top + STAGE.openH, pz - 0.55);
    group.add(tag(c, 'stage'));
    return c;
  });
  const valance = F.curtain({ width: STAGE.open + 0.4, height: 1.1, material: velvet, folds: 26 });
  valance.position.set(0, STAGE.top + STAGE.openH, pz - 0.42);
  group.add(tag(valance, 'stage'));
  const tassel = new THREE.Mesh(new THREE.PlaneGeometry(STAGE.open + 0.4, 0.08), gold);
  tassel.position.set(0, STAGE.top + STAGE.openH - 1.1, pz - 0.36);
  group.add(tassel);

  let curtainsOpen = false;
  let curtainBusy = false;
  const setCurtains = (open) => {
    if (curtainBusy || open === curtainsOpen) return;
    curtainBusy = true;
    const from = curtainsOpen ? 1 : 0, to = open ? 1 : 0;
    playOnce(anim, 2.2, (_k, e) => {
      const v = from + (to - from) * e;
      curtains.forEach((c, i) => {
        const s = i ? 1 : -1;
        c.scale.x = 1 - 0.72 * v;
        c.position.x = s * (STAGE.open / 4 + v * (STAGE.open / 4 - (STAGE.open / 2 + 0.2) * 0.28 / 2 - 0.1));
      });
    }, () => { curtainsOpen = open; curtainBusy = false; });
  };

  // ---------- seating ----------
  const xs = seatXs();
  const geos = seatGeometries();
  const seats = [];
  const tiers = new THREE.Group();
  for (let i = 0; i < ROWS; i++) {
    const z = rowZ(i), y = rowY(i);
    if (i >= 2) tiers.add(block(W - 0.02, y, D / 2 - (z - PITCH / 2), carpet, 0, 0, (z - PITCH / 2 + D / 2) / 2));
    for (const x of xs) seats.push(place(x, y, z, Math.atan2(-x, -22 - z)));
  }
  // Rear cross-aisle platform
  const backY = rowY(ROWS - 1) + RISE;
  const backZ0 = rowZ(ROWS - 1) + PITCH / 2;
  tiers.add(block(W - 0.02, backY, D / 2 - backZ0, carpet, 0, 0, (backZ0 + D / 2) / 2));
  const rail = [];
  for (let x = -11; x <= 11; x += 1.1) rail.push(place(x, backY, backZ0 + 0.15));
  tiers.add(instanced([boxGeo(0.04, 0.95, 0.04)], gold, rail, { cast: false }));
  const railTop = cylinder(0.03, 0.03, 22.2, gold, 0, 0, 0, 8);
  railTop.rotation.z = Math.PI / 2;
  railTop.position.set(0, backY + 0.95, backZ0 + 0.15);
  tiers.add(railTop);
  group.add(tag(tiers, 'seating'));

  const seatMesh = instanced(geos.velvet, seatVelvet, seats);
  const frameMesh = instanced(geos.frame, mat({ color: '#2a1a14', roughness: 0.6 }), seats);
  group.add(tag(seatMesh, 'seating'), tag(frameMesh, 'seating'));

  // Aisle step lights and row letters
  const steps = [];
  for (let i = 2; i < ROWS; i++) for (const x of [-3.9, 3.9]) steps.push(place(x, rowY(i) + 0.01, rowZ(i) - PITCH / 2 + 0.03));
  group.add(instanced([boxGeo(1.1, 0.02, 0.04)], glow('#ffd9a0', 1.6), steps, { cast: false }));
  const letterMats = new Map();
  for (let i = 0; i < ROWS; i++) {
    for (const x of [-3.3 - 0.06, 3.3 + 0.06]) {
      if (!letterMats.has(i)) {
        letterMats.set(i, mat({ map: signTexture(LETTERS[i], { width: 64, height: 64, color: '#ffe2b0', font: '700 46px "Segoe UI", Arial' }), transparent: true, emissive: '#ffd08a', emissiveIntensity: 0.5 }));
      }
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), letterMats.get(i));
      plate.position.set(x, rowY(i) + 0.5, rowZ(i) + 0.05);
      plate.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2;
      plate.userData.noPick = true;
      group.add(plate);
    }
  }

  // Wheelchair spaces in front of row A
  const access = new THREE.Group();
  const wcTex = wheelchairTexture();
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
    const x = s * (5.0 + k * 0.85);
    const bay = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.2), mat({ color: '#2d4f7a', roughness: 0.9 }));
    bay.rotation.x = -Math.PI / 2;
    bay.position.set(x, 0.006, -4.0);
    access.add(bay);
    const icon = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.45), mat({ map: wcTex }));
    icon.rotation.x = -Math.PI / 2;
    icon.position.set(x, 0.008, -4.0);
    access.add(icon);
  }
  group.add(tag(access, 'access'));

  // ---------- sound system ----------
  const sound = new THREE.Group();
  for (const s of [-1, 1]) {
    const x = s * 9.6;
    sound.add(block(1.0, 0.06, 0.7, blackMetal, x, 8.7, pz + 0.6));
    sound.add(cylinder(0.01, 0.01, H - 8.7, blackMetal, x - 0.4, 8.7, pz + 0.6, 4));
    sound.add(cylinder(0.01, 0.01, H - 8.7, blackMetal, x + 0.4, 8.7, pz + 0.6, 4));
    for (let i = 0; i < 7; i++) {
      const box = block(0.95, 0.3, 0.6, spk, 0, -0.3, 0);
      const holder = new THREE.Group();
      holder.add(box);
      holder.position.set(x, 8.68 - i * 0.31, pz + 0.6 + i * i * 0.012);
      holder.rotation.x = 0.03 * i * i * 0.5;
      sound.add(holder);
    }
    sound.add(block(1.2, 0.8, 0.8, spk, s * 10.6, 0, -6.6));
    sound.add(block(1.2, 0.8, 0.8, spk, s * 10.6, 0.8, -6.6));
  }
  group.add(tag(sound, 'sound'));

  // ---------- lighting truss ----------
  const truss = new THREE.Group();
  const tz = -3.2, ty = 9.4;
  for (const [dy, dz] of [[0, -0.2], [0, 0.2], [0.4, -0.2], [0.4, 0.2]]) {
    const t = cylinder(0.03, 0.03, 19, mat({ color: '#b8bcc2', metalness: 0.9, roughness: 0.3 }), 0, 0, 0, 8);
    t.rotation.z = Math.PI / 2;
    t.position.set(0, ty + dy, tz + dz);
    truss.add(t);
  }
  for (let x = -9.4; x <= 9.4; x += 0.8) truss.add(block(0.02, 0.4, 0.42, mat({ color: '#b8bcc2', metalness: 0.9, roughness: 0.3 }), x, ty, tz));
  for (const s of [-1, 1]) truss.add(cylinder(0.012, 0.012, H - ty - 0.4, blackMetal, s * 8.5, ty + 0.4, tz, 4));
  const lensMat = glow('#fff1d0', 1.2);
  const fixtures = [];
  for (let i = 0; i < 10; i++) {
    const x = -8.1 + i * 1.8;
    const f = new THREE.Group();
    f.add(cylinder(0.16, 0.2, 0.5, blackMetal, 0, -0.5, 0, 14));
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.18, 16), lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.y = -0.51;
    f.add(lens);
    f.add(block(0.04, 0.3, 0.4, blackMetal, 0, -0.3, 0));
    f.position.set(x, ty - 0.05, tz);
    f.rotation.x = -0.65;
    f.rotation.z = x * -0.02;
    truss.add(f);
    fixtures.push(f);
  }
  group.add(tag(truss, 'lighting'));

  const spots = [-4.5, 0, 4.5].map((x) => {
    const sp = new THREE.SpotLight('#fff1d6', 160, 0, 0.32, 0.55, 2);
    sp.position.set(x, ty - 0.5, tz);
    sp.target.position.set(x * 0.7, STAGE.top, -9);
    group.add(sp, sp.target);
    return sp;
  });

  // ---------- control booth, doors and exit signs ----------
  const booth = new THREE.Group();
  const bz = D / 2 - 0.02;
  booth.add(block(7, 1.4, 0.05, mat({ color: '#0d1218', metalness: 0.5, roughness: 0.05, emissive: '#253447', emissiveIntensity: 0.6 }), 0, backY + 1.6, bz - 0.04));
  booth.add(block(7.3, 0.1, 0.14, gold, 0, backY + 3.0, bz - 0.05));
  booth.add(block(7.3, 0.1, 0.3, gold, 0, backY + 1.5, bz - 0.12));
  for (const x of [-2.2, 0, 2.2]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.35), glow(['#3c7bd9', '#5ad19a', '#e2c48c'][(x / 2.2 + 1) | 0], 1.2));
    m.position.set(x, backY + 2.0, bz - 0.08);
    m.rotation.y = Math.PI;
    booth.add(m);
  }
  group.add(tag(booth, 'booth'));

  const exitMat = mat({ map: signTexture('EXIT', { width: 256, height: 96, color: '#ffffff', bg: '#1a9a4a', font: '700 64px "Segoe UI", Arial' }), emissive: '#ffffff', emissiveIntensity: 0.9 });
  exitMat.emissiveMap = exitMat.map;
  const doorWood = mat({ map: T.woodGrain('#4a2e1e', { seed: 309 }), roughness: 0.6 });
  const doorFrame = mat({ color: '#2a1a14' });
  const doors = [
    { x: -W / 2 + 0.05, y: 0, z: -4.2, ry: Math.PI / 2 },
    { x: W / 2 - 0.05, y: 0, z: -4.2, ry: -Math.PI / 2 },
    { x: -9.5, y: backY, z: D / 2 - 0.05, ry: Math.PI },
    { x: 9.5, y: backY, z: D / 2 - 0.05, ry: Math.PI },
  ];
  for (const d of doors) {
    const g = new THREE.Group();
    for (const s of [-0.55, 0.55]) g.add(at(F.door({ wood: doorWood, handle: gold, frameMat: doorFrame, w: 1.05, h: 2.3 }), s, 0, 0));
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.24, 0.05), exitMat);
    sign.position.set(0, 2.75, 0.06);
    g.add(sign);
    group.add(at(g, d.x, d.y, d.z, d.ry));
  }

  // ---------- lighting modes ----------
  const hemi = new THREE.HemisphereLight('#ffe9cc', '#3a2228', 0.55);
  group.add(hemi);
  const house = [];
  for (const [x, z] of [[-6, -1], [6, -1], [-6, 8], [6, 8]]) {
    const p = new THREE.PointLight('#ffdcae', 40, 22, 2);
    p.position.set(x, H - 0.6, z);
    group.add(p);
    house.push(p);
  }
  const stageWash = new THREE.PointLight('#ffe4bf', 18, 14, 2);
  stageWash.position.set(0, 7.5, -8.5);
  group.add(stageWash);

  const MODES = [
    { id: 'house', label: 'House lights' },
    { id: 'show', label: 'Show lighting' },
    { id: 'film', label: 'Film mode' },
  ];
  let mode = 0;
  const applyMode = () => {
    const id = MODES[mode].id;
    const houseLevel = id === 'house' ? 1 : id === 'show' ? 0.18 : 0.06;
    for (const p of house) p.intensity = 40 * houseLevel;
    hemi.intensity = 0.55 * Math.max(houseLevel, 0.12);
    houseGlow.emissiveIntensity = 2.2 * Math.max(houseLevel, 0.1);
    sconceGlow.emissiveIntensity = 1.6 * Math.max(houseLevel, 0.25);
    if (group.parent) group.parent.environmentIntensity = 0.3 * Math.max(houseLevel, 0.2);
    for (const sp of spots) sp.intensity = id === 'film' ? 0 : id === 'show' ? 260 : 160;
    stageWash.intensity = id === 'film' ? 0 : 18;
    lensMat.emissiveIntensity = id === 'film' ? 0.1 : id === 'show' ? 3 : 1.2;
    footGlow.emissiveIntensity = id === 'film' ? 0.2 : 2;
    if (id !== 'show') for (const sp of spots) sp.color.set('#fff1d6');
  };
  const setFilm = (on) => {
    playing = on;
    screenFace.material.emissiveIntensity = on ? 1.25 : 0.35;
    if (on) { setCurtains(true); mode = 2; applyMode(); }
    else if (MODES[mode].id === 'film') { mode = 0; applyMode(); }
  };

  anim.add((dt, t) => {
    film.update(t);
    if (MODES[mode].id === 'show') {
      spots.forEach((sp, i) => {
        sp.color.setHSL((t * 0.05 + i / 3) % 1, 0.75, 0.6);
        sp.target.position.x = Math.sin(t * 0.6 + i * 2) * 4;
      });
      fixtures.forEach((f, i) => { f.rotation.z = Math.sin(t * 0.8 + i) * 0.25; });
    }
  });

  const hotspots = [
    {
      id: 'stage', label: 'Stage & curtains', position: [0, STAGE.top + STAGE.openH + 0.4, pz],
      title: 'Proscenium stage', text: 'A 15.6 m wide proscenium opening over a sprung timber stage with a curved apron and footlights, framed by gilded mouldings and red velvet house curtains with a swagged valance.',
      view: { position: [0, 3.2, 3.5], target: [0, 4.0, -10] },
      action: {
        get label() { return curtainsOpen ? 'Close curtains' : 'Open curtains'; },
        run: () => setCurtains(!curtainsOpen),
      },
    },
    {
      id: 'screen', label: 'Projection screen', position: [0, STAGE.top + 6.6, STAGE.back + 1.4],
      title: '9-metre projection screen', text: 'A laser projector in the control booth fills a 9 m screen behind the curtains for film screenings, presentations and live video. Play the preview to open the curtains and dim the house.',
      view: { position: [0, 2.6, 2.5], target: [0, 4.6, -12] },
      action: {
        get label() { return playing ? 'Stop film preview' : 'Play film preview'; },
        run: () => setFilm(!playing),
      },
    },
    {
      id: 'seating', label: 'Raked seating', position: [0, rowY(6) + 1.4, rowZ(6)],
      title: 'Raked seating, rows A–L', text: '312 upholstered seats in 12 rows (A–L): a centre block of 12 and two side blocks of 7 per row, divided by two lit aisles. Rows C to L rise 24 cm each for clear sight lines.',
      view: { position: [-7.5, 3.6, 9.5], target: [0, 1.2, 0] },
    },
    {
      id: 'access', label: 'Accessible spaces', position: [6.3, 1.0, -4.0],
      title: 'Wheelchair spaces', text: 'Eight wheelchair spaces in front of row A, reached step-free from the side doors at stage level, with companion seats in row A beside them.',
      view: { position: [3.2, 1.7, -0.8], target: [6.3, 0.2, -4.2] },
    },
    {
      id: 'sound', label: 'Sound system', position: [9.6, 7.4, pz + 0.6],
      title: 'Line-array sound', text: 'Two flown line arrays of seven cabinets each, curved to cover every row evenly, plus stacked subwoofers at each side of the stage and monitor wedges on stage.',
      view: { position: [4.5, 3.4, 1.0], target: [9.6, 6.4, -6.4] },
    },
    {
      id: 'lighting', label: 'Lighting rig', position: [0, ty + 0.9, tz],
      title: 'Stage lighting truss', text: 'A front-of-house truss carries ten moving-head fixtures and three follow spots that light the stage. Switch between house lights, colourful show lighting and film mode.',
      view: { position: [0, 2.4, 6], target: [0, 7.5, -4] },
      action: {
        get label() { return `Lighting: ${MODES[(mode + 1) % MODES.length].label}`; },
        run: () => { mode = (mode + 1) % MODES.length; applyMode(); },
      },
    },
    {
      id: 'booth', label: 'Control booth', position: [0, backY + 3.4, D / 2 - 0.4],
      title: 'Control booth', text: 'The projection, sound and lighting desks sit behind glass at the back of the auditorium, with a clear view of the stage.',
      view: { position: [0, backY + 1.7, 9.2], target: [0, backY + 1.8, D / 2] },
    },
    {
      id: 'shows', label: 'Performances', position: [0, STAGE.top + 0.6, -5.2],
      title: 'Scheduled performances', text: 'Concerts, Filipino musicals, comedy nights and family film matinees are scheduled here throughout the year. See dates and register on the Events page (sample schedule, no real tickets).',
      view: { position: [0, 2.0, 1.5], target: [0, 1.6, -6] },
      action: { label: 'See performances', run: () => { location.href = '/events.html?venue=THEATER'; } },
    },
  ];

  return {
    group, hotspots,
    bounds: { W, D, H },
    exposure: 0.95,
    envIntensity: 0.3,
    walkSpeed: 2.6,
    update: anim.update,
    viewpoints: [
      { id: 'overview', label: 'Overview', position: [7.5, 6.6, 12.5], target: [0, 2.4, -6] },
      { id: 'bestseat', label: 'Best seat (row F)', position: [0, rowY(5) + 1.15, rowZ(5)], target: [0, 4.2, -10] },
      { id: 'stage', label: 'From the stage', position: [0, STAGE.top + 1.7, -9], target: [0, 2.2, 8] },
      { id: 'aisle', label: 'Aisle', position: [3.9, rowY(9) + 1.65, rowZ(9)], target: [0, 2.5, -8] },
      { id: 'booth', label: 'Control booth', position: [0, backY + 1.8, D / 2 - 0.6], target: [0, 3.4, -9] },
      { id: 'balcony', label: 'Side view', position: [-10.5, 4.2, -1], target: [2, 2.4, -6] },
    ],
  };
}
