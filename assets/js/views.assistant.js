/* =============================================================================
   Triverse OS — Assistant view
   The page where the studio hands work to the AI: give it a job, watch it plan
   and run each step against the real records, and read back everything it did.
   Permissions are the gate — nothing is sent or deleted unless switched on.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;
  const ui = App.ui;

  const EXAMPLES = [
    'Which businesses have no website and are worth a first message today?',
    'Write the first WhatsApp message for the best-rated business without a website.',
    'Build the website draft for the highest rated business that has no website.',
    'List every unpaid invoice and tell me who to chase first.',
    'Add a project for the newest won client and set it to development.',
    'Tidy up: mark every business with no reply after 14 days as qualified again.'
  ];

  function state() {
    App.router.q.assistant = App.router.q.assistant || { text: '', task: null, running: false };
    return App.router.q.assistant;
  }

  function permsOn() {
    const p = App.agent.perms();
    return App.agent.PERMS.filter(x => p[x[0]]).length;
  }

  function stats() {
    const list = App.agent.history();
    const steps = U.sum(list, t => (t.steps || []).length);
    return { tasks: list.length, steps: steps, perms: permsOn(), blocked: list.filter(t => t.status === 'blocked').length };
  }

  /* ------------------------------- composer -------------------------------- */
  function composer() {
    const s = state();
    const rows = state().task;
    return ui.card(
      ui.head('Give the assistant a job',
        '<button class="btn btn-ghost btn-sm" data-action="assistant.clear"><i class="fa-solid fa-eraser"></i> Clear</button>',
        'It reads the workspace, works out the steps, then runs only what your permissions allow') +
      '<div id="assistant-live">' + (s.running && s.task ? runningBox(s.task) : rows ? taskBox(rows) : idleBox()) + '</div>' +
      '<textarea class="inp mt-3" id="assistant-ask" rows="3" placeholder="e.g. Find every cafe in Addis Ababa with no website, build the draft site and write its first message">' +
      U.esc(s.text || '') + '</textarea>' +
      '<div class="btn-row mt-2.5">' +
      '<button class="btn btn-lime" data-action="assistant.run"><i class="fa-solid fa-wand-magic-sparkles"></i> Give it the job</button>' +
      '<button class="btn btn-ghost" data-action="assistant.history"><i class="fa-solid fa-clock-rotate-left"></i> History</button>' +
      '</div>' +
      '<div class="assistant__examples">' + EXAMPLES.map((e, i) =>
        '<button class="chip" data-action="assistant.example" data-arg="' + i + '">' + U.esc(e.length > 56 ? e.slice(0, 56) + '…' : e) + '</button>').join('') +
      '</div>'
    );
  }

  function idleBox() {
    return '<div class="assistant__idle">' +
      ui.icon('fa-robot', 'text-accentMint') +
      '<p>Nothing running. Describe the job in plain language — it will plan first, show you each step, and stop the moment a permission is missing.</p>' +
      '</div>';
  }

  function runningBox(task) {
    const steps = (task.steps || []);
    return '<div class="assistant__run">' +
      '<p class="assistant__say"><i class="fa-solid fa-wand-magic-sparkles fa-fade text-accentMint"></i> ' +
      U.esc(task.say || 'Reading the workspace and working out the steps…') + '</p>' +
      (steps.length ? steps.map(stepRow).join('') :
        '<div class="assistant__wait"><span class="dot-live"></span> planning…</div>') +
      '</div>';
  }

  function taskBox(task) {
    const tone = task.status === 'done' ? 'lime' : task.status === 'blocked' ? 'amber' : task.status === 'error' ? 'red' : 'muted';
    return '<div class="assistant__run">' +
      '<div class="assistant__headline tone tone-' + tone + '"><i class="fa-solid ' +
      (task.status === 'done' ? 'fa-circle-check' : task.status === 'blocked' ? 'fa-lock' : 'fa-circle-info') + '"></i> ' +
      '<span>' + U.esc(task.say || 'Finished') + '</span></div>' +
      '<p class="assistant__meta">' + (task.steps || []).length + ' step(s) · ' + U.esc(task.status) +
      (task.error ? ' · ' + U.esc(task.error) : '') + ' · ' + U.relTime(task.at) + '</p>' +
      ((task.steps || []).length ? (task.steps || []).map(stepRow).join('') : '<p class="assistant__meta">Nothing was changed.</p>') +
      '</div>';
  }

  function stepRow(row) {
    const blocked = row.result && row.result.blocked;
    const tone = blocked ? 'amber' : row.ok ? 'lime' : 'red';
    const summary = row.ok
      ? (row.result.data && row.result.count !== undefined ? row.result.count + ' row(s)'
        : U.esc(JSON.stringify(row.result.data || {}).slice(0, 260)))
      : U.esc((row.result && row.result.error) || 'failed');
    return '<div class="assistant__step tone tone-' + tone + '">' +
      '<div class="assistant__step-top">' +
      ui.icon(blocked ? 'fa-lock' : row.ok ? 'fa-circle-check' : 'fa-triangle-exclamation') +
      '<span class="assistant__tool">' + U.esc(row.tool) + '</span>' +
      '</div>' +
      (row.why ? '<p class="assistant__why">' + U.esc(row.why) + '</p>' : '') +
      '<p class="assistant__result">' + summary + '</p>' +
      '</div>';
  }

  /* ------------------------------ permissions ------------------------------ */
  function permissions() {
    const p = App.agent.perms();
    const tiles = App.agent.PERMS.map(x =>
      '<button class="assistant__perm' + (p[x[0]] ? ' is-on' : '') + '" data-action="assistant.perm" data-arg="' + x[0] + '">' +
      '<span class="assistant__perm-top">' + U.esc(x[1]) +
      '<i class="fa-solid ' + (p[x[0]] ? 'fa-toggle-on' : 'fa-toggle-off') + '"></i></span>' +
      '<span class="assistant__perm-sub">' + U.esc(x[2]) + '</span>' +
      '</button>').join('');
    return ui.card(
      ui.head('What it may do', '', 'Send and Delete stay off until you switch them on yourself') +
      '<div class="assistant__perms">' + tiles + '</div>'
    );
  }

  /* -------------------------------- history -------------------------------- */
  function historyCard() {
    const list = App.agent.history().slice(0, 6);
    return ui.card(
      ui.head('Recent jobs',
        '<button class="btn btn-ghost btn-sm" data-action="assistant.history"><i class="fa-solid fa-list-check"></i> All</button>',
        list.length ? list.length + ' most recent' : '') +
      (list.length
        ? '<div class="assistant__history">' + list.map(t =>
          '<button class="assistant__job" data-action="assistant.open" data-arg="' + U.attr(t.id) + '">' +
          '<span class="assistant__job-top"><b>' + U.esc(String(t.request || '').slice(0, 96)) + '</b>' +
          '<i class="fa-solid fa-chevron-right"></i></span>' +
          '<span class="assistant__job-sub">' + U.esc(t.status) + ' · ' + (t.steps || []).length + ' step(s) · ' + U.relTime(t.at) + '</span>' +
          '</button>').join('') + '</div>'
        : ui.empty('No jobs yet', 'The first job you give it is recorded here', 'fa-robot'))
    );
  }

  App.views.assistant = {
    title: 'Assistant',
    sub: 'Hand work to the AI — it plans, you approve the permissions, it runs',

    render(el) {
      const s = stats();
      const ready = App.ai.ready();
      el.innerHTML =
        (ready ? '' :
          '<div class="glass-soft rounded-xl p-3 mb-4 tone tone-amber border flex items-start gap-2">' +
          ui.icon('fa-key', 'text-amber-300 fa-fade') +
          '<p class="text-[11px]">No Gemini key saved yet. Add it in <b>Settings → AI</b> — you can set the permissions below right now.</p>' +
          '</div>') +
        '<div class="assistant__tiles">' +
        tile('Jobs run', s.tasks, 'fa-clipboard-check', 'lime') +
        tile('Steps taken', s.steps, 'fa-shoe-prints', 'blue') +
        tile('Permissions on', s.perms + ' of ' + App.agent.PERMS.length, 'fa-shield-halved', 'violet') +
        tile('Blocked', s.blocked, 'fa-lock', 'amber') +
        '</div>' +
        '<div class="assistant__grid">' +
        '<div>' + composer() + '</div>' +
        '<div>' + permissions() + historyCard() + '</div>' +
        '</div>';
      const box = document.getElementById('assistant-ask');
      if (box) {
        box.addEventListener('input', () => { state().text = box.value; });
        box.addEventListener('keydown', ev => {
          if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') { ev.preventDefault(); App.actions['assistant.run']({}, null); }
        });
      }
    }
  };

  function tile(label, value, icon, tone) {
    return '<div class="glass-soft rounded-xl p-3 flex items-center gap-3 assistant__tile">' +
      '<span class="assistant__tile-icon tone tone-' + tone + '">' + ui.icon(icon) + '</span>' +
      '<span class="min-w-0"><b>' + U.esc(String(value)) + '</b><i>' + U.esc(label) + '</i></span>' +
      '</div>';
  }

  /* --------------------------------- actions ------------------------------- */
  App.action('assistant.focus', () => {
    const box = document.getElementById('assistant-ask');
    if (box) { box.focus(); box.scrollIntoView({ block: 'center' }); }
  });

  App.action('assistant.example', el => {
    const text = EXAMPLES[Number(el.getAttribute('data-arg'))] || '';
    state().text = text;
    const box = document.getElementById('assistant-ask');
    if (box) { box.value = text; box.focus(); }
  });

  App.action('assistant.perm', el => {
    const key = el.getAttribute('data-arg');
    const p = App.agent.perms();
    App.agent.setPerm(key, !p[key]);
    App.ui.toast('Permission “' + key + '” ' + (!p[key] ? 'granted' : 'revoked'), 'lime');
    App.refresh();
  });

  App.action('assistant.clear', () => {
    state().text = '';
    state().task = null;
    App.refresh();
  });

  App.action('assistant.open', el => {
    const rec = App.agent.history().filter(t => t.id === el.getAttribute('data-arg'))[0];
    if (!rec) { App.ui.toast('That job is no longer in the history', 'muted'); return; }
    state().text = rec.request || '';
    state().task = rec;
    App.refresh();
  });

  App.action('assistant.history', () => {
    const list = App.agent.history();
    ui.modal({
      title: 'Assistant history',
      sub: list.length + ' jobs recorded',
      size: 'md',
      body: list.length
        ? '<div class="assistant__history assistant__history--modal">' + list.map(t =>
          '<div class="assistant__job is-static">' +
          '<span class="assistant__job-top"><b>' + U.esc(String(t.request || '')) + '</b></span>' +
          '<span class="assistant__job-sub">' + U.esc(t.status) + ' · ' + (t.steps || []).length + ' step(s) · ' + U.relTime(t.at) + '</span>' +
          '<p class="assistant__job-say">' + U.esc(t.say || '') + '</p>' +
          ((t.steps || []).length ? '<p class="assistant__why">' + (t.steps || []).map(s => U.esc(s.tool)).join(' · ') + '</p>' : '') +
          '</div>').join('') + '</div>'
        : ui.empty('Nothing yet', 'Give the assistant its first job', 'fa-robot'),
      footer: '<button class="btn btn-ghost" data-action="close-modal">Close</button>'
    });
  });

  App.action('assistant.run', () => {
    const box = document.getElementById('assistant-ask');
    const text = (box ? box.value : state().text || '').trim();
    if (!text) { App.ui.toast('Describe the job first', 'amber'); return; }
    if (!App.ai.ready()) { App.ui.toast('Add the Gemini key in Settings → AI first', 'amber'); App.router.go('settings'); return; }

    state().text = text;
    state().running = true;
    state().task = { say: '', steps: [], status: 'running', at: U.now(), request: text };
    const live = document.getElementById('assistant-live');
    if (live) live.innerHTML = runningBox(state().task);

    App.agent.task(text, {
      rounds: 3,
      onStep(row) {
        state().task.steps.push(row);
        const target = document.getElementById('assistant-live');
        if (target) target.innerHTML = runningBox(state().task);
      }
    }).then(task => {
      state().running = false;
      state().task = task;
      const target = document.getElementById('assistant-live');
      if (target) target.innerHTML = taskBox(task);
      App.ui.toast(task.status === 'done' ? 'Job finished' : 'Job ' + task.status, task.status === 'done' ? 'lime' : 'amber');
      App.refresh();
    }).catch(err => {
      state().running = false;
      state().task = { say: String(err.message || err), steps: [], status: 'error', at: U.now(), request: text };
      const target = document.getElementById('assistant-live');
      if (target) target.innerHTML = taskBox(state().task);
    });
  });
})(window);
