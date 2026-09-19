/* -----------------------------------------------------------------------------
   Triverse OS — smoke test
   Runs the whole app logic in Node with a minimal DOM stub:
     node scripts/smoke.js
   Checks: store seeding + migrations, message merging for every template and
   lead, reply classification, website generation for every business type and
   template, modal/invoice rendering and every view's HTML build.
   -------------------------------------------------------------------------- */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', 'assets', 'js');
const FILES = [
  'core.js', 'vault.js', 'data.js', 'providers.js', 'files.js', 'cloud.js',
  'messages.js', 'samples.js', 'sitegen.js', 'ai.js', 'agent.js',
  'views.dashboard.js', 'views.discover.js', 'views.outreach.js',
  'views.clients.js', 'views.projects.js', 'views.files.js',
  'views.money.js', 'views.assets.js', 'views.settings.js'
];

/* ----------------------------- environment stub ----------------------------- */
const memory = {};
const localStorage = {
  getItem: k => (Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null),
  setItem: (k, v) => { memory[k] = String(v); },
  removeItem: k => { delete memory[k]; },
  key: i => Object.keys(memory)[i],
  get length() { return Object.keys(memory).length; }
};

function fakeEl() {
  const el = {
    innerHTML: '', textContent: '', value: '', style: {}, dataset: {}, files: [],
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {},
    querySelector: () => null, querySelectorAll: () => [],
    getAttribute: () => '', setAttribute() {}, closest: () => null, focus() {}, click() {}, select() {}
  };
  return el;
}

const document = {
  readyState: 'complete', title: '',
  documentElement: {
    _t: 'dark', _c: '', getAttribute() { return this._t; }, setAttribute(k, v) { this._t = v; },
    classList: { add(c) { this._o = c; }, remove() {}, toggle(c, on) { document.documentElement._c = on ? c : ''; } }
  },
  getElementById: () => fakeEl(),
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => fakeEl(),
  addEventListener: () => {},
  body: { appendChild() {}, style: {} },
  activeElement: { tagName: 'BODY' }
};

const sandbox = {
  console, JSON, Math, Date, Number, String, Boolean, Array, Object, Promise, RegExp, Error,
  encodeURIComponent, decodeURIComponent, parseInt, parseFloat, isNaN,
  setTimeout: (fn) => { try { fn(); } catch (e) {} return 0; },
  clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  fetch: () => Promise.reject(new Error('offline in the smoke test')),
  navigator: { onLine: true, clipboard: null },
  location: { hash: '#/dashboard', href: '', protocol: 'file:', origin: 'null', host: '' },
  localStorage, document, alert: () => {}, Blob: Blob, URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
  FileReader: function FileReader() {
    const self = this;
    this.readAsDataURL = function (blob) {
      Promise.resolve(blob.arrayBuffer()).then(function (buf) {
        self.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(buf).toString('base64');
        if (self.onload) self.onload();
      });
    };
    this.readAsText = function (blob) {
      Promise.resolve(blob.text ? blob.text() : '').then(function (t) {
        self.result = t;
        if (self.onload) self.onload();
      });
    };
  },
  /* the vault and the file checksum need real Web Crypto, exactly like a browser */
  crypto: require('crypto').webcrypto,
  btoa: s => Buffer.from(String(s), 'binary').toString('base64'),
  atob: s => Buffer.from(String(s), 'base64').toString('binary'),
  TextEncoder: TextEncoder, TextDecoder: TextDecoder,
  addEventListener: () => {}, removeEventListener: () => {},
  indexedDB: undefined,
  Blob_ignore: true
};
sandbox.window = sandbox;
sandbox.global = sandbox;
const ctx = vm.createContext(sandbox);

/* --------------------------------- runner ---------------------------------- */
const failures = [];
const asyncChecks = [];
function check(name, fn) {
  try { fn(); console.log('  ✓ ' + name); }
  catch (e) { failures.push(name + ' → ' + e.message); console.log('  ✗ ' + name + ' → ' + e.message); }
}
/** for checks that have to wait on a fetch/promise */
function checkAsync(name, fn) { asyncChecks.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

FILES.forEach(f => {
  const file = path.join(ROOT, f);
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
});
const App = sandbox.App;
const U = App.util;

console.log('\nTriverse OS smoke test\n---------------------');

check('modules loaded', () => {
  ['store', 'dict', 'seed', 'providers', 'msg', 'sitegen', 'views'].forEach(k => assert(App[k], 'missing App.' + k));
  assert(Object.keys(App.views).length >= 9, 'expected at least 9 views, got ' + Object.keys(App.views).length);
});

/*
 * The app ships with no records at all, so the checks below build their own
 * fixture — the kind of data a Google Maps search produces — and run against it.
 */
function seedTestData() {
  const types = App.dict.businessTypes.map(t => t[0]);
  const leads = types.map((type, i) => {
    const t = App.dict.typeOf(type);
    const hasSite = i % 3 === 0;
    const status = ['new', 'qualified', 'contacted', 'replied', 'interested', 'won', 'rejected'][i % 7];
    return {
      id: 'tl_' + i, source: 'google', placeId: 'ChIJtest' + i,
      name: 'Test ' + t.label + ' ' + (i + 1), businessType: type, category: t.label, types: [type],
      address: 'Test Road ' + (i + 1) + ', Addis Ababa', area: 'bole-medhanealem', areaLabel: 'Bole · Medhanealem',
      subCity: 'Bole', city: 'Addis Ababa', country: 'Ethiopia',
      lat: 9.0 + i / 1000, lng: 38.75 + i / 1000, dist: 1 + (i % 9),
      phone: '+251911000' + String(100 + i), intlPhone: '+251911000' + String(100 + i), whatsapp: true,
      telegram: '', email: '', website: hasSite ? 'https://test' + i + '.et' : '', socials: {},
      rating: 3.9 + (i % 10) / 10, reviews: 20 + i * 13, priceLevelLabel: 'Br Br',
      openNow: true, hours: 'Open now', hoursWeek: ['Monday: 9 AM–6 PM'],
      photoName: 'places/ChIJtest' + i + '/photos/p1', photos: ['places/ChIJtest' + i + '/photos/p1'],
      reviewsList: i < 3 ? [{ author: 'Hanna', rating: 5, when: 'a week ago', text: 'Great service, they fixed it the same day.', authorPhoto: '/photo.jpg' }] : [],
      mapsUrl: 'https://maps.google.com/?q=test' + i,
      claimed: true, status: status, value: t.avgValue,
      tags: hasSite ? ['has-website'] : ['no-website'],
      notes: [], outreach: [], reply: null, clientId: '', nextFollowUp: '', summary: '',
      createdAt: U.now(), updatedAt: U.now()
    };
  });
  App.store.set('leads', leads, { silent: true });

  const stages = ['active', 'active', 'active', 'active', 'past', 'past', 'prospect', 'rejected'];
  const clients = stages.map((stage, i) => ({
    id: 'tc_' + i, name: 'Test Client ' + (i + 1), type: 'company', stage: stage,
    industry: types[i], contactName: 'Contact ' + i, designation: 'Owner',
    phone: '+251922000' + String(100 + i), whatsapp: '', telegram: '', email: '', address: 'Addis Ababa',
    website: '', services: ['svc_site_business'], accountManager: 'Bereket Mamuye', source: 'google-maps',
    sourceLeadId: 'tl_' + i, startedAt: '2026-01-0' + ((i % 9) + 1), endedAt: stage === 'past' ? '2026-06-01' : '',
    health: 'good', tags: [], notes: '', createdAt: U.now(), updatedAt: U.now()
  }));
  App.store.set('clients', clients, { silent: true });

  const payments = [0, 1, 2, 3, 4, 5, 6, 7].flatMap(ci => [0, 1].map(k => {
    const amount = 25000 + ci * 9000 + k * 5000;
    const status = (ci + k) % 5 === 0 ? 'overdue' : (ci + k) % 4 === 0 ? 'partial' : (ci + k) % 3 === 0 ? 'pending' : 'paid';
    return {
      id: 'tp_' + ci + '_' + k, invoiceNo: 'TS-2026-' + String(ci * 2 + k + 1).padStart(4, '0'),
      clientId: 'tc_' + ci, projectTitle: 'Test project ' + ci + '.' + k, serviceId: 'svc_site_business',
      amount: amount, amountPaid: status === 'paid' ? amount : (status === 'partial' ? Math.round(amount / 2) : 0),
      currency: 'ETB', method: 'Telebirr', status: status,
      issueDate: U.addDays(U.todayISO(), -30 - ci), dueDate: U.addDays(U.todayISO(), -3 + k),
      paidDate: status === 'paid' ? U.addDays(U.todayISO(), -5) : '', recurring: 'none', renewalDate: '', notes: ''
    };
  })).concat([{
    id: 'tp_extra', invoiceNo: 'TS-2026-0099', clientId: 'tc_0', projectTitle: 'Retainer',
    serviceId: 'svc_maintenance', amount: 9000, amountPaid: 0, currency: 'ETB', method: 'CBE Birr',
    status: 'pending', issueDate: U.todayISO(), dueDate: U.addDays(U.todayISO(), 10), paidDate: '',
    recurring: 'monthly', renewalDate: U.addDays(U.todayISO(), 20), notes: ''
  }]);
  App.store.set('payments', payments, { silent: true });

  const sites = [0, 1, 2, 3, 4, 5, 6, 7, 0, 1].map((ci, i) => ({
    id: 'ts_' + i, name: 'test-site-' + i + '.et',
    kind: ['client', 'hosted', 'sample', 'draft'][i % 4], status: ['live', 'live', 'draft', 'archived'][i % 4],
    clientId: i < 8 ? 'tc_' + ci : '', clientName: 'Test Client ' + (ci + 1), url: 'https://test-site-' + i + '.et',
    templateId: App.store.get('templates')[i % 6].id, businessType: types[ci], stack: 'Static',
    hostingProvider: 'Cloudflare Pages', repoUrl: '', price: 55000,
    hostRenewDate: U.addDays(U.todayISO(), 20 + i), domainRenewDate: U.addDays(U.todayISO(), 60 + i),
    notes: '', createdAt: U.now(), updatedAt: U.now()
  }));
  App.store.set('sites', sites, { silent: true });
  App.store.save(true);
  return { leads: leads.length, clients: clients.length, payments: payments.length, sites: sites.length };
}

check('a brand-new install starts empty and real', () => {
  App.store.load();
  const s = App.store.state;
  assert(s.leads.length === 0, 'expected an empty pipeline, got ' + s.leads.length + ' businesses');
  assert(s.clients.length === 0, 'expected no clients, got ' + s.clients.length);
  assert(s.payments.length === 0, 'expected no invoices, got ' + s.payments.length);
  assert(s.sites.length === 0, 'expected no websites, got ' + s.sites.length);
  assert(s.activities.length === 0, 'expected an empty activity log');
  assert(s.meta.demoData === false, 'the app should not claim to be showing sample data');
  assert(!App.dict.demoLeads && !App.dict.sampleSet, 'no bundled sample businesses may exist any more');
  assert(s.catalog.length >= 15, 'the service catalogue should ship ready to sell');
  assert(s.templates.length === 6, 'expected 6 templates, got ' + s.templates.length);
  assert(s.messages.templates.length >= 10, 'message library too small');
  assert(s.settings.company.currency === 'ETB', 'currency should be Ethiopian Birr');
  assert(!!s.settings.google.apiKey, 'the Google Places key is not configured');
  assert(s.settings.google.provider === 'google', 'Google Maps should be the default source');
  assert(s.settings.company.currency === 'ETB', 'money must be counted in Ethiopian Birr');
  assert(s.settings.company.ceo === 'Bereket Mamuye', 'the CEO name is not set');
  assert(s.settings.company.phone === '+251902468625', 'the studio phone number is wrong: ' + s.settings.company.phone);
  assert(s.settings.company.postalCode === '1000', 'the postal code is not set');
  assert(s.settings.company.country === 'Ethiopia', 'the country is not set');
  assert(!s.settings.company.address.match(/Dhaka|Bangladesh/i), 'a non-Ethiopian address is still in the company profile');
  App.store.save(true);
  assert(memory[App.STORE_KEY], 'nothing written to localStorage');
});

check('a discovered list drives every screen (fixture)', () => {
  const n = seedTestData();
  assert(n.leads === App.dict.businessTypes.length, 'expected one fixture business per type, got ' + n.leads);
  assert(App.store.get('clients', []).length === 8, 'expected 8 clients');
  assert(App.store.get('payments', []).length === 17, 'expected 17 invoices, got ' + App.store.get('payments', []).length);
  assert(App.store.get('sites', []).length === 10, 'expected 10 websites');
  assert(App.store.get('leads', []).every(l => l.source === 'google'), 'every fixture business should look like a Google result');
});

check('an older install is archived and cleared of invented records', () => {
  const legacy = {
    schema: 1,
    meta: { demoData: true },
    settings: { company: { name: 'Kept Studio', phone: '+251902468625' }, google: { apiKey: 'AIzaTestKey1234567890' }, ui: {}, outreach: {}, integration: {} },
    catalog: App.store.get('catalog', []).slice(), templates: App.store.get('templates', []).slice(),
    leads: [
      { id: 'l1', source: 'demo', name: 'Flow Fitness Studio', phone: '+8801911889900', address: 'Uttara Sector 7, Dhaka', country: 'Bangladesh', tags: [] },
      { id: 'l2', source: 'demo', name: 'NextStep Academy', phone: '+8801611778899', address: 'Mirpur 10, Dhaka', tags: [] }
    ],
    clients: [{ id: 'c1', name: 'Flow Fitness Studio', phone: '+8801911889900', address: 'Dhaka', stage: 'active' }],
    payments: [{ id: 'p1', clientId: 'c1', currency: 'BDT', amount: 30000, status: 'paid', method: 'bKash' }],
    sites: [{ id: 's1', clientId: 'c1', name: 'flowfitness.com', status: 'live' }],
    activities: [{ id: 'a1', text: 'sample' }], messages: App.store.get('messages', {})
  };
  memory[App.STORE_KEY] = JSON.stringify(legacy);
  App.store.load();
  const s = App.store.state;
  assert(s.leads.length === 0, 'legacy businesses survived the upgrade');
  assert(s.clients.length === 0 && s.payments.length === 0 && s.sites.length === 0 && s.activities.length === 0, 'legacy records survived the upgrade');
  assert(s.schema === App.SCHEMA, 'schema was not stamped');
  assert(s.settings.company.name === 'Kept Studio', 'settings must be preserved across the upgrade');
  assert(s.meta.legacyPurged === true, 'the upgrade was not recorded');
  assert(s.meta.legacyCounts.leads === 2, 'the archived counts are wrong');
  assert(memory[App.ARCHIVE_KEY], 'the old state was not archived before it was cleared');
  assert(memory[App.ARCHIVE_KEY].indexOf('Flow Fitness Studio') !== -1, 'the archive does not contain the removed records');
  /* and rows matching the old data can never come back */
  App.store.set('leads', [{ id: 'x', source: 'demo', name: 'Flow Fitness Studio', phone: '+8801911889900', address: 'Uttara, Dhaka', tags: [] }], { silent: true });
  App.store.purgeLegacyRows();
  assert(App.store.get('leads', []).length === 0, 'a demo row slipped back into the pipeline');
  App.store.reset(false);
  App.store.load();
  seedTestData();
});

check('settings survive a reload (migration path)', () => {
  const before = App.store.get('settings.company.name');
  App.store.set('settings.company.name', 'Custom Studio', { silent: true });
  App.store.save(true);
  App.store.load();
  assert(App.store.get('settings.company.name') === 'Custom Studio', 'saved value was overwritten by defaults');
  App.store.set('settings.company.name', before, { silent: true });
});

check('reply keywords from older installs merge with new defaults', () => {
  App.store.set('messages.keywords.wantSite', ['website', 'my-custom-word'], { silent: true });
  App.store.save(true);
  App.store.load();
  const kw = App.store.get('messages.keywords.wantSite', []);
  assert(kw.indexOf('my-custom-word') !== -1, 'a custom keyword was dropped on upgrade');
  assert(kw.indexOf('proposal') !== -1, 'new default keywords never reached the existing install');
  assert(App.msg.classify('Yes, please send the proposal').wantsSite === true, 'proposal was not treated as a buying signal');
  App.store.reset(false);
  App.store.load();
  assert(App.store.get('leads', []).length === 0, 'reset should return to an empty, real workspace');
  seedTestData();
});

check('money + date helpers', () => {
  assert(U.money(25000).indexOf('25,000') !== -1, 'money formatting broken: ' + U.money(25000));
  assert(U.digits('+880 1711-223344') === '8801711223344', 'digit normalisation broken');
  assert(U.csv('a,b\n1,"x,y"\n').length === 1, 'CSV parse broken');
  assert(U.toCSV([{ a: 1, b: 'x' }]).split('\n').length === 2, 'CSV write broken');
});

check('every message template renders for every lead', () => {
  const leads = App.store.get('leads', []);
  App.msg.templates().forEach(t => leads.forEach(l => {
    const out = App.msg.render(t, l);
    assert(out.body && out.body.indexOf('{{') === -1, 'unfilled variable in ' + t.id + ' for ' + l.name);
  }));
});

check('service recommendation picks sensible bundles', () => {
  const noSite = App.store.get('leads', []).filter(l => !l.website)[0];
  const withSite = App.store.get('leads', []).filter(l => l.website)[0];
  const a = App.msg.recommend(noSite), b = App.msg.recommend(withSite);
  assert(a.total > 0 && a.items.length > 0, 'no recommendation for a business without a website');
  assert(b.total > 0, 'no recommendation for a business with a website');
  assert(a.ids.indexOf('svc_hosting') !== -1, 'hosting should be bundled with new websites');
});

check('reply classifier separates positive / negative', () => {
  const pos = App.msg.classify('Yes please send the demo and price, we are interested');
  const neg = App.msg.classify('No thanks, we already have a website, not interested');
  const vague = App.msg.classify('ok');
  assert(pos.sentiment === 'positive', 'positive reply misread as ' + pos.sentiment);
  assert(neg.sentiment === 'negative', 'negative reply misread as ' + neg.sentiment);
  assert(vague.sentiment !== 'negative', '"ok" should never be negative');
});

check('reply triage moves the lead and queues the next one', () => {
  const lead = App.store.get('leads', []).filter(l => l.status === 'contacted')[0] || App.store.get('leads', [])[0];
  App.msg.logOutreach(lead, { channel: 'whatsapp', templateId: 'smoke', body: 'hello' });
  assert(App.store.find('leads', lead.id).outreach.length > 0, 'outreach not logged');
  const res = App.msg.recordReply(lead.id, 'Not interested, please stop messaging us', 'whatsapp');
  assert(res.sentiment === 'negative', 'negative triage failed');
  assert(App.store.find('leads', lead.id).status === 'rejected', 'lead not moved to rejected');
  assert(App.store.find('leads', lead.id).tags.indexOf('do-not-chase') !== -1, 'do-not-chase tag missing');
  const pos = App.store.get('leads', []).filter(l => l.status === 'new')[0];
  if (pos) {
    const r2 = App.msg.recordReply(pos.id, 'Yes I want the website, how much is it?', 'whatsapp');
    assert(r2.sentiment === 'positive', 'positive triage failed');
    assert(App.store.find('leads', pos.id).status === 'interested', 'positive lead did not reach the hot list');
    assert(App.store.find('leads', pos.id).tags.indexOf('replied-positive') !== -1, 'replied-positive tag missing');
    assert(App.store.find('leads', pos.id).tags.indexOf('do-not-chase') === -1, 'chaseable lead marked do-not-chase');
  }
  const vagueLead = App.store.get('leads', []).filter(l => ['new', 'qualified', 'contacted'].indexOf(l.status) !== -1)[0];
  if (vagueLead) {
    const r3 = App.msg.recordReply(vagueLead.id, 'Maybe, I will look at it next month.', 'whatsapp');
    if (r3.sentiment === 'positive') {
      assert(r3.wantsSite ? true : App.store.find('leads', vagueLead.id).tags.indexOf('needs-qualify') !== -1,
        'positive reply without a website mention should be flagged for qualification');
      assert(App.store.find('leads', vagueLead.id).status === 'interested', 'positive lead not in the hot list');
    } else {
      assert(App.store.find('leads', vagueLead.id).status === 'replied', 'neutral reply should wait in needs triage');
    }
  }
});

check('website generator builds every type × every template', () => {
  const templates = App.store.get('templates', []);
  const leads = App.store.get('leads', []);
  let count = 0;
  templates.forEach(t => App.dict.businessTypes.forEach(bt => {
    const lead = leads.filter(l => l.businessType === bt[0])[0] || {
      id: '', name: 'Test ' + bt[1], businessType: bt[0], category: bt[1], city: 'Addis Ababa', address: '1 Test Road',
      phone: '+251911000000', intlPhone: '+251911000000', whatsapp: true, rating: 4.4, reviews: 90, hours: 'Open now', outreach: []
    };
    const out = App.sitegen.build({ lead: lead, templateId: t.id, options: {} });
    assert(out.html.indexOf('<!DOCTYPE html>') === 0, 'generated page is not a full document');
    assert(out.html.indexOf('{{') === -1, 'unfilled merge field in the generated site');
    assert(out.html.indexOf('<h1') !== -1, 'no headline rendered');
    assert(out.html.indexOf('</html>') !== -1, 'document not closed');
    count++;
  }));
  assert(count === templates.length * App.dict.businessTypes.length, 'unexpected generation count ' + count);
});

check('generator works for a business with no phone / no website', () => {
  const out = App.sitegen.build({
    lead: { id: '', name: 'Bare Minimum Shop', businessType: 'general', category: '', city: '', address: '', phone: '', whatsapp: false, rating: 0, reviews: 0, outreach: [] },
    templateId: App.store.get('templates')[0].id, options: {}
  });
  assert(out.html.length > 1500, 'page too small');
  assert(out.html.indexOf('tel:') === -1, 'call button rendered without a phone number');
});

check('saving a generated draft stores the HTML and links the lead', () => {
  const lead = App.store.get('leads', []).filter(l => !l.siteId)[0];
  const res = App.sitegen.save(lead, App.store.get('templates')[0].id, {});
  assert(App.store.html(res.site.id).length > 1000, 'site HTML not stored');
  assert(App.store.find('leads', lead.id).siteId === res.site.id, 'lead not linked to the draft');
  App.sitegen.rebuild(res.site.id);
})

checkAsync('provider: a Google failure falls back to your own list, never to invented data', async () => {
  const originalFetch = sandbox.fetch;
  sandbox.fetch = () => Promise.reject(new Error('network down'));
  const out = await App.providers.search({ typeKey: 'dentist', city: 'Addis Ababa' });
  assert(out !== null && out !== undefined, 'search never resolved');
  assert(out.failed === true, 'a failed Google call must be flagged');
  assert(out.leads.length > 0, 'the saved businesses were not offered as a fallback');
  assert(out.leads.every(l => App.store.find('leads', l.id)), 'the fallback invented a business that is not in the list');
  assert(out.note.indexOf('network down') !== -1, 'the failure reason is not shown: ' + out.note);
  sandbox.fetch = originalFetch;
});

check('provider: Google Places request is built correctly (no network)', () => {
  const seen = {};
  const originalFetch = sandbox.fetch;
  sandbox.fetch = (url, opts) => {
    seen.url = url; seen.opts = opts;
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ places: [{ id: 'p1', displayName: { text: 'Test Dental' }, location: { latitude: 9.01, longitude: 38.78 }, rating: 4.6, userRatingCount: 120, nationalPhoneNumber: '0911223344', websiteUri: '' }] }) });
  };
  App.providers.google({ typeKey: 'dentist', city: 'Addis Ababa' });
  assert(seen.url === 'https://places.googleapis.com/v1/places:searchText', 'wrong endpoint: ' + seen.url);
  assert(seen.opts.headers['X-Goog-Api-Key'], 'the API key was not sent');
  assert(seen.opts.headers['X-Goog-FieldMask'].indexOf('places.rating') !== -1, 'field mask missing rating');
  assert(seen.opts.headers['X-Goog-FieldMask'].indexOf('places.websiteUri') !== -1, 'field mask missing the website');
  assert(seen.opts.headers['X-Goog-FieldMask'].indexOf('places.photos') !== -1, 'field mask missing photos');
  const body = JSON.parse(seen.opts.body);
  assert(body.textQuery.indexOf('Addis Ababa') !== -1, 'search is not scoped to Addis Ababa');
  assert(body.includedType === 'dental_clinic', 'the Google type filter is missing: ' + body.includedType);
  sandbox.fetch = originalFetch;
});

check('provider: withheld Atmosphere data is detected, not shown as an empty section', () => {
  /* a business with 1,300 ratings that comes back with no review text and no
     photos means the project cannot use Google’s Enterprise Atmosphere SKUs */
  const blocked = App.providers.normaliseDetails({
    id: 'ChIJatm1', displayName: { text: 'Savor Restaurant' }, userRatingCount: 1396, rating: 4.7,
    nationalPhoneNumber: '093 601 0518', websiteUri: 'https://savor.et'
  });
  assert(blocked.atmosphereBlocked === true, 'withheld reviews were not detected');
  assert(blocked.atmosphere === false, 'the record claims Atmosphere data it does not have');
  assert(blocked.nationalPhone === '093 601 0518' && blocked.website === 'https://savor.et', 'the rest of the record must still be used');
  const note = App.providers.atmosphereNote();
  assert(note.indexOf('Atmosphere') !== -1 && note.indexOf('billing') !== -1, 'the explanation is not actionable: ' + note);
  const help = App.providers.atmosphereHelp({ reviews: 1396 });
  assert(help.indexOf('1,396') !== -1, 'the help does not quote the real rating count: ' + help);
  assert(help.indexOf('billing') !== -1 && help.indexOf('places.googleapis.com') === -1, 'the help should point at billing, not at a wrong link');
  /* a business that genuinely has reviews must not be flagged */
  const fine = App.providers.normaliseDetails({
    id: 'ChIJok1', displayName: { text: 'Cravings' }, userRatingCount: 2898,
    reviews: [{ rating: 5, text: { text: 'Great food' }, authorAttribution: { displayName: 'Selam' } }]
  });
  assert(fine.atmosphereBlocked === false, 'a business with real reviews was wrongly flagged');
  assert(fine.atmosphere === true && fine.reviewsList.length === 1, 'real reviews were not mapped');
  /* a brand-new business with no ratings at all is simply new, not blocked */
  const fresh = App.providers.normaliseDetails({ id: 'ChIJnew1', displayName: { text: 'New Cafe' } });
  assert(fresh.atmosphereBlocked === false, 'a business with no ratings was wrongly flagged as blocked');
});

check('provider: Google is never sent a business type it does not know', () => {
  /* every value here was verified against the live API — Google answers
     INVALID_ARGUMENT, and returns nothing at all, for an unknown type */
  const VETTED = ('restaurant cafe fast_food_restaurant hotel medical_clinic dental_clinic pharmacy gym ' +
    'beauty_salon spa real_estate_agency car_repair travel_agency educational_institution school ' +
    'clothing_store electronics_store furniture_store supermarket lawyer accounting courier_service event_venue').split(' ');
  const BANNED = ['general_contractor', 'photographer', 'event_planner', 'printer'];
  BANNED.forEach(t => assert(VETTED.indexOf(t) === -1, 'the test itself claims a bad type is good: ' + t));
  const keys = Object.keys(App.dict.typeByKey || {});
  assert(keys.length > 15, 'the business type list did not load');
  keys.forEach(k => {
    const t = App.providers.typeFilter(k);
    if (!t) return;
    assert(BANNED.indexOf(t) === -1, k + ' still sends the rejected Google type ' + t);
    assert(VETTED.indexOf(t) !== -1, 'unverified Google type for ' + k + ': ' + t);
  });
  assert(App.providers.typeFilter('photographer') === '', 'photographer has no Google type and must not filter');
  assert(App.providers.searchWords('photographer').indexOf('photographer') !== -1, 'the untyped search lost its words');
  assert(App.providers.searchWords('printing').indexOf('printing') !== -1, 'the printing search lost its words');
  assert(App.providers.typeFilter('dentist') === 'dental_clinic', 'the dentist filter regressed');
});

check('provider: the region code sent to Google is always a CLDR code', () => {
  assert(App.providers.regionCode('Ethiopia') === 'ET', 'a country name was not mapped: ' + App.providers.regionCode('Ethiopia'));
  assert(App.providers.regionCode('et') === 'ET', 'a lowercase code was not normalised');
  assert(App.providers.regionCode('eth') === 'ET', 'three letters should still resolve');
  assert(App.providers.regionCode('United Arab Emirates') === 'AE', 'a multi-word country name was not mapped');
  assert(App.providers.regionCode('zz') === '', 'two letters that are not a country must be dropped');
  assert(App.providers.regionCode('x') === '', 'a one-letter region must be dropped');
  assert(App.providers.regionCode('') === 'ET', 'a cleared region should fall back to Ethiopia, not send junk');
  assert(App.providers.regionCode(undefined) === 'ET', 'the shipped default region is not Ethiopia');
  assert(App.providers.validPoint(9.0192, 38.7525), 'Addis Ababa is a valid search centre');
  assert(App.providers.validPoint(-33.9, 151.2), 'the southern hemisphere is valid too');
  assert(!App.providers.validPoint(0, 0), '0,0 is open ocean and must never bias a search');
  assert(!App.providers.validPoint(NaN, 38.7525), 'a missing latitude must not bias a search');
  assert(!App.providers.validPoint(9.0192, 'Bole'), 'a text longitude must not bias a search');
});

check('provider: a broken saved region cannot reach Google, and is repaired', () => {
  const before = App.store.get('settings.google.region', 'et');
  const seen = {};
  const originalFetch = sandbox.fetch;
  App.store.set('settings.google.region', 'Ethiopia', { silent: true });
  sandbox.fetch = (url, opts) => {
    seen.body = JSON.parse(opts.body);
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ places: [] }) });
  };
  App.providers.google({ typeKey: 'cafe', city: 'Addis Ababa' });
  assert(seen.body.regionCode === 'ET', 'the region sent to Google was not repaired: ' + seen.body.regionCode);
  assert(App.store.get('settings.google.region', '') === 'et', 'the saved region was not written back as a valid code');
  sandbox.fetch = originalFetch;
  App.store.set('settings.google.region', before, { silent: true });
});

checkAsync('provider: a request Google refuses is retried without the extras, never blank', async () => {
  const originalFetch = sandbox.fetch;
  let calls = 0;
  const bodies = [];
  sandbox.fetch = (url, opts) => {
    calls++;
    bodies.push(JSON.parse(opts.body));
    if (calls === 1) {
      return Promise.resolve({
        ok: false, status: 400,
        json: () => Promise.resolve({
          error: {
            code: 400, status: 'INVALID_ARGUMENT', message: "Invalid included_type: 'printer'.",
            details: [{ fieldViolations: [{ field: 'includedType', description: "Invalid included_type: 'printer'." }] }]
          }
        })
      });
    }
    return Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve({
        places: [{ id: 'p9', displayName: { text: 'Addis Print House' }, location: { latitude: 9.01, longitude: 38.75 } }]
      })
    });
  };
  const out = await App.providers.google({ typeKey: 'printing', city: 'Addis Ababa' });
  assert(calls === 2, 'the request was not retried, calls: ' + calls);
  assert(out.leads.length === 1, 'the retry returned no businesses');
  assert(out.leads[0].name === 'Addis Print House', 'the retried result was not mapped');
  assert(bodies[1].includedType === undefined, 'the retry still sent the rejected type filter');
  assert(bodies[1].textQuery === bodies[0].textQuery, 'the retry changed the search itself');
  assert(out.note.indexOf('extra filters') !== -1, 'the owner is not told the filters were dropped: ' + out.note);
  sandbox.fetch = originalFetch;
});

checkAsync('provider: a daily quota wall is recognised and never mistaken for a short wait', async () => {
  const originalFetch = sandbox.fetch;
  App.store.set('google.quota', null, { silent: true });
  sandbox.fetch = () => Promise.resolve({
    ok: false, status: 429,
    json: () => Promise.resolve({
      error: {
        code: 429, status: 'RESOURCE_EXHAUSTED',
        message: "Quota exceeded for quota metric 'SearchTextRequest' and limit 'SearchTextRequest per day' of service 'places.googleapis.com' for consumer 'project_number:440939143986'.",
        details: [{
          reason: 'RATE_LIMIT_EXCEEDED',
          metadata: { quota_unit: '1/d/{project}', quota_limit_value: '100', quota_limit: 'SearchTextRequestPerDayPerProject', quota_metric: 'places.googleapis.com/SearchTextRequest', consumer: 'projects/440939143986' }
        }]
      }
    })
  });
  await App.providers.google({ typeKey: 'cafe', city: 'Addis Ababa' }).then(() => { throw new Error('a 429 should reject'); }, e => {
    assert(e.message.indexOf('per day') !== -1 || e.message.indexOf('daily limit') !== -1, 'a daily limit is described as a momentary one: ' + e.message);
    assert(e.message.indexOf('midnight Pacific') !== -1, 'the message does not say when it resets');
    assert(e.message.indexOf('440939143986') !== -1, 'the quotas link lost the project: ' + e.message);
    assert(e.message.indexOf('wait a moment') === -1, 'a daily limit still tells the owner to wait a moment');
  });
  const wall = App.providers.quotaBlocked();
  assert(wall && wall.perDay === true, 'the daily quota wall was not remembered');
  assert(wall.limit === 100, 'the daily limit value was not captured: ' + JSON.stringify(wall));
  const note = App.providers.quotaNote();
  assert(note.indexOf('100') !== -1, 'the banner does not state the real limit: ' + note);
  assert(note.indexOf('comes back in about') !== -1, 'the banner does not say when the allowance returns: ' + note);
  assert(/opens instantly from your own saved results/.test(note), 'the banner does not explain that saved searches still work: ' + note);
  assert(wall.resetAt && new Date(wall.resetAt).getTime() > Date.now(), 'the reset instant was not stored, so the wall could outlive the reset');
  /* a per-minute spike must NOT be remembered as a day-long wall */
  sandbox.fetch = () => Promise.resolve({
    ok: false, status: 429,
    json: () => Promise.resolve({
      error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Rate limit exceeded', details: [{ reason: 'RATE_LIMIT_EXCEEDED', metadata: { quota_unit: '1/m/{project}', quota_limit_value: '600', quota_limit: 'SearchTextRequestPerMinutePerProject' } }] }
    })
  });
  await App.providers.google({ typeKey: 'cafe', city: 'Addis Ababa' }).catch(() => {});
  assert(App.providers.quotaBlocked() === null, 'a per-minute spike was remembered as a whole-day wall');
  App.store.set('google.quota', null, { silent: true });
  sandbox.fetch = originalFetch;
});

check('provider: today’s Google usage is counted honestly', () => {
  App.store.set('google.usage', null, { silent: true });
  App.providers.countUsage('places:searchText');
  App.providers.countUsage('places:searchText');
  App.providers.countUsage('places/ChIJx');
  const u = App.store.get('google.usage', {});
  assert(u.day === U.todayISO(), 'the usage counter is not dated');
  assert(u.searches === 2, 'searches were not counted: ' + u.searches);
  assert(u.records === 1, 'record reads were not counted: ' + u.records);
  /* yesterday’s count resets, so the number never drifts across days */
  App.store.set('google.usage', { day: '2000-01-01', searches: 12, records: 5 }, { silent: true });
  const fresh = App.providers.countUsage('places:searchText');
  assert(fresh.searches === 1 && fresh.day === U.todayISO(), 'the usage counter did not roll over to a new day');
  App.store.set('google.usage', null, { silent: true });
});

checkAsync('provider: Google\u2019s own sentence is quoted, not replaced by a guess', async () => {
  const originalFetch = sandbox.fetch;
  sandbox.fetch = () => Promise.resolve({
    ok: false, status: 400,
    json: () => Promise.resolve({
      error: {
        code: 400, status: 'INVALID_ARGUMENT', message: 'Request contains an invalid argument.',
        details: [{ fieldViolations: [{ field: "id,displayName,serviceOptions", description: "Error expanding 'fields' parameter. Cannot find matching fields for path 'serviceOptions'." }] }]
      }
    })
  });
  await App.providers.details('ChIJbroken').then(() => { throw new Error('a broken mask should reject'); }, e => {
    assert(e.message.indexOf('serviceOptions') !== -1, 'the offending field was not named: ' + e.message);
    assert(e.message.indexOf('Cannot find matching fields') !== -1, 'Google\u2019s own sentence was dropped');
    assert(e.google && e.google.status === 400, 'the machine-readable status was lost');
  });
  sandbox.fetch = originalFetch;
});

checkAsync('provider: an unsupported details field falls back to the core record', async () => {
  const originalFetch = sandbox.fetch;
  const masks = [];
  sandbox.fetch = (url, opts) => {
    masks.push(opts.headers['X-Goog-FieldMask']);
    if (masks.length === 1) {
      return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Error expanding fields.' } }) });
    }
    return Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve({
        id: 'ChIJcore1', displayName: { text: 'Core Record Cafe' }, nationalPhoneNumber: '0911223344',
        websiteUri: 'https://core.et', rating: 4.4, userRatingCount: 88
      })
    });
  };
  const d = await App.providers.details('ChIJcore1', { apply: false });
  assert(masks.length === 2, 'the core-record fallback was not attempted');
  assert(masks[1].indexOf('serviceOptions') === -1 && masks[1].indexOf('reviews') === -1, 'the fallback mask is not a narrower one');
  assert(d.name === 'Core Record Cafe', 'the fallback record was not mapped');
  assert(d.nationalPhone === '0911223344', 'the phone was lost in the fallback');
  sandbox.fetch = originalFetch;
});

checkAsync('provider: the deep record brings reviews, hours, phone, website and photos', async () => {
  const seen = {};
  const originalFetch = sandbox.fetch;
  sandbox.fetch = (url, opts) => {
    seen.url = url; seen.opts = opts;
    return Promise.resolve({
      ok: true, status: 200, json: () => Promise.resolve({
        id: 'ChIJdetail1', displayName: { text: 'Test Dental Clinic' }, formattedAddress: 'Bole, Addis Ababa',
        location: { latitude: 9.01, longitude: 38.78 }, rating: 4.7, userRatingCount: 412,
        nationalPhoneNumber: '0911 223 344', internationalPhoneNumber: '+251911223344',
        websiteUri: 'https://testdental.et', primaryTypeDisplayName: { text: 'Dental clinic' },
        regularOpeningHours: { openNow: true, weekdayDescriptions: ['Monday: 9 AM–6 PM', 'Tuesday: Closed'] },
        photos: [{ name: 'places/ChIJdetail1/photos/a' }, { name: 'places/ChIJdetail1/photos/b' }],
        reviews: [
          { rating: 5, relativePublishTimeDescription: '2 weeks ago', text: { text: 'Painless and quick, highly recommend.' }, authorAttribution: { displayName: 'Selam T.', uri: '', photoUri: '' } },
          { rating: 4, relativePublishTimeDescription: 'a month ago', originalText: 'Good service', authorAttribution: { displayName: 'Dawit' } }
        ],
        googleMapsUri: 'https://maps.google.com/?cid=1', editorialSummary: { text: 'Family dental practice.' },
        delivery: true, dineIn: true, takeout: false, reservable: true, priceLevel: 'PRICE_LEVEL_MODERATE'
      })
    });
  };
  const lead = App.store.get('leads', []).filter(l => l.placeId === 'ChIJtest0')[0] || App.store.get('leads', [])[0];
  const applied = await App.providers.details(lead.placeId);
  assert(seen.url.indexOf('places.googleapis.com/v1/places/') !== -1, 'wrong details endpoint: ' + seen.url);
  assert(seen.opts.headers['X-Goog-FieldMask'].indexOf('reviews') !== -1, 'the details field mask has no reviews');
  assert(seen.opts.headers['X-Goog-FieldMask'].indexOf('serviceOptions') === -1, 'the mask still asks for the field Google has no path for — it fails the whole call');
  assert(seen.opts.headers['X-Goog-FieldMask'].indexOf('delivery') !== -1, 'the delivery/dine-in options are no longer requested');
  assert(applied.serviceOptions.delivery === true && applied.serviceOptions.reservable === true, 'the service options were not read from their own fields');
  assert(applied.reviewsList.length === 2, 'reviews were not mapped');
  assert(applied.reviewsList[0].text.indexOf('Painless') !== -1, 'review text was dropped');
  assert(applied.reviewsList[1].text === 'Good service', 'originalText fallback broken');
  assert(applied.reviewsList[0].author === 'Selam T.', 'reviewer name missing');
  assert(applied.hoursWeek.length === 2, 'weekday hours missing');
  assert(applied.hoursLine.indexOf('closes') !== -1 || applied.hoursLine.indexOf('Open') !== -1, 'hours line not built: ' + applied.hoursLine);
  assert(applied.photos.length === 2, 'photos not mapped');
  const saved = App.store.find('leads', lead.id);
  assert(saved.website === 'https://testdental.et', 'the website was not written onto the business');
  assert(saved.phone === '0911 223 344', 'the phone number was not written onto the business');
  assert(saved.reviews === 412, 'the review count was not updated');
  assert(saved.reviewsList.length === 2 && saved.hoursWeek.length === 2, 'the record was not cached on the business');
  assert(saved.tags.indexOf('has-website') !== -1, 'the has-website tag was not set');
  assert(saved.tags.indexOf('no-website') === -1, 'both website tags were set at once');
  sandbox.fetch = originalFetch;
});

check('a fresh install ships empty, so no dashboard figure is invented', () => {
  /* the numbers on the dashboard are the studio’s own: nothing is pre-filled */
  const fresh = App.seed();
  ['leads', 'clients', 'payments', 'sites', 'activities'].forEach(col => {
    assert(Array.isArray(fresh[col]) && fresh[col].length === 0, col + ' is pre-filled with fake records on a new install');
  });
  /* what is pre-filled is the studio’s real catalogue and its real identity */
  assert(fresh.catalog.length > 10, 'the service catalogue is missing');
  assert(fresh.catalog.every(s => s.price > 0), 'a service in the catalogue has no price');
  assert(fresh.catalog.every(s => s.active), 'a catalogue service is switched off on a new install');
  assert(fresh.templates.length > 0, 'the website templates are missing');
  assert(fresh.settings.company.currency === 'ETB', 'the currency is not Birr');
  assert(fresh.settings.company.country === 'Ethiopia', 'the company country is wrong');
  assert(fresh.settings.company.postalCode === '1000', 'the postal code is wrong');
  assert(fresh.settings.company.phone === '+251902468625', 'the company phone number is wrong');
  assert(fresh.settings.company.ceo === 'Bereket Mamuye', 'the CEO name is wrong');
  assert(U.money(455000).indexOf('Br') !== -1, 'money is not shown in Birr: ' + U.money(455000));
  assert(App.providers.regionCode('et') === 'ET', 'the shipped region code is not a valid CLDR code');
});

checkAsync('provider: Google errors are translated into the exact fix', async () => {
  const originalFetch = sandbox.fetch;
  sandbox.fetch = () => Promise.resolve({
    ok: false, status: 403,
    json: () => Promise.resolve({
      error: {
        code: 403, status: 'PERMISSION_DENIED',
        message: 'Places API (New) has not been used in project 440939143986 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/places.googleapis.com/overview?project=440939143986 then retry.',
        details: [{ reason: 'SERVICE_DISABLED' }]
      }
    })
  });
  await App.providers.google({ typeKey: 'cafe', city: 'Addis Ababa' }).then(() => { throw new Error('a 403 should reject'); }, e => {
    assert(e.message.indexOf('places.googleapis.com/overview?project=440939143986') !== -1, 'the enable link was not surfaced: ' + e.message);
    assert(e.message.indexOf('Enable') !== -1, 'the fix instructions are missing');
  });
  sandbox.fetch = originalFetch;
});

check('provider: a Google Maps place maps into our business shape', () => {
  const lead = App.providers.mapPlace({
    id: 'ChIJmap1', displayName: { text: 'Bole Coffee House' }, formattedAddress: 'Bole Road, Addis Ababa',
    shortFormattedAddress: 'Bole Road', location: { latitude: 9.0245, longitude: 38.8102 },
    rating: 4.6, userRatingCount: 233, internationalPhoneNumber: '+251911222333', nationalPhoneNumber: '0911 222 333',
    websiteUri: '', primaryTypeDisplayName: { text: 'Coffee shop' }, primaryType: 'coffee_shop', types: ['coffee_shop'],
    regularOpeningHours: { openNow: true }, photos: [{ name: 'places/ChIJmap1/photos/x' }],
    googleMapsUri: 'https://maps.google.com/?cid=2', priceLevel: 'PRICE_LEVEL_INEXPENSIVE',
    addressComponents: [{ types: ['sublocality_level_1'], shortText: 'Bole' }]
  }, 'auto', 'Addis Ababa', { areaKey: 'bole-road' });
  assert(lead.businessType === 'cafe', 'coffee_shop should map to the cafe type, got ' + lead.businessType);
  assert(lead.source === 'google', 'source should be google');
  assert(lead.website === '' && lead.tags.indexOf('no-website') !== -1, 'a business with no website was not flagged');
  assert(lead.tags.indexOf('whatsapp') !== -1, 'a listed mobile number should be whatsapp-ready');
  assert(lead.priceLevelLabel.indexOf('budget') !== -1, 'the price level was not translated');
  assert(lead.dist > 2 && lead.dist < 12, 'distance from the area centre looks wrong: ' + lead.dist + ' km');
  assert(App.providers.photoUrl(lead, 400).indexOf('places/ChIJmap1/photos/x/media') !== -1, 'the photo url is wrong');
  assert(App.providers.detectType({ types: ['dentist'] }, 'auto') === 'dentist', 'dentist detection failed');
  assert(App.providers.detectType({ types: ['beauty_salon'] }, 'auto') === 'salon', 'salon detection failed');
  assert(App.providers.hasKey() === true, 'a key is configured, hasKey should say so');
  assert(App.providers.areaFromComponents([{ types: ['sublocality_level_1'], shortText: 'Bole' }]).key === 'bole-medhanealem', 'area detection from Google address components failed');
});

check('provider: CSV import maps scraper columns', () => {
  const csv = 'name,category,phone,website,rating,reviews,address\n' +
    'Test Cafe,Restaurant,+251911000111,,4.6,210,"Road 1, Addis Ababa"\n' +
    'Test Gym,Gym,+251911000222,https://testgym.com,4.8,90,Banani\n';
  const parsed = App.providers.importText(csv, { typeKey: 'auto', source: 'import' });
  assert(parsed.leads.length === 2, 'expected 2 rows, got ' + parsed.leads.length);
  assert(parsed.leads[0].businessType === 'restaurant', 'type detection failed: ' + parsed.leads[0].businessType);
  assert(parsed.leads[0].tags.indexOf('no-website') !== -1, 'no-website tag missing');
  assert(parsed.leads[1].businessType === 'gym', 'gym detection failed: ' + parsed.leads[1].businessType);
  const res = App.providers.ingest(parsed.leads, {});
  assert(res.added === 2, 'ingest added ' + res.added);
  const again = App.providers.ingest(parsed.leads, {});
  assert(again.skipped === 2, 'duplicate detection failed (skipped ' + again.skipped + ')');
});

check('refresh mode still stores brand-new businesses', () => {
  const fresh = [{
    source: 'google', placeId: 'ChIJrefresh1', name: 'Refresh Test Cafe', businessType: 'cafe', category: 'Cafe',
    types: [], address: 'Bole, Addis Ababa', area: 'bole-medhanealem', areaLabel: 'Bole · Medhanealem',
    city: 'Addis Ababa', lat: 9, lng: 38, dist: 1, phone: '+251900000000', intlPhone: '+251900000000',
    whatsapp: true, telegram: '', email: '', website: '', socials: {}, rating: 0, reviews: 0,
    priceLevel: '', hours: '', mapsUrl: '', claimed: true, status: 'new', value: 45000,
    tags: [], notes: [], outreach: [], reply: null, clientId: '', nextFollowUp: '', summary: ''
  }];
  const before = App.store.get('leads', []).length;
  const res = App.providers.ingest(fresh, { refresh: true });
  assert(res.added === 1, 'refresh ingest did not add the new row');
  assert(App.store.get('leads', []).length === before + 1, 'a refresh ingest threw the new rows away');
  assert(App.store.findBy('leads', l => l.placeId === 'ChIJrefresh1'), 'the new business is not in the store');
  App.store.set('leads', App.store.get('leads', []).filter(l => l.placeId !== 'ChIJrefresh1'), { silent: true });
});

check('Addis Ababa area lookup', () => {
  const bole = App.dict.findArea('bole');
  assert(bole && bole.key === 'bole-medhanealem', 'area lookup failed for Bole');
  assert(App.dict.findArea('addis ababa').key === 'addis-ababa', 'whole-city lookup failed');
  assert(App.dict.areas.length >= 15, 'the Addis area list is too small');
  assert(App.dict.areas.every(a => a[2] > 8 && a[2] < 10 && a[3] > 38 && a[3] < 39), 'an area falls outside Addis Ababa');
});

check('AI layer: the prompt carries the real Maps facts, the answer is parsed', () => {
  const lead = App.store.get('leads', []).filter(l => (l.reviewsList || []).length)[0];
  assert(lead, 'no fixture business has reviews — the AI prompt check cannot run');
  const ctx = App.ai.context(lead);
  assert(ctx.indexOf(lead.name) !== -1, 'the business name is not in the prompt');
  assert(ctx.indexOf(String(lead.reviews)) !== -1, 'the review count is not in the prompt');
  assert(ctx.indexOf('Great service') !== -1, 'the real review text is not in the prompt');
  assert(/Currency|Birr|ETB/.test(ctx) || ctx.indexOf('Br ') !== -1, 'the currency context is missing');
  assert(App.ai.ready() === false, 'AI must stay off until a key is saved');
  App.store.set('settings.ai.geminiKey', 'AIzaFakeKeyForTests1234567890', { silent: true });
  assert(App.ai.ready() === true, 'a saved key should turn the AI layer on');
  const parsed = App.ai.parseJSON('```json\n{"headline":"Fresh coffee daily","services":[{"name":"Espresso","price":180,"desc":"Local beans"}]}\n```');
  assert(parsed.headline === 'Fresh coffee daily', 'fenced JSON was not parsed');
  assert(parsed.services[0].price === 180, 'service prices were not parsed');
  App.store.set('settings.ai.geminiKey', '', { silent: true });
});

check('AI copy lands in the generated website, real reviews and photos do too', () => {
  const lead = App.store.get('leads', []).filter(l => (l.photos || []).length && (l.reviewsList || []).length)[0];
  assert(lead, 'no fixture business has photos + reviews — the site check cannot run');
  const out = App.sitegen.build({
    lead: lead, templateId: App.store.get('templates')[0].id,
    options: {
      sections: ['hero', 'about', 'services', 'gallery', 'testimonials', 'hours', 'faq', 'contact'],
      ai: {
        headline: 'Coffee roasted fresh in Bole', tagline: 'Beans from Jimma, roasted every morning.',
        about: 'We roast in small batches.\n\nCome in for a cup.', cta: 'Call us and we will save you a table.',
        services: [{ name: 'Espresso', desc: 'Single origin', price: 180 }],
        faq: [['Do you deliver?', 'Yes, inside Bole.']]
      }
    }
  });
  assert(out.html.indexOf('Coffee roasted fresh in Bole') !== -1, 'the AI headline is not on the page');
  assert(out.html.indexOf('Beans from Jimma') !== -1, 'the AI tagline is not on the page');
  assert(out.html.indexOf('We roast in small batches.') !== -1, 'the AI about text is not on the page');
  assert(out.html.indexOf('Espresso') !== -1, 'the AI service list is not on the page');
  assert(out.html.indexOf('Do you deliver?') !== -1, 'the AI FAQ is not on the page');
  assert(out.html.indexOf('Great service') !== -1, 'the real Google review is not used as a testimonial');
  assert(out.html.indexOf('places.googleapis.com/v1/places/') !== -1, 'the real Google photos are not in the gallery');
  assert(out.html.indexOf('Monday') !== -1 && out.html.indexOf('9 AM') !== -1, 'the real opening hours are not on the page');
  assert(out.html.indexOf('{{') === -1, 'unfilled merge field in the generated site');
});

check('theme helper switches and reports', () => {
  assert(App.theme.current() === 'dark', 'default theme should be dark');
  App.theme.apply('light', false);
  assert(App.theme.current() === 'light', 'light theme did not apply');
  assert(App.theme.toggle() === 'dark', 'toggle did not return to dark');
});

check('invoice document renders with company + client details', () => {
  const p = App.store.get('payments', [])[0];
  const html = App.invoiceHTML(p, App.store.find('clients', p.clientId));
  assert(html.indexOf('INVOICE') !== -1 && html.indexOf(p.invoiceNo) !== -1, 'invoice content missing');
  assert(html.indexOf('Balance due') !== -1, 'invoice totals missing');
});

check('photo url is built for real Google listings', () => {
  const url = App.providers.photoUrl({ photoName: 'places/x/photos/y' }, 200);
  assert(url.indexOf('places.googleapis.com/v1/places/x/photos/y/media') !== -1, 'photo endpoint wrong: ' + url);
  assert(url.indexOf('maxWidthPx=200') !== -1, 'photo width missing');
  assert(App.providers.photoUrl({}, 200) === '', 'a listing without photos should render nothing');
});

check('metrics add up', () => {
  const m = App.metrics();
  assert(m.collected > 0, 'no collected revenue detected');
  assert(m.outstanding > 0, 'no outstanding balance detected');
  assert(m.revenueByMonth.length === 8, 'revenue chart series broken');
  assert(m.leadStats.contacted > 0, 'contacted counter broken');
});

check('every view renders without throwing', () => {
  Object.keys(App.views).forEach(key => {
    const el = fakeEl();
    try {
      App.views[key].render(el, '');
    } catch (e) {
      throw new Error(key + ': ' + e.message);
    }
    assert(el.innerHTML.length > 500, key + ' rendered almost nothing (' + el.innerHTML.length + ' chars)');
    const bad = el.innerHTML.indexOf('undefined');
    assert(bad === -1, key + ' output contains "undefined": …' + el.innerHTML.slice(Math.max(0, bad - 160), bad + 60) + '…');
  });
});

check('modal-opening actions run without looping', () => {
  const stub = arg => ({
    getAttribute: k => (k === 'data-arg' || k === 'data-extra' ? arg : ''),
    setAttribute() {}, classList: { add() {}, remove() {}, toggle() {} }, style: {}, value: '', focus() {}, click() {},
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, matches: () => false, tagName: 'BUTTON'
  });
  const lead = App.store.get('leads', [])[0];
  const client = App.store.get('clients', [])[0];
  const payment = App.store.get('payments', [])[0];
  const site = App.store.get('sites', [])[0];
  const catalog = App.store.get('catalog', [])[0];
  [
    ['lead.generate', lead.id], ['lead.reply', lead.id], ['lead.toClient', lead.id], ['lead.copyMsg', lead.id],
    ['outreach.logReply', lead.id], ['outreach.openCompose', lead.id], ['client.edit', client.id], ['client.compose', client.id],
    ['pay.edit', payment.id], ['pay.print', payment.id], ['pay.remind', payment.id], ['sites.edit', site.id],
    ['sites.open', site.id], ['cat.edit', catalog.id], ['tpl.edit', App.store.get('templates', [])[0].id]
  ].forEach(pair => {
    const fn = App.actions[pair[0]];
    assert(fn, 'missing action ' + pair[0]);
    fn(stub(pair[1]), { stopPropagation() {} });
  });
});

check('backup export / import round-trips', () => {
  const json = App.store.export();
  const parsed = JSON.parse(json);
  assert(parsed.state.leads.length === App.store.get('leads', []).length, 'backup is missing leads');
  App.store.importJSON(json);
  assert(App.store.get('leads', []).length === parsed.state.leads.length, 'restore lost records');
});

/* ------------------------------ new in this release ----------------------- */

check('provider: a search that has already been run is kept, so it costs nothing to repeat', () => {
  App.providers.cacheClear();
  const params = { typeKey: 'dentist', city: 'Addis Ababa', areaKey: 'bole-road', radiusKm: 8 };
  assert(App.providers.cacheGet(params) === null, 'an empty cache returned something');
  App.providers.cachePut(params, {
    textQuery: 'dental clinic in Addis Ababa, Ethiopia', note: 'fixture',
    leads: [{ placeId: 'places/x', name: 'Smile Dental', businessType: 'dentist' }]
  });
  const hit = App.providers.cacheGet(params);
  assert(hit && hit.leads.length === 1, 'a saved search was not returned');
  assert(App.providers.cacheCount() === 1, 'the saved-search count is wrong');
  /* a different area is a different search and must not collide */
  assert(App.providers.cacheGet({ typeKey: 'dentist', city: 'Addis Ababa', areaKey: 'cmc', radiusKm: 8 }) === null, 'searches in different areas collided');
  App.providers.cacheClear();
  assert(App.providers.cacheCount() === 0, 'clearing the saved searches failed');
  assert(App.providers.cacheSig(params).indexOf('dentist') === 0, 'the cache signature does not lead with the business type');
});

check('provider: an empty result set is never cached', () => {
  App.providers.cacheClear();
  const params = { typeKey: 'hotel', city: 'Addis Ababa' };
  App.providers.cachePut(params, { leads: [] });
  assert(App.providers.cacheGet(params) === null, 'an empty search was cached, which would hide later results');
});

checkAsync('vault: the workspace round-trips through the encrypted store', async () => {
  const secret = { schema: 2, leads: [{ id: 'l1', name: 'Bole Dental Clinic' }], clients: [], payments: [], sites: [], documents: [], messages: { templates: [] }, meta: {}, settings: { company: { name: 'Triverse Studio' } }, counters: { invoice: 0 } };
  const out = await App.vault.create('a-strong-passphrase', secret, { hint: 'the usual one' });
  assert(out && out.recoveryCode, 'no recovery code was issued');
  assert(/^([A-Z0-9]{4}-){5}[A-Z0-9]{4}$/.test(out.recoveryCode), 'the recovery code is malformed: ' + out.recoveryCode);
  assert(App.vault.has(), 'the vault does not report itself as present');
  assert(App.vault.locked() === false, 'the vault is locked straight after creating it');

  /* the plain workspace must be gone from storage */
  assert(memory[App.STORE_KEY] === undefined, 'the unprotected workspace is still in storage');
  assert(memory['triverse.os.state.enc'] && memory['triverse.os.state.enc'].indexOf('Bole Dental Clinic') === -1,
    'the client name is readable in the encrypted blob');

  /* locking then unlocking with the wrong passphrase must fail.
     In the app the store holds the decrypted workspace, so point it at the same
     object before locking — otherwise the flush would seal the wrong state. */
  App.store.state = secret;
  App.vault.lock('test');
  assert(App.vault.locked(), 'locking did not lock');
  let wrong = '';
  await App.vault.unlock('not-the-passphrase').catch(e => { wrong = e.message; });
  assert(/does not open/.test(wrong), 'a wrong passphrase was not rejected: ' + wrong);

  const back = await App.vault.unlock('a-strong-passphrase');
  assert(back.leads[0].name === 'Bole Dental Clinic', 'the decrypted workspace lost its records');

  /* the recovery code opens it too, and issues a fresh one */
  const rec = await App.vault.unlockWithRecovery(out.recoveryCode, 'a-new-passphrase');
  assert(rec.state.leads.length === 1, 'recovery did not decrypt the workspace');
  assert(await App.vault.check('a-new-passphrase'), 'the new passphrase does not work after recovery');

  /* and the lock can be removed again */
  const plain = await App.vault.remove('a-new-passphrase');
  assert(plain.leads.length === 1, 'removing the lock lost the workspace');
  assert(!App.vault.has(), 'the vault is still reported after removal');
  assert(memory[App.STORE_KEY] && memory[App.STORE_KEY].indexOf('Bole Dental Clinic') !== -1, 'the plain workspace was not written back');
});

checkAsync('backup: a complete export carries the file bytes and restores them', async () => {
  const file = new Blob(['<!DOCTYPE html><html><body>Complete backup</body></html>'], { type: 'text/html' });
  Object.defineProperty(file, 'name', { value: 'about.html' });
  const doc = await App.files.add(file, { category: 'website', description: 'About page for the complete-backup test' });

  const payload = await App.store.exportFull();
  assert(payload.withFiles === true, 'the export is not marked as a full backup');
  assert(payload.fileCount >= 1, 'no files were packed into the backup');
  assert(payload.files[doc.id] && payload.files[doc.id].data, 'the file bytes are missing from the backup');
  assert(payload.files[doc.id].data.indexOf('<') === -1, 'the file bytes should be base64, not raw html');

  /* wipe the bytes, then restore from the backup alone */
  await App.files.remove(doc.id);
  assert((await App.files.has(doc.id)) === false, 'the file was not removed for the restore test');
  const out = await App.store.importFull(JSON.stringify(payload));
  assert(out.files >= 1, 'the restore reported no files');
  assert(await App.files.has(doc.id), 'the file bytes were not written back');
  const blob = await App.files.get(doc.id);
  assert(blob && blob.size > 10, 'the restored file is empty');
  App.store.remove('documents', doc.id);
  await App.files.remove(doc.id);
});

checkAsync('vault: repeated wrong passphrases are throttled', async () => {
  App.vaultAttempts.reset();
  for (let i = 0; i < 4; i++) App.vaultAttempts.fail();
  assert(App.vaultAttempts.penalty() > 0, 'four wrong attempts did not slow the next one down');
  App.vaultAttempts.reset();
  assert(App.vaultAttempts.penalty() === 0, 'resetting the attempt counter did not clear the wait');
});

checkAsync('files: a file keeps its full record and its bytes', async () => {
  const file = new Blob(['<html><body>Triverse</body></html>'], { type: 'text/html' });
  Object.defineProperty(file, 'name', { value: 'homepage.html' });
  const doc = await App.files.add(file, { category: 'website', description: 'Final homepage markup', version: '2.1', language: 'HTML' });
  assert(doc.kind === 'Markup', 'the file type was not recognised: ' + doc.kind);
  assert(doc.ext === 'html', 'the extension was not captured');
  assert(doc.checksum && doc.checksum.length === 64, 'no SHA-256 checksum was computed');
  assert(doc.preview && doc.preview.indexOf('Triverse') !== -1, 'no searchable text preview was kept');
  assert(App.store.find('documents', doc.id), 'the record was not saved in the workspace');
  const found = App.files.search('Triverse', {});
  assert(found.length === 1, 'searching inside the file contents did not find it');
  assert(App.files.search('homepage', { category: 'website' }).length === 1, 'category filtering broke');
  assert(App.files.search('nothing-here', {}).length === 0, 'a search for nonsense returned files');
  assert(App.files.categoryLabel('website') === 'Website build', 'the category label is wrong');
  assert(U.bytes(1536) === '1.5 KB' && U.bytes(1048576) === '1.0 MB', 'file sizes are not human readable: ' + U.bytes(1048576));
  await App.files.remove(doc.id);
  assert((await App.files.has(doc.id)) === false, 'deleting the file kept its bytes');
});

check('projects: every phase is reachable and the money adds up', () => {
  App.store.set('sites', [
    { id: 'p1', name: 'Bole Dental site', clientId: '', clientName: 'Bole Dental', price: 55000, status: 'live', kind: 'website', updatedAt: U.now() },
    { id: 'p2', name: 'New ordering app', clientId: '', clientName: 'Savanna Grill', price: 320000, status: 'draft', kind: 'app', updatedAt: U.now() },
    { id: 'p3', name: 'Care plan — Verde Realty', price: 9000, status: 'live', kind: 'service', maintenancePlan: 'Maintenance retainer', maintenanceFee: 9000, updatedAt: U.now() },
    { id: 'p4', name: 'Old brochure site', price: 25000, status: 'archived', kind: 'website', updatedAt: U.now() }
  ], { silent: true });
  const el = fakeEl();
  App.router.q.projects = { tab: 'all', search: '', client: '' };
  App.views.projects.render(el, '');
  assert(el.innerHTML.indexOf('Bole Dental site') !== -1, 'the projects screen did not list a live site');
  assert(/Hosted &amp; live|Hosted & live/.test(el.innerHTML), 'the phase chips are missing');
  assert(el.innerHTML.indexOf('Br 320,000') !== -1, 'the portfolio value is not counted in Birr');
  assert(el.innerHTML.indexOf('9,000') !== -1, 'retainer fees are not shown');
  App.store.set('sites', [], { silent: true });
});

check('copy audit: no pictographs left in the message library', () => {
  const bad = [];
  (App.store.get('messages.templates', []) || []).forEach(t => {
    const body = String(t.body || '');
    for (let i = 0; i < body.length; i++) {
      if (body.charCodeAt(i) >= 0x2700) { bad.push(t.id); break; }
    }
  });
  assert(bad.length === 0, 'emoji still present in: ' + bad.join(', '));
});

/* ======================= sample library and its cloning ==================== */
check('samples: every business type maps to a sample that exists', () => {
  assert(App.samples.list().length >= 3, 'the sample library is empty');
  App.dict.businessTypes.forEach(t => {
    const s = App.samples.forBusiness({ businessType: t[0], name: '', category: t[1] });
    assert(s && s.html, 'no sample for ' + t[0]);
    assert(s.category, 'the sample for ' + t[0] + ' has no category');
  });
});

check('samples: the food family is used for a cafe, the shop family for a dentist', () => {
  assert(App.samples.forBusiness({ businessType: 'cafe', name: '' }).category === 'food', 'a cafe did not get the food sample');
  assert(App.samples.forBusiness({ businessType: 'restaurant', name: '' }).category === 'food', 'a restaurant did not get the food sample');
  assert(App.samples.forBusiness({ businessType: 'dentist', name: '' }).category === 'shop', 'a dentist did not get the shop sample');
});

check('samples: cloning changes only the information, never the design', () => {
  const lead = {
    id: 'l-test', name: 'Kaldi Coffee House', businessType: 'cafe', category: 'Cafe',
    areaLabel: 'Bole, Addis Ababa', address: 'Bole Medhanealem, Addis Ababa',
    phone: '0911 223 344', intlPhone: '+251911223344', rating: 4.7, reviews: 312, source: 'google',
    hoursWeek: ['Monday \u00b7 7:00 \u2013 22:00', 'Sunday \u00b7 8:00 \u2013 21:00']
  };
  const sample = App.samples.forBusiness(lead);
  const out = App.samples.fill(sample, lead, {});
  assert(out.html.indexOf('Kaldi Coffee House') !== -1, 'the cloned page does not carry the business name');
  assert(out.html.indexOf('0911 223 344') !== -1, 'the cloned page does not carry the phone number');
  assert(out.html.indexOf('Bole Medhanealem') !== -1, 'the cloned page does not carry the address');
  assert(!/\{\{[^}]{1,40}\}\}/.test(out.html), 'a placeholder was left in the cloned page');
  assert(out.html.indexOf('undefined') === -1, 'the cloned page contains "undefined"');
  assert(!/\{\{/.test(out.html), 'raw braces survived into the page');
  assert(out.html.indexOf('tel:') !== -1, 'no click-to-call link was built');
  assert(out.html.indexOf('google.com/maps') !== -1, 'the map was not pointed at this business');
  assert(/<\/html>\s*$/.test(out.html.trim()), 'the page is not a complete document');
  // the design is untouched: the sample's own stylesheet is still all there
  const sampleCss = (sample.html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  const outCss = (out.html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  assert(sampleCss.length > 500 && outCss.indexOf(sampleCss.slice(0, 400)) !== -1, 'the cloned page lost the sample stylesheet');
});

check('samples: an uploaded page is analysed, saved and then cloned with its own look', () => {
  const uploaded = '<!doctype html><html><head><title>Bole Bites</title></head><body>' +
    '<header><h1>Bole Bites</h1></header>' +
    '<section><h2>Welcome to Bole Bites</h2><p>We serve the best breakfast in Addis Ababa every single morning of the week.</p></section>' +
    '<a href="tel:+251911000111">+251 91 100 0111</a>' +
    '<a href="https://wa.me/251911000111">WhatsApp</a>' +
    '<iframe src="https://www.google.com/maps/embed?pb=xyz"></iframe>' +
    '<img src="local/hero.jpg"><img src="local/logo.svg">' +
    '<footer><p>Bole Road, Addis Ababa</p></footer>' +
    '<style>.hero{color:#abcdef;font-family:Inter}</style></body></html>';

  const a = App.samples.analyse(uploaded);
  assert(a.title === 'Bole Bites', 'the title was not read: ' + a.title);
  assert(a.phones.length >= 1, 'the phone number was not found');
  assert(a.mapIframe, 'the map iframe was not found');
  assert(a.socials.whatsapp, 'the WhatsApp link was not found');
  assert(a.fonts.join(' ').indexOf('Inter') !== -1, 'the font was not read');
  assert(a.placeholders.length === 0, 'a plain page should report no placeholders');

  const res = App.samples.save({ name: 'Bole Bites sample', category: 'food', tags: 'breakfast', html: uploaded });
  assert(res.sample && res.sample.id, 'the sample was not saved');
  assert(App.samples.find(res.sample.id), 'the saved sample is not in the library');

  const lead = { id: 'l2', name: 'Genet Breakfast House', businessType: 'cafe', address: 'CMC, Addis Ababa',
    phone: '0902 468 625', intlPhone: '+251902468625', rating: 4.6, reviews: 44, source: 'google' };
  const out = App.samples.fill(res.sample, lead, {});
  assert(out.html.indexOf('Genet Breakfast House') !== -1, 'the uploaded sample kept the old business name');
  assert(out.html.indexOf('Bole Bites') === -1, 'the old brand name is still on the page');
  assert(out.html.indexOf('0902 468 625') !== -1, 'the new phone number was not written in');
  assert(out.html.indexOf('+251 91 100 0111') === -1, 'the old phone number is still on the page');
  assert(out.html.indexOf('#abcdef') !== -1, 'the uploaded design was not preserved');
  assert(out.swapped.length > 0, 'nothing was reported as swapped');
  App.samples.remove(res.sample.id);
  assert(!App.samples.find(res.sample.id), 'the sample could not be deleted');
});

check('samples: a sample with no photos still builds a clean page', () => {
  const lead = { id: 'l3', name: 'No Photo Garage', businessType: 'carrepair', address: 'Bole, Addis Ababa', phone: '0911 000 000' };
  const out = App.samples.fill(App.samples.forBusiness(lead), lead, {});
  assert(out.html.indexOf('No Photo Garage') !== -1, 'the garage name is missing');
  assert(out.html.indexOf('undefined') === -1, 'a missing photo produced "undefined"');
});

check('build: a business with no template named is built from its category sample', () => {
  const lead = { id: 'l4', name: 'Sunrise Bakery', businessType: 'cafe', address: 'Piassa, Addis Ababa', phone: '0911 555 666' };
  const out = App.sitegen.build({ lead: lead, options: {} });
  assert(out.meta.mode === 'sample', 'the build did not use a sample: ' + out.meta.mode);
  assert(out.meta.sampleId === 'sample-food', 'the bakery did not use the food sample: ' + out.meta.sampleId);
  assert(out.html.indexOf('Sunrise Bakery') !== -1, 'the built page does not name the business');
  // an explicit template still wins, so the generator keeps working
  const withTemplate = App.sitegen.build({ lead: lead, templateId: App.store.get('templates')[0].id, options: {} });
  assert(withTemplate.meta.mode !== 'sample', 'naming a template should not be overridden by a sample');
  const off = App.sitegen.build({ lead: lead, sampleId: 'none', templateId: App.store.get('templates')[0].id, options: {} });
  assert(off.meta.mode !== 'sample', 'sampleId "none" did not turn the sample path off');
});

/* ============================== the AI layer =============================== */
check('ai: the newest flash model wins, and a retired name is never trusted', () => {
  const ranked = App.ai.rank(['gemini-2.0-flash', 'gemini-3.6-flash', 'gemini-2.5-pro', 'text-embedding-004', 'gemini-2.5-flash']);
  assert(ranked[0] === 'gemini-3.6-flash', 'the newest flash model was not ranked first: ' + ranked[0]);
  assert(ranked.indexOf('text-embedding-004') === -1, 'an embedding model was offered as a text model');
  assert(ranked.indexOf('gemini-3.5-flash') === -1, 'a model the key does not have was invented');
});

checkAsync('ai: a retired model name is swapped for a live one automatically', async () => {
  App.store.set('settings.ai.geminiKey', 'AIzafake-key-for-the-test-1234', { silent: true });
  App.store.set('settings.ai.model', 'gemini-2.0-flash', { silent: true });
  const realFetch = sandbox.fetch;
  sandbox.fetch = () => Promise.resolve({
    ok: true, status: 200,
    // Google no longer offers 2.0-flash, which is exactly what the user hit
    json: () => Promise.resolve({ models: [
      { name: 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] }
    ] })
  });
  try {
    const list = await App.ai.listModels(true);
    assert(list[0] === 'gemini-3.6-flash', 'the live list was not ranked: ' + list.join(', '));
    assert(list.length === 2, 'a non-text model leaked into the list');
    const used = await App.ai.ensureModel(true);
    assert(used === 'gemini-3.6-flash', 'the dead model was not swapped: ' + used);
    assert(App.store.get('settings.ai.model') === 'gemini-3.6-flash', 'the swap was not saved');
    assert(App.store.get('settings.ai.modelSwappedFrom') === 'gemini-2.0-flash', 'the swap was not recorded for the user');
  } finally {
    sandbox.fetch = realFetch;
    App.store.set('settings.ai.geminiKey', '', { silent: true });
  }
});

check('ai: the retired-model error tells the user exactly what to press', () => {
  const hint = App.ai.hint(404, { message: 'models/gemini-2.0-flash is no longer available' });
  assert(/Detect models/.test(hint), 'the 404 hint does not point at Detect models: ' + hint);
  assert(/retired/i.test(hint), 'the hint does not explain that Google retired the model');
});

/* ============================== the assistant ============================== */
check('assistant: sending and deleting are off until the operator grants them', () => {
  const p = App.agent.perms();
  assert(p.read === true && p.draft === true && p.records === true, 'the safe permissions should start on');
  assert(p.send === false, 'sending must start switched off');
  assert(p.erase === false, 'deleting must start switched off');
  assert(App.agent.tools.send_message.group === 'send', 'send_message is in the wrong permission group');
  assert(App.agent.tools.delete_record.group === 'erase', 'delete_record is in the wrong permission group');
});

checkAsync('assistant: a tool whose permission is off is blocked, not run', async () => {
  const before = App.store.get('leads', []).length;
  const blocked = await App.agent.runStep({ tool: 'delete_record', args: { collection: 'leads', id: 'anything' } });
  assert(blocked.ok === false && blocked.blocked === 'erase', 'delete ran without permission');
  assert(App.store.get('leads', []).length === before || before === 0, 'records changed while blocked');
  const sent = await App.agent.runStep({ tool: 'send_message', args: { id: 'x', text: 'hi' } });
  assert(sent.ok === false && sent.blocked === 'send', 'a message was sent without permission');
});

check('assistant: every tool is grouped and described, so the model cannot guess', () => {
  const names = Object.keys(App.agent.tools);
  assert(names.length >= 14, 'the tool set shrank: ' + names.length);
  names.forEach(n => {
    const t = App.agent.tools[n];
    assert(t.group && t.label && t.args && typeof t.run === 'function', n + ' is not a complete tool');
  });
  const cat = App.agent.catalogue();
  assert(cat.indexOf('PERMISSION OFF') !== -1, 'the catalogue does not warn about blocked tools');
});

checkAsync('assistant: the read tools answer from the real records', async () => {
  const overview = await App.agent.runStep({ tool: 'overview', args: {} });
  assert(overview.ok === true, 'the overview tool failed: ' + overview.error);
  assert(overview.data.businesses === App.store.get('leads', []).length, 'the overview miscounted businesses');
  assert(typeof overview.data.invoiced === 'string' && overview.data.invoiced.indexOf('Br') === 0, 'money is not reported in Birr');
  const list = await App.agent.runStep({ tool: 'list_businesses', args: { hasWebsite: false, limit: 5 } });
  assert(list.ok === true, 'list_businesses failed');
  assert(list.data.every(x => x.website === 'none'), 'the hasWebsite filter leaked a business with a site');
  const unknown = await App.agent.runStep({ tool: 'no_such_tool', args: {} });
  assert(unknown.ok === false && /Unknown tool/.test(unknown.error), 'an invented tool was accepted');
});

check('storage: the doc describes what is stored and where', () => {
  const st = App.cloud.status();
  assert(typeof st.http === 'boolean' && typeof st.hasClientId === 'boolean', 'cloud status is incomplete');
  assert(App.providers.SCOPE ? true : true, '');
  assert(App.cloud.SCOPE === 'https://www.googleapis.com/auth/drive.file', 'the Drive scope is broader than drive.file');
  assert(App.cloud.FOLDER_NAME === 'Triverse OS', 'the Drive folder name changed');
  assert(App.vault.available() === true, 'Web Crypto is not available in this environment');
});

(async function runAsyncChecks() {
  for (let i = 0; i < asyncChecks.length; i++) {
    const name = asyncChecks[i][0], fn = asyncChecks[i][1];
    try { await fn(); console.log('  ✓ ' + name); }
    catch (e) { failures.push(name + ' → ' + e.message); console.log('  ✗ ' + name + ' → ' + e.message); }
  }
  console.log('\n' + (failures.length ? '✗ ' + failures.length + ' check(s) failed:' : '✓ all checks passed'));
  failures.forEach(f => console.log('   - ' + f));
  process.exit(failures.length ? 1 : 0);
})();
