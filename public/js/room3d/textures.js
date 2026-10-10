// Procedural canvas textures for the 3D rooms: no image downloads required.
import * as THREE from 'three';

/** Small deterministic PRNG so every visit renders the same room. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

export function toTexture(canvas, repeat = [1, 1], { srgb = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function shade(hex, amount) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
}

export function addNoise(ctx, w, h, strength, random) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (random() - 0.5) * strength;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** Staggered wooden floor planks with grain. One tile ≈ 2 m. */
export function woodPlanks(base = '#8a5a3b', { seed = 3, planks = 8, repeat = [2, 2] } = {}) {
  const S = 1024;
  const [c, ctx] = makeCanvas(S, S);
  const r = rng(seed);
  const ph = S / planks;
  for (let row = 0; row < planks; row++) {
    let x = -r() * S * 0.5;
    while (x < S) {
      const len = S * (0.35 + r() * 0.45);
      ctx.fillStyle = shade(base, (r() - 0.5) * 0.08);
      ctx.fillRect(x, row * ph, len, ph);
      ctx.globalAlpha = 0.18;
      for (let g = 0; g < 14; g++) {
        ctx.strokeStyle = r() > 0.5 ? shade(base, -0.12) : shade(base, 0.08);
        ctx.lineWidth = 0.6 + r() * 1.6;
        ctx.beginPath();
        const y0 = row * ph + r() * ph;
        ctx.moveTo(x, y0);
        for (let s = 0; s <= 8; s++) ctx.lineTo(x + (len * s) / 8, y0 + Math.sin(s * 0.9 + r() * 2) * 2.5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x, row * ph, 2, ph);
      x += len;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, row * ph, S, 2);
  }
  addNoise(ctx, S, S, 10, r);
  return toTexture(c, repeat);
}

/** Vertical wood grain for furniture. */
export function woodGrain(base = '#6b4a33', { seed = 7, repeat = [1, 1] } = {}) {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const r = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = r() > 0.5 ? shade(base, -0.1) : shade(base, 0.07);
    ctx.lineWidth = 0.5 + r() * 2;
    ctx.beginPath();
    const x0 = r() * S;
    ctx.moveTo(x0, 0);
    for (let y = 0; y <= S; y += 32) ctx.lineTo(x0 + Math.sin(y * 0.02 + i) * 6, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  addNoise(ctx, S, S, 8, r);
  return toTexture(c, repeat);
}

export function carpet(base = '#7d7468', { seed = 11, repeat = [4, 4] } = {}) {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const r = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  addNoise(ctx, S, S, 34, r);
  return toTexture(c, repeat);
}

export function fabric(base = '#d8d0c4', { seed = 13, repeat = [3, 3] } = {}) {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const r = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#000';
  for (let i = 0; i < S; i += 4) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i + 2); ctx.lineTo(S, i + 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  addNoise(ctx, S, S, 14, r);
  return toTexture(c, repeat);
}

export function marble(base = '#f1ede6', vein = '#b8ad9c', { seed = 17, repeat = [2, 2] } = {}) {
  const S = 1024;
  const [c, ctx] = makeCanvas(S, S);
  const r = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  addNoise(ctx, S, S, 10, r);
  ctx.filter = 'blur(1.2px)';
  for (let v = 0; v < 22; v++) {
    ctx.strokeStyle = vein;
    ctx.globalAlpha = 0.15 + r() * 0.35;
    ctx.lineWidth = 0.6 + r() * 2.4;
    let x = r() * S, y = r() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const angle = r() * Math.PI;
    for (let s = 0; s < 40; s++) {
      x += Math.cos(angle) * 26 + (r() - 0.5) * 30;
      y += Math.sin(angle) * 26 + (r() - 0.5) * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  // Large tile seams
  ctx.strokeStyle = 'rgba(120,110,95,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, S, S);
  return toTexture(c, repeat);
}

export function wallpaper(base = '#e9e1d4', { seed = 19, stripe = 0.03, repeat = [6, 1.5] } = {}) {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const r = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  if (stripe) {
    ctx.fillStyle = shade(base, stripe);
    for (let x = 0; x < S; x += 32) ctx.fillRect(x, 0, 12, S);
  }
  addNoise(ctx, S, S, 6, r);
  return toTexture(c, repeat);
}

/** Diamond tufting pattern used on upholstered headboards. */
export function tufted(base = '#cbbfae', { repeat = [3, 2] } = {}) {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S * 0.6);
  g.addColorStop(0, shade(base, 0.06));
  g.addColorStop(1, shade(base, -0.08));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = shade(base, -0.18);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(S, S); ctx.moveTo(S, 0); ctx.lineTo(0, S);
  ctx.stroke();
  ctx.fillStyle = shade(base, -0.3);
  for (const [x, y] of [[0, 0], [S, 0], [0, S], [S, S], [S / 2, S / 2]]) {
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  }
  return toTexture(c, repeat);
}

/** Abstract framed artwork in the hotel palette. */
export function artwork(seed = 23, palette = ['#b08d59', '#1f2a36', '#e9dccb', '#8c5a3c', '#5f7466']) {
  const W = 512, H = 640;
  const [c, ctx] = makeCanvas(W, H);
  const r = rng(seed);
  ctx.fillStyle = palette[2];
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = palette[Math.floor(r() * palette.length)];
    ctx.globalAlpha = 0.55 + r() * 0.45;
    ctx.beginPath();
    if (r() > 0.5) ctx.arc(r() * W, r() * H, 40 + r() * 170, 0, Math.PI * 2);
    else ctx.rect(r() * W * 0.8, r() * H * 0.8, 60 + r() * 260, 20 + r() * 120);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = palette[1];
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, H * (0.3 + r() * 0.4));
  for (let x = 0; x <= W; x += 32) ctx.lineTo(x, H * 0.5 + Math.sin(x * 0.02 + seed) * 70);
  ctx.stroke();
  return toTexture(c, [1, 1]);
}

function skyGradient(ctx, W, H, horizon, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, horizon);
}

function clouds(ctx, W, horizon, r, color, count = 14) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const cx = r() * W, cy = horizon * (0.15 + r() * 0.55), s = 30 + r() * 70;
    ctx.globalAlpha = 0.25 + r() * 0.35;
    for (let p = 0; p < 6; p++) {
      ctx.beginPath();
      ctx.ellipse(cx + (p - 3) * s * 0.55, cy + (r() - 0.5) * s * 0.3, s, s * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function sea(ctx, W, H, horizon, top, bottom, glint, r) {
  const g = ctx.createLinearGradient(0, horizon, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon, W, H - horizon);
  ctx.strokeStyle = glint;
  for (let i = 0; i < 260; i++) {
    const y = horizon + Math.pow(r(), 1.6) * (H - horizon);
    ctx.globalAlpha = 0.15 + r() * 0.3;
    ctx.lineWidth = 1 + ((y - horizon) / (H - horizon)) * 3;
    const x = r() * W, len = 10 + ((y - horizon) / (H - horizon)) * 80;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function skyline(ctx, W, base, r, color, maxH = 120) {
  ctx.fillStyle = color;
  let x = 0;
  while (x < W) {
    const w = 20 + r() * 60, h = 15 + r() * maxH;
    ctx.fillRect(x, base - h, w, h);
    x += w + r() * 18;
  }
}

function palm(ctx, x, base, h, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.quadraticCurveTo(x + 20, base - h * 0.5, x + 10, base - h);
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(x + 10 + Math.cos(a) * 40, base - h + Math.sin(a) * 14 + 10, 50, 9, a, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Painted window views shown on a backdrop outside each room's windows. */
export function viewTexture(kind) {
  const W = 2048, H = 1024;
  const [c, ctx] = makeCanvas(W, H);
  const r = rng(kind.length * 31);

  if (kind === 'garden') {
    const horizon = H * 0.55;
    skyGradient(ctx, W, H, horizon, [[0, '#7fb2dd'], [1, '#e6f1f7']]);
    clouds(ctx, W, horizon, r, '#ffffff');
    ctx.fillStyle = '#4f6b45';
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(r() * W, horizon + 20, 60 + r() * 110, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#6d8f4e';
    ctx.fillRect(0, horizon + 60, W, H);
    ctx.fillStyle = '#3d5a35';
    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      ctx.ellipse(r() * W, H * 0.78 + r() * 60, 50 + r() * 70, 30 + r() * 30, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = ['#e7b4c4', '#f4e2a3', '#ffffff', '#d7704f'][Math.floor(r() * 4)];
      ctx.beginPath();
      ctx.arc(r() * W, H * 0.78 + r() * 90, 3 + r() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    palm(ctx, W * 0.15, H * 0.82, 380, '#2f4a2a');
    palm(ctx, W * 0.82, H * 0.84, 430, '#2f4a2a');
  } else if (kind === 'bay') {
    const horizon = H * 0.5;
    skyGradient(ctx, W, H, horizon, [[0, '#5e93c8'], [0.7, '#bcd7ea'], [1, '#f2ede2']]);
    clouds(ctx, W, horizon, r, '#ffffff', 10);
    skyline(ctx, W, horizon, r, 'rgba(90,110,130,0.55)', 90);
    sea(ctx, W, H, horizon, '#5b87a8', '#1f4e6e', '#e8f2f8', r);
    ctx.fillStyle = '#d9cdb7';
    ctx.fillRect(0, H * 0.9, W, H * 0.1);
    palm(ctx, W * 0.08, H * 0.95, 360, '#29402c');
    palm(ctx, W * 0.93, H * 0.95, 400, '#29402c');
  } else {
    const horizon = H * 0.52;
    skyGradient(ctx, W, H, horizon, [[0, '#2c3e6b'], [0.45, '#c9677a'], [0.8, '#f2a25c'], [1, '#ffd38a']]);
    clouds(ctx, W, horizon, r, '#f6b48a', 12);
    const sunX = W * 0.62, sunY = horizon - 40;
    const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 360);
    glow.addColorStop(0, 'rgba(255,240,200,1)');
    glow.addColorStop(0.15, 'rgba(255,200,120,0.85)');
    glow.addColorStop(1, 'rgba(255,160,90,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, horizon);
    ctx.fillStyle = '#fff4d6';
    ctx.beginPath(); ctx.arc(sunX, sunY, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(70,40,70,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (let x = 0; x <= W * 0.4; x += 40) ctx.lineTo(x, horizon - 40 - Math.sin(x * 0.01) * 50 - r() * 10);
    ctx.lineTo(W * 0.4, horizon);
    ctx.fill();
    sea(ctx, W, H, horizon, '#c77a6a', '#2b2f4f', '#ffd9a0', r);
    ctx.fillStyle = 'rgba(255,214,150,0.5)';
    for (let i = 0; i < 70; i++) {
      const y = horizon + r() * (H - horizon);
      const w = 20 + ((y - horizon) / (H - horizon)) * 160;
      ctx.fillRect(sunX - w / 2 + (r() - 0.5) * 60, y, w, 2 + r() * 3);
    }
  }
  const t = toTexture(c, [1, 1]);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
