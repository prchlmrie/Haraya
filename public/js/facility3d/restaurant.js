// Sunset Brasserie: sunset windows, laid round tables, leather booths, a
// marble bar with back-bar shelving, a glass buffet display with heat lamps,
// a dessert station and candle-lit decorative lighting.
import {
  THREE, T, F, mat, block, soft, cylinder, METALS, buildShell, onWall, at, addSun,
  tag, glow, hemi, pointLight, animator, playOnce, signTexture, glassPanel, bottleRow,
} from './kit.js';

const W = 14, D = 11, H = 3.6;

/** Scattered copies of one food item as a single instanced mesh. */
function heap(geo, material, n, w, d, y, seed, scale = [1, 1, 1]) {
  const m = new THREE.InstancedMesh(geo, material, n);
  const r = T.rng(seed);
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    o.position.set((r() - 0.5) * w, y, (r() - 0.5) * d);
    o.rotation.set((r() - 0.5) * 0.4, r() * 6.28, (r() - 0.5) * 0.4);
    const s = 0.85 + r() * 0.3;
    o.scale.set(s * scale[0], s * scale[1], s * scale[2]);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  }
  m.castShadow = true;
  return m;
}

const wineGlassGeometry = () => new THREE.LatheGeometry([[0, 0], [0.035, 0], [0.035, 0.006], [0.005, 0.012], [0.004, 0.1], [0.03, 0.12], [0.04, 0.17], [0.036, 0.2]].map(([x, y]) => new THREE.Vector2(x, y)), 16);

function diningTable({ cloth, chairWood, seat, plate, glassGeo, glassMat, flame, gold, seats = 4, candle = [0, 0] }) {
  const g = new THREE.Group();
  g.add(cylinder(0.5, 0.5, 0.03, cloth, 0, 0.74, 0, 40));
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.505, 0.56, 0.36, 40, 1, true), cloth);
  skirt.position.y = 0.58;
  skirt.castShadow = true;
  g.add(skirt);
  g.add(cylinder(0.25, 0.3, 0.4, mat({ color: '#2a1d14' }), 0, 0, 0, 16));
  for (let i = 0; i < seats; i++) {
    const a = (i / seats) * Math.PI * 2 + Math.PI / 4;
    const chair = F.chair({ wood: chairWood, seat });
    chair.position.set(Math.sin(a) * 0.78, 0, Math.cos(a) * 0.78);
    chair.rotation.y = a + Math.PI;
    g.add(chair);
    const px = Math.sin(a) * 0.34, pz = Math.cos(a) * 0.34;
    g.add(cylinder(0.12, 0.1, 0.014, plate, px, 0.77, pz, 28));
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(px + Math.cos(a) * 0.16, 0.77, pz - Math.sin(a) * 0.16);
    g.add(glass);
    const napkin = block(0.08, 0.02, 0.16, mat({ color: '#f4efe6', roughness: 1 }), 0, 0.77, 0);
    napkin.position.set(px - Math.cos(a) * 0.17, 0.77, pz + Math.sin(a) * 0.17);
    napkin.rotation.y = a;
    g.add(napkin);
  }
  const [cx, cz] = candle;
  g.add(cylinder(0.035, 0.04, 0.02, gold, cx, 0.77, cz, 16));
  g.add(cylinder(0.022, 0.022, 0.09, mat({ color: '#f6efe0', roughness: 0.6 }), cx, 0.79, cz, 12));
  const f = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.035, 8), flame);
  f.position.set(cx, 0.9, cz);
  g.add(f);
  return g;
}

function booth(leather, wood, tufted) {
  const g = new THREE.Group();
  g.add(block(1.4, 0.4, 0.55, wood, 0, 0, 0));
  g.add(soft(1.38, 0.1, 0.52, leather, 0, 0.4, 0.01, 0.04));
  g.add(soft(1.38, 0.75, 0.14, tufted, 0, 0.5, -0.24, 0.05));
  g.add(block(1.42, 0.06, 0.18, wood, 0, 1.25, -0.25));
  return g;
}

export default function build() {
  const group = new THREE.Group();
  const anim = animator();
  const gold = METALS.gold();
  const darkWood = mat({ map: T.woodGrain('#4a2f1e', { seed: 111 }), roughness: 0.5 });
  const marble = mat({ map: T.marble('#f3efe8', '#b8ad9c', { seed: 112, repeat: [3, 1] }), roughness: 0.2 });
  const leather = mat({ color: '#2f4a3a', roughness: 0.45 });
  const tuftedLeather = mat({ map: T.tufted('#335140', { repeat: [3, 2] }), roughness: 0.5 });
  const cloth = mat({ map: T.fabric('#f7f3ec', { seed: 113, repeat: [3, 3] }), roughness: 0.95, side: THREE.DoubleSide });
  const plate = mat({ color: '#fbfaf7', roughness: 0.25 });
  const glassMat = mat({ color: '#eef4f6', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35 });
  const flame = glow('#ffb347', 2.5, { color: '#fff1c9' });
  const chairSeat = mat({ map: T.fabric('#8c5a3c', { seed: 114 }), roughness: 0.85 });

  group.add(buildShell({
    W, D, H,
    floorMat: mat({ map: T.woodPlanks('#6b4a33', { seed: 115, planks: 8, repeat: [W / 2.2, D / 2.2] }), roughness: 0.45 }),
    wallMat: mat({ map: T.wallpaper('#eadfce', { seed: 116, stripe: 0.03, repeat: [1, 1] }), roughness: 0.9 }),
    ceilingMat: mat({ color: '#f4eee4', roughness: 0.95 }),
    trimMat: mat({ color: '#3d2a1c', roughness: 0.5 }),
    crown: true,
    wainscot: { height: 1.0, material: darkWood },
    walls: { back: { openings: [-4.4, 0, 4.4].map((center) => ({ center, width: 3.0, sill: 0.45, height: 2.65, panes: 3 })) } },
    windowStyle: {
      frame: mat({ color: '#2e2219', roughness: 0.5 }),
      glass: mat({ color: '#f3e3cc', roughness: 0.03, transparent: true, opacity: 0.1, depthWrite: false }),
      view: new THREE.MeshBasicMaterial({ map: T.viewTexture('sunset'), toneMapped: false, color: '#f0f0f0' }),
      curtain: mat({ map: T.fabric('#8c3f2e', { seed: 117, repeat: [2, 4] }), roughness: 0.95 }),
      rod: gold,
    },
  }));

  // Round tables
  const tables = new THREE.Group();
  const glassGeo = wineGlassGeometry();
  const tableKit = { cloth, chairWood: darkWood, seat: chairSeat, plate, glassGeo, glassMat, flame, gold };
  const tableSpots = [[-3.4, -3.4], [-0.6, -3.4], [2.2, -3.4], [-3.4, -0.6], [2.2, -0.6], [-3.0, 2.0], [0.2, 2.0]];
  for (const [x, z] of tableSpots) tables.add(at(diningTable(tableKit), x, 0, z));
  group.add(tag(tables, 'tables'));

  // Chef's special table with a cloche
  const special = at(diningTable({ ...tableKit, seats: 2, candle: [0.24, 0.24] }), -0.6, 0, -0.6);
  const dish = new THREE.Group();
  dish.add(cylinder(0.16, 0.13, 0.016, plate, 0, 0, 0, 32));
  dish.add(soft(0.12, 0.035, 0.08, mat({ color: '#6b3420', roughness: 0.6 }), -0.02, 0.016, 0, 0.015));
  for (let i = 0; i < 5; i++) dish.add(cylinder(0.008, 0.008, 0.07, mat({ color: '#4f8a3a' }), 0.06 + i * 0.008, 0.016, -0.04 + i * 0.02, 6));
  dish.children.slice(-5).forEach((m) => { m.rotation.z = Math.PI / 2; m.position.y = 0.025; });
  dish.add(cylinder(0.03, 0.03, 0.02, mat({ color: '#e8c25a' }), -0.07, 0.016, 0.06, 14));
  const cloche = new THREE.Group();
  cloche.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), METALS.chrome()));
  cloche.add(cylinder(0.018, 0.012, 0.04, METALS.chrome(), 0, 0.15, 0, 12));
  cloche.children[0].castShadow = true;
  dish.add(cloche);
  dish.position.set(-0.05, 0.77, -0.05);
  special.add(dish);
  group.add(tag(special, 'special'));

  // Leather booths along the left wall
  const booths = new THREE.Group();
  for (const zc of [-3.6, -1.0, 1.6]) {
    const b1 = booth(leather, darkWood, tuftedLeather);
    b1.position.set(-W / 2 + 0.72, 0, zc - 0.85);
    booths.add(b1);
    const b2 = booth(leather, darkWood, tuftedLeather);
    b2.position.set(-W / 2 + 0.72, 0, zc + 0.85);
    b2.rotation.y = Math.PI;
    booths.add(b2);
    const t = new THREE.Group();
    t.add(block(1.2, 0.04, 0.8, darkWood, 0, 0.72, 0));
    t.add(cylinder(0.05, 0.05, 0.72, gold, 0.25, 0, 0, 10));
    t.add(block(0.5, 0.03, 0.4, gold, 0.25, 0, 0));
    for (const s of [-1, 1]) {
      t.add(cylinder(0.12, 0.1, 0.014, plate, 0.1, 0.76, s * 0.22, 28));
      const gl = new THREE.Mesh(glassGeo, glassMat);
      gl.position.set(0.32, 0.76, s * 0.22);
      t.add(gl);
    }
    t.position.set(-W / 2 + 0.62, 0, zc);
    booths.add(t);
    const p = F.pendant({ metal: gold, light: 0, drop: 1.4 });
    p.position.set(-W / 2 + 0.75, H, zc);
    booths.add(p);
    const art = F.framedArt({ w: 0.8, h: 0.6, texture: T.artwork(118 + Math.round(zc * 10)), frame: gold });
    booths.add(onWall(art, 'left', { W, D }, zc, 1.85, 0.02));
  }
  group.add(tag(booths, 'booths'));
  pointLight(group, [-W / 2 + 1.0, 2.0, -1.0], '#ffcf94', 5, 7);

  // Bar & espresso counter
  const counter = new THREE.Group();
  counter.add(block(5.0, 1.0, 0.6, darkWood, 0, 0, 0));
  for (let i = 0; i < 8; i++) counter.add(block(0.5, 0.75, 0.01, darkWood, -2.2 + i * 0.63, 0.12, 0.305));
  counter.add(block(5.2, 0.05, 0.78, marble, 0, 1.0, 0.06));
  const rail = cylinder(0.022, 0.022, 4.9, gold, 0, 0, 0, 12);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, 0.22, 0.42);
  counter.add(rail);
  for (const x of [-1.6, 0.4]) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
    dome.position.set(x, 1.06, 0.1);
    counter.add(dome);
    counter.add(cylinder(0.12, 0.12, 0.05, mat({ color: '#d9b38c' }), x, 1.05, 0.1, 24));
    counter.add(cylinder(0.15, 0.15, 0.01, METALS.chrome(), x, 1.05, 0.1, 24));
  }
  for (let i = 0; i < 3; i++) {
    counter.add(cylinder(0.02, 0.02, 0.35, METALS.chrome(), 1.6 + i * 0.12, 1.05, -0.05, 10));
    counter.add(block(0.04, 0.12, 0.03, darkWood, 1.6 + i * 0.12, 1.3, 0.0));
  }
  for (let i = 0; i < 5; i++) counter.add(at(F.barStool({ seat: leather, metal: gold }), -2.0 + i * 1.0, 0, 0.75));
  group.add(tag(onWall(counter, 'right', { W, D }, -0.9, 0, 1.6), 'counter'));

  const backBar = new THREE.Group();
  backBar.add(block(5.0, 0.95, 0.5, darkWood, 0, 0, 0));
  backBar.add(block(5.0, 0.04, 0.52, marble, 0, 0.95, 0));
  backBar.add(F.mirror({ w: 4.8, h: 1.25, frame: gold }).translateY(1.75).translateZ(-0.23));
  for (const [y, seed] of [[1.3, 119], [1.75, 120], [2.2, 121]]) {
    backBar.add(block(4.8, 0.03, 0.22, mat({ color: '#e8eef0', transparent: true, opacity: 0.6, roughness: 0.05 }), 0, y, -0.12));
    const row = bottleRow(4.6, { seed });
    row.position.set(0, y + 0.03, -0.12);
    backBar.add(row);
    backBar.add(block(4.8, 0.01, 0.02, glow('#ffcf8a', 1.5), 0, y - 0.012, -0.02));
  }
  // Espresso machine
  const espresso = new THREE.Group();
  espresso.add(soft(0.7, 0.42, 0.45, METALS.chrome(), 0, 0, 0, 0.04));
  espresso.add(block(0.6, 0.05, 0.4, mat({ color: '#1b1b1b' }), 0, 0.42, 0));
  for (const x of [-0.18, 0.18]) espresso.add(cylinder(0.035, 0.035, 0.08, mat({ color: '#1b1b1b' }), x, 0.12, 0.24, 12));
  for (let i = 0; i < 4; i++) espresso.add(cylinder(0.04, 0.035, 0.07, plate, -0.2 + i * 0.13, 0.47, 0, 14));
  espresso.position.set(-1.7, 0.99, 0.02);
  backBar.add(espresso);
  group.add(tag(onWall(backBar, 'right', { W, D }, -0.9, 0, 0.27), 'counter'));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.5), mat({ map: signTexture('SUNSET BRASSERIE', { width: 2048, height: 256, font: '300 150px "Segoe UI", Arial' }), transparent: true, emissive: '#c9a46a', emissiveIntensity: 0.35 }));
  group.add(onWall(sign, 'right', { W, D }, -0.9, 3.05, 0.03));
  for (let i = 0; i < 4; i++) {
    const p = F.pendant({ metal: gold, light: 0, drop: 1.25 });
    p.position.set(W / 2 - 1.55, H, -2.7 + i * 1.2);
    group.add(p);
  }
  pointLight(group, [W / 2 - 1.6, 2.2, -0.9], '#ffd29a', 7, 8);

  // Buffet display with heat lamps
  const buffet = new THREE.Group();
  buffet.add(block(4.6, 0.86, 0.8, darkWood, 0, 0, 0));
  buffet.add(block(4.7, 0.04, 0.9, marble, 0, 0.86, 0));
  const pans = [
    { x: -1.8, food: () => heap(new THREE.SphereGeometry(0.045, 12, 8), mat({ color: '#c98a4b', roughness: 0.7 }), 16, 0.38, 0.26, 0.965, 122, [1, 0.7, 1.3]) },
    { x: -1.0, food: () => heap(new THREE.TorusGeometry(0.04, 0.02, 8, 12, Math.PI), mat({ color: '#d79a4e', roughness: 0.6 }), 12, 0.36, 0.26, 0.97, 123) },
    { x: -0.2, food: () => heap(new THREE.SphereGeometry(0.035, 12, 8), mat({ color: '#e8462e', roughness: 0.4 }), 22, 0.38, 0.26, 0.98, 124) },
    { x: 0.6, food: () => heap(new THREE.IcosahedronGeometry(0.04, 0), mat({ color: '#5f9a3a', roughness: 0.8, flatShading: true }), 26, 0.38, 0.26, 0.98, 125) },
    { x: 1.4, food: () => heap(new THREE.CapsuleGeometry(0.018, 0.08, 4, 8).rotateZ(Math.PI / 2), mat({ color: '#9a4a2a', roughness: 0.5 }), 14, 0.36, 0.24, 0.97, 126) },
    { x: 2.1, food: () => heap(new THREE.SphereGeometry(0.04, 12, 8), mat({ color: '#f2c94c', roughness: 0.4 }), 14, 0.3, 0.24, 0.97, 127, [1, 0.6, 1]) },
  ];
  for (const p of pans) {
    buffet.add(block(0.7, 0.05, 0.4, METALS.chrome(), p.x, 0.9, 0.05));
    const food = p.food();
    food.position.x = p.x;
    food.position.z = 0.05;
    buffet.add(food);
  }
  const guard = glassPanel(4.5, 0.5, { opacity: 0.22 });
  guard.position.set(0, 1.35, 0.32);
  guard.rotation.x = -0.5;
  buffet.add(guard);
  for (const x of [-2.2, 2.2]) buffet.add(block(0.04, 0.75, 0.04, gold, x, 0.9, -0.3));
  buffet.add(block(4.5, 0.06, 0.12, gold, 0, 1.62, -0.3));
  for (let i = 0; i < 6; i++) {
    const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 16, 1, true), mat({ color: '#2a2a2a', metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide }));
    lamp.position.set(-1.9 + i * 0.78, 1.55, -0.2);
    buffet.add(lamp);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), glow('#ff5a2a', 2.2));
    bulb.position.set(-1.9 + i * 0.78, 1.5, -0.2);
    buffet.add(bulb);
  }
  group.add(tag(onWall(buffet, 'front', { W, D }, -3.4, 0, 1.0), 'buffet'));
  pointLight(group, [-3.4, 1.8, D / 2 - 1.2], '#ff8a4a', 2.5, 4);

  // Dessert station
  const dessert = new THREE.Group();
  dessert.add(cylinder(0.45, 0.45, 0.04, marble, 0, 0.86, 0, 40));
  dessert.add(cylinder(0.08, 0.2, 0.86, darkWood, 0, 0, 0, 20));
  dessert.add(cylinder(0.04, 0.06, 0.18, gold, 0, 0.9, 0, 16));
  const layers = [['#f6e7d0', 0.17], ['#a35a3a', 0.13], ['#f2d6d9', 0.09]];
  let y = 1.08;
  for (const [c, r] of layers) {
    dessert.add(cylinder(r + 0.03, r + 0.03, 0.01, gold, 0, y - 0.01, 0, 28));
    dessert.add(cylinder(r, r, 0.09, mat({ color: c, roughness: 0.6 }), 0, y, 0, 28));
    y += 0.12;
  }
  const sweets = heap(new THREE.SphereGeometry(0.03, 10, 8), mat({ color: '#d8476a', roughness: 0.5 }), 10, 0.5, 0.5, 0.92, 128);
  dessert.add(sweets);
  group.add(tag(at(dessert, 0.6, 0, 4.2), 'dessert'));

  // Host stand and entrance
  const host = new THREE.Group();
  host.add(block(0.7, 1.1, 0.45, darkWood, 0, 0, 0));
  host.add(block(0.75, 0.04, 0.5, gold, 0, 1.1, 0));
  host.add(block(0.3, 0.02, 0.22, mat({ color: '#1f1f1f' }), 0.05, 1.14, 0.05));
  host.add(at(F.tableLamp({ base: gold, light: 0, height: 0.35 }), -0.22, 1.14, -0.08));
  group.add(tag(at(host, 3.9, 0, 4.3, Math.PI), 'host'));
  group.add(onWall(F.door({ wood: darkWood, handle: gold, frameMat: mat({ color: '#2e2219' }), w: 1.2, h: 2.3 }), 'front', { W, D }, 5.4, 0, 0));

  // Decorative lighting and plants
  const chandelier = F.chandelier({ metal: gold, light: 9, drop: 0.8, radius: 0.6 });
  chandelier.position.set(-0.6, H, -1.8);
  group.add(chandelier);
  for (const [x, z] of tableSpots) {
    const p = F.pendant({ metal: gold, light: 0, drop: 1.0 });
    p.position.set(x, H, z);
    group.add(p);
  }
  for (const x of [-1.6, 1.8]) group.add(onWall(F.wallSconce({ metal: gold, light: 0 }), 'front', { W, D }, x, 2.0, 0));
  for (const [x, z] of [[-6.4, 4.8], [6.4, 4.8], [-6.4, -5.12], [6.4, -5.12]]) group.add(at(F.plant({ pot: darkWood, scale: 1.7 }), x, 0, z));

  hemi(group, '#ffe2bf', '#5a3a26', 0.5);
  addSun(group, { color: '#ffae6b', intensity: 2.4, position: [-3, 4.2, -16], target: [0.5, 0, 0], size: 9, near: 1, far: 40 });

  // Candle flicker and the cloche animation
  let clock = 0, clocheOpen = false, busy = false;
  anim.add((dt) => {
    clock += dt;
    flame.emissiveIntensity = 2.3 + Math.sin(clock * 11) * 0.35 + Math.sin(clock * 23.7) * 0.2;
  });
  const toggleCloche = () => {
    if (busy) return;
    busy = true;
    const from = clocheOpen ? 1 : 0, to = 1 - from;
    playOnce(anim, 0.9, (k, e) => {
      const v = from + (to - from) * e;
      cloche.position.set(v * 0.12, v * 0.32, 0);
      cloche.rotation.z = -v * 0.6;
    }, () => { clocheOpen = !clocheOpen; busy = false; });
  };

  const hotspots = [
    {
      id: 'tables', label: 'Window tables', position: [-0.6, 1.4, -3.4],
      title: 'Dining room & window tables', text: 'Linen-dressed round tables by tall windows facing the bay sunset, lit by brass pendants and candles.',
      view: { position: [1.6, 1.7, -0.6], target: [-1.2, 0.8, -3.6] },
    },
    {
      id: 'special', label: 'Chef’s special', position: [-0.6, 1.3, -0.6],
      title: 'Chef’s special of the day', text: 'Today’s sample dish: grilled beef tenderloin with asparagus and calamansi butter. Prices on this site are simulated.',
      view: { position: [0.5, 1.45, 0.5], target: [-0.6, 0.78, -0.6] },
      action: { label: 'Lift the cloche', run: toggleCloche },
    },
    {
      id: 'booths', label: 'Leather booths', position: [-6.3, 1.8, -1.0],
      title: 'Leather booths', text: 'Three tufted green-leather booths for four, each under its own pendant along the gallery wall.',
      view: { position: [-3.6, 1.6, 0.4], target: [-6.4, 0.9, -1.2] },
    },
    {
      id: 'counter', label: 'Bar & espresso', position: [5.4, 1.9, -0.9],
      title: 'Marble bar & espresso counter', text: 'A marble-topped bar with leather stools, pastries under glass domes, a lit back bar and an espresso machine pulling coffee all day.',
      view: { position: [2.4, 1.7, 0.6], target: [5.6, 1.1, -1.0] },
    },
    {
      id: 'buffet', label: 'Breakfast buffet', position: [-3.4, 1.95, D / 2 - 1.0],
      title: 'Breakfast buffet', text: 'Bread rolls, croissants, fresh fruit, salads, sausages and eggs kept warm under heat lamps behind a glass sneeze guard. Breakfast 6:30–10:30 AM (sample hours).',
      view: { position: [-2.6, 1.7, 1.6], target: [-3.4, 0.95, 4.6] },
    },
    {
      id: 'dessert', label: 'Dessert station', position: [0.6, 1.65, 4.2],
      title: 'Dessert station', text: 'A three-tier celebration cake on a marble pedestal with seasonal sweets.',
      view: { position: [1.4, 1.5, 2.6], target: [0.6, 1.0, 4.2] },
    },
    {
      id: 'host', label: 'Host stand', position: [3.9, 1.6, 4.3],
      title: 'Host stand', text: 'Walk-ins are welcome. Dinner reservations are recommended and are handled by the host in this simulation (no online booking).',
      view: { position: [2.6, 1.7, 2.4], target: [4.1, 1.0, 4.4] },
    },
  ];

  return {
    group, hotspots,
    bounds: { W, D, H },
    exposure: 1.0,
    envIntensity: 0.3,
    walkSpeed: 1.9,
    update: anim.update,
    viewpoints: [
      { id: 'entrance', label: 'Entrance', position: [5.6, 1.8, 3.1], target: [-1.8, 0.9, -2.2] },
      { id: 'dining', label: 'Dining room', position: hotspots[0].view.position, target: hotspots[0].view.target },
      { id: 'booths', label: 'Booths', position: hotspots[2].view.position, target: hotspots[2].view.target },
      { id: 'counter', label: 'Bar counter', position: hotspots[3].view.position, target: hotspots[3].view.target },
      { id: 'buffet', label: 'Buffet', position: hotspots[4].view.position, target: hotspots[4].view.target },
      { id: 'window', label: 'Window seat', position: [-3.9, 1.25, -2.7], target: [-3.0, 1.3, -5.5] },
    ],
  };
}
