// Finnish sauna: cedar boards, L-shaped two-tier benches, a stone heater
// with a steam ("löyly") effect, bucket and ladle, dials and warm light.
import {
  THREE, T, mat, block, soft, cylinder, METALS, buildShell, onWall, at, addSun,
  tag, glow, hemi, pointLight, animator, canvasTexture, tiles, rolledTowel,
} from './kit.js';

const W = 4.2, D = 3.4, H = 2.4;

function cedar(seed, repeat = [1, 1], base = '#b97c49') {
  return canvasTexture(512, 512, (ctx, S) => {
    const r = T.rng(seed);
    const boards = 6, h = S / boards;
    for (let i = 0; i < boards; i++) {
      ctx.fillStyle = T.shade(base, (r() - 0.5) * 0.2);
      ctx.fillRect(0, i * h, S, h);
      for (let k = 0; k < 26; k++) {
        ctx.strokeStyle = `rgba(90,45,15,${0.06 + r() * 0.12})`;
        ctx.lineWidth = 1 + r() * 1.5;
        const y = i * h + 4 + r() * (h - 8);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(S * 0.3, y + (r() - 0.5) * 8, S * 0.7, y + (r() - 0.5) * 8, S, y);
        ctx.stroke();
      }
      if (r() > 0.5) {
        ctx.fillStyle = 'rgba(80,40,15,0.35)';
        ctx.beginPath();
        ctx.ellipse(r() * S, i * h + h / 2, 6 + r() * 6, 3 + r() * 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(45,22,8,0.6)';
      ctx.fillRect(0, i * h, S, 3);
    }
    T.addNoise(ctx, S, S, 10, r);
  }, { repeat });
}

/** Slatted bench top running along local X (origin at the floor, front edge at +depth/2). */
function bench(length, depth, height, wood, dark) {
  const g = new THREE.Group();
  const slats = Math.floor(depth / 0.11);
  for (let i = 0; i < slats; i++) g.add(block(length, 0.035, 0.09, wood, 0, height - 0.035, -depth / 2 + 0.055 + i * (depth / slats)));
  g.add(block(length, height - 0.04, 0.025, wood, 0, 0, depth / 2 - 0.02));
  g.add(block(length - 0.02, height - 0.06, depth - 0.06, dark, 0, 0, 0));
  return g;
}

function dial(label, value, max) {
  return canvasTexture(256, 256, (ctx, S) => {
    ctx.fillStyle = '#f3ead8'; ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 6; ctx.stroke();
    ctx.lineWidth = 3;
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      ctx.beginPath();
      ctx.moveTo(S / 2 + Math.cos(a) * 92, S / 2 + Math.sin(a) * 92);
      ctx.lineTo(S / 2 + Math.cos(a) * 108, S / 2 + Math.sin(a) * 108);
      ctx.stroke();
    }
    ctx.fillStyle = '#3a2614'; ctx.font = '600 34px "Segoe UI", Arial'; ctx.textAlign = 'center';
    ctx.fillText(label, S / 2, S / 2 + 62);
    const a = Math.PI * 0.75 + (value / max) * Math.PI * 1.5;
    ctx.strokeStyle = '#a3261c'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(S / 2, S / 2); ctx.lineTo(S / 2 + Math.cos(a) * 88, S / 2 + Math.sin(a) * 88); ctx.stroke();
    ctx.fillStyle = '#3a2614'; ctx.beginPath(); ctx.arc(S / 2, S / 2, 9, 0, Math.PI * 2); ctx.fill();
  });
}

function steamSprite() {
  return canvasTexture(64, 64, (ctx, S) => {
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  });
}

export default function build() {
  const group = new THREE.Group();
  const anim = animator();
  const wood = mat({ map: cedar(101, [1, 1]), roughness: 0.75 });
  const benchWood = mat({ map: cedar(102, [1, 1], '#d0a070'), roughness: 0.7 });
  const dark = mat({ color: '#2a1a10', roughness: 0.9 });
  const steel = mat({ color: '#9aa0a6', metalness: 0.8, roughness: 0.35 });

  // Shell: cedar walls and ceiling, slate floor, glass door in the front wall
  const corridor = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3b2f27'); g.addColorStop(0.6, '#5a4636'); g.addColorStop(1, '#2a221d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,214,160,0.55)';
    for (const x of [40, 128, 216]) { ctx.beginPath(); ctx.arc(x, 30, 10, 0, Math.PI * 2); ctx.fill(); }
  });
  group.add(buildShell({
    W, D, H,
    floorMat: mat({ map: tiles('#4a4541', '#2f2b28', { count: 4, seed: 103, repeat: [W / 1.2, D / 1.2] }), roughness: 0.8 }),
    wallMat: wood,
    ceilingMat: mat({ map: cedar(104, [W / 0.9, D / 0.9]), roughness: 0.8 }),
    trimMat: mat({ color: '#6d4424', roughness: 0.7 }),
    tile: 0.9,
    walls: { front: { openings: [{ center: -1.15, width: 0.8, sill: 0, height: 2.0, panes: 1 }] } },
    windowStyle: {
      frame: mat({ color: '#7a4a26', roughness: 0.6 }),
      glass: mat({ color: '#8a6a4a', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.35, depthWrite: false }),
      view: new THREE.MeshBasicMaterial({ map: corridor, toneMapped: false }),
    },
  }));
  const handle = block(0.035, 0.6, 0.05, mat({ color: '#6d4424', roughness: 0.5 }), 0, 0, 0);
  group.add(at(handle, 1.15 - 0.3, 0.75, D / 2 + 0.035));

  // L-shaped two-tier benches
  const benches = new THREE.Group();
  benches.add(at(bench(W, 0.6, 0.95, benchWood, dark), 0, 0, -D / 2 + 0.3));
  benches.add(at(bench(3.6, 0.5, 0.5, benchWood, dark), 0.3, 0, -D / 2 + 0.85));
  group.add(tag(benches, 'upper'));
  const upperLeft = bench(2.3, 0.6, 0.95, benchWood, dark);
  upperLeft.rotation.y = Math.PI / 2;
  upperLeft.position.set(-W / 2 + 0.3, 0, 0.05);
  group.add(tag(upperLeft, 'upper'));
  const lowerLeft = bench(1.8, 0.5, 0.5, benchWood, dark);
  lowerLeft.rotation.y = Math.PI / 2;
  lowerLeft.position.set(-W / 2 + 0.85, 0, 0.3);
  group.add(tag(lowerLeft, 'lower'));
  benches.children[1].userData.hotspot = 'lower';
  // Backrest battens
  for (const y of [1.15, 1.32, 1.49]) {
    group.add(block(W - 0.02, 0.07, 0.03, benchWood, 0, y, -D / 2 + 0.03));
    const side = block(0.03, 0.07, 2.9, benchWood, -W / 2 + 0.03, y, -0.25);
    group.add(side);
  }
  // Warm LED strips under the upper tier
  const led = glow('#ff9a3c', 1.8, { color: '#ffcf9a' });
  group.add(block(W - 0.1, 0.015, 0.02, led, 0, 0.87, -D / 2 + 0.61));
  group.add(block(0.02, 0.015, 2.2, led, -W / 2 + 0.61, 0.87, 0.05));
  pointLight(group, [0.2, 0.6, -0.9], '#ff9d4d', 1.2, 3);

  // Duckboards on the floor
  for (const [x, z, w, d] of [[0.15, 0.35, 2.1, 1.5]]) {
    const mat2 = new THREE.Group();
    for (let i = 0; i < Math.floor(w / 0.1); i++) mat2.add(block(0.07, 0.025, d, benchWood, -w / 2 + 0.05 + i * 0.1, 0.012, 0));
    for (const zz of [-d / 2 + 0.1, d / 2 - 0.1]) mat2.add(block(w, 0.012, 0.05, dark, 0, 0, zz));
    group.add(at(mat2, x, 0, z));
  }

  // Heater with stones and a wooden guard
  const heater = new THREE.Group();
  heater.add(block(0.5, 0.62, 0.42, steel, 0, 0.08, 0));
  for (const [x, z] of [[-0.2, -0.16], [0.2, -0.16], [-0.2, 0.16], [0.2, 0.16]]) heater.add(block(0.03, 0.08, 0.03, steel, x, 0, z));
  for (let i = 0; i < 6; i++) heater.add(block(0.5, 0.01, 0.005, mat({ color: '#2a2a2a' }), 0, 0.2 + i * 0.07, 0.212));
  heater.add(cylinder(0.035, 0.035, 0.03, mat({ color: '#111' }), 0.16, 0.55, 0.22, 16));
  heater.children.at(-1).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) heater.add(block(0.012, 0.22, 0.42, steel, s * 0.25, 0.7, 0));
  for (const s of [-1, 1]) heater.add(block(0.5, 0.22, 0.012, steel, 0, 0.7, s * 0.21));
  const ember = glow('#ff5a1f', 1.2, { color: '#3a1006' });
  heater.add(block(0.46, 0.02, 0.38, ember, 0, 0.71, 0));
  const r = T.rng(105);
  const stoneMats = ['#6b6661', '#58534f', '#7a746d', '#4a4643'].map((c) => mat({ color: c, roughness: 0.95, flatShading: true }));
  for (let i = 0; i < 38; i++) {
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.045 + r() * 0.025, 0), stoneMats[i % 4]);
    s.position.set((r() - 0.5) * 0.4, 0.75 + r() * 0.16 + (i > 26 ? 0.06 : 0), (r() - 0.5) * 0.32);
    s.rotation.set(r() * 3, r() * 3, r() * 3);
    s.scale.y = 0.8;
    s.castShadow = true;
    heater.add(s);
  }
  for (const [x, z, len, ry] of [[-0.42, 0, 0.75, Math.PI / 2], [0, 0.42, 0.75, 0]]) {
    const guard = new THREE.Group();
    for (let i = 0; i < 6; i++) guard.add(block(0.06, 0.82, 0.025, benchWood, -len / 2 + 0.06 + i * ((len - 0.12) / 5), 0, 0));
    guard.add(block(len, 0.04, 0.03, benchWood, 0, 0.82, 0));
    guard.position.set(x, 0, z);
    guard.rotation.y = ry;
    heater.add(guard);
  }
  group.add(tag(onWall(heater, 'right', { W, D }, 0.35, 0, 0.32), 'heater'));
  const heaterLight = pointLight(group, [W / 2 - 0.35, 1.05, 0.35], '#ff7a2e', 2.2, 3.5);

  // Bucket and ladle on the lower tier
  const bucket = new THREE.Group();
  const bucketWood = mat({ map: cedar(106, [1, 1], '#a8683a'), roughness: 0.6, side: THREE.DoubleSide });
  bucket.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.22, 20, 1, true), bucketWood));
  bucket.children[0].position.y = 0.11;
  bucket.add(cylinder(0.12, 0.12, 0.015, bucketWood, 0, 0, 0, 20));
  for (const y of [0.04, 0.17]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.128 + y * 0.07, 0.006, 6, 28), METALS.gold());
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    bucket.add(band);
  }
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), mat({ color: '#9fc4cc', roughness: 0.05, transparent: true, opacity: 0.8 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.17;
  bucket.add(water);
  const ladle = new THREE.Group();
  const ladleHandle = cylinder(0.012, 0.012, 0.55, bucketWood, 0, 0, 0, 8);
  ladleHandle.rotation.z = Math.PI / 2;
  ladleHandle.position.set(0.28, 0, 0);
  ladle.add(ladleHandle);
  ladle.add(cylinder(0.05, 0.04, 0.06, bucketWood, 0, -0.03, 0, 14));
  ladle.position.set(0.02, 0.2, 0);
  ladle.rotation.z = 0.45;
  bucket.add(ladle);
  group.add(tag(at(bucket, 1.35, 0.5, -D / 2 + 0.85), 'bucket'));

  // Thermometer / hygrometer plaque and sand timer
  const plaque = new THREE.Group();
  plaque.add(soft(0.62, 0.34, 0.03, mat({ color: '#6d4424', roughness: 0.6 }), 0, -0.17, 0, 0.012));
  [['°C', 85, 120, -0.15], ['% RH', 15, 100, 0.15]].forEach(([label, v, max, x]) => {
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.12, 32), mat({ map: dial(label, v, max), roughness: 0.4 }));
    face.position.set(x, 0, 0.032);
    plaque.add(face);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.01, 8, 32), METALS.gold());
    ring.position.set(x, 0, 0.032);
    plaque.add(ring);
  });
  group.add(tag(onWall(plaque, 'back', { W, D }, 1.15, 1.95, 0.01), 'dials'));
  const timer = new THREE.Group();
  timer.add(block(0.14, 0.03, 0.08, benchWood, 0, -0.16, 0));
  timer.add(block(0.14, 0.03, 0.08, benchWood, 0, 0.13, 0));
  for (const s of [-1, 1]) timer.add(block(0.015, 0.3, 0.015, benchWood, s * 0.06, -0.14, 0));
  const glassMat = mat({ color: '#f0f4f5', transparent: true, opacity: 0.35, roughness: 0.05 });
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.13, 16), glassMat); top.position.y = 0.065; top.rotation.x = Math.PI; timer.add(top);
  const bot = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.13, 16), glassMat); bot.position.y = -0.065; timer.add(bot);
  const sand = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.05, 16), mat({ color: '#d9b779' })); sand.position.y = -0.105; timer.add(sand);
  group.add(tag(onWall(timer, 'left', { W, D }, 1.35, 1.6, 0.06), 'rules'));
  const rules = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), mat({
    map: canvasTexture(256, 340, (ctx, w, h) => {
      ctx.fillStyle = '#f3ead8'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#6d4424'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = '#3a2614'; ctx.textAlign = 'center';
      ctx.font = '700 26px "Segoe UI", Arial'; ctx.fillText('SAUNA RULES', w / 2, 46);
      ctx.font = '400 19px "Segoe UI", Arial';
      ['Max 15 minutes', 'Shower before entering', 'Sit on a towel', 'Cool down between rounds', 'Drink plenty of water', 'Adults 18+ only', '(sample rules)'].forEach((t, i) => ctx.fillText(t, w / 2, 92 + i * 34));
    }),
    roughness: 0.8,
  }));
  group.add(tag(onWall(rules, 'left', { W, D }, 0.75, 1.65, 0.065), 'rules'));

  // Towels on the benches
  const towel = soft(0.45, 0.03, 0.55, mat({ map: T.fabric('#f4efe6', { seed: 107 }), roughness: 1 }), 0, 0, 0, 0.012);
  group.add(at(towel, -0.6, 0.95, -D / 2 + 0.32));
  const rolled = rolledTowel('#f4efe6');
  group.add(at(rolled, -W / 2 + 0.3, 1.02, 0.6, Math.PI / 2));

  // Louvred wooden lamp in the back corner
  const lamp = new THREE.Group();
  lamp.add(block(0.3, 0.02, 0.18, benchWood, 0, 0.32, 0));
  for (let i = 0; i < 6; i++) lamp.add(block(0.3, 0.025, 0.02, benchWood, 0, 0.03 + i * 0.05, 0.08 - (i % 2) * 0.01));
  lamp.add(block(0.2, 0.22, 0.03, glow('#ffb366', 2.2, { color: '#ffd9a8' }), 0, 0.06, 0.02));
  group.add(onWall(lamp, 'back', { W, D }, -1.4, 1.75, 0.1));
  pointLight(group, [-1.4, 1.95, -D / 2 + 0.35], '#ffb46b', 4, 6);

  hemi(group, '#ffd2a1', '#4a2c18', 0.35);
  addSun(group, { color: '#ffc58f', intensity: 0.9, position: [1.4, H - 0.12, 1.2], target: [-0.6, 0, -1], size: 3, near: 0.05, far: 6 });

  // Steam particles
  const N = 70;
  const positions = new Float32Array(N * 3);
  const velocity = new Float32Array(N * 3);
  const steamGeo = new THREE.BufferGeometry();
  steamGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const steamMat = new THREE.PointsMaterial({ map: steamSprite(), size: 0.45, transparent: true, opacity: 0, depthWrite: false, color: '#ffffff' });
  const steam = new THREE.Points(steamGeo, steamMat);
  steam.userData.noPick = true;
  steam.frustumCulled = false;
  group.add(steam);
  const origin = new THREE.Vector3(W / 2 - 0.32, 0.92, 0.35);
  let steamAge = Infinity;
  const pour = () => {
    for (let i = 0; i < N; i++) {
      positions.set([origin.x + (Math.random() - 0.5) * 0.3, origin.y, origin.z + (Math.random() - 0.5) * 0.25], i * 3);
      velocity.set([-0.1 - Math.random() * 0.35, 0.45 + Math.random() * 0.5, (Math.random() - 0.5) * 0.4], i * 3);
    }
    steamGeo.attributes.position.needsUpdate = true;
    steamAge = 0;
  };

  let clock = 0;
  anim.add((dt) => {
    clock += dt;
    const flicker = 1 + Math.sin(clock * 7.1) * 0.06 + Math.sin(clock * 13.3) * 0.04;
    let flare = 0;
    if (steamAge < 4) {
      steamAge += dt;
      flare = Math.max(0, 1 - steamAge / 1.2);
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        velocity[k + 1] *= 0.995;
        positions[k] += velocity[k] * dt;
        positions[k + 1] = Math.min(H - 0.1, positions[k + 1] + velocity[k + 1] * dt);
        positions[k + 2] += velocity[k + 2] * dt;
        if (positions[k + 1] >= H - 0.1) { velocity[k] *= 1.01; velocity[k + 2] *= 1.01; }
      }
      steamGeo.attributes.position.needsUpdate = true;
      steamMat.opacity = Math.min(1, steamAge * 3) * Math.max(0, 1 - steamAge / 4) * 0.55;
      steamMat.size = 0.35 + steamAge * 0.18;
    } else steamMat.opacity = 0;
    heaterLight.intensity = 2.2 * flicker + flare * 6;
    ember.emissiveIntensity = 1.2 * flicker + flare * 2.5;
  });

  const hotspots = [
    {
      id: 'heater', label: 'Heater & stones', position: [W / 2 - 0.32, 1.25, 0.35],
      title: 'Sauna heater', text: 'An electric heater keeps the room at about 85 °C. Ladle a little water onto the hot stones for a burst of soft steam (löyly).',
      view: { position: [0.2, 1.4, 0.9], target: [1.8, 0.75, 0.35] },
      action: { label: 'Pour water on the stones', run: pour },
    },
    {
      id: 'upper', label: 'Upper bench', position: [0.4, 1.35, -D / 2 + 0.3],
      title: 'Upper bench', text: 'The top tier is the hottest spot in the room (around 90 °C in this sample reading). Always sit on a towel.',
      view: { position: [0.9, 1.5, 0.9], target: [-0.6, 0.95, -1.4] },
    },
    {
      id: 'lower', label: 'Lower bench', position: [-W / 2 + 0.85, 0.85, 0.6],
      title: 'Lower bench', text: 'The lower tier is cooler (about 70 °C), ideal for a first round or a gentler session.',
      view: { position: [0.6, 1.3, 0.9], target: [-1.6, 0.5, 0.2] },
    },
    {
      id: 'dials', label: 'Thermometer', position: [1.15, 2.15, -D / 2 + 0.05],
      title: 'Thermometer & hygrometer', text: 'Sample readings: 85 °C and 15% relative humidity. Staff check the dials every hour (simulated).',
      view: { position: [0.9, 1.75, 0.2], target: [1.15, 1.8, -1.7] },
    },
    {
      id: 'bucket', label: 'Bucket & ladle', position: [1.35, 0.95, -D / 2 + 0.85],
      title: 'Bucket & ladle', text: 'A cedar bucket with a long-handled ladle. Two or three ladles of water are plenty.',
      view: { position: [0.6, 1.25, 0.3], target: [1.35, 0.55, -0.85] },
    },
    {
      id: 'rules', label: 'Sauna rules', position: [-W / 2 + 0.06, 2.05, 1.05],
      title: 'Sand timer & rules', text: 'A 15-minute sand timer and the house rules: shower first, sit on a towel, cool down between rounds and stay hydrated. Sessions are booked in 45-minute slots (sample rule).',
      view: { position: [0.4, 1.6, 0.7], target: [-2.0, 1.6, 1.0] },
    },
  ];

  return {
    group, hotspots,
    bounds: { W, D, H },
    exposure: 1.05,
    envIntensity: 0.12,
    walkSpeed: 0.9,
    update: anim.update,
    viewpoints: [
      { id: 'door', label: 'Doorway', position: [1.15, 1.6, 1.35], target: [-0.6, 0.85, -0.9] },
      { id: 'benches', label: 'Benches', position: hotspots[1].view.position, target: hotspots[1].view.target },
      { id: 'heater', label: 'Heater', position: hotspots[0].view.position, target: hotspots[0].view.target },
      { id: 'seat', label: 'From the top bench', position: [-1.5, 1.45, -1.3], target: [1.4, 0.8, 0.9] },
      { id: 'corner', label: 'Overview', position: [1.75, 2.15, 1.4], target: [-0.7, 0.45, -0.8] },
    ],
  };
}
