/* Renders every built-in sample with a realistic Addis lead, so we can see
   exactly what a cloned site looks like.  node scripts/check-samples.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const sandbox = {
  window: {}, console, setTimeout, clearTimeout, Date, Math, JSON, Number, String, Object,
  Array, Promise, Error, RegExp, encodeURIComponent, decodeURIComponent, isNaN, parseFloat, parseInt
};
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);

const FILES = ['core.js', 'data.js', 'providers.js', 'messages.js', 'samples.real.js', 'samples.js', 'sitegen.js', 'ai.js'];
FILES.forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', f), 'utf8'), sandbox, { filename: f }));
const App = sandbox.App;

try { App.store.load(); } catch (e) {}

const leads = [
  { id: 'l1', name: 'Kaldi Coffee House', businessType: 'cafe', category: 'Cafe', areaLabel: 'Bole, Addis Ababa', address: 'Bole Medhanealem, Addis Ababa', phone: '0911 223 344', intlPhone: '+251911223344', rating: 4.7, reviews: 312, website: '', source: 'google', openNow: true, hoursWeek: ['Monday · 7:00 – 22:00', 'Tuesday · 7:00 – 22:00', 'Sunday · 8:00 – 21:00'] },
  { id: 'l2', name: 'Bright Smile Dental', businessType: 'dentist', category: 'Dental clinic', areaLabel: 'CMC, Addis Ababa', address: 'CMC Michael, Addis Ababa', phone: '0936 010 518', intlPhone: '+251936010518', rating: 4.5, reviews: 88, source: 'google' },
  { id: 'l3', name: 'Triverse HR Suite', businessType: 'general', category: 'Software', areaLabel: 'Kazanchis, Addis Ababa', phone: '0902 468 625', intlPhone: '+251902468625', rating: 5, reviews: 12, source: 'google' }
];

/* never write into .sample-preview — that is the studio's own uploaded library */
const outDir = path.join(__dirname, '..', '.preview-out');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let fails = 0;
leads.forEach(lead => {
  const s = App.samples.forBusiness(lead);
  const out = App.samples.fill(s, lead, {});
  const html = out.html;
  const checks = [
    ['carries the business name', html.indexOf(lead.name) !== -1],
    ['carries the phone', html.indexOf('0911 223 344') !== -1 || html.indexOf(lead.phone) !== -1],
    ['no leftover placeholder', !/\{\{[^}]*\}\}/.test(html)],
    ['no undefined in the markup', !/(?:src|href|content|alt)=["']undefined["']|>undefined</.test(html)],
    ['has a map embed', html.indexOf('google.com/maps') !== -1],
    ['has real contact links', html.indexOf('tel:') !== -1],
    ['closed html document', /<\/html>\s*$/.test(html.trim())]
  ];
  const bad = checks.filter(c => !c[1]);
  if (bad.length) fails++;
  console.log('-', lead.name, '-> sample', s.id, '(' + s.category + ')',
    '\n   filled:', out.used.length, 'placeholders, swapped:', out.swapped.length, 'details');
  checks.forEach(c => console.log('   ', c[1] ? 'ok  ' : 'FAIL', c[0]));
  fs.writeFileSync(path.join(outDir, lead.id + '-' + s.category + '.html'), html);
});
/*
 * Every picture the imported designs point at must actually be on disk — the
 * whole point of carrying them is that the clone renders exactly as uploaded.
 */
(function assetsResolve() {
  const ROOT = path.join(__dirname, '..');
  const designs = App.samplesReal || [];
  let refs = 0, missing = 0;
  designs.forEach(s => {
    const seen = new Set();
    for (const m of String(s.html || '').matchAll(/samples\/assets\/[^"')\s]+/g)) seen.add(m[0]);
    seen.forEach(rel => {
      refs++;
      if (!fs.existsSync(path.join(ROOT, rel))) { missing++; console.log('   FAIL missing asset', rel); }
    });
  });
  console.log('\n- carried assets:', refs, 'reference(s),', missing, 'missing');
  if (missing) fails++;
})();

console.log(fails ? '\n✗ ' + fails + ' sample(s) had a problem' : '\n✓ every sample cloned cleanly');
process.exit(fails ? 1 : 0);
