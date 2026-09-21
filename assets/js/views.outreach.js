/* =============================================================================
   Triverse OS — Outreach desk + Pipeline
   Compose personalised cold messages, send in one tap, triage replies
   (positive → work it, negative → jump to the next business) and move the
   deal through the pipeline board.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;
  const ui = App.ui;

  function o() {
    App.router.q.outreach = App.router.q.outreach || { leadId: '', channel: 'whatsapp', templateId: '', mode: 'compose', dirty: {} };
    return App.router.q.outreach;
  }

  function hotList() {
    return U.sortBy(App.store.get('leads', []).filter(l => ['interested', 'replied'].indexOf(l.status) !== -1), l => l.lastReplyAt || l.updatedAt || '', 'desc');
  }
  function triageList() { return App.store.get('leads', []).filter(l => l.reply && l.status !== 'won' && l.status !== 'rejected' && (!l.reply.reasons || l.reply.reasons.length === 0)); }
  function dueList() { return App.store.get('leads', []).filter(l => l.nextFollowUp && l.nextFollowUp <= U.todayISO() && ['won', 'lost', 'rejected', 'skipped'].indexOf(l.status) === -1); }
  function stoppedList() { return App.store.get('leads', []).filter(l => l.status === 'rejected' || l.status === 'lost'); }

  function channelChips(lead, current) {
    return App.msg.channelsFor(lead).map(ch =>
      '<button class="chip ' + (ch.key === current ? 'is-on' : '') + '" data-action="outreach.channel" data-arg="' + ch.key + '">' +
      App.dict.chanIcon(ch.key, 'text-[9px]') + ' ' + U.esc(App.dict.chanLabel(ch.key)) + '</button>').join('');
  }

  function composer(lead) {
    if (!lead) {
      return ui.card(ui.empty('Pick a business to message', 'Choose one from the queues on the right, or open a lead from Discover.', 'fa-comment-dots',
        '<button class="btn btn-lime btn-sm" data-nav="discover">Go to Discover</button>'));
    }
    const s = o();
    const tpl = App.msg.template(s.templateId) || App.msg.defaultTemplate(lead);
    if (!s.templateId) s.templateId = tpl.id;
    const rendered = App.msg.render(tpl, lead);
    const body = s.body && s.dirty[lead.id + ':' + tpl.id] ? s.body : rendered.body;
    const rec = App.msg.recommend(lead);
    const channels = App.msg.channelsFor(lead);

    return ui.card(
      ui.head('Compose · ' + lead.name,
        '<div class="flex items-center gap-2">' +
        '<button class="btn btn-ghost btn-sm" data-action="outreach.openLead" data-arg="' + lead.id + '"><i class="fa-solid fa-circle-info"></i> Deep info</button>' +
        (App.router.q.batch ? ui.badge('batch mode', 'lime') : '') + '</div>',
        (lead.category || '') + ' · ' + (lead.website ? 'has a website' : 'no website on Google')) +

      '<div class="flex flex-wrap gap-1.5 mb-3">' + channelChips(lead, s.channel) +
      '<span class="text-[10px] text-textMuted self-center ml-1">' + (channels.length ? channels.length + ' reachable channels detected' : 'no contact details yet') + '</span></div>' +

      '<div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">' +
      '<div><label class="lbl">Message template</label><select class="inp" data-model="ui.outreachTemplate" data-change-action="outreach.retemplate">' +
      App.msg.templates().map(t => '<option value="' + U.attr(t.id) + '"' + (t.id === tpl.id ? ' selected' : '') + '>' + U.esc(t.name) + ' · ' + U.esc(App.dict.chanLabel(t.channel)) + '</option>').join('') +
      '</select></div>' +
      '<div><label class="lbl">Recommended offer · ' + U.money(rec.total) + ' · ' + U.esc(rec.deliveryLabel) + '</label>' +
      '<div class="flex flex-wrap gap-1">' + rec.items.map(i => '<span class="tag">' + U.esc(i.name) + '</span>').join('') + '</div></div>' +
      '</div>' +

      (tpl.channel === 'email' ? ui.field({ label: 'Subject', model: 'ui.outreachSubject', value: rendered.subject, wrapCls: 'mb-2' }) : '') +
      '<textarea class="inp" id="outreach-body" rows="13" data-model="ui.outreachBody">' + U.esc(body) + '</textarea>' +

      '<div class="flex items-center justify-between gap-2 mt-2 flex-wrap">' +
      '<p class="text-[9px] text-textMuted">Merge fields are filled from the Google data — edit anything before sending.</p>' +
      '<div class="btn-row">' +
      '<button class="btn btn-ghost btn-sm" data-action="outreach.retemplate"><i class="fa-solid fa-rotate"></i> Reset text</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="outreach.copy"><i class="fa-solid fa-copy"></i> Copy</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="outreach.preview"><i class="fa-solid fa-eye"></i> Variables</button>' +
      '</div></div>' +

      '<div class="btn-row mt-3">' +
      '<button class="btn btn-lime" data-action="outreach.send"><i class="fa-solid fa-paper-plane"></i> Send on ' + U.esc(App.dict.chanLabel(s.channel)) + '</button>' +
      '<button class="btn btn-ghost" data-action="outreach.logReply" data-arg="' + lead.id + '"><i class="fa-solid fa-reply"></i> Log their reply</button>' +
      '<button class="btn btn-ghost" data-action="outreach.toNext"><i class="fa-solid fa-forward"></i> Skip to next lead</button>' +
      '</div>' +
      (App.store.get('settings.integration.autoSendEnabled') ? '<p class="text-[9px] text-limeAccent mt-2"><i class="fa-solid fa-bolt"></i> Auto-send API is ON — messages are posted without opening a chat.</p>'
        : '<p class="text-[9px] text-textMuted mt-2"><i class="fa-solid fa-circle-info"></i> Sending opens WhatsApp / Telegram / your mail app with the text ready, and logs the attempt. Connect the WhatsApp Cloud API in Settings for fully automatic sending.</p>'));
  }

  function queueCard(title, sub, list, opts) {
    opts = opts || {};
    return ui.card(
      ui.head(title, list.length ? ui.badge(list.length + '', opts.tone || 'lime') : ui.badge('empty', 'muted'), sub) +
      (list.length ? '<div class="space-y-2 max-h-[360px] overflow-y-auto pr-0.5">' + list.slice(0, 25).map(l => {
        const rec = App.msg.recommend(l);
        return '<div class="row-card p-2.5" data-action="' + (opts.action || 'outreach.openCompose') + '" data-arg="' + l.id + '">' +
          '<div class="flex items-center gap-2.5">' + ui.avatar(l.name, 'w-7 h-7 text-[10px]') +
          '<div class="min-w-0 flex-1"><p class="text-[11px] font-semibold truncate">' + U.esc(l.name) + '</p>' +
          '<p class="text-[9px] text-textMuted truncate">' + U.esc(l.category) + ' · ' + (l.phone || 'no phone') + '</p></div>' +
          (opts.showValue ? '<span class="text-[10px] text-limeAccent font-bold shrink-0">' + U.money(rec.total) + '</span>' : '') +
          '</div>' +
          (l.reply ? '<p class="text-[10px] mt-1.5 pl-9 ' + (l.reply.sentiment === 'negative' ? 'text-red-300' : l.reply.sentiment === 'positive' ? 'text-limeAccent' : 'text-gray-300') + '">' +
            ui.icon('fa-quote-left', 'text-[8px] mr-1') + U.esc(String(l.reply.text).slice(0, 110)) + '</p>' : '') +
          (opts.showDue && l.nextFollowUp ? '<p class="text-[9px] text-amber-300 mt-1 pl-9">' + ui.icon('fa-clock', 'text-[8px] mr-1') + 'due ' + U.fmtDate(l.nextFollowUp) + (U.daysUntil(l.nextFollowUp) < 0 ? ' (overdue)' : '') + '</p>' : '') +
          '</div>';
      }).join('') + '</div>'
        : ui.empty(opts.emptyText || 'Nothing here yet', opts.emptySub || '', opts.emptyIcon || 'fa-inbox')));
  }

  App.views = App.views || {};
  App.views.outreach = {
    title: 'Outreach desk',
    sub: 'Compose → send → triage replies → close',
    icon: 'fa-comment-dots',
    render(el, params) {
      const s = o();
      if (params) s.leadId = params;
      const leads = App.store.get('leads', []);
      if (!s.leadId) {
        const hot = hotList()[0] || dueList()[0] || leads.filter(l => ['new', 'qualified'].indexOf(l.status) !== -1)[0];
        s.leadId = hot ? hot.id : '';
      }
      const lead = App.store.find('leads', s.leadId);
      const st = App.msg.stats(leads);
      const sentToday = U.sum(leads, l => (l.outreach || []).filter(x => x.at && x.at.slice(0, 10) === U.todayISO()).length);

      const limit = App.store.get('settings.outreach.dailySendLimit', 40);
      el.innerHTML =
        ui.hero([
          { label: 'Sent today', value: sentToday + ' / ' + limit, tone: sentToday >= limit ? 'amber' : 'lime',
            sub: U.num(st.sent) + ' sent all time' },
          { label: 'Reply rate', value: st.replyRate + '%', tone: st.replyRate >= 20 ? 'lime' : 'amber',
            sub: st.replied + ' replies · ' + st.positive + ' positive' },
          { label: 'Open pipeline', value: U.money(st.pipelineValue), tone: 'violet',
            sub: st.interested + ' interested · ' + hotList().length + ' to work now' }
        ]) +

        '<div class="dash__grid">' +
        '<div class="dash__main">' + composer(lead) + '</div>' +
        '<div class="dash__side">' +
        queueCard('Hot — replied positively', 'Send the price or the demo', hotList(), { tone: 'lime', showValue: true, emptyText: 'No positive replies yet', emptySub: 'Send your first batch from Discover', emptyIcon: 'fa-fire' }) +
        queueCard('Follow-ups due', 'Nudge once, then stop', dueList(), { tone: 'amber', showDue: true, emptyText: 'No follow-ups due today', emptyIcon: 'fa-clock' }) +
        queueCard('Needs triage', 'Replies the filters could not judge', triageList(), { tone: 'violet', action: 'outreach.logReply', emptyText: 'Nothing to triage', emptyIcon: 'fa-scale-balanced' }) +
        queueCard('Do not chase', 'Kept for the 12-month revisit', stoppedList(), { tone: 'red', emptyText: 'Nobody has said no yet', emptyIcon: 'fa-ban' }) +
        '</div></div>';

      if (s.mode === 'reply' && params) { s.mode = 'compose'; replyModal(params); }
    }
  };

  /* --------------------------------- actions -------------------------------- */
  App.action('outreach.openCompose', el => {
    const s = o();
    s.leadId = el.getAttribute('data-arg') || s.leadId;
    s.mode = 'compose';
    s.templateId = '';
    if (App.router.current().route === 'outreach') App.emit('state:changed', { path: 'compose' });
    else App.router.go('outreach', s.leadId);
  });
  App.action('outreach.openLead', el => App.router.go('discover', el.getAttribute('data-arg')));
  App.action('outreach.channel', el => { o().channel = el.getAttribute('data-arg'); App.emit('state:changed', { path: 'channel' }); });
  App.action('outreach.retemplate', () => {
    const s = o();
    const lead = App.store.find('leads', s.leadId);
    const tpl = App.msg.template(s.templateId) || App.msg.defaultTemplate(lead);
    if (lead && tpl) {
      const rendered = App.msg.render(tpl, lead);
      s.body = rendered.body;
      s.dirty[lead.id + ':' + tpl.id] = false;
      const box = document.getElementById('outreach-body');
      if (box) box.value = rendered.body;
      const subj = document.querySelector('[data-model="ui.outreachSubject"]');
      if (subj) subj.value = rendered.subject;
      ui.toast('Template re-applied', 'lime');
    }
  });
  App.action('outreach.copy', () => {
    const box = document.getElementById('outreach-body');
    U.copy(box ? box.value : '').then(() => ui.toast('Message copied', 'lime'));
  });
  App.action('outreach.preview', () => {
    const s = o();
    const lead = App.store.find('leads', s.leadId);
    const tpl = App.msg.template(s.templateId) || App.msg.defaultTemplate(lead);
    const v = App.msg.vars(lead);
    ui.modal({
      title: 'Merge fields used in this message',
      sub: lead.name, size: 'lg',
      body: '<div class="grid grid-cols-1 md:grid-cols-2 gap-x-4">' + Object.keys(v).map(k => ui.kv('{{' + k + '}}', U.esc(v[k]))).join('') + '</div>',
      footer: '<button class="btn btn-ghost" data-action="close-modal">Close</button>'
    });
  });
  App.action('outreach.send', () => {
    const s = o();
    const lead = App.store.find('leads', s.leadId);
    if (!lead) { ui.toast('Pick a business first', 'amber'); return; }
    const box = document.getElementById('outreach-body');
    const body = box ? box.value : '';
    if (!body.trim()) { ui.toast('Message is empty', 'amber'); return; }
    const subj = document.querySelector('[data-model="ui.outreachSubject"]');
    const tpl = App.msg.template(App.store.get('ui.outreachTemplate', s.templateId)) || App.msg.defaultTemplate(lead);
    App.msg.send({ lead: lead, channel: s.channel, templateId: tpl.id, body: body, subject: subj ? subj.value : '' }).then(r => {
      ui.toast(r.via === 'api' ? 'Sent automatically ✓' : 'Opened ' + App.dict.chanLabel(s.channel) + ' with the message — press send there', 'lime');
      s.body = '';
      setTimeout(() => App.emit('state:changed', { path: 'sent' }), 150);
    });
  });
  App.action('outreach.logReply', el => App.openReply(el.getAttribute('data-arg') || o().leadId));
  App.action('outreach.toNext', () => {
    const s = o();
    const next = App.msg.nextLead(s.leadId, l => ['won', 'lost', 'rejected'].indexOf(l.status) === -1 && l.id !== s.leadId);
    if (!next) { ui.toast('No other lead in this queue', 'amber'); return; }
    s.leadId = next; s.templateId = ''; s.body = '';
    App.emit('state:changed', { path: 'next' });
  });

  /* ------------------------------ reply triage ------------------------------ */
  function replyModal(leadId) {
    const lead = App.store.find('leads', leadId);
    if (!lead) { ui.toast('Business not found', 'red'); return; }
    const t = App.dict.typeOf(lead.businessType);
    ui.modal({
      title: 'Log reply from ' + lead.name,
      sub: 'Paste or type what they answered — the system reads it and moves the deal automatically',
      size: 'lg',
      body:
        '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
        '<div>' +
        ui.field({ label: 'Their reply', model: 'ui.replyText', value: '', rows: 6, placeholder: 'e.g. "Yes please send the demo and price"' }) +
        '<div class="flex items-center gap-2 mt-1">' +
        '<button class="btn btn-ghost btn-sm" data-action="reply.classify"><i class="fa-solid fa-wand-magic-sparkles"></i> Read sentiment</button>' +
        '<span class="text-[9px] text-textMuted">Automatic analysis runs on save too</span></div>' +
        '<div id="reply-verdict" class="mt-3"></div>' +
        '</div>' +
        '<div>' +
        ui.card(ui.head('Suggested replies', ui.badge('after a positive reply', 'lime'), 'One tap: loads the template, copies it and opens the chat') +
          '<div class="space-y-2">' +
          App.msg.templates().filter(x => ['proposal', 'followup'].indexOf(x.stage) !== -1).slice(0, 2).map(x =>
            '<button class="w-full text-left bg-field border border-line hover:border-limeAccent/50 rounded-lg p-2" data-action="reply.useTemplate" data-arg="' + x.id + '">' +
            '<p class="text-[10px] font-semibold text-limeAccent">' + U.esc(x.name) + '</p>' +
            '<p class="text-[9px] text-textMuted line-clamp-2">' + U.esc(App.msg.render(x, lead).body.slice(0, 130)) + '…</p></button>').join('') +
          '</div>') +
        ui.card(ui.head('What happens on save') +
          '<ul class="ticks">' +
          '<li><b>Positive</b> → status “interested”, appears in the Hot list, price proposal suggested</li>' +
          '<li><b>Negative</b> → status “rejected”, added to do-not-chase, and the next lead loads automatically</li>' +
          '<li><b>Unclear</b> → kept in “needs triage” for you to decide</li>' +
          '</ul>', 'mt-3') +
        '</div></div>',
      footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
        '<button class="btn btn-ghost" data-action="reply.markNegative" data-arg="' + leadId + '"><i class="fa-solid fa-thumbs-down"></i> Save as negative</button>' +
        '<button class="btn btn-lime" data-action="reply.save" data-arg="' + leadId + '"><i class="fa-solid fa-check"></i> Save reply</button>',
      onMount(root) {
        const ta = root.querySelector('textarea');
        if (ta) { ta.focus(); }
      }
    });
  }
  App.openReply = function (leadId) {
    const s = o();
    s.leadId = leadId; s.mode = 'reply';
    if (App.router.current().route !== 'outreach') App.router.go('outreach', leadId);
    else replyModal(leadId);
  };

  App.action('reply.classify', () => {
    const text = App.store.get('ui.replyText', '');
    const res = App.msg.classify(text);
    const box = document.getElementById('reply-verdict');
    if (box) box.innerHTML = verdictHtml(res);
  });
  App.action('reply.useTemplate', el => {
    const lead = App.store.find('leads', o().leadId);
    const tpl = App.msg.template(el.getAttribute('data-arg'));
    const text = App.msg.render(tpl, lead).body;
    ui.closeModal();
    const s = o();
    s.templateId = tpl.id; s.channel = tpl.channel; s.body = text;
    if (App.router.current().route === 'outreach') App.emit('state:changed', { path: 'useTemplate' });
    else App.router.go('outreach', lead.id);
    U.copy(text);
    ui.toast('Template ready and copied', 'lime');
  });
  App.action('reply.save', el => {
    const id = el.getAttribute('data-arg');
    const text = App.store.get('ui.replyText', '');
    if (!String(text).trim()) { ui.toast('Paste their reply first', 'amber'); return; }
    commitReply(id, text);
  });
  App.action('reply.markNegative', el => commitReply(el.getAttribute('data-arg'), App.store.get('ui.replyText', '') || 'Not interested.'));

  function commitReply(id, text) {
    const res = App.msg.recordReply(id, text, o().channel);
    if (!res) { ui.toast('Could not save', 'red'); return; }
    ui.closeModal();
    const lead = res.lead;
    if (res.sentiment === 'negative') {
      ui.toast('Negative reply recorded — moved to do-not-chase', 'red');
      if (res.nextLeadId) {
        ui.confirm({
          title: 'Load the next business?', confirmLabel: 'Next lead', tone: 'lime',
          message: res.nextLeadId ? (App.store.find('leads', res.nextLeadId) || {}).name + ' is next in this queue.' : '',
          onConfirm() { const s = o(); s.leadId = res.nextLeadId; s.templateId = ''; s.body = ''; App.emit('state:changed', { path: 'next' }); }
        });
      }
      App.emit('state:changed', { path: 'replied' });
      return;
    }
    if (res.sentiment === 'positive') {
      ui.toast(res.wantsSite
        ? 'Positive reply — moved to the Interested list. Send the price proposal.'
        : 'Positive reply — moved to the Interested list. Ask one clarifying question before quoting.', 'lime');
      const tpl = App.msg.templates().filter(t => t.id === 'msg_wa_proposal')[0];
      if (tpl) {
        const text = App.msg.render(tpl, lead).body;
        const s = o();
        s.leadId = lead.id; s.templateId = tpl.id; s.channel = 'whatsapp'; s.body = text;
      }
      App.emit('state:changed', { path: 'replied' });
      return;
    }
    ui.toast('Reply saved — kept in needs triage', 'amber');
    App.emit('state:changed', { path: 'replied' });
  }

  function verdictHtml(res) {
    const tone = res.sentiment === 'positive' ? 'lime' : res.sentiment === 'negative' ? 'red' : 'amber';
    return '<div class="glass-soft rounded-xl p-3 border ' + (ui.TONES[tone] || '') + '">' +
      '<p class="text-[11px] font-bold">' + (res.sentiment === 'positive' ? 'Looks POSITIVE' : res.sentiment === 'negative' ? 'Looks NEGATIVE' : 'Unclear / neutral') + ' (score ' + res.score + ')</p>' +
      '<p class="text-[10px] mt-1">Matched: ' + U.esc(res.reasons.join(', ') || 'nothing recognisable') + '</p>' +
      '<p class="text-[10px] mt-1">' + (res.wantsSite ? 'They mentioned a website / software need → send the proposal.' : 'Ask one clarifying question before quoting.') + '</p></div>';
  }

  /* -------------------------------- pipeline -------------------------------- */
  function stageLeads(stage) {
    return U.sortBy(App.store.get('leads', []).filter(l => l.status === stage), l => Number(l.value) || 0, 'desc');
  }

  App.views.pipeline = {
    title: 'Pipeline',
    sub: 'Every lead and deal, stage by stage',
    icon: 'fa-diagram-project',
    render(el) {
      const stages = App.dict.pipelineStages;
      const leads = App.store.get('leads', []);
      const totalValue = U.sum(leads.filter(l => ['new', 'qualified', 'contacted', 'replied', 'interested', 'proposal'].indexOf(l.status) !== -1), l => Number(l.value) || 0);
      const wonThisMonth = leads.filter(l => l.status === 'won');
      const q = App.router.q.pipeline || {};
      el.innerHTML = pipelineBoard(q.stage || '', stages, leads, totalValue, wonThisMonth);
    }
  };

  function pipelineBoard(activeStage, stages, leads, totalValue, wonThisMonth) {
    {
      const open = leads.filter(l => ['new', 'qualified', 'contacted', 'replied', 'interested', 'proposal'].indexOf(l.status) !== -1);
      const filtered = activeStage ? leads.filter(l => l.status === activeStage) : leads;
      const rows = U.sortBy(filtered, l => Number(l.value) || 0, 'desc');
      const stageOf = s => ({ count: leads.filter(l => l.status === s).length, value: U.sum(leads.filter(l => l.status === s), l => Number(l.value) || 0) });
      const reachable = leads.filter(l => (l.outreach || []).length || l.reply).length;
      const wonValue = U.sum(wonThisMonth, l => Number(l.value) || 0);
      const barTotal = Math.max(1, U.sum(stages, s => stageOf(s).count));

      const el2 = [];
      el2.push(
        '<div class="flex items-start justify-between gap-5 flex-wrap mb-5">' +
        '<div class="flex flex-wrap gap-2">' +
        '<span class="chip is-on">' + ui.icon('fa-bullseye', 'text-[9px]') + ' Open value ' + U.money(totalValue) + '</span>' +
        '<span class="chip">' + ui.icon('fa-trophy', 'text-[9px]') + ' Won ' + U.money(wonValue) + '</span>' +
        '<span class="chip">' + ui.icon('fa-comments', 'text-[9px]') + ' In conversation ' + reachable + '</span>' +
        '<span class="chip">' + ui.icon('fa-clock', 'text-[9px]') + ' Follow-ups due ' + dueList().length + '</span>' +
        '</div>' +
        '<div class="btn-row">' +
        '<button class="btn btn-ghost btn-sm" data-action="pipe.autoFollow"><i class="fa-solid fa-robot"></i> Schedule follow-ups</button>' +
        '<button class="btn btn-lime btn-sm" data-nav="discover"><i class="fa-solid fa-plus"></i> Find businesses</button>' +
        '</div></div>'
      );

      /* ---- the stage rail: one flowing bar, click a stage to filter the list ---- */
      el2.push(
        '<div class="glass-soft rounded-2xl p-5 mb-5">' +
        '<div class="flex items-end justify-between gap-3 mb-4">' +
        '<div><p class="text-[12px] font-semibold">Stage flow</p>' +
        '<p class="text-[10px] text-textMuted mt-0.5">' + open.length + ' open deals worth ' + U.money(totalValue) + ' · click a stage to filter</p></div>' +
        '<button class="btn btn-ghost btn-sm" data-action="pipe.filter" data-arg="all"><i class="fa-solid fa-list"></i> Show all</button>' +
        '</div>' +
        '<div class="flex gap-1.5 h-3 rounded-full overflow-hidden bg-track">' + stages.map(s => {
          const st = stageOf(s);
          if (!st.count) return '';
          const on = activeStage === s;
          return '<button title="' + U.esc(U.title(s)) + ' · ' + st.count + ' · ' + U.money(st.value) + '" ' +
            'data-action="pipe.filter" data-arg="' + s + '" style="flex:' + st.count + ';border:0;cursor:pointer;transition:.2s" ' +
            'class="fill fill-' + (App.dict.leadTones[s] || 'muted') + (on ? ' brightness-125' : ' opacity-80 hover:opacity-100') + '"></button>';
        }).join('') + '</div>' +
        '<div class="flex flex-wrap gap-x-5 gap-y-2 mt-4">' + stages.map(s => {
          const st = stageOf(s);
          const on = activeStage === s;
          return '<button class="flex items-center gap-2 text-left" data-action="pipe.filter" data-arg="' + s + '">' +
            '<span class="w-2.5 h-2.5 rounded-sm fill fill-' + (App.dict.leadTones[s] || 'muted') + (on ? ' ring-2 ring-white/30' : '') + '"></span>' +
            '<span class="text-[10px] ' + (on ? 'text-white font-semibold' : 'text-textMuted') + '">' + U.title(s) + '</span>' +
            '<span class="text-[10px] font-bold text-limeAccent">' + st.count + '</span>' +
            '<span class="text-[10px] text-textMuted">' + U.money(st.value) + '</span></button>';
        }).join('') + '</div>' +
        '</div>'
      );

      /* ---- the deal table: one row per business, every number visible ---- */
      el2.push(
        ui.card(ui.head('Deals', ui.badge(rows.length + '', activeStage ? 'lime' : 'muted'),
          activeStage ? 'Showing ' + U.title(activeStage) + ' only' : 'Every lead, biggest value first') +
          (rows.length ? '<div class="overflow-x-auto -mx-1 px-1"><table class="tbl min-w-[720px]">' +
            '<thead><tr><th>Business</th><th>Stage</th><th>Value</th><th>Site</th><th>Reached</th><th>Next follow-up</th><th class="text-right">Move</th></tr></thead><tbody>' +
            rows.slice(0, 120).map(l => {
              const reached = (l.outreach || []).length;
              return '<tr>' +
                '<td><button class="flex items-center gap-2.5 text-left" data-action="pipe.open" data-arg="' + l.id + '">' +
                ui.avatar(l.name, 'w-7 h-7 text-[10px]') +
                '<span class="min-w-0"><span class="block text-[11px] font-semibold truncate max-w-[190px]">' + U.esc(l.name) + '</span>' +
                '<span class="block text-[9px] text-textMuted truncate max-w-[190px]">' + U.esc(l.category || l.businessType || '') + (l.dist ? ' · ' + l.dist + ' km' : '') + '</span></span></button></td>' +
                '<td>' + ui.badge(l.status, App.dict.leadTones[l.status] || 'muted') + '</td>' +
                '<td class="text-[11px] font-bold text-limeAccent whitespace-nowrap">' + U.money(l.value) + '</td>' +
                '<td><span class="tag">' + (l.website ? 'has site' : 'no site') + '</span></td>' +
                '<td class="text-[10px] text-textMuted whitespace-nowrap">' + (reached ? reached + ' sent' : 'not yet') +
                (l.reply ? ' · <span style="color:' + (l.reply.sentiment === 'positive' ? '#cbfa31' : l.reply.sentiment === 'negative' ? '#fca5a5' : '#e5e7eb') + '">' + l.reply.sentiment + '</span>' : '') + '</td>' +
                '<td class="text-[10px] text-textMuted whitespace-nowrap">' + (l.nextFollowUp ? U.fmtDate(l.nextFollowUp) : '—') + '</td>' +
                '<td><div class="flex items-center justify-end gap-1">' +
                '<button class="btn btn-ghost btn-sm" title="Move back a stage" data-action="pipe.back" data-arg="' + l.id + '"><i class="fa-solid fa-chevron-left text-[8px]"></i></button>' +
                '<button class="btn btn-ghost btn-sm" title="Advance a stage" data-action="pipe.advance" data-arg="' + l.id + '"><i class="fa-solid fa-chevron-right text-[8px]"></i></button>' +
                '<button class="btn btn-ghost btn-sm" title="Compose a message" data-action="outreach.openCompose" data-arg="' + l.id + '"><i class="fa-solid fa-comment-dots text-[9px]"></i></button>' +
                '</div></td></tr>';
            }).join('') + '</tbody></table></div>'
            : ui.empty('No leads in this stage', 'Search a business type in Discover and the deals land here', 'fa-diagram-project',
              '<button class="btn btn-lime btn-sm" data-nav="discover">Find businesses</button>')))
      );

      /* ---- money and follow-ups side by side ---- */
      el2.push('<div class="two-col mt-5">' +
        ui.card(ui.head('Value by stage', ui.badge('ETB', 'lime'), 'Where the money is actually sitting right now') +
          '<div class="space-y-3">' + stages.map(s => {
            const st = stageOf(s);
            const pct = totalValue ? Math.round((st.value / totalValue) * 100) : 0;
            return '<div>' +
              '<div class="flex items-center justify-between text-[10px] mb-1"><span>' + U.title(s) + '</span>' +
              '<span class="text-textMuted">' + U.money(st.value) + '</span></div>' +
              '<div class="h-2 rounded-full bg-track overflow-hidden">' +
              '<div class="h-full fill fill-' + (App.dict.leadTones[s] || 'muted') + '" style="width:' + U.clamp(pct, st.value ? 3 : 0, 100) + '%;transition:width .5s cubic-bezier(.22,.9,.28,1)"></div>' +
              '</div></div>';
          }).join('') + '</div>') +
        ui.card(ui.head('Next calls to make', '<button class="btn btn-ghost btn-sm" data-action="pipe.autoFollow">Auto-schedule</button>', 'Rejected leads are never contacted again — they wait 12 months') +
          (dueList().length ? '<div class="space-y-2">' + dueList().slice(0, 8).map(l =>
            '<div class="row-card p-3 flex items-center gap-3" data-action="pipe.open" data-arg="' + l.id + '">' +
            ui.avatar(l.name, 'w-7 h-7 text-[10px]') +
            '<div class="min-w-0 flex-1"><p class="text-[11px] font-semibold truncate">' + U.esc(l.name) + '</p>' +
            '<p class="text-[9px] text-textMuted">' + U.esc(App.dict.chanLabel('whatsapp')) + ' · due ' + U.fmtDate(l.nextFollowUp) + '</p></div>' +
            '<button class="btn btn-lime btn-sm" data-action="outreach.openCompose" data-arg="' + l.id + '"><i class="fa-solid fa-comment-dots"></i></button></div>'
          ).join('') + '</div>'
            : ui.empty('Nothing due today', 'Interested leads get a follow-up in ' + App.store.get('settings.outreach.followUpDays', 3) + ' days, then one more', 'fa-mug-hot'))) +
        '</div>');

      return el2.join('');
    }
  }

  App.action('pipe.filter', el => {
    const stage = el.getAttribute('data-arg');
    App.router.q.pipeline = App.router.q.pipeline || {};
    App.router.q.pipeline.stage = stage === 'all' ? '' : stage;
    if (App.refresh) App.refresh();
  });


  App.action('pipe.open', el => App.router.go('discover', el.getAttribute('data-arg')));
  App.action('pipe.advance', el => {
    const id = el.getAttribute('data-arg');
    const lead = App.store.find('leads', id);
    const i = App.dict.pipelineStages.indexOf(lead.status);
    const next = App.dict.pipelineStages[Math.min(i + 1, App.dict.pipelineStages.length - 1)];
    move(id, next);
  });
  App.action('pipe.back', el => {
    const lead = App.store.find('leads', el.getAttribute('data-arg'));
    const i = App.dict.pipelineStages.indexOf(lead.status);
    move(lead.id, App.dict.pipelineStages[Math.max(i - 1, 0)]);
  });
  App.action('pipe.autoFollow', () => {
    const days = App.store.get('settings.outreach.followUpDays', 3);
    const days2 = App.store.get('settings.outreach.secondFollowUpDays', 7);
    let n = 0;
    App.store.get('leads', []).forEach(l => {
      if (['won', 'lost', 'rejected', 'skipped'].indexOf(l.status) !== -1) return;
      if (l.nextFollowUp) return;
      const sent = (l.outreach || []).length;
      const at = sent === 0 ? U.addDays(U.todayISO(), 0) : U.addDays(U.todayISO(), sent === 1 ? days : days2);
      App.store.patch('leads', l.id, { nextFollowUp: at }); n++;
    });
    ui.toast(n + ' follow-up dates scheduled', 'lime');
  });

  function move(id, status) {
    const lead = App.store.find('leads', id);
    const patch = { status: status };
    if (status === 'won') {
      patch.nextFollowUp = '';
      if (!lead.clientId) {
        const client = App.store.add('clients', {
          name: lead.name, type: 'company', stage: 'active', industry: lead.businessType,
          contactName: '', designation: '', phone: lead.phone, whatsapp: lead.whatsapp ? lead.phone : '',
          telegram: lead.telegram, email: lead.email, address: lead.address, website: lead.website,
          services: App.msg.recommend(lead).ids, accountManager: App.store.get('settings.company.senderName', ''),
          source: lead.source, sourceLeadId: lead.id, startedAt: U.todayISO(), endedAt: '', health: 'excellent',
          tags: ['from-discovery'], notes: 'Converted from a cold lead.'
        });
        patch.clientId = client.id;
        App.log('win', lead.name + ' converted to an active client', client.id);
      }
    }
    if (status === 'rejected' || status === 'lost') patch.nextFollowUp = '';
    App.store.patch('leads', id, patch);
    ui.toast(lead.name + ' → ' + U.title(status), status === 'won' ? 'lime' : 'muted');
  }

  /* data-model change hook for selects with data-change-action */
  App.on('field:changed', payload => {
    if (payload && payload.path === 'ui.outreachTemplate') {
      const s = o();
      s.templateId = payload.value;
      s.dirty[s.leadId + ':' + payload.value] = false;
      App.actions['outreach.retemplate']();
    }
  });
})(window);
