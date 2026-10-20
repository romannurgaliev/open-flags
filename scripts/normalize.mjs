// Нормализация SVG из экспорта Figma к виду, который требуют проверки C02–C16.
// Только детерминированные замены атрибутов, геометрию не трогаем:
//  - убрать fill="none" у корня <svg> (Figma ставит его всегда);
//  - убрать clip-rule (Figma дублирует fill-rule; clip-rule без clip-path ничего не значит);
//  - именованные цвета white/black → #FFFFFF/#000000, hex — в верхний регистр;
//  - добавить <title> с названием страны.
// Всё остальное, что Figma может добавить (clipPath, mask, transform, g), не исправляется,
// а ловится проверками: такой файл должен вернуться на правку в Figma.

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
