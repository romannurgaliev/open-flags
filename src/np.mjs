// Flag of Nepal per the 2015 Constitution, Schedule 1 (steps 1–24).
// Step transcription: FOTW, page np-law.html (via: fotw), read 2026-10-21.
// The unit is the length AB. The y axis points up, origin at point A. Output is in SVG coordinates.

const pt = (x, y) => ({ x, y });
const lerp = (a, b, t) => pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Intersection of two lines, each given by two points.
function cross(p1, p2, p3, p4) {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  const a = p1.x * p2.y - p1.y * p2.x;
  const b = p3.x * p4.y - p3.y * p4.x;
  return pt((a * (p3.x - p4.x) - (p1.x - p2.x) * b) / d, (a * (p3.y - p4.y) - (p1.y - p2.y) * b) / d);
}

// Intersection of two circles; returns both points.
function circles(c1, r1, c2, r2) {
  const d = dist(c1, c2);
  const a = (d * d + r1 * r1 - r2 * r2) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const m = pt(c1.x + (a * (c2.x - c1.x)) / d, c1.y + (a * (c2.y - c1.y)) / d);
  return [pt(m.x + (h * (c2.y - c1.y)) / d, m.y - (h * (c2.x - c1.x)) / d), pt(m.x - (h * (c2.y - c1.y)) / d, m.y + (h * (c2.x - c1.x)) / d)];
}

export function nepalConstruction() {
  // A. Shape inside the border
  const A = pt(0, 0);
  const B = pt(1, 0); // step 1
  const C = pt(0, 4 / 3); // step 2: AC = AB + AB/3
  const D = pt(0, 1); // AD = AB
  const E = lerp(B, D, 1 / dist(B, D)); // step 3: BE = AB
  const F = pt(0, E.y); // step 4
  const G = pt(1, E.y); // FG = AB
  // B. Moon
  const H = pt(0.25, 0); // step 6
  const I = cross(H, pt(0.25, 1), C, G);
  const J = lerp(C, F, 0.5); // step 7
  const K = cross(J, pt(1, J.y), C, G);
  const L = cross(J, K, H, I); // step 8
  const M = cross(J, G, H, I); // steps 9–10
  // step 11: the radius is the shortest distance from M to BD
  const rMN = Math.abs(M.x + M.y - 1) / Math.SQRT2;
  const N = pt(M.x, M.y - rMN);
  const rLN = dist(L, N); // step 13
  const dyLM = L.y - M.y;
  const half = Math.sqrt(rLN * rLN - dyLM * dyLM);
  const P = pt(L.x - half, M.y);
  const Q = pt(L.x + half, M.y);
  const rMQ = dist(M, Q); // step 14
  const [R, S] = circles(N, dist(N, M), L, rLN); // step 15
  const T = cross(R, S, H, I);
  const rTS = dist(T, S); // step 16: outer radius of the moon's rays
  const rTM = dist(T, M); // step 17: the moon's semicircle
  // C. Sun
  const U = lerp(A, F, 0.5); // step 19
  const W = cross(U, pt(1, U.y), H, I); // step 20 (sun center on HI)
  const sunInner = rMN; // step 20: radius MN
  const sunOuter = rLN; // step 21: radius LN
  // D. Border
  const border = dist(T, N); // step 23
  return {
    outline: [A, B, E, G, C],
    moon: { L, rLN, M, rMQ, T, rTS, rTM, P, Q },
    sun: { W, inner: sunInner, outer: sunOuter },
    border,
    points: { A, B, C, D, E, F, G, H, I, J, K, L, M, N, P, Q, R, S, T, U, W },
  };
}

// Border: the outer contour offset outward by the border width, with sharp (mitered) corners:
// "the outer angles equal the inner angles" (step 23).
export function offsetPolygon(poly, d) {
  const n = poly.length;
  // The contour A→B→E→G→C runs counterclockwise (y up). The outward normal is to the right of the direction.
  const lines = poly.map((p, i) => {
    const q = poly[(i + 1) % n];
    const len = dist(p, q);
    const nx = (q.y - p.y) / len;
    const ny = -(q.x - p.x) / len;
    return [pt(p.x + nx * d, p.y + ny * d), pt(q.x + nx * d, q.y + ny * d)];
  });
  return poly.map((_, i) => {
    const prev = lines[(i - 1 + n) % n];
    const cur = lines[i];
    return cross(prev[0], prev[1], cur[0], cur[1]);
  });
}

// Everything in SVG coordinates: the frame is the bounding box of the border's outer contour, y down, height = 1.
export function nepalFrame() {
  const c = nepalConstruction();
  const outer = offsetPolygon(c.outline, c.border);
  const xs = outer.map((p) => p.x);
  const ys = outer.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const h = maxY - minY;
  const w = maxX - minX;
  const to = (p) => pt((p.x - minX) / h, (maxY - p.y) / h); // the unit is the height
  return { c, outer, w: w / h, h: 1, to, scale: 1 / h };
}
