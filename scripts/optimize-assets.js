/* -----------------------------------------------------------------------------
   Triverse OS — sample asset optimiser

     node scripts/optimize-assets.js [--dry]

   The uploaded designs ship their own photography. Several files are 2–3 MB and
   thousands of pixels wide — far larger than a web page ever shows. This
   re-encodes each one to a sensible display size so the designs look the same on
   screen while the repository stays small enough to push.

   Deliberately conservative:
     · never touches a file that is already small (< MIN)
     · never enlarges, never changes the format, never renames
     · caps the long edge at MAX_EDGE, above every real web layout
     · leaves animated images alone
     · writes in place only when the result is genuinely smaller
   -------------------------------------------------------------------------- */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'samples', 'assets');

const MAX_EDGE = 1600;   // px, long edge
const QUALITY = 78;      // webp / jpeg / avif quality
const MIN = 200 * 1024;  // leave anything under this alone
const DRY = process.argv.includes('--dry');

const EXTS = { '.webp': 'webp', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.png': 'png', '.avif': 'avif' };

let sharp;
try { sharp = require('sharp'); } catch (e) {
  console.error('sharp is not installed. Run:  npm install --save-dev sharp');
  process.exit(1);
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  });
  return out;
}

const kb = n => (n / 1024).toFixed(0) + 'KB';

async function optimise(file) {
  const fmt = EXTS[path.extname(file).toLowerCase()];
  if (!fmt) return null;

  const size = fs.statSync(file).size;
  if (size < MIN) return null;

  /* Read the bytes ourselves and hand sharp a buffer. libvips on Windows cannot
     open an absolute path that contains a space — and this project lives in one. */
  const bytesIn = fs.readFileSync(file);
  const meta = await sharp(bytesIn, { animated: true }).metadata();
  if (meta.pages && meta.pages > 1) return null;           // animated — leave it
  const long = Math.max(meta.width || 0, meta.height || 0);
  if (!long) return null;

  const out = sharp(bytesIn);
  if (long > MAX_EDGE) {
    out.resize({
      width: meta.width >= meta.height ? MAX_EDGE : null,
      height: meta.height > meta.width ? MAX_EDGE : null,
      withoutEnlargement: true
    });
  }
  if (fmt === 'webp') out.webp({ quality: QUALITY, effort: 5 });
  else if (fmt === 'jpeg') out.jpeg({ quality: QUALITY, mozjpeg: true });
  else if (fmt === 'avif') out.avif({ quality: QUALITY, effort: 4 });
  else out.png({ compressionLevel: 9, palette: true });

  const buf = await out.toBuffer();
  if (buf.length >= size) return null;                     // no win — keep the original

  if (!DRY) fs.writeFileSync(file, buf);
  return { from: size, to: buf.length };
}

(async () => {
  if (!fs.existsSync(ASSETS)) {
    console.log('No samples/assets folder yet — run  npm run import-samples  first.');
    return;
  }

  const files = walk(ASSETS, []);
  const before = files.reduce((n, p) => n + fs.statSync(p).size, 0);
  let changed = 0, saved = 0, skipped = 0;

  for (const file of files) {
    let res = null;
    try { res = await optimise(file); } catch (e) {
      res = null;
      if (process.env.OPT_DEBUG) console.log('  ! ' + file + ' — ' + e.message);
    }
    if (!res) { skipped++; continue; }
    changed++;
    saved += res.from - res.to;
    console.log('  ' + (DRY ? 'would shrink' : 'shrunk') + '  ' +
      path.relative(ROOT, file).split(path.sep).join('/').padEnd(52) +
      kb(res.from) + ' → ' + kb(res.to));
  }

  console.log('\n  ' + changed + ' file(s) ' + (DRY ? 'would shrink' : 'shrunk') + ', ' +
    skipped + ' left alone');
  console.log('  ' + kb(before) + ' → ' + kb(before - saved) +
    '  (saved ' + (saved / 1048576).toFixed(2) + ' MB)');
})();
