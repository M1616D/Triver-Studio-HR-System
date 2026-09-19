/* -----------------------------------------------------------------------------
   Triverse OS — sample importer
   Curates the studio's own sample-website folder into one embeddable module so
   the generator can clone those exact designs and change only the information.

     node scripts/import-samples.js
       reads  .sample-preview/**  (the uploaded library)
       writes assets/js/samples.real.js

   The uploaded design is used EXACTLY as it was written. The importer does not
   redesign, re-create or restyle anything. It only:

     · copies every local file the design references into  samples/assets/<id>/
       and repoints those references there, so the real photos and fonts load
     · compiles the Tailwind Play CDN into inline CSS (the one script that had to
       go: it is not for production, needs the network and warns in the console)
     · strips analytics / service-worker / tracker scripts
     · collapses comments and runs of whitespace (invisible to the eye)

   Every tag, class, colour, image, animation and paragraph of copy stays exactly
   as uploaded. The generator then changes only the information inside the design
   — names, phone, address, map, socials, opening hours — when a client comes.
   -------------------------------------------------------------------------- */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const LIB = path.join(ROOT, '.sample-preview');
const OUT = path.join(ROOT, 'assets', 'js', 'samples.real.js');

/* the curated library: which uploaded design represents which category */
const SOURCES = [
  {
    file: "CAFE AND RESTURENT/Zemen's Kitchen.html",
    id: 'real-food-ethiopian',
    name: 'Ethiopian restaurant (fine dining)',
    category: 'food',
    tags: ['restaurant', 'ethiopian', 'injera', 'traditional', 'fine dining', 'cultural', 'dinner', 'kitchen'],
    blurb: 'The uploaded Zemen’s Kitchen design — warm, dark, food-led, built around a full menu.'
  },
  {
    file: 'CAFE AND RESTURENT/La.pizza.html.html',
    id: 'real-food-pizza',
    name: 'Pizza / fast food / cafe',
    category: 'food',
    tags: ['pizza', 'burger', 'fast food', 'fastfood', 'cafe', 'café', 'juice', 'bar', 'lounge', 'pasta', 'delivery'],
    blurb: 'The uploaded La.pizza design — bright modern ordering layout with a menu grid and map.'
  },
  {
    file: 'Digtal-qr-menu/Sunset-Cafe-main/index.html',
    id: 'real-qr-menu',
    name: 'Digital QR menu',
    category: 'qrmenu',
    tags: ['qr', 'qr menu', 'digital menu', 'menu', 'cafe', 'café', 'coffee', 'restaurant', 'juice', 'bakery', 'roastery', 'order'],
    blurb: 'The uploaded Sunset Cafe menu — the table-QR product, ready for order and call-waiter.'
  },
  {
    file: 'COSMOTICS/TSI COSMETICS.html',
    id: 'real-cosmetics',
    name: 'Cosmetics / beauty / perfume',
    category: 'beauty',
    tags: ['cosmetic', 'cosmetics', 'beauty', 'skincare', 'perfume', 'makeup', 'salon', 'spa', 'boutique', 'shop'],
    blurb: 'The uploaded TSI Cosmetics design — product-led beauty storefront with a catalogue grid.'
  },
  {
    file: 'DENTAL CLNIC/Tori Dental/index.html',
    id: 'real-dental',
    name: 'Dental / clinic / health',
    category: 'clinic',
    tags: ['dentist', 'dental', 'clinic', 'health', 'medical', 'ortho', 'pharmacy', 'doctor', 'lab'],
    blurb: 'The uploaded Tori Speciality Dental design — clean clinical layout with services and booking.'
  },
  {
    file: 'SHOP/CAR SHOP/LUXURY MOTORS.html',
    id: 'real-auto',
    name: 'Auto / dealership / garage',
    category: 'auto',
    tags: ['auto', 'car', 'cars', 'vehicle', 'dealership', 'motors', 'garage', 'rental', 'carrepair', 'car repair'],
    blurb: 'The uploaded Luxury Motors design — dark premium layout for cars and vehicle services.'
  },
  {
    file: 'SHOP/MUSIC INSTUREMENT/Hone Musical Instruments.html',
    id: 'real-shop',
    name: 'Shop / retail / store',
    category: 'shop',
    tags: ['shop', 'store', 'retail', 'electronics', 'music', 'instrument', 'furniture', 'grocery', 'boutique', 'products'],
    blurb: 'The uploaded Hone design — rich retail catalogue with categories and enquiry buttons.'
  },
  {
    file: 'SAS-UI/dashboard_app.html',
    id: 'real-saas',
    name: 'Software / SaaS / dashboard',
    category: 'saas',
    tags: ['saas', 'software', 'system', 'dashboard', 'hr', 'payroll', 'inventory', 'billing', 'app', 'platform', 'technology', 'agency'],
    blurb: 'The uploaded Aaru dashboard — product-led software layout for portals and systems.'
  },
  {
    file: 'LOGIN-PAGE/glassmorphism_login_ui.html',
    id: 'real-login',
    name: 'Login / portal entry',
    category: 'login',
    tags: ['login', 'sign in', 'portal', 'auth', 'account', 'password', 'secure'],
    blurb: 'The uploaded glassmorphism login — a secure entry screen for any portal we sell.'
  }
];

/*
 * Several of the uploaded designs pull Tailwind from the Play CDN, which is
 * explicitly not for production: it re-scans the DOM on every change, needs the
 * network, and warns in the console. So we compile the exact utility set each
 * design uses into plain CSS at import time and inline it. The design keeps its
 * classes; the shipped page carries only the CSS it actually uses.
 */
const TW_BIN = 'tailwindcss@3.4.17';
/* the system temp folder, not the project: the project path may contain spaces,
   which the Tailwind CLI splits on */
const TMP = path.join(require('os').tmpdir(), 'triverse-import');

/* quote for the shell — the working path on Windows often contains a space */
const q = s => '"' + String(s).replace(/"/g, '\\"') + '"';

function extractTailwindConfig(html) {
  const m = html.match(/tailwind\.config\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/i);
  return m ? m[1] : '';
}

function compileTailwind(html, id) {
  if (!/cdn\.tailwindcss\.com/.test(html)) return { css: '', reason: '', compiled: false };
  fs.mkdirSync(TMP, { recursive: true });
  const htmlFile = path.join(TMP, id + '.html');
  const cfgFile = path.join(TMP, id + '.config.js');
  const srcFile = path.join(TMP, id + '.src.css');
  const outFile = path.join(TMP, id + '.out.css');
  fs.writeFileSync(htmlFile, html);
  fs.writeFileSync(srcFile, '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
  const own = extractTailwindConfig(html);
  /* fast-glob wants forward slashes even on Windows */
  const content = htmlFile.split(path.sep).join('/');
  fs.writeFileSync(cfgFile,
    'module.exports = Object.assign({ content: [' + JSON.stringify(content) + '] },' +
    (own || '{}') + ');\n');
  try {
    const cmd = ['npx --yes ' + TW_BIN, '-c ' + q(cfgFile), '-i ' + q(srcFile), '-o ' + q(outFile), '--minify'].join(' ');
    execFileSync(cmd, { shell: true, stdio: 'pipe', timeout: 300000 });
    const css = fs.readFileSync(outFile, 'utf8');
    return { css: css, reason: '', compiled: true };
  } catch (e) {
    const why = String(e.stderr || e.message || '').split('\n').filter(Boolean).slice(-1)[0] || 'unknown';
    return { css: '', reason: 'tailwind build failed: ' + why.slice(0, 90), compiled: false };
  }
}

/* swap the CDN script for the compiled stylesheet */
function inlineTailwind(html, css) {
  if (!css) return html;
  return html
    .replace(/<script\b[^>]*src=["'][^"']*cdn\.tailwindcss\.com[^"']*["'][^>]*>\s*<\/script>/gi, '')
    /* the inline config script is only read by the CDN runtime */
    .replace(/<script\b[^>]*>\s*(?:window\.)?tailwind\.config\s*=[\s\S]*?<\/script>/gi, '')
    .replace(/<\/head>/i, '<style data-tailwind-compiled>\n' + css + '\n</style></head>');
}

/* scripts that are pure tracking / dev leftovers and must never ship */
const DEAD_SCRIPT = /(gtag\(|googletagmanager\.com|google-analytics\.com|dataLayer\s*=|serviceWorker\.register|hotjar\.com|clarity\.ms|connect\.facebook\.net|sentry\.io|localhost:\d\d\d\d)/i;

function stripScripts(html) {
  return html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs, body) => {
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) return m; // keep structured data, we rewrite it later
    if (DEAD_SCRIPT.test(attrs) || DEAD_SCRIPT.test(body)) return '';
    return m;
  });
}

/*
 * The design's own files, carried into the repo so the page renders exactly as
 * uploaded. Anything larger than CAP is left in place rather than shipped: a
 * 50 MB background video would bloat the repository and the clone still lays out
 * identically without it. Its tag — and its poster — are never touched.
 */
const CAP = 8 * 1024 * 1024;
const ASSET_ROOT = path.join(ROOT, 'samples', 'assets');
const ASSET_EXT = /\.(png|jpe?g|webp|gif|svg|avif|ico|bmp|mp4|webm|mov|m4v|woff2?|ttf|otf|eot|css|js|json)$/i;

function localRefs(html) {
  const found = new Set();
  const consider = u => {
    const raw = String(u || '').trim();
    if (!raw || /^(https?:|\/\/|#|mailto:|tel:|data:|javascript:|blob:)/i.test(raw)) return;
    const clean = raw.split('#')[0].split('?')[0];
    if (ASSET_EXT.test(clean)) found.add(clean);
  };
  for (const m of html.matchAll(/\b(?:src|href|poster|data-src)\s*=\s*["']([^"']+)["']/gi)) consider(m[1]);
  for (const m of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) consider(m[1]);
  /* a design often keeps its photo list in an inline script — a plain quoted
     path. Matching those keeps menus and galleries complete. */
  for (const m of html.matchAll(/["']([^"'\s]+\.(?:png|jpe?g|webp|gif|svg|avif|mp4|webm|woff2?|ttf))["']/gi)) consider(m[1]);
  return [...found];
}

function carryAssets(html, src) {
  const from = path.dirname(path.join(LIB, src.file));
  const to = path.join(ASSET_ROOT, src.id);
  let bytes = 0, copied = 0, skipped = 0, missing = 0;

  localRefs(html).forEach(ref => {
    const abs = path.resolve(from, ref);
    let st;
    try { st = fs.statSync(abs); } catch (e) { missing++; return; }
    if (st.isDirectory() || !st.isFile()) return;
    if (st.size > CAP) { skipped++; return; }

    /* keep the design's own folder shape so same-folder references still match */
    const rel = path.relative(from, abs).split(path.sep).join('/');
    const dest = path.join(to, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try { fs.copyFileSync(abs, dest); } catch (e) { skipped++; return; }
    bytes += st.size; copied++;

    const url = 'samples/assets/' + src.id + '/' + rel;
    const esc = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html
      .replace(new RegExp('(\\b(?:src|href|poster|data-src)\\s*=\\s*["\'])' + esc + '(["\'])', 'gi'), '$1' + url + '$2')
      .replace(new RegExp('url\\(\\s*["\']?' + esc + '["\']?\\s*\\)', 'gi'), 'url(' + url + ')');
  });

  return { html: html, bytes: bytes, copied: copied, skipped: skipped, missing: missing };
}

function stripNoise(html) {
  return html
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')            // comments
    .replace(/<link\b[^>]*rel=(["'])manifest\1[^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=(["'])(?:dns-prefetch|prefetch|preload)\1[^>]*>/gi, '')
    .replace(/<meta\b[^>]*(?:theme-color|twitter:[^"']*|og:url)[^>]*>/gi, '');
}

/* the smallest change that keeps the design pixel-identical */
function minify(html) {
  return html
    .replace(/[\t\r]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/>\n</g, '><')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function stripOwnStructuredData(html) {
  // the generator writes its own LocalBusiness JSON-LD for the new business
  return html.replace(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');
}

/* a rough safety net: an unbalanced <div> stack renders as a broken page */
function tagsBalanced(html, tag) {
  const open = (html.match(new RegExp('<' + tag + '\\b', 'gi')) || []).length;
  const close = (html.match(new RegExp('</' + tag + '\\s*>', 'gi')) || []).length;
  return open === close;
}

const built = [];
const report = [];

SOURCES.forEach(src => {
  const from = path.join(LIB, src.file);
  if (!fs.existsSync(from)) {
    report.push(['MISSING', src.id, src.file]);
    return;
  }
  const raw = fs.readFileSync(from, 'utf8');
  let html = raw;
  /* the design's own pictures and fonts first, while the original paths are
     still in the markup */
  const assets = carryAssets(html, src);
  html = assets.html;
  html = stripNoise(html);
  html = stripScripts(html);
  html = stripOwnStructuredData(html);
  const tw = compileTailwind(html, src.id);
  html = inlineTailwind(html, tw.css);
  html = minify(html);

  const problems = [];
  if (tw.reason) problems.push(tw.reason);
  if (assets.skipped) problems.push(assets.skipped + ' file(s) over ' + Math.round(CAP / 1048576) + 'MB left in place');
  if (/cdn\.tailwindcss\.com/.test(html)) problems.push('still on the tailwind cdn');
  if (!/<\/html>\s*$/i.test(html)) problems.push('no closing </html>');
  if (!tagsBalanced(html, 'div')) problems.push('unbalanced <div>');
  const survivingScripts = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [];
  if (survivingScripts.some(s => DEAD_SCRIPT.test(s))) problems.push('tracker script survived');

  built.push({
    id: src.id,
    name: src.name,
    category: src.category,
    tags: src.tags,
    blurb: src.blurb,
    source: src.file,
    html: html
  });
  report.push([problems.length ? 'WARN' : 'ok', src.id, src.file,
    Math.round(raw.length / 1024) + 'KB → ' + Math.round(html.length / 1024) + 'KB' +
    (tw.compiled ? ' (tailwind compiled inline)' : '') +
    (assets.copied ? ' + ' + assets.copied + ' asset(s) ' + Math.round(assets.bytes / 1024) + 'KB' : '') +
    (problems.length ? ' — ' + problems.join(', ') : '')]);
});

/* ------------------------------------------------------------------ output */
const head =
  '/* =============================================================================\n' +
  '   Triverse OS — the studio\'s own sample designs, imported from the uploaded\n' +
  '   library. GENERATED FILE — do not hand-edit; run  node scripts/import-samples.js\n' +
  '   Each entry is a complete design. The generator clones the entry for the\n' +
  '   business\'s category and changes only the information inside it.\n' +
  '   ========================================================================== */\n' +
  '(function (global) {\n' +
  '  \'use strict\';\n' +
  '  global.App = global.App || {};\n' +
  '  App.samplesReal = ' + JSON.stringify(built, null, 0) + ';\n' +
  '})(window);\n';

fs.writeFileSync(OUT, head);
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* nothing to clean */ }

console.log('Imported ' + built.length + ' real sample designs');
report.forEach(r => console.log('  ' + r[0].padEnd(7) + r[1].padEnd(22) + r[2].padEnd(52) + (r[3] || '')));
console.log('Wrote ' + path.relative(ROOT, OUT) + ' (' + Math.round(head.length / 1024) + ' KB)');
