// Procedural SVG posters for event cards (no external images or paid assets).

const PALETTES = {
  cake: ['#fde4d3', '#f7b7a3', '#e9897e', '#7a3b2e'],
  jazz: ['#1b2440', '#2f3f6e', '#d9a441', '#f3e3b5'],
  theater: ['#2a0b12', '#7d1626', '#c9a46a', '#f6e7c8'],
  film: ['#101820', '#24384d', '#f2c14e', '#f78154'],
  wedding: ['#f8f1ea', '#e8d7c5', '#c9a46a', '#8d6e57'],
  gala: ['#0f0f14', '#262233', '#d4af6a', '#f5e6c4'],
  corporate: ['#0e2a3f', '#1f4e79', '#5fb0c9', '#e7f1f6'],
  music: ['#2b1a3d', '#ff7a59', '#ffd166', '#fff3e0'],
  festive: ['#123d2c', '#a3192b', '#e8c26a', '#fff7e4'],
  birthday: ['#fff1f6', '#ff8fb1', '#7bc6ff', '#ffd166'],
};

const MOTIFS = {
  cake: ([, mid, deep, ink]) => `
    <circle cx="300" cy="190" r="150" fill="#fff" opacity=".35"/>
    ${Array.from({ length: 18 }, (_, i) => `<circle cx="${40 + ((i * 97) % 520)}" cy="${30 + ((i * 53) % 150)}" r="${3 + (i % 3)}" fill="${['#ff6f91', '#ffc75f', '#73d2de', '#b39cd0'][i % 4]}"/>`).join('')}
    <ellipse cx="300" cy="318" rx="190" ry="20" fill="${ink}" opacity=".18"/>
    <rect x="130" y="300" width="340" height="14" rx="7" fill="#fff"/>
    <rect x="150" y="226" width="300" height="80" rx="14" fill="${deep}"/>
    <path d="M150 246c25 18 50 18 75 0s50 18 75 0 50 18 75 0 50 18 75 0v-8a14 14 0 0 0-14-14H164a14 14 0 0 0-14 14z" fill="#fff6ef"/>
    <rect x="185" y="160" width="230" height="72" rx="12" fill="${mid}"/>
    <path d="M185 178c19 14 38 14 57 0s38 14 57 0 38 14 57 0 38 14 58 0v-6a12 12 0 0 0-12-12H197a12 12 0 0 0-12 12z" fill="#fff6ef"/>
    <circle cx="300" cy="150" r="13" fill="#d7263d"/><path d="M300 137c2-10 9-14 14-15" stroke="#3c763d" stroke-width="3" fill="none"/>
    ${[250, 350].map((x) => `<rect x="${x - 4}" y="112" width="8" height="40" rx="3" fill="#fff" stroke="${deep}" stroke-width="2"/><path d="M${x} 96c7 8 5 14 0 16-5-2-7-8 0-16z" fill="#ffb627"/>`).join('')}
    ${[200, 260, 320, 380, 430].map((x, i) => `<circle cx="${x}" cy="${270 + (i % 2) * 14}" r="4" fill="${['#ffd166', '#06d6a0', '#ef476f', '#118ab2', '#fff'][i]}"/>`).join('')}`,
  jazz: ([, mid, gold, cream]) => `
    <circle cx="460" cy="90" r="120" fill="${mid}"/>
    <path d="M250 70v170a40 30 0 1 1-18-25V95l120-28v140a40 30 0 1 1-18-25V90z" fill="${gold}"/>
    ${[0, 1, 2, 3, 4].map((i) => `<path d="M0 ${250 + i * 14}h600" stroke="${cream}" stroke-opacity=".25"/>`).join('')}
    <circle cx="120" cy="120" r="5" fill="${cream}"/><circle cx="520" cy="250" r="4" fill="${cream}"/>`,
  theater: ([, red, gold, cream]) => `
    <rect width="600" height="40" fill="${gold}"/>
    <path d="M0 40h170c-20 80-10 200 30 300H0z" fill="${red}"/><path d="M600 40H430c20 80 10 200-30 300h200z" fill="${red}"/>
    ${[20, 60, 100, 140].map((x) => `<path d="M${x} 40c-8 100-4 200 10 300" stroke="#000" stroke-opacity=".25" stroke-width="4" fill="none"/>`).join('')}
    <ellipse cx="300" cy="320" rx="160" ry="22" fill="${cream}" opacity=".2"/>
    <path d="M250 150c0-30 40-36 50-10 10-26 50-20 50 10 0 50-40 70-50 70s-50-20-50-70z" fill="${cream}"/>
    <circle cx="282" cy="160" r="7" fill="#2a0b12"/><circle cx="318" cy="160" r="7" fill="#2a0b12"/><path d="M282 190q18 14 36 0" stroke="#2a0b12" stroke-width="4" fill="none"/>`,
  film: ([, mid, yellow, orange]) => `
    <rect x="0" y="40" width="600" height="70" fill="#000" opacity=".5"/>
    ${Array.from({ length: 15 }, (_, i) => `<rect x="${10 + i * 40}" y="50" width="22" height="14" rx="2" fill="#fff" opacity=".8"/><rect x="${10 + i * 40}" y="86" width="22" height="14" rx="2" fill="#fff" opacity=".8"/>`).join('')}
    <path d="M220 330l-20-150h200l-20 150z" fill="#fff"/>
    ${[0, 1, 2, 3].map((i) => `<path d="M${215 + i * 45} 180l${6} 150" stroke="${orange}" stroke-width="16"/>`).join('')}
    ${Array.from({ length: 9 }, (_, i) => `<circle cx="${215 + i * 21}" cy="${170 - (i % 3) * 10}" r="16" fill="${yellow}"/>`).join('')}
    <circle cx="480" cy="210" r="60" fill="${mid}"/><circle cx="480" cy="210" r="18" fill="${yellow}"/>`,
  wedding: ([, soft, gold, deep]) => `
    <circle cx="300" cy="180" r="140" fill="${soft}"/>
    <circle cx="268" cy="200" r="52" fill="none" stroke="${gold}" stroke-width="12"/>
    <circle cx="332" cy="200" r="52" fill="none" stroke="${gold}" stroke-width="12"/>
    <path d="M318 140l14-22 14 22-14 10z" fill="#fff" stroke="${deep}" stroke-width="2"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${80 + i * 90} ${300 + (i % 2) * 20}c-10-14 10-24 14-10 4-14 24-4 14 10l-14 14z" fill="#e8a0a8" opacity=".7"/>`).join('')}`,
  gala: ([, mid, gold, cream]) => `
    <path d="M300 0v40" stroke="${gold}" stroke-width="3"/>
    <path d="M200 60h200l-30 50H230z" fill="${gold}" opacity=".9"/>
    ${Array.from({ length: 9 }, (_, i) => `<path d="M${215 + i * 21} 110v${30 + (i % 3) * 14}" stroke="${cream}" stroke-width="2"/><circle cx="${215 + i * 21}" cy="${142 + (i % 3) * 14}" r="5" fill="${cream}"/>`).join('')}
    <path d="M170 330l18-110h28l18 110z" fill="${mid}" stroke="${gold}" stroke-width="3"/>
    <path d="M380 330l18-110h28l18 110z" fill="${mid}" stroke="${gold}" stroke-width="3"/>
    ${Array.from({ length: 20 }, (_, i) => `<circle cx="${(i * 131) % 600}" cy="${40 + ((i * 71) % 260)}" r="${1.5 + (i % 3)}" fill="${gold}" opacity=".7"/>`).join('')}`,
  corporate: ([, mid, teal, pale]) => `
    <rect x="80" y="230" width="60" height="90" fill="${teal}" opacity=".6"/><rect x="160" y="190" width="60" height="130" fill="${teal}" opacity=".75"/>
    <rect x="240" y="150" width="60" height="170" fill="${teal}"/><path d="M80 210l90-40 70-40 90-50" stroke="${pale}" stroke-width="5" fill="none"/>
    <rect x="380" y="200" width="140" height="120" fill="${mid}"/><rect x="400" y="170" width="100" height="30" fill="${pale}"/>
    <circle cx="450" cy="120" r="28" fill="${pale}"/>`,
  music: ([, coral, yellow, cream]) => `
    <circle cx="300" cy="190" r="130" fill="${coral}" opacity=".85"/>
    <ellipse cx="300" cy="230" rx="70" ry="60" fill="${yellow}"/><circle cx="300" cy="225" r="18" fill="#2b1a3d"/>
    <rect x="292" y="40" width="16" height="140" fill="${cream}"/>
    ${[0, 1, 2].map((i) => `<path d="M${100 + i * 180} ${90 + i * 20}v60a14 10 0 1 1-6-8V${90 + i * 20}l30-8" stroke="${cream}" stroke-width="5" fill="none"/>`).join('')}`,
  festive: ([, red, gold, cream]) => `
    <path d="M300 30l20 50 54 4-42 34 14 52-46-30-46 30 14-52-42-34 54-4z" fill="${gold}"/>
    <path d="M300 150l-90 120h50l-60 70h200l-60-70h50z" fill="#2e7d4f"/>
    ${[[260, 250], [340, 260], [300, 300], [230, 320], [370, 320]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="9" fill="${[red, gold, cream, gold, red][i]}"/>`).join('')}
    ${Array.from({ length: 22 }, (_, i) => `<circle cx="${(i * 113) % 600}" cy="${(i * 67) % 340}" r="${2 + (i % 3)}" fill="#fff" opacity=".7"/>`).join('')}`,
  birthday: ([, pink, blue, yellow]) => `
    ${[[180, 140, pink], [300, 110, blue], [420, 150, yellow]].map(([x, y, c]) => `<ellipse cx="${x}" cy="${y}" rx="52" ry="64" fill="${c}"/><path d="M${x} ${y + 64}c-8 40 8 80 0 140" stroke="#8a8a8a" stroke-width="2" fill="none"/>`).join('')}
    ${Array.from({ length: 24 }, (_, i) => `<rect x="${(i * 83) % 600}" y="${(i * 47) % 340}" width="8" height="4" fill="${[pink, blue, yellow][i % 3]}" transform="rotate(${i * 30} ${(i * 83) % 600} ${(i * 47) % 340})"/>`).join('')}`,
};

/** `fit: 'meet'` keeps the whole motif visible; the background extends past the viewBox to fill any extra space. */
export function posterSvg(theme, { label = '', fit = 'slice' } = {}) {
  const key = Object.hasOwn(MOTIFS, theme) ? theme : 'gala';
  const p = PALETTES[key];
  return `<svg class="poster poster--${fit}" viewBox="0 0 600 340" preserveAspectRatio="xMidYMid ${fit}" role="img" aria-label="${label ? `${label} poster` : 'Event poster'}">
    <defs><linearGradient id="bg-${key}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient></defs>
    <rect x="-600" y="-600" width="1800" height="1540" fill="url(#bg-${key})"/>
    ${MOTIFS[key](p)}
  </svg>`;
}
