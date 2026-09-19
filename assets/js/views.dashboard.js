/* =============================================================================
   Triverse OS — Dashboard view (KPIs, funnel, today's work, revenue, activity)
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;
  const ui = App.ui;

  /* ------------------------------ shared metrics --------------------------- */
  App.metrics = function () {
    const leads = App.store.get('leads', []);
    const clients = App.store.get('clients', []);
    const payments = App.store.get('payments', []);
    const sites = App.store.get('sites', []);
    const liveStatuses = ['paid', 'partial'];
    const openStatuses = ['pending', 'partial', 'overdue'];
    const paid = payments.filter(p => liveStatuses.indexOf(p.status) !== -1);
    const open = payments.filter(p => openStatuses.indexOf(p.status) !== -1);
    const collected = U.sum(paid, p => Number(p.amountPaid) || (p.status === 'paid' ? Number(p.amount) : 0));
    const outstanding = U.sum(open, p => (Number(p.amount) || 0) - (Number(p.amountPaid) || 0));
    const overdue = U.sum(payments.filter(p => p.status === 'overdue' || (openStatuses.indexOf(p.status) !== -1 && p.dueDate && p.dueDate < U.todayISO())), p => (Number(p.amount) || 0) - (Number(p.amountPaid) || 0));
    const thisMonth = U.monthKey(U.todayISO());
    const monthCollected = U.sum(paid.filter(p => U.monthKey(p.paidDate || p.issueDate) === thisMonth), p => Number(p.amountPaid) || Number(p.amount) || 0);

    const months = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
      months.push(d.toISOString().slice(0, 7));
    }
    const revenueByMonth = months.map(m => ({
      key: m, label: U.monthLabel(m).split(' ')[0],
      value: U.sum(paid.filter(p => U.monthKey(p.paidDate || p.issueDate) === m), p => Number(p.amountPaid) || Number(p.amount) || 0)
    }));

    const dueFollowUps = leads.filter(l => l.nextFollowUp && l.nextFollowUp <= U.todayISO() && ['replied-off'].indexOf(l.status) === -1 && ['won', 'lost', 'rejected'].indexOf(l.status) === -1);
    const renewals = sites.filter(s => s.hostRenewDate && U.daysUntil(s.hostRenewDate) !== null && U.daysUntil(s.hostRenewDate) <= 45)
      .concat(payments.filter(p => p.renewalDate && U.daysUntil(p.renewalDate) !== null && U.daysUntil(p.renewalDate) <= 45).map(p => ({
        name: 'Retainer renewal · ' + (App.store.find('clients', p.clientId) || {}).name, hostRenewDate: p.renewalDate, clientName: 'Payment'
      })));

    return {
      leads: leads, clients: clients, payments: payments, sites: sites,
      leadStats: App.msg.stats(leads),
      collected: collected, monthCollected: monthCollected, outstanding: outstanding, overdue: overdue,
      revenueByMonth: revenueByMonth,
      activeClients: clients.filter(c => c.stage === 'active').length,
      pastClients: clients.filter(c => c.stage === 'past').length,
      rejectedClients: clients.filter(c => c.stage === 'rejected').length,
      prospectClients: clients.filter(c => c.stage === 'prospect').length,
      sitesLive: sites.filter(s => s.status === 'live').length,
      sitesSample: sites.filter(s => s.kind === 'sample').length,
      sitesDraft: sites.filter(s => s.kind === 'draft').length,
      templates: App.store.get('templates', []).length,
      dueFollowUps: dueFollowUps,
      renewals: renewals,
      awaitingQuote: leads.filter(l => l.status === 'interested'),
      toTriage: leads.filter(l => l.reply && l.status === 'replied')
    };
  };

  /* --------------------------------- helpers -------------------------------- */
  function kpiRow(m) {
    const ls = m.leadStats;
    return '<div class="four-col">' +
      ui.stat({
        icon: 'fa-bullseye', label: 'Open pipeline value', value: U.money(ls.pipelineValue),
        badge: ls.interested + ' interested', tone: 'lime',
        sub: ls.noWebsite + ' of ' + ls.total + ' businesses have no website'
      }) +
      ui.stat({
        icon: 'fa-paper-plane', label: 'Cold messages sent', value: U.num(ls.sent),
        badge: ls.replyRate + '% reply rate', tone: ls.replyRate >= 20 ? 'lime' : 'amber',
        sub: ls.positive + ' positive · ' + ls.negative + ' negative replies'
      }) +
      ui.stat({
        icon: 'fa-wallet', label: 'Collected this month', value: U.money(m.monthCollected),
        badge: m.payments.length + ' invoices', tone: m.monthCollected ? 'lime' : 'amber',
        sub: U.money(m.collected) + ' collected in total'
      }) +
      ui.stat({
        icon: 'fa-hourglass-half', label: 'Outstanding', value: U.money(m.outstanding),
        badge: m.overdue ? U.money(m.overdue) + ' overdue' : 'on time', tone: m.overdue ? 'red' : 'lime',
        sub: m.activeClients + ' active clients · ' + m.pastClients + ' past'
      }) +
      '</div>';
  }

  /** shown until the first business is discovered — three obvious next moves */
  function startCard() {
    const cards = [
      ['fa-map-location-dot', 'Find businesses', 'Search a business type on Google Maps and get every listing in that area of Addis Ababa.', 'focus.discover', 'Find businesses'],
      ['fa-wand-magic-sparkles', 'Build their website', 'One tap generates a complete site from a business\u2019s own Google information and type.', 'sites.generate', 'Build a website'],
      ['fa-file-invoice-dollar', 'Get paid', 'Add a client, raise the invoice and track what is paid in Ethiopian Birr.', 'pay.new', 'Raise an invoice']
    ];
    return '<div class="grid grid-cols-1 md:grid-cols-3 gap-5">' + cards.map(c =>
      '<div class="glass-card hover-lift p-5 flex flex-col">' +
      '<div class="stat-ico mb-4"><i class="fa-solid ' + c[0] + '"></i></div>' +
      '<h3 class="section-title">' + c[1] + '</h3>' +
      '<p class="text-[12px] text-textMuted leading-relaxed mt-1.5 flex-1">' + c[2] + '</p>' +
      '<button class="btn btn-lime mt-4" data-action="' + c[3] + '">' + c[4] + '</button></div>').join('') + '</div>';
  }

  function funnelCard(m) {
    const ls = m.leadStats;
    const rows = [
      ['Businesses found', ls.total, 'muted'],
      ['With no website', ls.noWebsite, 'amber'],
      ['Contacted', ls.contacted, 'blue'],
      ['Replied', ls.replied, 'violet'],
      ['Interested', ls.interested, 'lime'],
      ['Won', ls.won, 'lime']
    ];
    const max = Math.max.apply(null, rows.map(r => r[1]).concat([1]));
    return ui.card(
      ui.head('Discovery funnel', '<button class="btn btn-ghost btn-sm" data-nav="discover">Open discovery</button>', 'From Google Maps lead to paying client') +
      '<div class="space-y-2.5">' + rows.map(r =>
        '<div><div class="flex items-center justify-between text-[10px] mb-1"><span class="text-gray-300">' + r[0] + '</span><span class="text-textMuted">' + U.num(r[1]) + ' · ' + U.pct(r[1], ls.total) + '%</span></div>' +
        ui.progress((r[1] / max) * 100) + '</div>').join('') + '</div>' +
      '<div class="flex items-center justify-around pt-4 mt-3 border-t border-white/5">' +
      ui.donut(ls.replyRate, ls.replyRate + '%', 'Reply rate') +
      ui.donut(ls.positiveRate, ls.positiveRate + '%', 'Positive of replies') +
      ui.donut(U.pct(ls.won, ls.contacted || 1), ls.won + '', 'Won deals') +
      '</div>');
  }

  function todayCard(m) {
    const items = [];
    m.dueFollowUps.slice(0, 4).forEach(l => items.push({
      icon: 'fa-clock', tone: 'amber', title: l.name,
      sub: 'Follow-up due ' + U.fmtDate(l.nextFollowUp) + ' · ' + App.dict.typeLabel(l.businessType),
      action: 'lead-open', arg: l.id, cta: 'Open'
    }));
    m.toTriage.slice(0, 3).forEach(l => items.push({
      icon: 'fa-comment-dots', tone: 'violet', title: l.name,
      sub: 'Reply needs triage: “' + String(l.reply.text).slice(0, 42) + '…”',
      action: 'outreach.openReply', arg: l.id, cta: 'Triage'
    }));
    m.awaitingQuote.slice(0, 3).forEach(l => items.push({
      icon: 'fa-file-invoice-dollar', tone: 'lime', title: l.name,
      sub: 'Interested — send the price proposal (' + U.money(App.msg.recommend(l).total) + ')',
      action: 'outreach.openCompose', arg: l.id, cta: 'Compose'
    }));
    m.payments.filter(p => p.status === 'overdue').slice(0, 3).forEach(p => items.push({
      icon: 'fa-triangle-exclamation', tone: 'red', title: (App.store.find('clients', p.clientId) || {}).name || 'Client',
      sub: 'Invoice ' + p.invoiceNo + ' overdue · ' + U.money((Number(p.amount) || 0) - (Number(p.amountPaid) || 0)),
      action: 'pay.remind', arg: p.id, cta: 'Remind'
    }));
    m.renewals.slice(0, 3).forEach(s => {
      const d = U.daysUntil(s.hostRenewDate);
      items.push({
        icon: 'fa-rotate', tone: 'blue', title: s.name,
        sub: 'Renewal on ' + U.fmtDate(s.hostRenewDate) + ' · ' + (d < 0 ? Math.abs(d) + ' days overdue' : d + (d === 1 ? ' day' : ' days') + ' left'),
        action: s.id ? 'sites.open' : 'nav', arg: s.id || 'sites', cta: 'Open'
      });
    });

    return ui.card(
      ui.head('Today\'s worklist', items.length ? ui.badge(items.length + ' items', 'lime') : ui.badge('all clear', 'muted'), 'Follow-ups, replies, quotes, money and renewals') +
      (items.length ? '<div class="space-y-2">' + items.map(it =>
        '<div class="bg-field border border-line rounded-xl p-2.5 flex items-center gap-3">' +
        '<span class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ' + (ui.TONES[it.tone] || '') + '"><i class="fa-solid ' + it.icon + ' text-[11px]"></i></span>' +
        '<div class="min-w-0 flex-1"><p class="text-[11px] font-semibold text-white truncate">' + U.esc(it.title) + '</p>' +
        '<p class="text-[9px] text-textMuted truncate">' + U.esc(it.sub) + '</p></div>' +
        '<button class="btn btn-ghost btn-sm" data-action="' + it.action + '" data-arg="' + it.arg + '">' + it.cta + '</button></div>').join('') + '</div>'
        : ui.empty('Nothing is due right now', 'Discovery keeps the pipeline full — search a business type and start messaging.', 'fa-mug-hot')));
  }

  App.views = App.views || {};
  App.views.dashboard = {
    title: 'Dashboard',
    sub: 'Live snapshot of discovery, outreach and cash',
    icon: 'fa-shapes',
    render(el) {
      const m = App.metrics();
      const c = App.store.get('settings.company', {});
      const activities = App.store.get('activities', []).slice(0, 8);

      el.innerHTML =
        (m.leads.length ? kpiRow(m) : startCard()) +
        '<div class="two-col mt-5">' +
        '<div class="space-y-4">' + funnelCard(m) +
        ui.card(ui.head('Collections — last 8 months', ui.badge('collected ' + U.money(m.collected), 'lime'), 'Paid and partially paid invoices, in Ethiopian Birr') +
          ui.bars(m.revenueByMonth, { highlight: m.revenueByMonth[m.revenueByMonth.length - 1].key }) +
          '<div class="flex items-center gap-2 text-[10px] text-textMuted mt-2"><span class="w-2 h-2 rounded-full bg-limeAccent"></span> This month <span class="text-white font-semibold">' + U.money(m.monthCollected) + '</span></div>') +
        ui.card(ui.head('Business assets', '<button class="btn btn-ghost btn-sm" data-nav="sites">Manage</button>', 'Websites, samples and templates you already own') +
          '<div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">' +
          [['Live websites', m.sitesLive], ['Sample pages', m.sitesSample], ['Generated drafts', m.sitesDraft], ['Templates', m.templates]].map(x =>
            '<div class="bg-field border border-line rounded-xl p-2.5"><p class="text-lg font-black text-limeAccent">' + x[1] + '</p><p class="text-[9px] text-textMuted">' + x[0] + '</p></div>').join('') +
          '</div>' +
          '<div class="grid grid-cols-2 gap-2 mt-3">' +
          '<div class="glass-soft rounded-xl p-3"><p class="text-[9px] text-textMuted">Active clients</p><p class="text-base font-bold text-limeAccent">' + m.activeClients + '</p></div>' +
          '<div class="glass-soft rounded-xl p-3"><p class="text-[9px] text-textMuted">Rejected (do not chase)</p><p class="text-base font-bold text-red-300">' + m.rejectedClients + '</p></div>' +
          '</div>') +
        '</div>' +
        '<div class="space-y-4">' + todayCard(m) +
        ui.card(ui.head('Recent activity', '<button class="btn btn-ghost btn-sm" data-nav="pipeline">Pipeline</button>') +
          (activities.length ? '<div class="space-y-3 stagger">' + activities.map(a =>
            '<div class="flex gap-2.5"><span class="mt-0.5">' + activityIcon(a.kind) + '</span>' +
            '<div class="min-w-0"><p class="text-[10px] text-gray-300 leading-snug">' + U.esc(a.text) + '</p>' +
            '<p class="text-[9px] text-textMuted">' + U.relTime(a.at) + '</p></div></div>').join('') + '</div>'
            : ui.empty('No activity yet', '', 'fa-clock-rotate-left'))) +
        ui.card(ui.head('Top opportunities', '<button class="btn btn-ghost btn-sm" data-nav="pipeline">All</button>', 'Highest value open leads') +
          (function () {
            const top = U.sortBy(m.leads.filter(l => ['new', 'qualified', 'contacted', 'replied', 'interested', 'proposal'].indexOf(l.status) !== -1), l => Number(l.value) || 0, 'desc').slice(0, 5);
            if (!top.length) return ui.empty('No open leads', 'Discover businesses to get started', 'fa-bullseye');
            return '<div class="space-y-2">' + top.map(l =>
              '<div class="row-card p-2.5 flex items-center gap-3" data-action="lead-open" data-arg="' + l.id + '">' +
              ui.avatar(l.name, 'w-7 h-7 text-[10px]') +
              '<div class="min-w-0 flex-1"><p class="text-[11px] font-semibold truncate">' + U.esc(l.name) + '</p>' +
              '<p class="text-[9px] text-textMuted truncate">' + U.esc(l.category) + ' · ' + (l.website ? 'has website' : 'no website') + '</p></div>' +
              '<span class="text-[10px] font-bold text-limeAccent">' + U.money(l.value) + '</span></div>').join('') + '</div>';
          })()) +
        '</div></div>';
    }
  };

  function activityIcon(kind) {
    const map = {
      message: ['fa-paper-plane', 'blue'], reply: ['fa-reply', 'violet'], 'reply-negative': ['fa-thumbs-down', 'red'],
      win: ['fa-trophy', 'lime'], payment: ['fa-money-bill-wave', 'lime'], lead: ['fa-magnifying-glass', 'muted'],
      site: ['fa-wand-magic-sparkles', 'lime'], client: ['fa-user-plus', 'blue'], note: ['fa-note-sticky', 'muted']
    };
    const it = map[kind] || map.note;
    return '<span class="w-6 h-6 rounded-lg flex items-center justify-center ' + (ui.TONES[it[1]] || '') + '"><i class="fa-solid ' + it[0] + ' text-[9px]"></i></span>';
  }
})(window);
