// Serializes layers to SVG: absolute coordinates (no accumulated rounding error),
// an explicit fill-rule on every path, and no clip-path, stroke, text, image or external references.

const fmt = (v, p) => {
  const s = (Math.round(v * 10 ** p) / 10 ** p).toFixed(p);
  return s.replace(/\.?0+$/, '').replace(/^-0$/, '0');
};

function pathToD(path, p) {
  const segs = path.segments;
  if (!segs.length) return '';
  const pt = (q) => `${fmt(q.x, p)} ${fmt(q.y, p)}`;
  let d = `M${pt(segs[0].point)}`;
  const n = segs.length;
  for (let i = 0; i < n; i++) {
    const a = segs[i];
    const b = segs[(i + 1) % n];
    if (i === n - 1 && !path.closed) break;
    const h1 = a.handleOut;
    const h2 = b.handleIn;
    const isLine = h1.isZero() && h2.isZero();
    if (i === n - 1) {
      // closing segment
      if (isLine) break;
    }
    if (isLine) d += `L${pt(b.point)}`;
    else d += `C${pt(a.point.add(h1))} ${pt(b.point.add(h2))} ${pt(b.point)}`;
  }
  return d + 'Z';
}

export function itemToD(item, p) {
  const paths = item.className === 'CompoundPath' ? item.children : [item];
  return paths
    .filter((x) => x.segments && x.segments.length > 1)
    .map((x) => pathToD(x, p))
    .join('');
}

export function toSvg(layers, W, H, { precision = 2, title = '' } = {}) {
  const w = fmt(W, 2);
  const h = fmt(H, 2);
  const body = layers
    .map((l) => {
      const d = itemToD(l.item, precision);
      return d ? `<path fill="${l.hex}" fill-rule="evenodd" d="${d}"/>` : '';
    })
    .filter(Boolean)
    .join('\n');
  const t = title ? `<title>${title.replace(/[<&]/g, '')}</title>\n` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n${t}${body}\n</svg>\n`;
}
