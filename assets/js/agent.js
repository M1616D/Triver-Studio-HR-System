/* =============================================================================
   Triverse OS — the assistant
   Gemini is given a job description and a fixed set of tools. It plans in
   steps, shows you the plan, and only runs a step when the permission for that
   group of tools is switched on. Everything it does is written to an audit log
   so you can always see what changed and why.

   Nothing is ever sent to a business and nothing is ever deleted unless you
   switch those two permissions on yourself.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;

  /* ------------------------------------------------------------------ rights */
  const PERMS = [
    ['read', 'Read', 'See businesses, clients, projects, files and money', true],
    ['draft', 'Draft', 'Write messages and build website drafts', true],
    ['records', 'Records', 'Create projects, clients, invoices and change statuses', true],
    ['files', 'Files', 'Store and tag files in the vault', true],
    ['send', 'Send', 'Actually open or send a message to a business', false],
    ['erase', 'Delete', 'Remove records permanently', false]
  ];

  function perms() {
    const saved = App.store.get('settings.ai.perms', {}) || {};
    const out = {};
    PERMS.forEach(p => { out[p[0]] = saved[p[0]] === undefined ? p[3] : saved[p[0]] === true; });
    return out;
  }

  const agent = App.agent = {
    PERMS: PERMS,

    perms: perms,

    /** switch one permission on or off (saved instantly, audited) */
    setPerm(key, on) {
      const all = Object.assign({}, App.store.get('settings.ai.perms', {}), {});
      all[key] = Boolean(on);
      App.store.set('settings.ai.perms', all);
      App.store.save();
      App.log('assistant', 'Permission “' + key + '” ' + (on ? 'granted' : 'revoked'), '');
      return perms();
    },

    allowed(group) { return perms()[group] === true; },

    /* ----------------------------------------------------------------- tools */
    /**
     * Each tool is a small, honest action on the real data. `group` names the
     * permission that has to be granted before it can run.
     */
    tools: {
      list_businesses: {
        group: 'read', label: 'List businesses',
        args: '{ "status": "new|qualified|interested|contacted|won|lost|rejected (optional)", "type": "business type key (optional)", "hasWebsite": true|false (optional)", "limit": 20 }',
        run(a) {
          let list = App.store.get('leads', []).slice();
          if (a.status) list = list.filter(x => x.status === a.status);
          if (a.type) list = list.filter(x => x.businessType === a.type);
          if (a.hasWebsite === true) list = list.filter(x => x.website);
          if (a.hasWebsite === false) list = list.filter(x => !x.website);
          list = list.slice(0, Math.min(Number(a.limit) || 20, 50));
          return {
            ok: true, count: list.length,
            data: list.map(x => ({
              id: x.id, name: x.name, type: x.businessType, status: x.status,
              area: x.areaLabel || x.city || '', rating: x.rating, reviews: x.reviews,
              website: x.website || 'none', phone: x.phone || '', value: App.msg.recommend(x).total
            }))
          };
        }
      },
      business_detail: {
        group: 'read', label: 'Read one business',
        args: '{ "id": "business id" }',
        run(a) {
          const l = App.store.find('leads', a.id);
          if (!l) return { ok: false, error: 'No business with id ' + a.id };
          return {
            ok: true, data: {
              id: l.id, name: l.name, type: l.businessType, category: l.category, status: l.status,
              address: l.address, area: l.areaLabel || l.city, phone: l.phone, website: l.website || 'none',
              rating: l.rating, reviews: l.reviews, openNow: l.openNow,
              hours: (l.hoursWeek || []).join(' | '), summary: l.summary || '',
              email: l.email || '', telegram: l.telegram || '', whatsapp: l.intlPhone || '',
              reviewsList: (l.reviewsList || []).slice(0, 4).map(r => r.author + ': ' + String(r.text || '').slice(0, 180)),
              recommended: App.msg.recommend(l).items.map(i => i.name + ' ' + U.money(i.price))
            }
          };
        }
      },
      overview: {
        group: 'read', label: 'Workspace overview',
        args: '{}',
        run() {
          const leads = App.store.get('leads', []);
          const pay = App.store.get('payments', []);
          const sites = App.store.get('sites', []);
          const sum = f => U.sum(pay.filter(f), x => Number(x.amount) || 0);
          return {
            ok: true, data: {
              businesses: leads.length,
              byStatus: leads.reduce((m, l) => { m[l.status || 'new'] = (m[l.status || 'new'] || 0) + 1; return m; }, {}),
              withoutWebsite: leads.filter(l => !l.website).length,
              clients: App.store.get('clients', []).length,
              projects: sites.length,
              invoices: pay.length,
              invoiced: U.money(sum(() => true)),
              paid: U.money(sum(x => x.status === 'paid')),
              unpaid: U.money(sum(x => x.status !== 'paid')),
              openDrafts: sites.filter(s => s.kind === 'draft').length,
              files: (App.files ? App.files.all().length : 0)
            }
          };
        }
      },
      list_projects: {
        group: 'read', label: 'List projects and websites',
        args: '{ "phase": "live|development|delivered|maintenance|paused (optional)" }',
        run(a) {
          let list = App.store.get('sites', []).slice();
          if (a.phase) list = list.filter(x => (x.phase || (x.status === 'live' ? 'live' : 'development')) === a.phase);
          return {
            ok: true, count: list.length,
            data: list.slice(0, 40).map(x => ({
              id: x.id, name: x.name, client: x.clientName || '', phase: x.phase || x.status,
              url: x.url || '', price: Number(x.price) || 0, renews: x.hostRenewDate || ''
            }))
          };
        }
      },
      list_clients: {
        group: 'read', label: 'List clients',
        args: '{ "stage": "prospect|active|won|lost (optional)" }',
        run(a) {
          let list = App.store.get('clients', []).slice();
          if (a.stage) list = list.filter(x => x.stage === a.stage);
          return {
            ok: true, count: list.length,
            data: list.slice(0, 40).map(x => ({ id: x.id, name: x.name, stage: x.stage, industry: x.industry, phone: x.phone }))
          };
        }
      },
      list_money: {
        group: 'read', label: 'Read the invoices',
        args: '{ "unpaidOnly": true|false }',
        run(a) {
          let list = App.store.get('payments', []).slice();
          if (a.unpaidOnly) list = list.filter(x => x.status !== 'paid');
          return {
            ok: true, count: list.length,
            data: list.slice(0, 40).map(x => ({
              id: x.id, invoiceNo: x.invoiceNo, client: (App.store.find('clients', x.clientId) || {}).name || '',
              title: x.projectTitle, amount: Number(x.amount) || 0, paid: Number(x.amountPaid) || 0,
              status: x.status, due: x.dueDate || '', renews: x.renewalDate || ''
            }))
          };
        }
      },
      list_files: {
        group: 'read', label: 'Search the file vault',
        args: '{ "search": "text (optional)" }',
        run(a) {
          const all = App.files ? App.files.all() : [];
          const list = a.search ? all.filter(f => U.hit(f.name, a.search) || U.hit(f.category, a.search) || U.hit(f.description, a.search)) : all;
          return {
            ok: true, count: list.length,
            data: list.slice(0, 30).map(f => ({ id: f.id, name: f.name, category: f.category, size: U.bytes(f.size), project: f.projectId || '' }))
          };
        }
      },

      draft_message: {
        group: 'draft', label: 'Draft the message for a business',
        args: '{ "id": "business id", "channel": "whatsapp|telegram|email (optional)", "focus": "what to push (optional)" }',
        run(a) {
          const l = App.store.find('leads', a.id);
          if (!l) return { ok: false, error: 'No business with id ' + a.id };
          const tpl = App.msg.defaultTemplate(l);
          const body = App.msg.render(tpl, l).body;
          if (App.router.q) {
            App.router.q.compose = App.router.q.compose || {};
            App.router.q.compose[l.id] = body;
          }
          return { ok: true, data: { business: l.name, channel: a.channel || (tpl && tpl.channel) || 'whatsapp', text: body, keptInComposer: true } };
        }
      },
      build_site: {
        group: 'draft', label: 'Build the website draft',
        args: '{ "id": "business id", "sampleId": "optional sample id" }',
        run(a) {
          const l = App.store.find('leads', a.id);
          if (!l) return { ok: false, error: 'No business with id ' + a.id };
          const sample = a.sampleId ? App.samples.find(a.sampleId) : App.samples.forBusiness(l);
          const res = App.sitegen.save(l, sample ? sample.id : '', { sampleId: sample ? sample.id : undefined });
          return {
            ok: true, data: {
              siteId: res.site.id, name: res.site.name, sample: (res.meta && res.meta.sampleName) || '',
              fieldsFilled: (res.meta && res.meta.placeholders ? res.meta.placeholders.length : 0),
              detailsReplaced: (res.meta && res.meta.swapped ? res.meta.swapped.length : 0),
              sizeKb: Math.round((res.html || '').length / 1024)
            }
          };
        }
      },
      create_project: {
        group: 'records', label: 'Create a project record',
        args: '{ "name": "project name", "phase": "live|development|delivered|maintenance", "url": "", "clientName": "", "price": 0 }',
        run(a) {
          if (!a.name) return { ok: false, error: 'name is required' };
          const phase = a.phase || 'development';
          const client = a.clientName ? App.store.findBy('clients', c => U.hit(c.name, a.clientName)) : null;
          const rec = App.store.add('sites', {
            name: a.name, phase: phase, kind: 'project',
            status: phase === 'live' ? 'live' : phase === 'delivered' ? 'archived' : 'draft',
            clientId: client ? client.id : '', clientName: client ? client.name : 'Triverse Studio',
            url: a.url || '', price: Number(a.price) || 0, progressPct: phase === 'live' ? 100 : 40,
            generatedFrom: null, notes: a.notes || 'Created by the assistant'
          });
          App.log('project', 'Project “' + rec.name + '” created by the assistant', rec.id);
          return { ok: true, data: { id: rec.id, name: rec.name, phase: rec.phase } };
        }
      },
      create_client: {
        group: 'records', label: 'Create a client record',
        args: '{ "name": "client name", "phone": "", "industry": "", "fromBusinessId": "optional business id" }',
        run(a) {
          if (!a.name) return { ok: false, error: 'name is required' };
          const lead = a.fromBusinessId ? App.store.find('leads', a.fromBusinessId) : null;
          const existing = App.store.findBy('clients', c => U.hit(c.name, a.name));
          if (existing) return { ok: true, data: { id: existing.id, name: existing.name, note: 'already existed' } };
          const rec = App.store.add('clients', {
            name: a.name, type: 'company', stage: 'prospect', industry: a.industry || (lead ? lead.businessType : ''),
            phone: a.phone || (lead ? lead.phone : ''), address: lead ? lead.address : '',
            website: lead ? lead.website : '', source: lead ? lead.source : 'assistant',
            sourceLeadId: lead ? lead.id : '', accountManager: App.store.get('settings.company.senderName', ''),
            health: 'warm', tags: ['from-assistant'], notes: a.notes || 'Created by the assistant.'
          });
          if (lead) App.store.patch('leads', lead.id, { clientId: rec.id });
          App.log('client', 'Client “' + rec.name + '” created by the assistant', rec.id);
          return { ok: true, data: { id: rec.id, name: rec.name } };
        }
      },
      create_invoice: {
        group: 'records', label: 'Raise an invoice',
        args: '{ "clientName": "", "title": "what it is for", "amount": 0, "status": "due|paid", "dueDate": "YYYY-MM-DD" }',
        run(a) {
          const client = a.clientName ? App.store.findBy('clients', c => U.hit(c.name, a.clientName)) : null;
          if (!client) return { ok: false, error: 'No client matching “' + (a.clientName || '') + '” — create the client first.' };
          const n = (App.store.get('counters.invoice', 0) || 0) + 1;
          const invoiceNo = 'TS-' + String(n).padStart(4, '0');
          App.store.set('counters.invoice', n, { silent: true });
          const rec = App.store.add('payments', {
            invoiceNo: invoiceNo, clientId: client.id, projectTitle: a.title || 'Website project',
            amount: Number(a.amount) || 0, amountPaid: a.status === 'paid' ? Number(a.amount) || 0 : 0,
            method: a.method || 'bank', status: a.status === 'paid' ? 'paid' : 'due',
            issueDate: U.todayISO(), dueDate: a.dueDate || '', currency: 'ETB',
            notes: a.notes || 'Raised by the assistant'
          });
          App.log('payment', 'Invoice ' + invoiceNo + ' raised for ' + client.name + ' · ' + U.money(rec.amount), client.id);
          return { ok: true, data: { id: rec.id, invoiceNo: invoiceNo, client: client.name, amount: U.money(rec.amount) } };
        }
      },
      set_business_status: {
        group: 'records', label: 'Move a business forward',
        args: '{ "id": "business id", "status": "qualified|interested|contacted|replied|won|lost|rejected" }',
        run(a) {
          const l = App.store.find('leads', a.id);
          if (!l) return { ok: false, error: 'No business with id ' + a.id };
          App.store.patch('leads', l.id, { status: a.status });
          App.log('lead', l.name + ' moved to “' + a.status + '” by the assistant', l.id);
          return { ok: true, data: { id: l.id, name: l.name, status: a.status } };
        }
      },

      send_message: {
        group: 'send', label: 'Send the message',
        args: '{ "id": "business id", "channel": "whatsapp|telegram|email", "text": "the message body" }',
        run(a) {
          const l = App.store.find('leads', a.id);
          if (!l) return { ok: false, error: 'No business with id ' + a.id };
          const text = a.text || App.msg.render(App.msg.defaultTemplate(l), l).body;
          return App.msg.send({ lead: l, channel: a.channel || 'whatsapp', body: text })
            .then(r => ({ ok: true, data: { via: r.via, channel: a.channel || 'whatsapp', business: l.name, text: text } }));
        }
      },
      delete_record: {
        group: 'erase', label: 'Delete a record',
        args: '{ "collection": "leads|clients|sites|payments|documents", "id": "record id" }',
        run(a) {
          if (!a.collection || !a.id) return { ok: false, error: 'collection and id are required' };
          const rec = App.store.find(a.collection, a.id);
          if (!rec) return { ok: false, error: 'Nothing found to delete' };
          App.store.remove(a.collection, a.id);
          App.log('assistant', 'Deleted ' + a.collection + ' record “' + (rec.name || rec.invoiceNo || a.id) + '”', '');
          return { ok: true, data: { collection: a.collection, removed: rec.name || rec.invoiceNo || a.id } };
        }
      }
    },

    /** the tool catalogue, written out for the model */
    catalogue() {
      const p = perms();
      return Object.keys(agent.tools).map(k => {
        const t = agent.tools[k];
        return '- ' + k + '  [' + t.group + (p[t.group] ? '' : ' — PERMISSION OFF, do not use') + ']\n    ' + t.label + '\n    args: ' + t.args;
      }).join('\n');
    },

    /** a compact picture of the workspace so the model can resolve names to ids */
    digest() {
      const out = [];
      const leads = App.store.get('leads', []);
      out.push('BUSINESSES (' + leads.length + ') — id | name | type | status | website');
      leads.slice(0, 25).forEach(l => out.push('  ' + l.id + ' | ' + l.name + ' | ' + l.businessType + ' | ' + (l.status || 'new') + ' | ' + (l.website || 'none')));
      const clients = App.store.get('clients', []);
      out.push('CLIENTS (' + clients.length + ') — id | name | stage');
      clients.slice(0, 15).forEach(c => out.push('  ' + c.id + ' | ' + c.name + ' | ' + (c.stage || '')));
      const sites = App.store.get('sites', []);
      out.push('PROJECTS & WEBSITES (' + sites.length + ') — id | name | phase | client');
      sites.slice(0, 15).forEach(s => out.push('  ' + s.id + ' | ' + s.name + ' | ' + (s.phase || s.status) + ' | ' + (s.clientName || '')));
      const pay = App.store.get('payments', []);
      out.push('INVOICES (' + pay.length + ') — id | no | client | amount | status');
      pay.slice(0, 15).forEach(p => out.push('  ' + p.id + ' | ' + p.invoiceNo + ' | ' + ((App.store.find('clients', p.clientId) || {}).name || '') + ' | ' + (Number(p.amount) || 0) + ' | ' + p.status));
      out.push('SAMPLES: ' + App.samples.list().map(s => s.id + ' (' + s.category + ')').join(', '));
      out.push('TODAY: ' + U.todayISO());
      return out.join('\n');
    },

    RULES: [
      'You are the operations assistant inside Triverse Studio Software Solution (Addis Ababa, Ethiopia).',
      'You act on the company\'s own records through the tools listed. You never invent a record, an id, a price or a fact.',
      'Only use a tool if its permission is on. If the job needs a tool whose permission is off, do the part you can and say plainly in "say" which permission has to be switched on.',
      'Prefer reading before writing. Never guess an id — ids come from the digest or from an earlier step result.',
      'Money is Ethiopian Birr, written like “Br 55,000”. Dates are YYYY-MM-DD.',
      'Return JSON only, no markdown and no commentary outside the JSON object.'
    ].join('\n'),

    /**
     * One round: the model answers with what it understood and the steps to run.
     * `history` carries earlier rounds so it can chain (read → decide → act).
     */
    plan(request, history) {
      const prompt = 'THE REQUEST\n' + request + '\n\n' +
        'THE WORKSPACE RIGHT NOW\n' + agent.digest() + '\n\n' +
        'TOOLS AVAILABLE\n' + agent.catalogue() + '\n\n' +
        (history && history.length
          ? 'STEPS ALREADY RUN IN THIS TASK\n' + history.map((h, i) => (i + 1) + '. ' + h.tool + ' → ' + JSON.stringify(h.result).slice(0, 900)).join('\n') + '\n\n'
          : '') +
        'Answer with JSON in exactly this shape:\n' +
        '{"say":"one or two plain sentences to the operator: what you understood and what you are about to do",' +
        '"steps":[{"tool":"tool_name","args":{...},"why":"short reason"}, ...],' +
        '"done":true|false}\n' +
        'Rules: at most 6 steps per answer. Set "done":true only when no further step is needed. ' +
        (history && history.length ? 'If the earlier steps already finished the job, return "steps":[] and "done":true with a summary in "say".' : 'Start with the steps that gather what you need.');
      return App.ai.call(prompt, { temperature: 0.25, maxTokens: 2200, system: agent.RULES })
        .then(txt => App.ai.parseJSON(txt));
    },

    /** run one planned step, respecting its permission */
    runStep(step) {
      const tool = agent.tools[step && step.tool];
      if (!tool) return Promise.resolve({ ok: false, error: 'Unknown tool “' + (step && step.tool) + '”' });
      if (!agent.allowed(tool.group)) {
        return Promise.resolve({ ok: false, blocked: tool.group, error: 'Permission “' + tool.group + '” is off — switch it on in the assistant panel and run again.' });
      }
      let out;
      try { out = tool.run(step.args || {}); }
      catch (e) { return Promise.resolve({ ok: false, error: e.message }); }
      return Promise.resolve(out).catch(e => ({ ok: false, error: e.message }));
    },

    /** the full task: plan, run, hand the results back, repeat until done */
    task(request, opts) {
      opts = opts || {};
      const history = [];
      const rounds = opts.rounds || 3;
      const record = {
        id: U.uid('task'), at: U.now(), request: request, say: '', steps: [],
        status: 'running', rounds: 0
      };

      const loop = n => {
        if (n > rounds) return Promise.resolve(record);
        return agent.plan(request, history).then(p => {
          record.rounds = n;
          if (p.say) record.say = p.say;
          const steps = (p.steps || []).slice(0, 6);
          if (!steps.length) {
            record.status = 'done';
            return record;
          }
          if (opts.onPlan) opts.onPlan(steps, p.say || '');
          const filtered = steps;
          return Promise.all(filtered.map(s => agent.runStep(s).then(r => {
            const row = { tool: s.tool, args: s.args || {}, why: s.why || '', result: r, ok: r.ok === true };
            history.push(row);
            record.steps.push(row);
            if (opts.onStep) opts.onStep(row, history.length, filtered.length);
            return row;
          }))).then(rows => {
            const blocked = rows.filter(r => r.result && r.result.blocked);
            const failed = rows.filter(r => !r.ok && !(r.result && r.result.blocked));
            if (blocked.length) { record.status = 'blocked'; return record; }
            if (p.done === true) { record.status = 'done'; return record; }
            if (failed.length && failed.length === rows.length) { record.status = 'stopped'; return record; }
            return loop(n + 1);
          });
        });
      };

      return loop(1)
        .then(r => {
          r.status = r.status === 'running' ? 'done' : r.status;
          r.finishedAt = U.now();
          if (opts.audit !== false) agent.audit(r);
          return r;
        })
        .catch(err => {
          record.status = 'error';
          record.error = err.message;
          if (opts.audit !== false) agent.audit(record);
          return record;
        });
    },

    /* -------------------------------------------------------------- audit log */
    audit(rec) {
      const list = (App.store.get('aiTasks', []) || []).slice();
      list.unshift(rec);
      App.store.set('aiTasks', list.slice(0, 200), { silent: true });
      App.store.save();
      App.emit('state:changed', { path: 'aiTasks' });
      return rec;
    },

    history() { return App.store.get('aiTasks', []) || []; }
  };

  /* ==========================================================================
     the assistant panel
     ====================================================================== */
  const EXAMPLES = [
    'Which businesses have no website and are worth a first message today?',
    'Read the bakery with the best rating and write its first WhatsApp message.',
    'Build the website draft for the highest rated business without a website.',
    'List every unpaid invoice and tell me who to chase first.'
  ];

  function permsPanel() {
    const p = perms();
    return '<div class="glass-soft rounded-xl p-3 mb-3">' +
      '<p class="text-[11px] font-semibold mb-2">' + App.ui.icon('fa-shield-halved', 'text-accentMint') + ' What the assistant may do</p>' +
      '<div class="grid grid-cols-1 md:grid-cols-3 gap-2">' +
      PERMS.map(x => '<button class="text-left rounded-lg border px-3 py-2 transition ' +
        (p[x[0]] ? 'border-limeAccent bg-accentMint/10' : 'border-borderMain bg-bgPanel hover:border-limeAccent/40') +
        '" data-action="ai.perm" data-arg="' + x[0] + '">' +
        '<span class="text-[11px] font-semibold">' + U.esc(x[1]) + (p[x[0]] ? ' · on' : ' · off') + '</span>' +
        '<span class="block text-[9px] text-textMuted leading-snug">' + U.esc(x[2]) + '</span></button>').join('') +
      '</div></div>';
  }

  function stepRow(row) {
    const tone = row.result && row.result.blocked ? 'amber' : row.ok ? 'lime' : 'red';
    const summary = row.ok
      ? (row.result.data && row.result.count !== undefined ? row.result.count + ' row(s)'
        : JSON.stringify(row.result.data || {}).slice(0, 220))
      : U.esc(row.result && row.result.error ? row.result.error : 'failed');
    return '<div class="glass-soft rounded-xl p-3 mb-2 tone tone-' + tone + ' border">' +
      '<p class="text-[10px] font-semibold">' + (row.ok ? App.ui.icon('fa-circle-check') : App.ui.icon(row.result && row.result.blocked ? 'fa-lock' : 'fa-triangle-exclamation')) + ' ' +
      U.esc(row.tool) + '</p>' +
      (row.why ? '<p class="text-[9px] text-textMuted">' + U.esc(row.why) + '</p>' : '') +
      '<p class="text-[10px] mt-1 break-words">' + (row.ok ? summary : summary) + '</p></div>';
  }

  function resultsBox(task) {
    const body = (task.steps || []).length
      ? (task.steps || []).map(stepRow).join('')
      : '<p class="text-[11px] text-textMuted">Nothing was changed.</p>';
    return '<div class="glass-soft rounded-xl p-3 mb-3"><p class="text-[11px] font-semibold mb-1">' + U.esc(task.say || 'Done') + '</p>' +
      '<p class="text-[10px] text-textMuted mb-2">' + (task.steps || []).length + ' step(s) · ' + U.esc(task.status) +
      (task.error ? ' · ' + U.esc(task.error) : '') + '</p>' + body + '</div>';
  }

  App.action('ai.openAssistant', () => {
    const hasKey = App.ai.ready();
    App.router.q.aiAsk = App.router.q.aiAsk || { text: '', task: null, busy: false };
    const q = App.router.q.aiAsk;
    App.ui.modal({
      title: 'Assistant',
      sub: hasKey
        ? 'Give it a job. It plans, shows you the steps, and only touches what you allowed.'
        : 'Switch the permissions on now; the key in Settings → AI turns the planner on.',
      size: 'lg',
      body:
        permsPanel() +
        (hasKey ? '' :
          '<div class="glass-soft rounded-xl p-3 mb-3 tone tone-amber border text-[11px]">' +
          App.ui.icon('fa-key', 'text-amber-300') + ' No Gemini key yet — permissions can be set now. ' +
          'Add the key in <b>Settings → AI</b> and the assistant starts working on its own.</div>') +
        '<div id="ai-assistant-body">' + (q.task ? resultsBox(q.task) : '') + '</div>' +
        '<label class="lbl mt-2">What should it do?</label>' +
        '<textarea class="inp" id="ai-ask" rows="3" placeholder="Read the best-rated business without a website and write its first message">' + U.esc(q.text || '') + '</textarea>' +
        '<div class="flex flex-wrap gap-1.5 mt-2">' + EXAMPLES.map((e, i) =>
          '<button class="chip" data-action="ai.example" data-arg="' + i + '">' + U.esc(e.slice(0, 46)) + (e.length > 46 ? '…' : '') + '</button>').join('') + '</div>',
      footer: '<button class="btn btn-ghost" data-action="close-modal">Close</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="ai.log"><i class="fa-solid fa-clock-rotate-left"></i> History</button>' +
        (hasKey
          ? '<button class="btn btn-lime" id="ai-run" data-action="ai.run"><i class="fa-solid fa-wand-magic-sparkles"></i> Work out a plan</button>'
          : '<button class="btn btn-lime" data-nav="settings"><i class="fa-solid fa-key"></i> Add the key in Settings</button>')
    });
  });

  App.action('ai.perm', el => {
    const key = el.getAttribute('data-arg');
    const p = perms();
    agent.setPerm(key, !p[key]);
    App.ui.toast(key + ' permission ' + (!p[key] ? 'granted' : 'revoked'), 'lime');
    App.actions['ai.openAssistant']({}, null);
  });

  App.action('ai.example', el => {
    const text = EXAMPLES[Number(el.getAttribute('data-arg'))] || '';
    const box = document.getElementById('ai-ask');
    if (box) box.value = text;
    App.router.q.aiAsk.text = text;
  });

  App.action('ai.run', () => {
    const box = document.getElementById('ai-ask');
    const body = document.getElementById('ai-assistant-body');
    const text = (box ? box.value : App.router.q.aiAsk.text || '').trim();
    if (!text) { App.ui.toast('Type what you want done', 'amber'); return; }
    App.router.q.aiAsk.text = text;
    if (body) body.innerHTML = '<div class="glass-soft rounded-xl p-3 text-[11px] text-textMuted flex items-center gap-2">' +
      '<i class="fa-solid fa-wand-magic-sparkles fa-fade text-accentMint"></i> Reading the workspace and working out the steps…</div>';
    agent.task(text, {
      rounds: 3,
      onStep(row) {
        const target = document.getElementById('ai-assistant-body');
        if (target) target.innerHTML = '<div class="glass-soft rounded-xl p-3 mb-2 text-[11px]">' +
          '<p class="font-semibold mb-1">Running…</p>' + stepRow(row) + '</div>';
      }
    }).then(task => {
      App.router.q.aiAsk.task = task;
      const target = document.getElementById('ai-assistant-body');
      if (target) target.innerHTML = resultsBox(task);
      App.ui.toast(task.status === 'done' ? 'Task finished' : 'Task ' + task.status, task.status === 'done' ? 'lime' : 'amber');
      App.refresh();
    }).catch(err => {
      const target = document.getElementById('ai-assistant-body');
      if (target) target.innerHTML = '<div class="glass-soft rounded-xl p-3 text-[11px] tone tone-red border whitespace-pre-line">' + U.esc(err.message) + '</div>';
    });
  });

  App.action('ai.log', () => {
    const list = agent.history();
    App.ui.modal({
      title: 'Assistant history',
      sub: list.length + ' tasks recorded on this device',
      size: 'md',
      body: list.length
        ? '<div class="space-y-2 max-h-[440px] overflow-auto">' + list.map(t =>
          '<div class="glass-soft rounded-xl p-3">' +
          '<p class="text-[11px] font-semibold">' + U.esc(t.request) + '</p>' +
          '<p class="text-[9px] text-textMuted">' + U.relTime(t.at) + ' · ' + U.esc(t.status) + ' · ' + (t.steps || []).length + ' step(s)</p>' +
          '<p class="text-[10px] mt-1">' + U.esc(t.say || '') + '</p>' +
          ((t.steps || []).length ? '<p class="text-[9px] text-textMuted mt-1">' + (t.steps || []).map(s => U.esc(s.tool)).join(' · ') + '</p>' : '') +
          '</div>').join('') + '</div>'
        : '<p class="text-[11px] text-textMuted">Nothing yet.</p>',
      footer: '<button class="btn btn-ghost" data-action="close-modal">Close</button>'
    });
  });
})(window);
