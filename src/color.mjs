// Цвет: sRGB ⇄ XYZ ⇄ CIELAB, пересчёт из CIE xyY и L*C*h, ΔE2000.
// Все пересчёты, которыми получены sRGB-значения в data/flags/*.json, идут через этот файл,
// чтобы метод был один и проверяемый.

const WHITE = {
  D65: [0.95047, 1.0, 1.08883],
  D50: [0.96422, 1.0, 0.82521],
  C: [0.98074, 1.0, 1.18232],
};

const BRADFORD = [
  [0.8951, 0.2664, -0.1614],
  [-0.7502, 1.7135, 0.0367],
  [0.0389, -0.0685, 1.0296],
];
const BRADFORD_INV = [
  [0.9869929, -0.1470543, 0.1599627],
  [0.4323053, 0.5183603, 0.0492912],
  [-0.0085287, 0.0400428, 0.9684867],
];

const mul = (m, v) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);

export function adapt(xyz, from, to) {
  if (from === to) return xyz;
  const s = mul(BRADFORD, WHITE[from]);
  const d = mul(BRADFORD, WHITE[to]);
  const cone = mul(BRADFORD, xyz);
  return mul(BRADFORD_INV, cone.map((c, i) => (c * d[i]) / s[i]));
}

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function rgbToXyz(rgb) {
  const [r, g, b] = rgb.map((v) => lin(v / 255));
  return [
    0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    0.0193339 * r + 0.119192 * g + 0.9503041 * b,
  ];
}

// Возвращает { rgb, clipped }: clipped=true, если цвет вне охвата sRGB и был обрезан.
export function xyzToRgb(xyz) {
  const [x, y, z] = xyz;
  const l = [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ];
  const clipped = l.some((c) => c < -1e-4 || c > 1 + 1e-4);
  const rgb = l.map((c) => Math.round(Math.min(1, Math.max(0, gam(Math.min(1, Math.max(0, c))))) * 255));
  return { rgb, clipped };
}

export function xyzToLab([x, y, z], white = 'D65') {
  const w = WHITE[white];
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [x / w[0], y / w[1], z / w[2]].map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function labToXyz([L, a, b], white = 'D65') {
  const w = WHITE[white];
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  return [inv(fx) * w[0], inv(fy) * w[1], inv(fz) * w[2]];
}

export const hexToLab = (hex) => xyzToLab(rgbToXyz(hexToRgb(hex)));
export const rgbToLab = (rgb) => xyzToLab(rgbToXyz(rgb));

// CIE xyY (Y в процентах, 0–100) под осветителем `illuminant` → sRGB (D65).
export function xyYToSrgb(x, y, Y, illuminant = 'D65') {
  const Yn = Y / 100;
  const xyz = [(x * Yn) / y, Yn, ((1 - x - y) * Yn) / y];
  return xyzToRgb(adapt(xyz, illuminant, 'D65'));
}

// CIELAB, заданный в L*, C*, h° (как в испанском RD 481/1981), → sRGB.
export function lchToSrgb(L, C, h, illuminant = 'D65') {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  return xyzToRgb(adapt(labToXyz([L, a, b], illuminant), illuminant, 'D65'));
}

// ΔE2000 (Sharma, Wu, Dalal 2005).
export function deltaE2000(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h = (a, b) => {
    if (a === 0 && b === 0) return 0;
    const v = Math.atan2(b, a) / rad;
    return v < 0 ? v + 360 : v;
  };
  const h1p = h(a1p, b1);
  const h2p = h(a2p, b2);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
    else hbp = (h1p + h2p) / 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  );
}

export const dE = (hexA, hexB) => deltaE2000(hexToLab(hexA), hexToLab(hexB));
