// Rooftop pool deck: sunken mosaic pool with animated water and caustics,
// loungers under umbrellas, palms, a pool bar and a glass balustrade facing
// the bay.
import {
  THREE, T, F, mat, block, soft, cylinder, METALS, at, addSun,
  tag, glow, hemi, animator, tiles, waterNormals, caustics, signTexture, canvasTexture,
  glassPanel, towelStack, rolledTowel, skyDome, bottleRow, leafTexture, palm,
} from './kit.js';

const W = 22, D = 16, H = 7;
const P = { x0: -6, x1: 6, z0: -2.6, z1: 1.4, depth: 1.4 };
const PW = P.x1 - P.x0, PD = P.z1 - P.z0, PCX = (P.x0 + P.x1) / 2, PCZ = (P.z0 + P.z1) / 2;

const repeatClone = (tex, x, y) => { const t = tex.clone(); t.repeat.set(x, y); t.needsUpdate = true; return t; };

function lounger({ teak, cushion }) {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.3, -0.85], [0.3, -0.85], [-0.3, 0.85], [0.3, 0.85]]) g.add(block(0.06, 0.25, 0.06, teak, x, 0, z));
  g.add(block(0.7, 0.07, 1.95, teak, 0, 0.25, 0));
  g.add(soft(0.64, 0.08, 1.25, cushion, 0, 0.32, -0.33, 0.035));
  const back = new THREE.Group();
  back.add(block(0.66, 0.04, 0.72, teak, 0, -0.03, 0.36));
  back.add(soft(0.64, 0.08, 0.72, cushion, 0, 0.01, 0.36, 0.035));
  back.position.set(0, 0.36, 0.3);
  back.rotation.x = -0.75;
  g.add(back);
  const towel = rolledTowel('#f2ede3');
  towel.position.set(0, 0.47, -0.85);
  g.add(towel);
  return g;
}

function umbrella(fabricMat, pole) {
  const g = new THREE.Group();
  g.add(cylinder(0.25, 0.28, 0.08, mat({ color: '#3a3a3a', roughness: 0.6 }), 0, 0, 0, 20));
  g.add(cylinder(0.025, 0.025, 2.55, pole, 0, 0.08, 0, 10));
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.5, 8, 1, true), fabricMat);
  canopy.position.y = 2.42;
  canopy.castShadow = true;
  g.add(canopy);
  const valance = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.14, 8, 1, true), fabricMat);
  valance.position.y = 2.1;
  valance.castShadow = true;
  g.add(valance);
  g.add(cylinder(0.04, 0.02, 0.1, pole, 0, 2.66, 0, 10));
  return g;
}

function planter(size, stone) {
  const g = new THREE.Group();
  g.add(block(size, 0.55, size, stone, 0, 0, 0));
  g.add(block(size - 0.1, 0.02, size - 0.1, mat({ color: '#4a3a2a', roughness: 1 }), 0, 0.55, 0));
  return g;
}

export default function build() {
  const group = new THREE.Group();
  const anim = animator();
  const teak = mat({ map: T.woodGrain('#8a5a35', { seed: 81 }), roughness: 0.6 });
  const stone = mat({ map: tiles('#e2d6c0', '#d2c4aa', { count: 2, seed: 82, vary: 0.05 }), roughness: 0.8 });
  const chrome = METALS.chrome();
  const cushion = mat({ map: T.fabric('#f5f1e8', { seed: 83 }), roughness: 0.95 });

  group.add(skyDome({ top: '#4f86c0', horizon: '#e9dccb' }));

  // Travertine deck with a hole for the pool (shape UVs are in metres)
  const deckShape = new THREE.Shape();
  deckShape.moveTo(-W / 2, -D / 2); deckShape.lineTo(W / 2, -D / 2); deckShape.lineTo(W / 2, D / 2); deckShape.lineTo(-W / 2, D / 2); deckShape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(P.x0, -P.z1); hole.lineTo(P.x1, -P.z1); hole.lineTo(P.x1, -P.z0); hole.lineTo(P.x0, -P.z0); hole.closePath();
  deckShape.holes.push(hole);
  const deckTex = tiles('#ddd0b8', '#c9b99c', { count: 2, seed: 84, vary: 0.07 });
  deckTex.repeat.set(1 / 1.2, 1 / 1.2);
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(deckShape), mat({ map: deckTex, roughness: 0.85 }));
  deck.rotation.x = -Math.PI / 2;
  deck.receiveShadow = true;
  group.add(deck);
  for (const [w, d, x, z] of [[W + 0.3, 0.3, 0, D / 2 + 0.15], [W + 0.3, 0.3, 0, -D / 2 - 0.15], [0.3, D, -W / 2 - 0.15, 0], [0.3, D, W / 2 + 0.15, 0]]) {
    group.add(block(w, 0.8, d, stone, x, -0.8, z));
  }

  // Pool basin
  const mosaic = tiles('#2f8fb5', '#e7f2f5', { count: 12, seed: 85, vary: 0.18 });
  const tileMat = (x, y) => mat({ map: repeatClone(mosaic, x, y), roughness: 0.35 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), tileMat(PW, PD));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(PCX, -P.depth, PCZ);
  floor.receiveShadow = true;
  const basin = new THREE.Group();
  basin.add(floor);
  const band = tiles('#1d4f6b', '#d9e6ea', { count: 12, seed: 86, vary: 0.1 });
  for (const [len, x, z, ry] of [[PW, PCX, P.z0, 0], [PW, PCX, P.z1, Math.PI], [PD, P.x0, PCZ, Math.PI / 2], [PD, P.x1, PCZ, -Math.PI / 2]]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, P.depth), tileMat(len, P.depth));
    wall.position.set(x, -P.depth / 2, z);
    wall.rotation.y = ry;
    wall.receiveShadow = true;
    basin.add(wall);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.16), mat({ map: repeatClone(band, len, 0.16), roughness: 0.3 }));
    strip.position.set(x, -0.08, z);
    strip.rotation.y = ry;
    strip.translateZ(0.003);
    basin.add(strip);
  }
  // Entry steps at the shallow end
  const stepMat = tileMat(1, 1);
  for (let i = 0; i < 3; i++) basin.add(block(0.42, P.depth - 0.35 * (i + 1), PD, stepMat, P.x0 + 0.21 + i * 0.42, -P.depth, PCZ));
  // Coping
  basin.add(block(PW + 0.7, 0.05, 0.35, stone, PCX, 0, P.z0 - 0.125));
  basin.add(block(PW + 0.7, 0.05, 0.35, stone, PCX, 0, P.z1 + 0.125));
  basin.add(block(0.35, 0.05, PD, stone, P.x0 - 0.125, 0, PCZ));
  basin.add(block(0.35, 0.05, PD, stone, P.x1 + 0.125, 0, PCZ));
  // Ladder
  for (const s of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([[0.45, 0.02], [0.38, 0.75], [0.15, 0.9], [-0.08, 0.7], [-0.12, -0.2], [-0.12, -1.0]].map(([z, y]) => new THREE.Vector3(s * 0.24, y, z)));
    basin.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.022, 8), chrome));
  }
  for (const y of [-0.3, -0.62, -0.94]) basin.add(block(0.5, 0.03, 0.08, chrome, 0, y, -0.12));
  const ladderAt = new THREE.Vector3(4.6, 0, P.z1);
  basin.children.slice(-5).forEach((m) => m.position.add(ladderAt));
  // Rail down the steps
  const rail = new THREE.CatmullRomCurve3([[P.x0 - 0.3, 0.9], [P.x0 + 0.1, 0.85], [P.x0 + 1.25, -0.25]].map(([x, y]) => new THREE.Vector3(x, y, P.z1 - 0.35)));
  basin.add(new THREE.Mesh(new THREE.TubeGeometry(rail, 30, 0.022, 8), chrome));
  basin.add(cylinder(0.022, 0.022, 0.9, chrome, P.x0 - 0.3, 0, P.z1 - 0.35, 8));
  basin.add(cylinder(0.022, 0.022, 0.8, chrome, P.x0 + 1.25, -1.05, P.z1 - 0.35, 8));
  group.add(tag(basin, 'pool'));

  // Underwater lights
  const lampMat = glow('#a8f0ff', 2.2, { color: '#dffaff' });
  const lamps = [];
  for (const x of [-4, 0, 4]) for (const [z, ry] of [[P.z0 + 0.005, 0], [P.z1 - 0.005, Math.PI]]) {
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.12, 20), lampMat);
    lamp.position.set(x, -0.85, z);
    lamp.rotation.y = ry;
    group.add(lamp);
  }
  for (const x of [-3, 3]) {
    const l = new THREE.PointLight('#7fe3ff', 5, 8, 2);
    l.position.set(x, -0.9, PCZ);
    group.add(l);
    lamps.push(l);
  }

  // Caustics and water
  const causticTex = caustics({ repeat: [PW / 2.2, PD / 2.2] });
  const causticTex2 = repeatClone(causticTex, PW / 3.1, PD / 3.1);
  for (const [tex, y, op] of [[causticTex, -P.depth + 0.01, 0.35], [causticTex2, -P.depth + 0.015, 0.25]]) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), new THREE.MeshBasicMaterial({ map: tex, color: '#9fe6ff', transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
    c.rotation.x = -Math.PI / 2;
    c.position.set(PCX, y, PCZ);
    c.userData.noPick = true;
    group.add(c);
  }
  const normals = waterNormals({ repeat: [PW / 3, PD / 3] });
  const normals2 = repeatClone(normals, PW / 5, PD / 5);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), new THREE.MeshPhysicalMaterial({
    color: '#38b3d1', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.62, depthWrite: false,
    normalMap: normals, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 1, clearcoatNormalMap: normals2,
    clearcoatNormalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 1.8,
  }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(PCX, -0.12, PCZ);
  group.add(tag(water, 'pool'));

  // Loungers and umbrellas along the south deck
  const canvasMat = mat({ map: T.fabric('#efe6d4', { seed: 87, repeat: [4, 4] }), roughness: 0.95, side: THREE.DoubleSide });
  const sideTable = (x, z) => {
    const t = new THREE.Group();
    t.add(cylinder(0.22, 0.22, 0.03, teak, 0, 0.45, 0, 20));
    t.add(cylinder(0.03, 0.05, 0.45, teak, 0, 0, 0, 10));
    const glass = mat({ color: '#ffb347', transparent: true, opacity: 0.85, roughness: 0.1 });
    t.add(cylinder(0.035, 0.03, 0.12, glass, 0.06, 0.48, 0, 12));
    t.add(cylinder(0.035, 0.03, 0.12, glass, -0.07, 0.48, 0.05, 12));
    return at(t, x, 0, z);
  };
  for (const c of [-7.6, -2.6, 2.4, 7.4]) {
    for (const s of [-1, 1]) group.add(tag(at(lounger({ teak, cushion }), c + s * 0.55, 0, 3.95), 'loungers'));
    group.add(sideTable(c, 4.6));
    group.add(tag(at(umbrella(canvasMat, teak), c, 0, 5.15), 'loungers'));
  }

  // Shaded lounge on the north deck
  const loungeFabric = mat({ map: T.fabric('#e9e2d4', { seed: 88 }), roughness: 0.95 });
  group.add(tag(at(F.sofa({ width: 2.4, fabric: loungeFabric, legsMat: teak, pillows: [mat({ color: '#2e6f8e' }), mat({ color: '#c9a46a' })] }), -2.2, 0, -6.6), 'lounge'));
  group.add(tag(at(F.armchair({ fabric: loungeFabric, legsMat: teak }), -4.3, 0, -5.3, Math.PI / 2), 'lounge'));
  group.add(tag(at(F.armchair({ fabric: loungeFabric, legsMat: teak }), -0.1, 0, -5.3, -Math.PI / 2), 'lounge'));
  group.add(at(F.coffeeTable({ top: teak, legsMat: teak, w: 1.2, d: 0.7 }), -2.2, 0, -5.3));
  group.add(at(F.rug({ w: 4.6, d: 3.2, material: mat({ map: T.carpet('#cfc3ac', { seed: 89, repeat: [3, 2] }), roughness: 1 }) }), -2.2, 0, -5.6));
  const pergola = new THREE.Group();
  for (const [x, z] of [[-4.6, -7.6], [0.2, -7.6], [-4.6, -3.9], [0.2, -3.9]]) pergola.add(block(0.14, 2.8, 0.14, teak, x, 0, z));
  for (const z of [-7.6, -3.9]) pergola.add(block(5.0, 0.18, 0.14, teak, -2.2, 2.8, z));
  for (let i = 0; i < 11; i++) pergola.add(block(0.08, 0.12, 3.9, teak, -4.5 + i * 0.46, 2.98, -5.75));
  group.add(tag(pergola, 'lounge'));

  // Pool bar
  const bar = new THREE.Group();
  const marble = mat({ map: T.marble('#f1ede6', '#b8ad9c', { seed: 90 }), roughness: 0.25 });
  bar.add(block(4.0, 1.0, 0.6, teak, 0, 0, 0));
  bar.add(block(4.2, 0.05, 0.75, marble, 0, 1.0, 0.05));
  bar.add(block(0.6, 1.0, 1.6, teak, 2.3, 0, -0.5));
  bar.add(block(0.75, 0.05, 1.8, marble, 2.3, 1.0, -0.55));
  bar.add(block(4.4, 0.9, 0.5, teak, 0.2, 0, -1.6));
  bar.add(block(4.4, 0.04, 0.5, marble, 0.2, 0.9, -1.6));
  bar.add(block(4.4, 0.04, 0.3, teak, 0.2, 1.45, -1.75));
  const bottles = bottleRow(4.2, { seed: 91 });
  bottles.position.set(0.2, 0.94, -1.65);
  bar.add(bottles);
  const bottles2 = bottleRow(4.2, { seed: 92 });
  bottles2.position.set(0.2, 1.49, -1.75);
  bar.add(bottles2);
  for (const [x, z] of [[-2.2, 0.3], [2.6, 0.3], [-2.2, -1.9], [2.6, -1.9]]) bar.add(block(0.14, 2.9, 0.14, teak, x, 0, z));
  bar.add(block(5.2, 0.12, 2.6, teak, 0.2, 2.9, -0.8));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.4), mat({ map: signTexture('POOL BAR', { width: 1024, height: 200, color: '#f4e7cf', bg: '#3b2b1d', font: '600 110px "Segoe UI", Arial' }), roughness: 0.6 }));
  sign.position.set(0.2, 2.75, 0.32);
  bar.add(sign);
  for (let i = 0; i < 4; i++) bar.add(at(F.barStool({ seat: teak, metal: chrome }), -1.5 + i * 1.0, 0, 0.75));
  group.add(tag(at(bar, 7.6, 0, -5.4), 'bar'));

  // Towel station by the lobby doors
  const towels = new THREE.Group();
  towels.add(block(1.6, 0.95, 0.55, teak, 0, 0, 0));
  for (const x of [-0.5, 0, 0.5]) { const s = towelStack('#f6f3ec', 4); s.position.set(x, 0.95, 0); towels.add(s); }
  towels.add(block(1.6, 1.1, 0.04, teak, 0, 0.95, -0.25));
  const towelSign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), mat({ map: signTexture('TOWELS', { width: 512, height: 128, color: '#3b2b1d', bg: '#f1e6d2', font: '600 76px "Segoe UI", Arial' }) }));
  towelSign.position.set(0, 1.75, -0.225);
  towels.add(towelSign);
  group.add(tag(at(towels, -8.6, 0, -7.3), 'towels'));

  // Hotel facade with lobby glazing
  const facadeTex = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#d9d2c5'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const g = ctx.createLinearGradient(0, y * 64, 0, y * 64 + 50);
      g.addColorStop(0, '#5d7f99'); g.addColorStop(1, '#2c4256');
      ctx.fillStyle = g;
      ctx.fillRect(x * 64 + 6, y * 64 + 8, 52, 46);
    }
  }, { repeat: [4, 0.6] });
  const facade = block(W + 0.6, 16, 1, mat({ map: facadeTex, roughness: 0.6 }), 0, 3.6, -D / 2 - 0.5);
  group.add(facade);
  group.add(block(W + 0.6, 3.6, 1, mat({ color: '#cfc6b6', roughness: 0.7 }), 0, 0, -D / 2 - 0.55));
  const lobby = new THREE.Group();
  const frame = mat({ color: '#2b2b2b', metalness: 0.6, roughness: 0.4 });
  lobby.add(block(8.2, 3.0, 0.05, mat({ color: '#25343f', metalness: 0.6, roughness: 0.08 }), 0, 0, 0));
  for (let i = 0; i <= 6; i++) lobby.add(block(0.06, 3.0, 0.08, frame, -4.1 + i * (8.2 / 6), 0, 0.03));
  lobby.add(block(8.4, 0.08, 0.1, frame, 0, 2.96, 0.03));
  lobby.add(block(9.0, 0.12, 1.6, frame, 0, 3.15, 0.8));
  group.add(at(lobby, -1.2, 0, -D / 2 + 0.03));

  // Glass balustrade on the three open sides
  const balustrade = new THREE.Group();
  const runs = [
    { from: [-W / 2 + 0.15, D / 2 - 0.15], to: [W / 2 - 0.15, D / 2 - 0.15] },
    { from: [-W / 2 + 0.15, -D / 2 + 0.2], to: [-W / 2 + 0.15, D / 2 - 0.15] },
    { from: [W / 2 - 0.15, -D / 2 + 0.2], to: [W / 2 - 0.15, D / 2 - 0.15] },
  ];
  for (const { from, to } of runs) {
    const dx = to[0] - from[0], dz = to[1] - from[1];
    const len = Math.hypot(dx, dz), ang = Math.atan2(-dz, dx);
    const run = new THREE.Group();
    const panels = Math.round(len / 1.8);
    for (let i = 0; i < panels; i++) {
      const p = glassPanel(len / panels - 0.04, 1.05);
      p.position.set(-len / 2 + (len / panels) * (i + 0.5), 0.58, 0);
      run.add(p);
      run.add(block(0.05, 0.08, 0.12, chrome, -len / 2 + (len / panels) * i, 0, 0));
    }
    const top = cylinder(0.03, 0.03, len, chrome, 0, 0, 0, 10);
    top.rotation.z = Math.PI / 2;
    top.position.set(0, 1.13, 0);
    run.add(top);
    run.position.set((from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2);
    run.rotation.y = ang;
    balustrade.add(run);
  }
  group.add(tag(balustrade, 'view'));

  // Palms in planters
  const trunk = mat({ map: T.woodGrain('#7b6248', { seed: 93, repeat: [1, 4] }), roughness: 0.9 });
  const leafMat = mat({ map: leafTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 });
  [[-9.9, 6.9, 4.2], [9.9, 6.9, 4.6], [-9.6, -0.6, 3.8], [9.6, 1.4, 4.0], [-9.8, -5.4, 4.4]].forEach(([x, z, h], i) => {
    group.add(at(planter(1.1, stone), x, 0, z));
    group.add(at(palm(h, trunk, leafMat, 94 + i), x, 0.55, z));
  });

  // Lighting
  hemi(group, '#d7e9ff', '#d9c7a6', 0.85);
  addSun(group, { color: '#fff0d8', intensity: 3.0, position: [-12, 17, 11], target: [0, 0, 0], size: 15, near: 1, far: 60 });

  // Animation: drifting ripples and caustics, toggled pool lights
  let lightsOn = true;
  anim.add((dt) => {
    normals.offset.x += dt * 0.018; normals.offset.y += dt * 0.011;
    normals2.offset.x -= dt * 0.012; normals2.offset.y += dt * 0.016;
    causticTex.offset.x += dt * 0.03; causticTex.offset.y += dt * 0.02;
    causticTex2.offset.x -= dt * 0.025; causticTex2.offset.y += dt * 0.012;
  });

  const hotspots = [
    {
      id: 'pool', label: 'Infinity pool', position: [0, 0.7, PCZ],
      title: 'Rooftop pool', text: 'A 12 × 4 m heated pool, 1.0 m deep at the entry steps and 1.4 m at the ladder end, finished in blue glass mosaic with underwater lighting.',
      view: { position: [3.6, 1.7, 4.6], target: [-0.5, -0.6, PCZ] },
      action: { label: 'Toggle underwater lights', run: () => {
        lightsOn = !lightsOn;
        lampMat.emissiveIntensity = lightsOn ? 2.2 : 0;
        for (const l of lamps) l.intensity = lightsOn ? 5 : 0;
      } },
    },
    {
      id: 'loungers', label: 'Sun loungers', position: [-2.6, 1.4, 3.95],
      title: 'Loungers & umbrellas', text: 'Eight teak loungers with cushions and rolled towels, paired under canvas umbrellas with side tables for drinks. First come, first served (sample rule).',
      view: { position: [-0.4, 1.6, 0.9], target: [-3.6, 0.4, 4.4] },
    },
    {
      id: 'bar', label: 'Pool bar', position: [7.8, 2.2, -5.0],
      title: 'Pool bar', text: 'Fresh juices, mocktails and light snacks served from a marble-topped teak bar under a timber canopy. Charges are simulated only.',
      view: { position: [5.6, 1.7, -1.6], target: [7.8, 1.0, -5.6] },
    },
    {
      id: 'lounge', label: 'Shaded lounge', position: [-2.2, 1.4, -5.6],
      title: 'Shaded lounge', text: 'A pergola-covered seating area with outdoor sofas for guests who prefer the shade.',
      view: { position: [-2.0, 1.7, -1.4], target: [-2.2, 0.6, -6.2] },
    },
    {
      id: 'towels', label: 'Towel station', position: [-8.6, 2.1, -7.3],
      title: 'Towel station', text: 'Collect fresh pool towels and your wristband here. Show your room key card (simulated check).',
      view: { position: [-6.0, 1.7, -4.6], target: [-8.6, 1.0, -7.3] },
    },
    {
      id: 'view', label: 'Bay lookout', position: [0, 1.5, D / 2 - 0.4],
      title: 'Bay lookout', text: 'A frameless glass balustrade keeps the view of Manila Bay open, with the best seats in the house at sunset.',
      view: { position: [0.5, 1.65, 5.6], target: [0, 1.3, 7.9] },
    },
  ];

  return {
    group, hotspots,
    bounds: { W, D, H },
    exposure: 0.8,
    envIntensity: 0.7,
    walkSpeed: 2.6,
    update: anim.update,
    viewpoints: [
      { id: 'overview', label: 'Overview', position: [9.6, 4.4, 7.4], target: [-1, -0.3, -1.2] },
      { id: 'poolside', label: 'Poolside', position: [-4.2, 1.6, 2.6], target: [2.5, -0.5, -1.2] },
      { id: 'loungers', label: 'Loungers', position: hotspots[1].view.position, target: hotspots[1].view.target },
      { id: 'water', label: 'Water level', position: [-5.4, 0.3, 1.95], target: [3.5, -0.15, -1.4] },
      { id: 'bar', label: 'Pool bar', position: hotspots[2].view.position, target: hotspots[2].view.target },
      { id: 'lookout', label: 'Bay lookout', position: hotspots[5].view.position, target: hotspots[5].view.target },
    ],
  };
}
