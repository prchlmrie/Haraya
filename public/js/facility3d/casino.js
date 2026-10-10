// The Gilded Room: a casino-themed lounge for VISUAL SIMULATION ONLY (no
// betting, no money). Slot machines with spinning reels, poker tables with a
// card-dealing animation, a roulette wheel with a rolling ball, a cocktail
// bar, a display-only cashier and chandeliers.
import {
  THREE, T, F, mat, block, soft, cylinder, METALS, buildShell, onWall, at, addSun,
  tag, glow, hemi, pointLight, animator, playOnce, canvasTexture, signTexture, liveScreen, felt, bottleRow,
} from './kit.js';

const W = 18, D = 14, H = 4.2;
const TAU = Math.PI * 2;
const RED = '#b3261e', BLACK = '#141414', GREEN = '#1f6b45';
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

// ---------- textures ----------

function carpetTexture() {
  return canvasTexture(512, 512, (ctx, S) => {
    ctx.fillStyle = '#5a1420'; ctx.fillRect(0, 0, S, S);
    T.addNoise(ctx, S, S, 12, T.rng(131));
    ctx.strokeStyle = '#b8893f'; ctx.lineWidth = 6;
    for (const [cx, cy] of [[0, 0], [S, 0], [0, S], [S, S], [S / 2, S / 2]]) {
      ctx.beginPath(); ctx.moveTo(cx, cy - 90); ctx.lineTo(cx + 90, cy); ctx.lineTo(cx, cy + 90); ctx.lineTo(cx - 90, cy); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 34, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = '#2b0a10';
    for (const [cx, cy] of [[S / 2, 0], [0, S / 2], [S, S / 2], [S / 2, S]]) { ctx.beginPath(); ctx.arc(cx, cy, 22, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#d4a85a';
    for (const [cx, cy] of [[S / 2, 0], [0, S / 2], [S, S / 2], [S / 2, S]]) { ctx.beginPath(); ctx.arc(cx, cy, 8, 0, TAU); ctx.fill(); }
  }, { repeat: [W / 2.5, D / 2.5] });
}

const SYMBOLS = [['7', RED], ['BAR', '#111'], ['★', '#c9a46a'], ['♦', '#2a6fd6'], ['7', '#2a6fd6'], ['♥', RED], ['BAR', '#7a1fa2'], ['★', '#2f9e44']];

function reelTexture() {
  return canvasTexture(1024, 128, (ctx, w, h) => {
    ctx.fillStyle = '#fbf7ee'; ctx.fillRect(0, 0, w, h);
    const cell = w / SYMBOLS.length;
    SYMBOLS.forEach(([s, c], i) => {
      ctx.save();
      ctx.translate(cell * i + cell / 2, h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = c;
      ctx.font = `800 ${s.length > 1 ? 44 : 84}px "Segoe UI", Arial`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(s, 0, 4);
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(cell * i, 0, 2, h);
    });
  });
}

function cardTexture(rank, suit) {
  const red = suit === '♥' || suit === '♦';
  return canvasTexture(128, 180, (ctx, w, h) => {
    ctx.fillStyle = '#fdfcf8'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.fillStyle = red ? RED : BLACK;
    ctx.font = '700 34px Georgia, serif'; ctx.textAlign = 'left'; ctx.fillText(rank, 10, 38);
    ctx.font = '30px Georgia, serif'; ctx.fillText(suit, 12, 68);
    ctx.font = '80px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText(suit, w / 2, h / 2 + 30);
  });
}

function cardBack() {
  return canvasTexture(128, 180, (ctx, w, h) => {
    ctx.fillStyle = '#6a1424'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c9a46a'; ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    for (let y = 16; y < h - 10; y += 14) for (let x = 16; x < w - 10; x += 14) {
      ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5, y); ctx.closePath(); ctx.stroke();
    }
  });
}

function rouletteLayout() {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = GREEN; ctx.fillRect(0, 0, w, h);
    T.addNoise(ctx, w, h, 10, T.rng(132));
    ctx.strokeStyle = '#f3ead8'; ctx.lineWidth = 3;
    ctx.font = '700 30px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const x0 = 90, y0 = 40, cw = 66, ch = 90;
    ctx.strokeRect(20, y0, x0 - 20, ch * 3);
    ctx.fillStyle = '#f3ead8'; ctx.fillText('0', 55, y0 + ch * 1.5);
    for (let c = 0; c < 12; c++) for (let r = 0; r < 3; r++) {
      const n = c * 3 + (3 - r);
      const x = x0 + c * cw, y = y0 + r * ch;
      ctx.fillStyle = REDS.has(n) ? RED : BLACK;
      ctx.beginPath(); ctx.ellipse(x + cw / 2, y + ch / 2, 24, 30, 0, 0, TAU); ctx.fill();
      ctx.strokeRect(x, y, cw, ch);
      ctx.fillStyle = '#fff'; ctx.fillText(String(n), x + cw / 2, y + ch / 2);
    }
    ctx.fillStyle = '#f3ead8'; ctx.font = '600 26px Georgia, serif';
    ['1st 12', '2nd 12', '3rd 12'].forEach((t, i) => { ctx.strokeRect(x0 + i * cw * 4, y0 + ch * 3, cw * 4, 60); ctx.fillText(t, x0 + i * cw * 4 + cw * 2, y0 + ch * 3 + 30); });
    ['1-18', 'EVEN', '◆', '◆', 'ODD', '19-36'].forEach((t, i) => {
      ctx.strokeRect(x0 + i * cw * 2, y0 + ch * 3 + 60, cw * 2, 60);
      ctx.fillStyle = t === '◆' ? (i === 2 ? RED : BLACK) : '#f3ead8';
      ctx.fillText(t, x0 + i * cw * 2 + cw, y0 + ch * 3 + 90);
      ctx.fillStyle = '#f3ead8';
    });
    ctx.font = '600 20px "Segoe UI", Arial'; ctx.fillStyle = 'rgba(243,234,216,0.75)';
    ctx.fillText('VISUAL SIMULATION ONLY · NO BETTING · NO MONEY', w / 2 + 40, h - 22);
  });
}

function wheelTexture() {
  return canvasTexture(512, 512, (ctx, S) => {
    const c = S / 2;
    ctx.fillStyle = '#3a2416'; ctx.fillRect(0, 0, S, S);
    const step = TAU / WHEEL.length;
    WHEEL.forEach((n, i) => {
      ctx.fillStyle = n === 0 ? GREEN : REDS.has(n) ? RED : BLACK;
      ctx.beginPath(); ctx.moveTo(c, c);
      ctx.arc(c, c, c - 4, i * step - step / 2, i * step + step / 2);
      ctx.closePath(); ctx.fill();
      ctx.save();
      ctx.translate(c, c); ctx.rotate(i * step); ctx.translate(c - 28, 0); ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#fff'; ctx.font = '700 20px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(n), 0, 0);
      ctx.restore();
    });
    ctx.strokeStyle = '#c9a46a'; ctx.lineWidth = 3;
    for (let i = 0; i < WHEEL.length; i++) {
      ctx.beginPath(); ctx.moveTo(c + Math.cos(i * step + step / 2) * c * 0.55, c + Math.sin(i * step + step / 2) * c * 0.55);
      ctx.lineTo(c + Math.cos(i * step + step / 2) * (c - 4), c + Math.sin(i * step + step / 2) * (c - 4)); ctx.stroke();
    }
    ctx.fillStyle = '#5a3a24'; ctx.beginPath(); ctx.arc(c, c, c * 0.55, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#c9a46a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(c, c, c * 0.55, 0, TAU); ctx.stroke();
  });
}

function chipEdge(color) {
  return canvasTexture(128, 16, (ctx, w, h) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f5f0e6';
    for (let i = 0; i < 6; i++) ctx.fillRect(i * (w / 6) + 4, 0, 8, h);
  }, { repeat: [1, 1] });
}

// ---------- props ----------

function stadium(halfStraight, r) {
  const s = new THREE.Shape();
  s.moveTo(-halfStraight, -r);
  s.lineTo(halfStraight, -r);
  s.absarc(halfStraight, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-halfStraight, r);
  s.absarc(-halfStraight, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  return s;
}

function chipStack(chipMats, n, color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, n * 0.0034, 20), chipMats[color]);
  m.position.y = (n * 0.0034) / 2;
  m.castShadow = true;
  return m;
}

function slotMachine({ body, trim, reelMat, screenTex, accent }) {
  const g = new THREE.Group();
  g.add(block(0.62, 0.78, 0.55, body, 0, 0, 0));
  g.add(block(0.5, 0.3, 0.01, glow(accent, 1.4, { color: '#1a0f12' }), 0, 0.3, 0.28));
  const deck = block(0.64, 0.07, 0.32, trim, 0, 0, 0);
  deck.position.set(0, 0.8, 0.18);
  deck.rotation.x = 0.25;
  g.add(deck);
  for (let i = 0; i < 4; i++) g.add(cylinder(0.022, 0.022, 0.02, glow(['#ff4d4d', '#ffd24d', '#4dff88', '#4dc3ff'][i], 1.6), -0.18 + i * 0.12, 0.85, 0.22, 12));
  g.add(block(0.62, 0.78, 0.42, body, 0, 0.84, -0.06));
  g.add(block(0.52, 0.34, 0.01, mat({ color: '#050505' }), 0, 1.0, 0.155));
  const reels = [];
  for (const x of [-0.165, 0, 0.165]) {
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.15, 32, 1, true), reelMat);
    reel.rotation.z = Math.PI / 2;
    const holder = new THREE.Group();
    holder.position.set(x, 1.17, 0.07);
    holder.add(reel);
    g.add(holder);
    reels.push(holder);
  }
  for (const y of [1.0, 1.34]) g.add(block(0.56, 0.025, 0.04, trim, 0, y, 0.16));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.4), mat({ map: screenTex, emissive: '#ffffff', emissiveMap: screenTex, emissiveIntensity: 1.1 }));
  scr.position.set(0, 1.85, 0.155);
  g.add(scr);
  g.add(block(0.64, 0.12, 0.44, trim, 0, 2.08, -0.06));
  g.add(block(0.56, 0.05, 0.02, glow(accent, 2.2), 0, 2.12, 0.165));
  const stool = new THREE.Group();
  stool.add(cylinder(0.2, 0.22, 0.03, trim, 0, 0, 0, 20));
  stool.add(cylinder(0.03, 0.03, 0.62, trim, 0, 0.03, 0, 10));
  stool.add(cylinder(0.22, 0.2, 0.1, mat({ color: '#6e1423', roughness: 0.5 }), 0, 0.64, 0, 24));
  stool.add(soft(0.36, 0.3, 0.07, mat({ color: '#6e1423', roughness: 0.5 }), 0, 0.72, 0.2, 0.03));
  stool.position.z = 0.8;
  g.add(stool);
  return { group: g, reels };
}

function pokerTable({ feltMat, rail, wood, gold, chairSeat, chipMats, back, faces }) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.ExtrudeGeometry(stadium(0.65, 0.65), { depth: 0.04, bevelEnabled: false }), feltMat);
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.72;
  top.receiveShadow = true;
  g.add(top);
  const ring = stadium(0.65, 0.82);
  ring.holes.push(stadium(0.65, 0.66));
  const railMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 24 }), rail);
  railMesh.rotation.x = -Math.PI / 2;
  railMesh.position.y = 0.73;
  railMesh.castShadow = true;
  g.add(railMesh);
  for (const x of [-0.6, 0.6]) {
    g.add(cylinder(0.12, 0.16, 0.7, wood, x, 0, 0, 16));
    g.add(block(0.6, 0.04, 0.5, gold, x, 0, 0));
  }
  g.add(block(0.5, 0.03, 0.14, mat({ color: '#111', roughness: 0.4 }), 0, 0.76, -0.5));
  const colors = ['red', 'blue', 'green', 'black'];
  colors.forEach((c, i) => { const s = chipStack(chipMats, 10 + i * 3, c); s.position.x = -0.18 + i * 0.12; s.position.y += 0.76; s.position.z = -0.5; g.add(s); });

  const cardGeo = new THREE.PlaneGeometry(0.063, 0.088);
  const backMat = mat({ map: back, roughness: 0.6 });
  const community = [];
  faces.forEach((faceTex, i) => {
    const card = new THREE.Group();
    const front = new THREE.Mesh(cardGeo, mat({ map: faceTex, roughness: 0.6 }));
    front.rotation.x = -Math.PI / 2;
    const rear = new THREE.Mesh(cardGeo, backMat);
    rear.rotation.x = Math.PI / 2;
    card.add(front, rear);
    card.position.set(-0.18 + i * 0.09, 0.765, -0.08);
    card.rotation.z = Math.PI;
    g.add(card);
    community.push(card);
  });
  const seats = [[-1.25, 0], [-0.75, 0.62], [0, 0.72], [0.75, 0.62], [1.25, 0], [0, -1.0]];
  seats.slice(0, 5).forEach(([x, z], i) => {
    const a = Math.atan2(x, z);
    const cx = x * 0.72, cz = z * 0.72;
    for (const k of [0, 1]) {
      const c = new THREE.Mesh(cardGeo, backMat);
      c.rotation.x = -Math.PI / 2;
      c.rotation.z = -a + (k - 0.5) * 0.2;
      c.position.set(cx + k * 0.03, 0.762 + k * 0.001, cz);
      g.add(c);
    }
    const s = chipStack(chipMats, 6 + ((i * 5) % 9), colors[i % 4]);
    s.position.x = x * 0.55 + 0.08; s.position.z = z * 0.55; s.position.y += 0.76;
    g.add(s);
    const chair = F.chair({ wood: gold, seat: chairSeat });
    chair.position.set(x * 1.22, 0, z * 1.25 + Math.sign(z) * 0.15);
    chair.rotation.y = a + Math.PI;
    g.add(chair);
  });
  const dealer = F.chair({ wood: gold, seat: chairSeat });
  dealer.position.set(0, 0, -1.25);
  g.add(dealer);
  return { group: g, community };
}

export default function build() {
  const group = new THREE.Group();
  const anim = animator();
  const gold = METALS.gold();
  const darkWood = mat({ map: T.woodGrain('#2a1612', { seed: 133 }), roughness: 0.45 });
  const velvet = mat({ map: T.fabric('#6e1423', { seed: 134 }), roughness: 0.75 });
  const rail = mat({ color: '#2a1810', roughness: 0.35 });

  group.add(buildShell({
    W, D, H,
    floorMat: mat({ map: carpetTexture(), roughness: 0.95 }),
    wallMat: mat({ map: T.wallpaper('#2e1b1f', { seed: 135, stripe: 0.05, repeat: [1, 1] }), roughness: 0.8 }),
    ceilingMat: mat({ color: '#1a1214', roughness: 0.9 }),
    trimMat: gold,
    crown: true,
    wainscot: { height: 1.1, material: darkWood },
    walls: {},
    windowStyle: {},
  }));
  for (const [len, side] of [[W, 'back'], [W, 'front'], [D, 'left'], [D, 'right']]) {
    const strip = F.coveStrip(len - 0.4, '#ffcf8a', 1.4);
    group.add(onWall(strip, side, { W, D }, 0, H - 0.25, 0.1));
  }

  // Slot machines
  const reelTex = reelTexture();
  const reelMat = mat({ map: reelTex, roughness: 0.4, side: THREE.DoubleSide });
  const attract = (hue) => liveScreen((ctx, w, h, t) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `hsl(${hue},70%,22%)`); g.addColorStop(1, `hsl(${hue + 40},70%,10%)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU + t * 0.8;
      ctx.fillStyle = (i + Math.floor(t * 6)) % 3 ? '#ffd24d' : '#ff4d6d';
      ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a) * w * 0.4, h / 2 + Math.sin(a) * h * 0.38, 4, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#ffd24d'; ctx.textAlign = 'center'; ctx.font = '800 30px "Segoe UI", Arial';
    ctx.fillText(hue > 200 ? 'STAR RUSH' : 'GOLDEN 7s', w / 2, h / 2 - 6);
    ctx.fillStyle = '#fff'; ctx.font = '600 13px "Segoe UI", Arial';
    ctx.fillText('DEMO · NO MONEY', w / 2, h / 2 + 22);
  }, { width: 256, height: 190, fps: 10 });
  const screens = [attract(280), attract(20)];
  const slots = new THREE.Group();
  const reels = [];
  const slotBody = mat({ color: '#1c1c22', metalness: 0.5, roughness: 0.35 });
  const addSlot = (x, z, ry, i) => {
    const s = slotMachine({ body: slotBody, trim: gold, reelMat, screenTex: screens[i % 2].texture, accent: i % 2 ? '#ff8a3d' : '#b06dff' });
    at(s.group, x, 0, z, ry);
    slots.add(s.group);
    reels.push(...s.reels);
  };
  for (let i = 0; i < 6; i++) addSlot(-W / 2 + 0.35, -5.6 + i * 0.75, Math.PI / 2, i);
  for (let i = 0; i < 4; i++) {
    addSlot(-5.95, -4.9 + i * 0.75, -Math.PI / 2, i + 1);
    addSlot(-5.25, -4.9 + i * 0.75, Math.PI / 2, i);
  }
  slots.add(block(1.3, 0.12, 3.2, gold, -5.6, 2.2, -3.78));
  group.add(tag(slots, 'slots'));
  reels.forEach((r, i) => { r.rotation.x = (i * 1.7) % TAU; });
  pointLight(group, [-6.2, 3.0, -3.0], '#c58bff', 5, 8);

  // Poker tables
  const chipMats = Object.fromEntries([['red', RED], ['blue', '#1f4ea8'], ['green', '#1f7a45'], ['black', '#1a1a1a']].map(([k, c]) => {
    const side = mat({ map: chipEdge(c), roughness: 0.5 });
    const top = mat({ color: c, roughness: 0.5 });
    return [k, [side, top, top]];
  }));
  const back = cardBack();
  const hands = [[['A', '♠'], ['K', '♥'], ['10', '♦'], ['7', '♣'], ['Q', '♥']], [['J', '♣'], ['9', '♥'], ['9', '♠'], ['2', '♦'], ['A', '♦']]];
  const pokerFelt = mat({ map: felt('#1d5f40', { repeat: [0.8, 0.8] }), roughness: 0.95 });
  const communities = [];
  const poker = new THREE.Group();
  [[-0.8, -3.9], [3.6, -3.9]].forEach(([x, z], i) => {
    const t = pokerTable({ feltMat: pokerFelt, rail, wood: darkWood, gold, chairSeat: velvet, chipMats, back, faces: hands[i].map(([r, s]) => cardTexture(r, s)) });
    poker.add(at(t.group, x, 0, z));
    communities.push(t.community);
    const lamp = new THREE.Group();
    lamp.add(block(1.8, 0.14, 0.6, mat({ color: '#1b1214', roughness: 0.5 }), 0, -0.14, 0));
    lamp.add(block(1.84, 0.03, 0.64, gold, 0, -0.15, 0));
    const lit = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.5), glow('#ffe2b0', 1.8));
    lit.rotation.x = Math.PI / 2;
    lit.position.y = -0.155;
    lamp.add(lit);
    for (const s of [-0.7, 0.7]) lamp.add(cylinder(0.004, 0.004, 1.5, gold, s, 0, 0, 4));
    lamp.position.set(x, H - 1.5, z);
    poker.add(lamp);
    pointLight(group, [x, H - 1.8, z], '#ffe0b0', 7, 6);
  });
  group.add(tag(poker, 'poker'));

  // Roulette table
  const roulette = new THREE.Group();
  roulette.add(block(3.0, 0.72, 1.3, darkWood, 0, 0, 0));
  roulette.add(block(3.1, 0.05, 1.4, rail, 0, 0.72, 0));
  const layout = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), mat({ map: rouletteLayout(), roughness: 0.9 }));
  layout.rotation.x = -Math.PI / 2;
  layout.position.set(0.42, 0.775, 0);
  roulette.add(layout);
  const bowlProfile = [[0.5, 0], [0.52, 0.03], [0.52, 0.13], [0.49, 0.15], [0.44, 0.12], [0.38, 0.09], [0.35, 0.08]].map(([x, y]) => new THREE.Vector2(x, y));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlProfile, 64), mat({ map: T.woodGrain('#5a3420', { seed: 136 }), roughness: 0.35, side: THREE.DoubleSide }));
  bowl.position.set(-1.0, 0.77, 0);
  bowl.castShadow = true;
  roulette.add(bowl);
  const rotor = new THREE.Group();
  rotor.position.set(-1.0, 0.82, 0);
  const wheelMats = [mat({ color: '#3a2416', roughness: 0.4 }), mat({ map: wheelTexture(), roughness: 0.35 }), mat({ color: '#3a2416' })];
  rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.33, 0.05, 64), wheelMats));
  const turret = new THREE.Group();
  turret.add(cylinder(0.05, 0.08, 0.06, gold, 0, 0.025, 0, 20));
  turret.add(cylinder(0.008, 0.02, 0.1, gold, 0, 0.08, 0, 12));
  for (let i = 0; i < 4; i++) {
    const arm = block(0.16, 0.012, 0.012, gold, 0, 0.13, 0);
    arm.rotation.y = (i * Math.PI) / 4;
    turret.add(arm);
  }
  rotor.add(turret);
  roulette.add(rotor);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), mat({ color: '#fafafa', roughness: 0.2 }));
  roulette.add(ball);
  ['red', 'black', 'blue', 'green'].forEach((c, i) => {
    const s = chipStack(chipMats, 4 + i * 2, c);
    s.position.set(0.0 + i * 0.32, 0.775 + s.position.y, i % 2 ? 0.18 : -0.14);
    roulette.add(s);
  });
  for (let i = 0; i < 5; i++) {
    const chair = F.chair({ wood: gold, seat: velvet });
    chair.position.set(-0.4 + i * 0.5, 0, 1.15);
    chair.rotation.y = Math.PI;
    roulette.add(chair);
  }
  const rouletteAt = new THREE.Vector3(1.4, 0, 1.3);
  group.add(tag(at(roulette, rouletteAt.x, 0, rouletteAt.z), 'roulette'));
  pointLight(group, [rouletteAt.x - 0.3, 2.6, rouletteAt.z], '#ffe0b0', 6, 6);

  // Cocktail bar on the right wall
  const bar = new THREE.Group();
  bar.add(block(5.0, 1.05, 0.6, darkWood, 0, 0, 0));
  bar.add(block(5.0, 0.06, 0.02, glow('#ffcf8a', 1.6), 0, 0.95, 0.31));
  bar.add(block(5.2, 0.05, 0.8, mat({ map: T.marble('#1d1a1a', '#6a5a4a', { seed: 137 }), roughness: 0.2 }), 0, 1.05, 0.08));
  for (let i = 0; i < 5; i++) bar.add(at(F.barStool({ seat: velvet, metal: gold }), -2.0 + i * 1.0, 0, 0.75));
  group.add(tag(onWall(bar, 'right', { W, D }, -2.6, 0, 1.6), 'bar'));
  const backBar = new THREE.Group();
  backBar.add(block(5.0, 0.95, 0.5, darkWood, 0, 0, 0));
  backBar.add(block(4.9, 1.4, 0.02, glow('#3a7bd5', 0.5, { color: '#0d1830' }), 0, 1.1, -0.22));
  for (const [y, seed] of [[1.2, 138], [1.65, 139], [2.1, 140]]) {
    backBar.add(block(4.8, 0.03, 0.24, mat({ color: '#e8eef0', transparent: true, opacity: 0.5, roughness: 0.05 }), 0, y, -0.1));
    const row = bottleRow(4.6, { seed });
    row.position.set(0, y + 0.03, -0.1);
    backBar.add(row);
  }
  group.add(tag(onWall(backBar, 'right', { W, D }, -2.6, 0, 0.27), 'bar'));
  pointLight(group, [W / 2 - 1.5, 2.4, -2.6], '#ffd29a', 5, 7);

  // Cashier cage (display only)
  const cage = new THREE.Group();
  cage.add(block(3.2, 1.05, 0.6, darkWood, 0, 0, 0));
  cage.add(block(3.3, 0.05, 0.7, gold, 0, 1.05, 0));
  cage.add(block(3.2, 0.5, 0.6, darkWood, 0, 2.4, 0));
  for (let i = 0; i <= 26; i++) cage.add(cylinder(0.008, 0.008, 1.3, gold, -1.56 + i * 0.12, 1.1, 0.05, 6));
  for (const x of [-0.8, 0.8]) cage.add(block(0.5, 0.18, 0.08, mat({ color: '#111' }), x, 1.1, 0.3));
  const cashierSign = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.42), mat({
    map: signTexture('CASHIER', { width: 1536, height: 220, color: '#e8c27a', bg: '#1a1012', font: '600 110px "Segoe UI", Arial', sub: 'DISPLAY ONLY · NO REAL MONEY OR CHIPS' }),
    emissive: '#ffffff', emissiveIntensity: 0.25,
  }));
  cashierSign.position.set(0, 2.65, 0.305);
  cage.add(cashierSign);
  group.add(tag(onWall(cage, 'front', { W, D }, 6.6, 0, 0.35), 'cashier'));

  // Neon sign, entrance ropes, columns, lounge
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 1.2), new THREE.MeshBasicMaterial({
    map: signTexture('THE GILDED ROOM', { width: 2048, height: 410, color: '#ffcf6a', neon: true, font: '600 200px Georgia, serif', sub: 'VISUAL SIMULATION · NO GAMBLING' }),
    transparent: true, toneMapped: false,
  }));
  neon.userData.noPick = true;
  group.add(onWall(neon, 'back', { W, D }, 1.4, 3.05, 0.04));
  group.add(onWall(F.door({ wood: darkWood, handle: gold, frameMat: gold, w: 1.6, h: 2.6 }), 'front', { W, D }, 1.4, 0, 0));
  const ropeMat = mat({ color: '#7a1020', roughness: 0.6 });
  const posts = [[-0.4, 5.6], [0.6, 4.9], [2.2, 4.9], [3.2, 5.6]];
  posts.forEach(([x, z]) => {
    group.add(cylinder(0.14, 0.16, 0.04, gold, x, 0, z, 20));
    group.add(cylinder(0.025, 0.025, 0.95, gold, x, 0.04, z, 10));
    group.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), gold), x, 1.0, z));
  });
  for (let i = 0; i < posts.length - 1; i++) {
    if (i === 1) continue;
    const [x1, z1] = posts[i], [x2, z2] = posts[i + 1];
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x1, 0.95, z1), new THREE.Vector3((x1 + x2) / 2, 0.65, (z1 + z2) / 2), new THREE.Vector3(x2, 0.95, z2));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.02, 8), ropeMat));
  }
  const columnMat = mat({ map: T.marble('#1f1a1a', '#7a6a55', { seed: 141, repeat: [1, 2] }), roughness: 0.25 });
  for (const [x, z] of [[-2.9, -1.2], [6.0, -1.2], [-2.9, 4.2], [6.0, 4.2]]) {
    group.add(cylinder(0.28, 0.28, H, columnMat, x, 0, z, 28));
    for (const y of [0, H - 0.3]) group.add(cylinder(0.34, 0.34, 0.3, gold, x, y, z, 28));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.015, 8, 40), glow('#ffcf8a', 2));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.32, z);
    group.add(ring);
  }
  const lounge = new THREE.Group();
  lounge.add(at(F.rug({ w: 4.2, d: 3.0, material: mat({ map: T.carpet('#2a1a14', { seed: 142, repeat: [3, 2] }), roughness: 1 }) }), 0, 0, 0));
  lounge.add(at(F.sofa({ width: 2.4, fabric: velvet, legsMat: gold, pillows: [mat({ color: '#c9a46a' }), mat({ color: '#c9a46a' })] }), 0, 0, -1.0));
  lounge.add(at(F.armchair({ fabric: velvet, legsMat: gold }), -1.6, 0, 0.3, Math.PI / 2));
  lounge.add(at(F.armchair({ fabric: velvet, legsMat: gold }), 1.6, 0, 0.3, -Math.PI / 2));
  lounge.add(at(F.coffeeTable({ top: mat({ map: T.marble('#1d1a1a', '#6a5a4a', { seed: 143 }), roughness: 0.2 }), legsMat: gold, round: true, w: 0.9 }), 0, 0, 0.1));
  lounge.add(at(F.floorLamp({ base: gold, light: 0 }), -1.8, 0, -1.1));
  lounge.add(at(F.plant({ pot: gold, scale: 1.8 }), 1.9, 0, -1.2));
  group.add(tag(at(lounge, -6.2, 0, 4.4), 'lounge'));
  pointLight(group, [-6.2, 2.6, 4.4], '#ffcf94', 4, 6);

  for (const [x, z] of [[1.4, 1.3], [-6.2, 4.4]]) {
    const ch = F.chandelier({ metal: gold, light: 0, drop: 0.9, radius: 0.75 });
    ch.position.set(x, H, z);
    group.add(ch);
  }

  hemi(group, '#ffd9b0', '#2a1010', 0.4);
  addSun(group, { color: '#ffd6a0', intensity: 0.9, position: [2, H - 0.15, 3], target: [0, 0, -1], size: 10, near: 0.1, far: 12 });

  // ---------- animations (visual only) ----------
  let clock = 0;
  anim.add((dt) => { clock += dt; screens[0].update(clock); screens[1].update(clock); });

  let spinning = false;
  const spinReels = () => {
    if (spinning) return;
    spinning = true;
    const step = TAU / SYMBOLS.length;
    let done = 0;
    reels.forEach((r, i) => {
      const start = r.rotation.x;
      const target = Math.round((start + TAU * (4 + (i % 3)) + Math.floor(Math.random() * SYMBOLS.length) * step) / step) * step;
      playOnce(anim, 1.6 + (i % 3) * 0.45 + Math.random() * 0.2, (k, e) => { r.rotation.x = start + (target - start) * e; }, () => {
        r.rotation.x = target % TAU;
        if (++done === reels.length) spinning = false;
      });
    });
  };

  let dealing = false;
  const deal = () => {
    if (dealing) return;
    dealing = true;
    const faceUp = communities[0][0].rotation.z < 1;
    communities.forEach((cards) => cards.forEach((card, i) => {
      const from = card.rotation.z, to = faceUp ? Math.PI : 0;
      let wait = i * 0.35;
      anim.add((dt) => {
        wait -= dt;
        if (wait > 0) return true;
        playOnce(anim, 0.45, (k, e) => {
          card.rotation.z = from + (to - from) * e;
          card.position.y = 0.765 + Math.sin(k * Math.PI) * 0.06;
        }, () => { if (i === cards.length - 1) dealing = false; });
        return false;
      });
    }));
  };

  const wheel = { rotor: 0.3, ball: 0, angle: 0, ballAngle: 1, r: 0.3, locked: true, offset: 1 };
  const placeBall = () => {
    const y = 0.77 + (wheel.r > 0.38 ? 0.105 : 0.088);
    ball.position.set(-1.0 + Math.cos(wheel.ballAngle) * wheel.r, y, -Math.sin(wheel.ballAngle) * wheel.r);
  };
  anim.add((dt) => {
    wheel.angle += wheel.rotor * dt;
    rotor.rotation.y = wheel.angle;
    if (!wheel.locked) {
      wheel.ballAngle += wheel.ball * dt;
      wheel.ball *= Math.exp(-0.42 * dt);
      wheel.rotor = Math.max(0.3, wheel.rotor * Math.exp(-0.12 * dt));
      if (Math.abs(wheel.ball) < 2.4) wheel.r = Math.max(0.3, wheel.r - dt * 0.09);
      if (wheel.r <= 0.3) {
        const pocket = TAU / WHEEL.length;
        wheel.offset = Math.round((wheel.ballAngle - wheel.angle) / pocket) * pocket;
        wheel.locked = true;
      }
    }
    if (wheel.locked) {
      wheel.rotor = Math.max(0.3, wheel.rotor * Math.exp(-0.25 * dt));
      wheel.ballAngle = wheel.angle + wheel.offset;
    }
    placeBall();
  });
  const spinWheel = () => {
    if (!wheel.locked) return;
    wheel.locked = false;
    wheel.rotor = 2.6;
    wheel.ball = -10 - Math.random() * 2;
    wheel.r = 0.43;
  };

  const disclaimer = ' Visual simulation only: no bets, no money and no prizes.';
  const hotspots = [
    {
      id: 'slots', label: 'Slot machines', position: [-5.6, 2.6, -3.4],
      title: 'Slot machine banks', text: `Fourteen themed cabinets with spinning reels and animated screens.${disclaimer}`,
      view: { position: [-3.6, 1.7, -0.4], target: [-6.4, 1.2, -3.8] },
      action: { label: 'Spin the reels (demo)', run: spinReels },
    },
    {
      id: 'poker', label: 'Poker tables', position: [1.4, 1.5, -3.9],
      title: 'Poker tables', text: `Two felt poker tables with padded rails, dealer chip trays and seats for five players.${disclaimer}`,
      view: { position: [1.4, 2.2, -1.2], target: [0.2, 0.75, -3.9] },
      action: { label: 'Deal the community cards', run: deal },
    },
    {
      id: 'roulette', label: 'Roulette', position: [rouletteAt.x - 1.0, 1.4, rouletteAt.z],
      title: 'Roulette wheel', text: `A European-style single-zero wheel and betting layout. Spin it to watch the ball settle.${disclaimer}`,
      view: { position: [rouletteAt.x - 1.0, 1.55, rouletteAt.z + 1.4], target: [rouletteAt.x - 1.0, 0.8, rouletteAt.z] },
      action: { label: 'Spin the wheel (demo)', run: spinWheel },
    },
    {
      id: 'bar', label: 'Cocktail bar', position: [W / 2 - 1.6, 1.9, -2.6],
      title: 'Cocktail bar', text: 'A backlit bar serving mocktails and classic cocktails (21+). Drinks and prices on this site are simulated.',
      view: { position: [5.2, 1.7, -0.6], target: [8.0, 1.2, -2.8] },
    },
    {
      id: 'cashier', label: 'Cashier', position: [6.6, 2.2, D / 2 - 0.4],
      title: 'Cashier (display only)', text: 'Part of the decor only. This simulation has no chips, credits, deposits or payouts, and no real-money transactions of any kind.',
      view: { position: [5.6, 1.7, 3.0], target: [6.6, 1.4, 6.6] },
    },
    {
      id: 'lounge', label: 'Velvet lounge', position: [-6.2, 1.5, 4.4],
      title: 'Velvet lounge', text: 'Plush velvet seating under a chandelier, a quiet corner away from the gaming floor.',
      view: { position: [-3.4, 1.7, 2.2], target: [-6.2, 0.7, 4.4] },
    },
  ];

  return {
    group, hotspots,
    bounds: { W, D, H },
    exposure: 1.2,
    envIntensity: 0.22,
    walkSpeed: 2.0,
    update: anim.update,
    viewpoints: [
      { id: 'entrance', label: 'Entrance', position: [1.4, 1.8, 6.3], target: [0.2, 1.0, -2.5] },
      { id: 'slots', label: 'Slots', position: hotspots[0].view.position, target: hotspots[0].view.target },
      { id: 'poker', label: 'Poker', position: hotspots[1].view.position, target: hotspots[1].view.target },
      { id: 'roulette', label: 'Roulette', position: hotspots[2].view.position, target: hotspots[2].view.target },
      { id: 'bar', label: 'Bar', position: hotspots[3].view.position, target: hotspots[3].view.target },
      { id: 'overview', label: 'Overview', position: [8.2, 3.6, 6.3], target: [-1.5, 0.6, -1.8] },
    ],
  };
}
