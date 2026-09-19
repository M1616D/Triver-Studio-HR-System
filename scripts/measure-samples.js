/* -----------------------------------------------------------------------------
   Measure what the curated sample designs actually need from disk.

     node scripts/measure-samples.js

   For each design in scripts/import-samples.js it lists the local files the page
   references (images, css, js, fonts, video) and totals their size — the true
   cost of shipping the design verbatim instead of rewriting its asset paths.
   Prints a compact table only; never dumps file contents.
   -------------------------------------------------------------------------- */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LIB = path.join(ROOT, '.sample-preview');

/* read the SOURCES table straight out of the importer so the two cannot drift */
const importer = fs.readFileSync(path.join(__dirname, 'import-samples.js'), 'utf8');
const block = importer.match(/const SOURCES = (\[[\s\S]*?\n\];)/);
/* eslint-disable-next-line no-eval */
const SOURCES = eval(block[1].replace(/;$/, ''));

const EXT = /\.(png|jpe?g|webp|gif|svg|avif|ico|bmp|mp4|webm|mov|m4v|woff2?|ttf|otf|eot|css|js|json)$/i;

function refsOf(html) {
  const out = new Set();
  const push = u => {
    const raw = String(u || '').trim();
    if (!raw || /^(https?:|\/\/|#|mailto:|tel:|data:|javascript:|blob:)/i.test(raw)) return;
    out.add(raw.split('#')[0].split('?')[0]);
  };
  for (const m of html.matchAll(/\b(?:src|href|poster|data-src|content)\s*=\s*["']([^"']+)["']/gi)) push(m[1]);
  for (const m of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) push(m[1]);
  for (const m of html.matchAll(/["']([^"']+\.(?:png|jpe?g|webp|gif|svg|avif|mp4|webm|woff2?|ttf))["']/gi)) push(m[1]);
  return [...out].filter(u => EXT.test(u));
}

let grand = 0;
const rows = [];

SOURCES.forEach(src => {
  const file = path.join(LIB, src.file);
  if (!fs.existsSync(file)) { rows.push([src.id, 'MISSING', '', '', '']); return; }
  const html = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  let bytes = 0, found = 0, missing = 0, biggest = '';
  let bigSize = 0;
  refsOf(html).forEach(r => {
    const p = path.resolve(dir, r);
    let st = null;
    try { st = fs.statSync(p); } catch (e) { missing++; return; }
    if (st.isDirectory()) return;
    found++; bytes += st.size;
    if (st.size > bigSize) { bigSize = st.size; biggest = path.basename(p); }
  });
  grand += bytes;
  rows.push([src.id, found + ' files', missing + ' missing', (bytes / 1048576).toFixed(2) + ' MB',
    biggest ? biggest + ' (' + Math.round(bigSize / 1024) + 'KB)' : '']);
});

const w = [0, 0, 0, 0, 0];
rows.forEach(r => r.forEach((c, i) => { w[i] = Math.max(w[i], String(c).length); }));
rows.forEach(r => console.log('  ' + r.map((c, i) => String(c).padEnd(w[i])).join('  ')));
console.log('\n  total to ship every curated design verbatim: ' + (grand / 1048576).toFixed(1) + ' MB');
