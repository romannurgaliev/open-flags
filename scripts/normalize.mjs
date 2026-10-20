// Normalizes SVG exported from Figma to the form that checks C02–C16 require.
// Only deterministic attribute replacements; geometry is left alone:
//  - remove fill="none" from the root <svg> (Figma always adds it);
//  - remove clip-rule (Figma duplicates fill-rule; clip-rule without clip-path has no effect);
//  - named colors white/black → #FFFFFF/#000000, hex to uppercase;
//  - add a <title> with the country name.
// Anything else Figma may add (clipPath, mask, transform, g) is not fixed here
// but caught by the checks: such a file goes back to Figma to be fixed.

const NAMED = { white: '#FFFFFF', black: '#000000' };

export function normalizeFigmaSvg(svg, title = '') {
  let s = svg.replace(/\r\n/g, '\n');
  s = s.replace(/<svg([^>]*?)\sfill="none"/, '<svg$1');
  s = s.replace(/\sclip-rule="[^"]*"/g, '');
  s = s.replace(/\sfill="([a-zA-Z]+)"/g, (m, c) => (NAMED[c.toLowerCase()] ? ` fill="${NAMED[c.toLowerCase()]}"` : m));
  s = s.replace(/\sfill="(#[0-9a-fA-F]{6})"/g, (m, c) => ` fill="${c.toUpperCase()}"`);
  if (title && !s.includes('<title>')) s = s.replace(/(<svg[^>]*>)\n?/, `$1\n<title>${title.replace(/[<&]/g, '')}</title>\n`);
  return s.endsWith('\n') ? s : s + '\n';
}
