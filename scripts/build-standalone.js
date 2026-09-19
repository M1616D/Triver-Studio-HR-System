/* -----------------------------------------------------------------------------
   Triverse OS — single-file build
   Inlines app.css + every js module into one portable HTML file so the whole
   system can live in a single document (or be opened straight from a folder).

     node scripts/build-standalone.js      → triverse-os.html
   -------------------------------------------------------------------------- */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'triverse-os.html');

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* every local stylesheet is inlined in order (Tailwind utilities first, then app.css) */
html = html.replace(/\s*<link rel="stylesheet" href="(assets\/css\/[^"]+)"\s*\/>/g, (m, src) =>
  '\n  <style data-src="' + src + '">\n' + fs.readFileSync(path.join(ROOT, src), 'utf8') + '\n</style>');

if (html.indexOf('href="assets/css') !== -1) {
  console.error('Build failed: a stylesheet link was not inlined');
  process.exit(1);
}

html = html.replace(/(\s*)<script src="(assets\/js\/[^"]+)"><\/script>/g, (m, ws, src) => {
  const code = fs.readFileSync(path.join(ROOT, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return ws + '<script>\n/* ===== ' + src + ' ===== */\n' + code + '\n</script>';
});

if (html.indexOf('assets/js/') !== -1 && html.indexOf('src="assets/js/') !== -1) {
  console.error('Build failed: some script tags were not inlined');
  process.exit(1);
}

fs.writeFileSync(OUT, html);
console.log('Wrote ' + path.relative(ROOT, OUT) + ' (' + Math.round(html.length / 1024) + ' KB, single file)');
