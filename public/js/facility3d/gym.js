// Fitness centre: cardio row facing a bay-view window, free weights by a
// mirror wall, cable machines, a power rack and a stretching zone.
import {
  THREE, T, F, mat, block, soft, cylinder, METALS, buildShell, onWall, at, addSun,
  tag, glow, hemi, pointLight, ledBar, animator, liveScreen, screen, signTexture, rubber, towelStack,
} from './kit.js';

const W = 14, D = 10, H = 3.4;

// ---------- equipment (users face -Z) ----------

function treadmill({ frame, accent, belt, display }) {
  const g = new THREE.Group();
  g.add(block(0.85, 0.16, 1.9, frame, 0, 0, 0));
  const beltMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.62), belt);
  beltMesh.rotation.x = -Math.PI / 2;
  beltMesh.position.set(0, 0.165, 0.08);
  beltMesh.receiveShadow = true;
  g.add(beltMesh);
  for (const s of [-1, 1]) g.add(block(0.13, 0.03, 1.7, accent, s * 0.36, 0.16, 0.08));
  g.add(soft(0.85, 0.24, 0.32, frame, 0, 0, -0.82, 0.05));
  for (const s of [-1, 1]) {
    const up = block(0.06, 1.12, 0.08, frame, s * 0.36, 0.2, -0.78);
    up.rotation.x = -0.12;
    g.add(up);
    const rail = cylinder(0.018, 0.018, 0.5, METALS.chrome(), s * 0.36, 0, 0, 10);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(s * 0.36, 1.05, -0.48);
    g.add(rail);
  }
  const head = new THREE.Group();
  head.add(soft(0.82, 0.3, 0.1, frame, 0, -0.15, 0, 0.03));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), display);
  scr.position.set(0, 0, 0.052);
  head.add(scr);
  head.position.set(0, 1.32, -0.86);
  head.rotation.x = -0.45;
  g.add(head);
  return { group: g, belt: beltMesh, display };
}

function bike({ frame, accent, seat }) {
  const g = new THREE.Group();
  g.add(block(0.5, 0.05, 1.05, frame, 0, 0, 0));
  const wheel = new THREE.Group();
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 32), METALS.chrome());
  disk.rotation.z = Math.PI / 2;
  disk.castShadow = true;
  wheel.add(disk);
  const spoke = block(0.06, 0.04, 0.5, accent, 0, -0.02, 0);
  wheel.add(spoke);
  wheel.position.set(0, 0.36, -0.32);
  g.add(wheel);
  g.add(block(0.08, 0.06, 0.6, frame, 0, 0.3, -0.05));
  const post = block(0.06, 0.62, 0.06, frame, 0, 0.3, 0.22);
  post.rotation.x = 0.18;
  g.add(post);
  g.add(soft(0.22, 0.07, 0.3, seat, 0, 0.9, 0.3, 0.03));
  const stem = block(0.07, 0.8, 0.07, frame, 0, 0.3, -0.42);
  stem.rotation.x = -0.25;
  g.add(stem);
  const bar = cylinder(0.02, 0.02, 0.5, METALS.chrome(), 0, 0, 0, 10);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 1.08, -0.62);
  g.add(bar);
  g.add(block(0.18, 0.12, 0.04, glow('#5fd0ff', 0.8, { color: '#0d1b24' }), 0, 1.1, -0.6));
  for (const s of [-1, 1]) g.add(block(0.1, 0.02, 0.05, frame, s * 0.16, 0.34, -0.22));
  return { group: g, wheel };
}

function cableMachine({ frame, accent, pad, plates, label }) {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.42, -0.45], [0.42, -0.45], [-0.42, 0.05], [0.42, 0.05]]) g.add(block(0.08, 2.2, 0.08, frame, x, 0, z));
  g.add(block(0.95, 0.1, 0.6, frame, 0, 2.15, -0.2));
  g.add(block(0.95, 0.06, 0.6, frame, 0, 0, -0.2));
  for (let i = 0; i < 14; i++) g.add(block(0.38, 0.04, 0.2, i === 5 ? accent : plates, 0, 0.12 + i * 0.048, -0.3));
  for (const s of [-1, 1]) g.add(cylinder(0.01, 0.01, 1.95, METALS.chrome(), s * 0.15, 0.1, -0.3, 8));
  g.add(cylinder(0.004, 0.004, 1.2, mat({ color: '#111' }), 0, 0.9, -0.3, 4));
  const shroud = block(0.6, 1.0, 0.02, mat({ map: label, roughness: 0.5 }), 0, 1.0, -0.52);
  g.add(shroud);
  const bar = cylinder(0.018, 0.018, 1.15, METALS.chrome(), 0, 0, 0, 10);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 1.85, 0.35);
  g.add(bar);
  g.add(cylinder(0.004, 0.004, 0.32, mat({ color: '#111' }), 0, 1.86, 0.35, 4));
  g.add(block(0.08, 0.5, 0.08, frame, 0, 0, 0.55));
  g.add(soft(0.42, 0.08, 0.38, pad, 0, 0.5, 0.55, 0.03));
  for (const s of [-1, 1]) {
    const roller = cylinder(0.06, 0.06, 0.28, pad, 0, 0, 0, 16);
    roller.rotation.z = Math.PI / 2;
    roller.position.set(s * 0.12, 0.78, 0.38);
    g.add(roller);
  }
  return g;
}

function dumbbell(r, len, headMat, handleMat) {
  const g = new THREE.Group();
  const handle = cylinder(0.016, 0.016, len, handleMat, 0, 0, 0, 8);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, 0, 0);
  g.add(handle);
  for (const s of [-1, 1]) {
    const head = cylinder(r, r, r * 1.3, headMat, 0, 0, 0, 6);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 0, s * (len / 2 + r * 0.6));
    g.add(head);
  }
  return g;
}

function dumbbellRack({ frame, head, handle }) {
  const g = new THREE.Group();
  for (const x of [-1.2, 0, 1.2]) g.add(block(0.06, 0.85, 0.55, frame, x, 0, 0));
  g.add(block(2.5, 0.04, 0.32, frame, 0, 0.42, 0.1));
  g.add(block(2.5, 0.04, 0.26, frame, 0, 0.8, -0.1));
  for (let i = 0; i < 7; i++) {
    const r = 0.055 + i * 0.008;
    for (const s of [-1, 1]) {
      const d = dumbbell(r, 0.12, head, handle);
      d.position.set(-1.05 + i * 0.35 + s * 0.08, 0.46 + r, 0.1);
      g.add(d);
    }
  }
  for (let i = 0; i < 8; i++) {
    const r = 0.04 + i * 0.004;
    for (const s of [-1, 1]) {
      const d = dumbbell(r, 0.11, head, handle);
      d.position.set(-1.1 + i * 0.31 + s * 0.065, 0.84 + r, -0.1);
      g.add(d);
    }
  }
  return g;
}

function bench({ frame, pad }) {
  const g = new THREE.Group();
  g.add(block(0.08, 0.06, 1.2, frame, 0, 0, 0));
  for (const z of [-0.5, 0.5]) g.add(block(0.4, 0.05, 0.08, frame, 0, 0, z));
  g.add(block(0.08, 0.36, 0.08, frame, 0, 0.05, 0.25));
  g.add(block(0.08, 0.36, 0.08, frame, 0, 0.05, -0.3));
  g.add(soft(0.3, 0.08, 0.4, pad, 0, 0.42, 0.35, 0.03));
  const back = soft(0.3, 0.08, 0.75, pad, 0, 0, 0, 0.03);
  back.rotation.x = 0.35;
  back.position.set(0, 0.58, -0.2);
  g.add(back);
  return g;
}

function powerRack({ frame, bar, plate }) {
  const g = new THREE.Group();
  for (const x of [-0.6, 0.6]) for (const z of [-0.6, 0.6]) g.add(block(0.08, 2.25, 0.08, frame, x, 0, z));
  for (const z of [-0.6, 0.6]) g.add(block(1.28, 0.08, 0.08, frame, 0, 2.17, z));
  for (const x of [-0.6, 0.6]) g.add(block(0.08, 0.08, 1.28, frame, x, 2.17, 0));
  g.add(block(1.4, 0.03, 1.4, mat({ color: '#3a2c20', roughness: 0.8 }), 0, 0, 0));
  const b = cylinder(0.015, 0.015, 2.1, bar, 0, 0, 0, 10);
  b.rotation.z = Math.PI / 2;
  b.position.set(0, 1.35, 0.6);
  g.add(b);
  for (const s of [-1, 1]) for (const [off, r] of [[0.82, 0.22], [0.88, 0.18]]) {
    const p = cylinder(r, r, 0.045, plate, 0, 0, 0, 32);
    p.rotation.z = Math.PI / 2;
    p.position.set(s * off, 1.35, 0.6);
    g.add(p);
  }
  return g;
}

function kettlebell(r, material) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), material);
  ball.position.y = r;
  ball.castShadow = true;
  g.add(ball);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(r * 0.6, r * 0.14, 8, 20, Math.PI), material);
  handle.position.y = r * 1.75;
  g.add(handle);
  return g;
}

// ---------- scene ----------

export default function build() {
  const group = new THREE.Group();
  const anim = animator();
  const steel = mat({ color: '#2c2f33', metalness: 0.6, roughness: 0.35 });
  const gold = METALS.gold();
  const accent = mat({ color: '#b08d59', metalness: 0.4, roughness: 0.4 });
  const padMat = mat({ map: T.fabric('#1c1c1e', { seed: 71 }), roughness: 0.6 });
  const trim = mat({ color: '#e8e5df', roughness: 0.6 });

  group.add(buildShell({
    W, D, H,
    floorMat: mat({ map: rubber('#26282b', { repeat: [W / 1.5, D / 1.5] }), roughness: 0.9 }),
    wallMat: mat({ map: T.wallpaper('#dcd8d1', { seed: 72, stripe: 0, repeat: [1, 1] }), roughness: 0.9 }),
    ceilingMat: mat({ color: '#f2f0ec', roughness: 0.95 }),
    trimMat: trim,
    walls: { back: { openings: [{ center: 0, width: 10.4, sill: 0.25, height: 2.75, panes: 6 }] } },
    windowStyle: {
      frame: mat({ color: '#2a2a2a', metalness: 0.5, roughness: 0.4 }),
      glass: mat({ color: '#dfeaf0', roughness: 0.03, transparent: true, opacity: 0.1, depthWrite: false }),
      view: new THREE.MeshBasicMaterial({ map: T.viewTexture('bay'), toneMapped: false, color: '#e8e8e8' }),
    },
  }));

  // Cardio row facing the window
  const display = glow('#3fc3ff', 0.6, { color: '#06131b' });
  const beltTex = rubber('#1b1c1e', { repeat: [1, 3], seed: 77 });
  const treadmills = [];
  for (const x of [-4.4, -3.2, -2.0, -0.8]) {
    const t = treadmill({ frame: steel, accent, belt: mat({ map: beltTex, roughness: 0.9 }), display });
    group.add(tag(at(t.group, x, 0, -3.35), 'cardio'));
    treadmills.push(t);
  }
  const wheels = [];
  for (const x of [0.9, 1.9, 2.9, 3.9]) {
    const b = bike({ frame: steel, accent, seat: padMat });
    group.add(tag(at(b.group, x, 0, -3.55), 'bikes'));
    wheels.push(b.wheel);
  }

  // Free weights by the mirror wall
  const mirrorMat = mat({ color: '#e4ecf0', metalness: 1, roughness: 0.06, envMapIntensity: 2.4 });
  for (const z of [-2.6, -1.3, 0, 1.3, 2.6, 3.9]) {
    const m = F.mirror({ w: 1.22, h: 2.1, frame: steel });
    m.children[1].material.dispose();
    m.children[1].material = mirrorMat;
    group.add(onWall(m, 'left', { W, D }, z, 1.35, 0.02));
  }
  group.add(tag(onWall(dumbbellRack({ frame: steel, head: mat({ color: '#1d1d1f', roughness: 0.5 }), handle: METALS.chrome() }), 'left', { W, D }, 0.6, 0, 0.45), 'weights'));
  for (const z of [-1.4, 2.6]) group.add(tag(at(bench({ frame: steel, pad: padMat }), -4.6, 0, z, -Math.PI / 2), 'weights'));
  group.add(tag(at(powerRack({ frame: steel, bar: METALS.chrome(), plate: mat({ color: '#151515', roughness: 0.6 }) }), -5.6, 0, 3.6), 'rack'));
  [0.08, 0.1, 0.12, 0.14].forEach((r, i) => group.add(at(kettlebell(r, mat({ color: ['#2d2d2d', '#3c4a3a', '#5a3b2e', '#2e3b55'][i], roughness: 0.5 })), -4.5 + i * 0.4, 0, 4.4)));

  // Cable machines on the right wall
  const shroud = signTexture('HARAYA', { width: 512, height: 512, bg: '#1d1f22', color: '#c9a46a', font: '600 90px "Segoe UI", Arial' });
  for (const z of [-1.1, 1.3]) group.add(tag(onWall(cableMachine({ frame: steel, accent: gold, pad: padMat, plates: mat({ color: '#111', roughness: 0.5 }), label: shroud }), 'right', { W, D }, z, 0, 0.75), 'cables'));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.55), mat({ map: signTexture('HARAYA FITNESS', { width: 2048, height: 256, font: '300 150px "Segoe UI", Arial' }), transparent: true, emissive: '#c9a46a', emissiveIntensity: 0.25 }));
  group.add(onWall(sign, 'right', { W, D }, 0.1, 2.75, 0.02));

  // Stretching zone
  ['#5f7466', '#b08d59', '#2e3b55', '#8c5a3c'].forEach((c, i) => {
    group.add(tag(at(soft(0.62, 0.012, 1.8, mat({ color: c, roughness: 0.9 }), 0, 0, 0, 0.005), -1.6 + i * 0.95, 0, 2.6), 'stretch'));
  });
  for (const [x, z, r, c] of [[2.6, 3.4, 0.33, '#c9a46a'], [3.3, 3.8, 0.28, '#5f7466']]) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), mat({ color: c, roughness: 0.35 }));
    ball.position.set(x, r, z);
    ball.castShadow = true;
    group.add(tag(ball, 'stretch'));
  }
  for (let i = 0; i < 3; i++) {
    const roller = cylinder(0.075, 0.075, 0.6, mat({ color: '#222', roughness: 0.8 }), 0, 0, 0, 16);
    roller.rotation.x = Math.PI / 2;
    roller.position.set(2.3 + i * 0.2, 0.075, 2.2);
    group.add(roller);
  }

  // Front wall: entrance, towels, water and class screens
  group.add(onWall(F.door({ wood: mat({ color: '#2b2b2b', roughness: 0.4 }), handle: gold, frameMat: steel, w: 1.0 }), 'front', { W, D }, 5.6, 0, 0));
  const shelf = new THREE.Group();
  shelf.add(block(1.2, 0.9, 0.45, mat({ map: T.woodGrain('#6e4f35', { seed: 73 }) }), 0, 0, 0));
  for (const x of [-0.35, 0.05, 0.42]) { const s = towelStack('#f4f1ea', 4); s.position.set(x, 0.9, 0); shelf.add(s); }
  group.add(onWall(shelf, 'front', { W, D }, 3.6, 0, 0.25));
  const cooler = new THREE.Group();
  cooler.add(block(0.32, 1.0, 0.32, mat({ color: '#e9e9e9', roughness: 0.4 }), 0, 0, 0));
  cooler.add(cylinder(0.13, 0.13, 0.4, mat({ color: '#9fd3ef', transparent: true, opacity: 0.6, roughness: 0.1 }), 0, 1.0, 0));
  group.add(onWall(cooler, 'front', { W, D }, 2.4, 0, 0.2));
  const classScreen = liveScreen((ctx, w, h, t) => {
    ctx.fillStyle = '#10161d'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c9a46a'; ctx.font = '600 18px "Segoe UI", Arial'; ctx.fillText('HARAYA FIT · HIIT 20', 12, 26);
    for (let i = 0; i < 14; i++) {
      const v = (Math.sin(t * 3 + i * 0.7) * 0.5 + 0.5) * 70 + 10;
      ctx.fillStyle = i % 2 ? '#3fc3ff' : '#5f7466';
      ctx.fillRect(14 + i * 16, h - 18 - v, 11, v);
    }
    ctx.fillStyle = '#fff'; ctx.font = '600 14px "Segoe UI", Arial';
    ctx.fillText(`${String(19 - Math.floor(t / 60) % 20).padStart(2, '0')}:${String(59 - Math.floor(t) % 60).padStart(2, '0')}`, w - 60, 26);
  });
  for (const x of [-2.2, 0.6]) group.add(onWall(screen(1.5, classScreen.texture), 'front', { W, D }, x, 2.0, 0.03));

  // Lighting
  for (const z of [-2.8, 0, 2.8]) for (const x of [-4.5, 0, 4.5]) { const l = ledBar(2.4); l.position.set(x, H, z); group.add(l); }
  hemi(group, '#ffffff', '#5a5148', 0.7);
  addSun(group, { color: '#fff1dc', intensity: 2.6, position: [3, 7, -14], target: [0, 0, 0], size: 9 });
  pointLight(group, [0, 3.0, 0.5], '#fff3e0', 10, 12);
  pointLight(group, [-4.5, 3.0, 1], '#fff3e0', 6, 9);

  // Interactions
  let clock = 0, treadmillUntil = 0, bikeUntil = 0;
  anim.add((dt) => {
    clock += dt;
    classScreen.update(clock);
    if (clock < treadmillUntil) { beltTex.offset.y -= dt * 1.4; display.emissiveIntensity = 1.6; } else display.emissiveIntensity = 0.6;
    if (clock < bikeUntil) for (const w of wheels) w.rotation.x -= dt * 9;
  });

  const hotspots = [
    {
      id: 'cardio', label: 'Treadmills', position: [-2.6, 1.9, -3.3],
      title: 'Cardio row', text: 'Four treadmills face the floor-to-ceiling window overlooking Manila Bay. Touch consoles show speed, incline (0–15%) and heart rate.',
      view: { position: [-0.6, 1.7, -0.6], target: [-2.8, 0.9, -3.6] },
      action: { label: 'Start a treadmill', run: () => { treadmillUntil = clock + 8; } },
    },
    {
      id: 'bikes', label: 'Spin bikes', position: [2.4, 1.6, -3.5],
      title: 'Spin bikes', text: 'Four studio bikes with magnetic resistance and backlit consoles. Join the simulated 7:00 AM spin class or ride at your own pace.',
      view: { position: [3.6, 1.6, -0.9], target: [2.2, 0.8, -3.7] },
      action: { label: 'Spin the flywheels', run: () => { bikeUntil = clock + 6; } },
    },
    {
      id: 'weights', label: 'Free weights', position: [-6.3, 1.4, 0.6],
      title: 'Free weights & benches', text: 'Hex dumbbells from 2.5 kg to 30 kg on a two-tier rack, adjustable benches and a full mirror wall for checking your form.',
      view: { position: [-2.8, 1.6, 1.4], target: [-6.4, 0.8, 0.3] },
    },
    {
      id: 'rack', label: 'Power rack', position: [-5.6, 2.5, 3.6],
      title: 'Power rack', text: 'A steel squat rack with an Olympic barbell, bumper plates and a lifting platform. Kettlebells from 8 kg to 20 kg sit alongside.',
      view: { position: [-3.2, 1.7, 2.0], target: [-5.6, 1.1, 3.7] },
    },
    {
      id: 'cables', label: 'Cable machines', position: [6.0, 2.5, 0.1],
      title: 'Cable machines', text: 'Two selectorised cable stations for lat pull-downs, rows and leg work. Each has a 14-plate weight stack.',
      view: { position: [3.2, 1.7, 0.2], target: [6.3, 1.1, 0.1] },
    },
    {
      id: 'stretch', label: 'Stretch zone', position: [0, 0.9, 2.6],
      title: 'Stretching & mobility zone', text: 'Yoga mats, stability balls and foam rollers next to screens showing simulated on-demand classes.',
      view: { position: [0.2, 1.8, -0.4], target: [0.3, 0.3, 2.8] },
    },
  ];

  return {
    group, hotspots,
    bounds: { W, D, H },
    exposure: 1.0,
    envIntensity: 0.4,
    walkSpeed: 1.9,
    update: anim.update,
    viewpoints: [
      { id: 'entrance', label: 'Entrance', position: [5.2, 2.1, 4.2], target: [-1.5, 0.8, -1.5] },
      { id: 'cardio', label: 'Cardio row', position: hotspots[0].view.position, target: hotspots[0].view.target },
      { id: 'weights', label: 'Free weights', position: hotspots[2].view.position, target: hotspots[2].view.target },
      { id: 'cables', label: 'Machines', position: hotspots[4].view.position, target: hotspots[4].view.target },
      { id: 'stretch', label: 'Stretch zone', position: hotspots[5].view.position, target: hotspots[5].view.target },
      { id: 'window', label: 'Bay window', position: [0.5, 1.6, 0.8], target: [0.2, 1.4, -5] },
    ],
  };
}
