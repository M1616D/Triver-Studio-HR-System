/* =============================================================================
   Triverse OS — Payments, invoices and receivables
   Ledger of everything sold: paid, partial, pending, overdue, cancelled —
   plus printable invoices and WhatsApp payment reminders.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;
  const ui = App.ui;

  function q() {
    App.router.q.money = App.router.q.money || { status: 'all', clientId: 'all', search: '', month: 'all', method: 'all' };
    return App.router.q.money;
  }

  function balance(p) { return (Number(p.amount) || 0) - (Number(p.amountPaid) || 0); }
  function effectiveStatus(p) {
    if (p.status === 'paid' || p.status === 'cancelled') return p.status;
    if (p.dueDate && p.dueDate < U.todayISO()) return 'overdue';
    return p.status;
  }

  function filtered() {
    const s = q();
    let list = App.store.get('payments', []).slice();
    if (s.status !== 'all') list = list.filter(p => effectiveStatus(p) === s.status);
    if (s.clientId !== 'all') list = list.filter(p => p.clientId === s.clientId);
    if (s.method !== 'all') list = list.filter(p => p.method === s.method);
    if (s.month !== 'all') list = list.filter(p => U.monthKey(p.issueDate) === s.month);
    if (s.search) list = list.filter(p => U.hit(p.invoiceNo, s.search) || U.hit(p.projectTitle, s.search) || U.hit(clientName(p.clientId), s.search) || U.hit(p.notes, s.search));
    return U.sortBy(list, p => p.issueDate || '', 'desc');
  }

  function clientName(id) { const c = App.store.find('clients', id); return c ? c.name : '—'; }

  function nextInvoiceNo() {
    const n = (App.store.get('counters.invoice', 0) || 0) + 1;
    return 'TS-' + new Date().getFullYear() + '-' + String(n).padStart(4, '0');
  }

  App.views = App.views || {};
  App.views.payments = {
    title: 'Payments & invoices',
    sub: 'Every birr in and out — collected, pending, overdue',
    icon: 'fa-wallet',
    render(el) {
      const m = App.metrics();
      const list = filtered();
      const s = q();
      const months = U.uniq(App.store.get('payments', []).map(p => U.monthKey(p.issueDate))).filter(Boolean).sort().reverse();
      const renewals = App.store.get('payments', []).filter(p => p.renewalDate && U.daysUntil(p.renewalDate) !== null && U.daysUntil(p.renewalDate) <= 45 && U.daysUntil(p.renewalDate) >= -30);

      el.innerHTML =
        '<div class="four-col mb-4">' +
        ui.stat({ tag: 'This month', label: 'Collected', value: U.money(m.monthCollected), badge: U.money(m.collected) + ' lifetime', sub: 'Across ' + m.payments.filter(p => p.status === 'paid').length + ' settled invoices' }) +
        ui.stat({ tag: 'Receivable', label: 'Outstanding', value: U.money(m.outstanding), badge: 'open', tone: 'blue', sub: 'Pending + partial balances' }) +
        ui.stat({ tag: 'Risk', label: 'Overdue', value: U.money(m.overdue), badge: m.payments.filter(p => effectiveStatus(p) === 'overdue').length + ' invoices', tone: m.overdue ? 'red' : 'lime', sub: 'Send a reminder with one tap' }) +
        ui.stat({ tag: 'Recurring', label: 'Renewals next 45 days', value: U.money(U.sum(renewals, p => Number(p.amount) || 0)), badge: renewals.length + ' items', tone: 'amber', sub: 'Retainers, hosting and ads packages' }) +
        '</div>' +

        ui.card(ui.head('Collections trend', ui.badge('last 8 months', 'muted'), 'Paid invoices by month') +
          ui.bars(m.revenueByMonth, { highlight: m.revenueByMonth[m.revenueByMonth.length - 1].key }), 'mb-4') +

        '<div class="flex items-center justify-between gap-3 flex-wrap mb-3">' +
        '<div class="flex flex-wrap gap-1.5">' +
        ui.chip('All (' + m.payments.length + ')', s.status === 'all', 'pay.filter', 'all') +
        App.dict.paymentStatuses.map(st => ui.chip(U.title(st) + ' (' + m.payments.filter(p => effectiveStatus(p) === st).length + ')', s.status === st, 'pay.filter', st)).join('') +
        '</div>' +
        '<div class="btn-row">' +
        '<input class="inp w-[160px]" data-model="ui.paySearch" data-change-action="pay.applyFilters" data-enter="pay.applyFilters" value="' + U.attr(s.search) + '" placeholder="Invoice / project…" />' +
        '<select class="inp w-[170px]" data-model="ui.payClient" data-change-action="pay.applyFilters"><option value="all">All clients</option>' +
        App.store.get('clients', []).map(c => '<option value="' + U.attr(c.id) + '"' + (s.clientId === c.id ? ' selected' : '') + '>' + U.esc(c.name) + '</option>').join('') + '</select>' +
        '<select class="inp w-[140px]" data-model="ui.payMonth" data-change-action="pay.applyFilters"><option value="all">All months</option>' +
        months.map(mm => '<option value="' + mm + '"' + (s.month === mm ? ' selected' : '') + '>' + U.monthLabel(mm) + '</option>').join('') + '</select>' +
        '<select class="inp w-[140px]" data-model="ui.payMethod" data-change-action="pay.applyFilters"><option value="all">All methods</option>' +
        App.dict.paymentMethods.map(mm => '<option value="' + U.attr(mm) + '"' + (s.method === mm ? ' selected' : '') + '>' + U.esc(mm) + '</option>').join('') + '</select>' +
        '<button class="btn btn-lime btn-sm" data-action="pay.new"><i class="fa-solid fa-plus"></i> New invoice</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="pay.export"><i class="fa-solid fa-file-csv"></i> Export</button>' +
        '</div></div>' +

        ui.card(ui.table(['Invoice', 'Client / project', 'Amount', 'Paid', 'Balance', 'Status', 'Dates', ''], list.map(p => {
          const st = effectiveStatus(p);
          const cl = App.store.find('clients', p.clientId);
          return {
            cells: [
              '<span class="mono text-[10px]">' + U.esc(p.invoiceNo) + '</span>' + (p.recurring && p.recurring !== 'none' ? '<span class="tag ml-1">' + p.recurring + '</span>' : ''),
              '<div><p class="text-[11px] text-gray-200">' + U.esc(cl ? cl.name : '—') + '</p><p class="text-[9px] text-textMuted">' + U.esc(p.projectTitle) + '</p></div>',
              '<b>' + U.money(p.amount) + '</b>',
              U.money(p.amountPaid),
              '<span style="color:' + (balance(p) > 0 ? '#fcd34d' : '#cbfa31') + '">' + U.money(balance(p)) + '</span>',
              ui.badge(st, App.dict.paymentTones[st] || 'muted') + (p.method ? ' <span class="tag">' + U.esc(p.method) + '</span>' : ''),
              '<span class="text-[9px] text-textMuted">issued ' + U.fmtDate(p.issueDate) + '<br>due ' + U.fmtDate(p.dueDate) + (p.paidDate ? '<br>paid ' + U.fmtDate(p.paidDate) : '') + '</span>',
              '<div class="flex items-center gap-1 justify-end">' +
              (st !== 'paid' && st !== 'cancelled' ? '<button class="btn btn-lime btn-sm" data-action="pay.markPaid" data-arg="' + p.id + '" title="Mark paid"><i class="fa-solid fa-check"></i></button>' : '') +
              (st !== 'cancelled' ? '<button class="btn btn-ghost btn-sm" data-action="pay.remind" data-arg="' + p.id + '" title="Remind"><i class="fa-brands fa-whatsapp"></i></button>' : '') +
              '<button class="btn btn-ghost btn-sm" data-action="pay.print" data-arg="' + p.id + '" title="Invoice"><i class="fa-solid fa-print"></i></button>' +
              '<button class="btn btn-ghost btn-sm" data-action="pay.edit" data-arg="' + p.id + '" title="Edit"><i class="fa-solid fa-pen"></i></button>' +
              '</div>'
            ]
          };
        }), { empty: 'No invoices match this filter', emptySub: 'Create an invoice when a client confirms a project.', emptyIcon: 'fa-file-invoice-dollar' }));
    }
  };

  /* ---------------------------------- form ---------------------------------- */
  function payForm(id, presetClientId) {
    const p = id ? App.store.find('payments', id) : null;
    const clients = App.store.get('clients', []);
    const catalog = App.store.get('catalog', []);
    const inv = p ? p.invoiceNo : nextInvoiceNo();
    ui.modal({
      title: p ? 'Edit invoice ' + p.invoiceNo : 'New invoice · ' + inv,
      sub: 'Invoice numbers are generated automatically and never reused',
      size: 'lg',
      body: '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
        ui.field({ label: 'Invoice number', model: 'ui.pay.invoiceNo', value: inv }) +
        ui.field({ label: 'Client', model: 'ui.pay.clientId', value: p ? p.clientId : (presetClientId || (clients[0] || {}).id || ''), options: clients.map(c => [c.id, c.name]) }) +
        ui.field({ label: 'Service (from catalogue)', model: 'ui.pay.serviceId', value: p ? p.serviceId : '', options: [['', '— none / custom —']].concat(catalog.map(s => [s.id, s.name + ' · ' + U.money(s.price)])) }) +
        ui.field({ label: 'Project title', model: 'ui.pay.projectTitle', value: p ? p.projectTitle : '' }) +
        ui.field({ label: 'Amount', model: 'ui.pay.amount', value: p ? p.amount : 0, type: 'number' }) +
        ui.field({ label: 'Already paid', model: 'ui.pay.amountPaid', value: p ? p.amountPaid : 0, type: 'number' }) +
        ui.field({ label: 'Method', model: 'ui.pay.method', value: p ? p.method : 'Telebirr', options: App.dict.paymentMethods.map(x => [x, x]) }) +
        ui.field({ label: 'Status', model: 'ui.pay.status', value: p ? p.status : 'pending', options: App.dict.paymentStatuses.map(x => [x, U.title(x)]) }) +
        ui.field({ label: 'Issue date', model: 'ui.pay.issueDate', value: p ? p.issueDate : U.todayISO(), type: 'date' }) +
        ui.field({ label: 'Due date', model: 'ui.pay.dueDate', value: p ? p.dueDate : U.addDays(U.todayISO(), 7), type: 'date' }) +
        ui.field({ label: 'Paid on', model: 'ui.pay.paidDate', value: p ? p.paidDate : '', type: 'date' }) +
        ui.field({ label: 'Recurring', model: 'ui.pay.recurring', value: p ? p.recurring : 'none', options: [['none', 'One time'], ['monthly', 'Monthly retainer'], ['yearly', 'Yearly (hosting / domain)']] }) +
        ui.field({ label: 'Next renewal date', model: 'ui.pay.renewalDate', value: p ? p.renewalDate : '', type: 'date' }) +
        ui.field({ label: 'Accepted currency', model: 'ui.pay.currency', value: p ? p.currency : App.store.get('settings.company.currency', 'ETB'), options: App.dict.currencies.map(c => [c[0], c[0]]) }) +
        '</div>' +
        ui.field({ label: 'Notes / terms', model: 'ui.pay.notes', value: p ? p.notes : '50% advance, 50% on delivery.', rows: 2, wrapCls: 'mt-3' }),
      footer: (p ? '<button class="btn btn-danger" data-action="pay.delete" data-arg="' + p.id + '">Delete</button>' : '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>') +
        '<button class="btn btn-lime" data-action="pay.save" data-arg="' + (p ? p.id : '') + '"><i class="fa-solid fa-floppy-disk"></i> Save invoice</button>',
      onMount(root) {
        const svc = root.querySelector('[data-model="ui.pay.serviceId"]');
        if (svc) svc.addEventListener('change', () => {
          const s = App.store.find('catalog', svc.value);
          if (!s) return;
          App.store.set('ui.pay.projectTitle', s.name, { silent: true });
          App.store.set('ui.pay.amount', s.price, { silent: true });
          const t = root.querySelector('[data-model="ui.pay.projectTitle"]');
          const a = root.querySelector('[data-model="ui.pay.amount"]');
          if (t) t.value = s.name; if (a) a.value = s.price;
          const cls = root.querySelector('[data-model="ui.pay.method"]');
          if (cls) cls.value = cls.value || 'Telebirr';
        });
        const clientSel = root.querySelector('[data-model="ui.pay.clientId"]');
        if (clientSel) clientSel.addEventListener('change', () => App.store.set('ui.pay.clientId', clientSel.value, { silent: true }));
      }
    });
  }

  /* -------------------------------- actions -------------------------------- */
  App.action('pay.applyFilters', () => {
    const s = q();
    s.search = App.store.get('ui.paySearch', '');
    s.clientId = App.store.get('ui.payClient', s.clientId);
    s.month = App.store.get('ui.payMonth', s.month);
    s.method = App.store.get('ui.payMethod', s.method);
    App.emit('state:changed', { path: 'payfilter' });
  });
  App.action('pay.new', el => payForm('', el ? el.getAttribute('data-arg') : ''));
  App.action('pay.edit', el => payForm(el.getAttribute('data-arg')));
  App.action('pay.filter', el => { q().status = el.getAttribute('data-arg'); App.emit('state:changed', { path: 'payfilter' }); });
  App.action('pay.save', el => {
    const id = el.getAttribute('data-arg');
    const g = k => App.store.get('ui.pay.' + k, '');
    const data = {
      invoiceNo: g('invoiceNo'), clientId: g('clientId'), serviceId: g('serviceId'), projectTitle: g('projectTitle'),
      amount: Number(g('amount')) || 0, amountPaid: Number(g('amountPaid')) || 0, method: g('method'), status: g('status'),
      issueDate: g('issueDate'), dueDate: g('dueDate'), paidDate: g('paidDate'), recurring: g('recurring'),
      renewalDate: g('renewalDate'), currency: g('currency'), notes: g('notes')
    };
    if (!data.clientId) { ui.toast('Pick a client (add one first if the list is empty)', 'amber'); return; }
    if (!data.projectTitle) data.projectTitle = (App.store.find('catalog', data.serviceId) || {}).name || 'Project';
    if (data.status === 'paid' && !data.paidDate) data.paidDate = U.todayISO();
    if (data.status === 'paid') data.amountPaid = data.amount;
    if (id) {
      App.store.patch('payments', id, data);
      ui.toast('Invoice updated', 'lime');
    } else {
      App.store.add('payments', data);
      const n = (App.store.get('counters.invoice', 0) || 0) + 1;
      App.store.set('counters.invoice', n, { silent: true });
      App.log('payment', 'Invoice ' + data.invoiceNo + ' created for ' + clientName(data.clientId) + ' · ' + U.money(data.amount), '');
      ui.toast('Invoice ' + data.invoiceNo + ' created', 'lime');
    }
    ui.closeModal();
    App.emit('state:changed', { path: 'payments' });
  });
  App.action('pay.markPaid', el => {
    const id = el.getAttribute('data-arg');
    const p = App.store.find('payments', id);
    ui.confirm({
      title: 'Mark ' + p.invoiceNo + ' as paid?', confirmLabel: 'Mark paid',
      message: U.money(balance(p)) + ' will be recorded as received today' + (p.method ? ' via ' + p.method : '') + '.',
      onConfirm() {
        App.store.patch('payments', id, { status: 'paid', amountPaid: Number(p.amount) || 0, paidDate: U.todayISO() });
        App.log('payment', U.money(p.amount) + ' received from ' + clientName(p.clientId) + ' (' + p.invoiceNo + ')', p.clientId);
        ui.toast('Payment recorded', 'lime');
      }
    });
  });
  App.action('pay.delete', el => {
    const id = el.getAttribute('data-arg');
    const p = App.store.find('payments', id);
    ui.confirm({
      title: 'Delete invoice?', tone: 'danger', confirmLabel: 'Delete', message: p.invoiceNo + ' · ' + U.money(p.amount) + ' will be removed from the ledger.',
      onConfirm() { App.store.remove('payments', id); ui.closeModal(); ui.toast('Invoice deleted', 'amber'); }
    });
  });
  App.action('pay.remind', el => {
    const p = App.store.find('payments', el.getAttribute('data-arg'));
    const c = App.store.find('clients', p.clientId);
    const tpl = App.msg.templates().filter(t => t.id === 'msg_wa_invoice')[0] || App.msg.templates()[0];
    const lead = {
      id: p.clientId, name: c ? c.name : 'Client', phone: c ? (c.whatsapp || c.phone) : '', intlPhone: c ? (c.whatsapp || c.phone) : '',
      whatsapp: true, telegram: c ? c.telegram : '', email: c ? c.email : '', businessType: c ? c.industry : 'general',
      category: App.dict.typeLabel(c ? c.industry : ''), outreach: [], reviews: 0
    };
    const body = App.msg.render(tpl, lead, { invoice: p.invoiceNo, due: U.fmtDate(p.dueDate), amount: balance(p) }).body;
    ui.modal({
      title: 'Payment reminder · ' + p.invoiceNo,
      sub: (c ? c.name : '') + ' · ' + U.money(balance(p)) + ' due ' + U.fmtDate(p.dueDate),
      size: 'lg',
      body: ui.field({ label: 'Message (editable)', model: 'ui.remindBody', value: body, rows: 10 }) +
        '<p class="text-[10px] text-textMuted mt-2">Tip: mention the method you prefer (Telebirr / CBE Birr / bank transfer) and the last 4 digits so they can verify.</p>',
      footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
        '<button class="btn btn-lime" data-action="pay.sendRemind" data-arg="' + p.id + '"><i class="fa-brands fa-whatsapp"></i> Open WhatsApp</button>'
    });
  });
  App.action('pay.sendRemind', el => {
    const p = App.store.find('payments', el.getAttribute('data-arg'));
    const c = App.store.find('clients', p.clientId);
    const body = App.store.get('ui.remindBody', '');
    const lead = { name: c ? c.name : '', phone: c ? (c.whatsapp || c.phone) : '', intlPhone: c ? (c.whatsapp || c.phone) : '', whatsapp: true };
    const url = App.msg.deepLink('whatsapp', lead, { body: body });
    if (!url) { ui.toast('No WhatsApp number on this client', 'amber'); return; }
    U.openUrl(url); U.copy(body);
    App.log('message', 'Payment reminder sent to ' + (c ? c.name : '') + ' for ' + p.invoiceNo, p.id);
    ui.closeModal();
    ui.toast('Reminder ready in WhatsApp', 'lime');
  });
  App.action('pay.export', () => {
    const rows = filtered().map(p => ({
      invoiceNo: p.invoiceNo, client: clientName(p.clientId), project: p.projectTitle, amount: p.amount, amountPaid: p.amountPaid,
      balance: balance(p), status: effectiveStatus(p), method: p.method, issueDate: p.issueDate, dueDate: p.dueDate,
      paidDate: p.paidDate, recurring: p.recurring, renewalDate: p.renewalDate, notes: p.notes
    }));
    U.download('triverse-payments-' + U.todayISO() + '.csv', U.toCSV(rows), 'text/csv');
    ui.toast('Exported ' + rows.length + ' invoices', 'lime');
  });

  /* ----------------------------- invoice document --------------------------- */
  App.action('pay.print', el => {
    const p = App.store.find('payments', el.getAttribute('data-arg'));
    const html = invoiceHTML(p, App.store.find('clients', p.clientId));
    App.router.q.invoiceHtml = html;
    ui.modal({
      title: 'Invoice ' + p.invoiceNo,
      size: 'xl',
      body: '<p class="text-[10px] text-textMuted mb-2">Print or “Save as PDF” from the browser. Amounts are read from the ledger — edit the invoice first if anything changed.</p>' +
        ui.previewFrame(html, 560),
      footer: '<button class="btn btn-ghost" data-action="close-modal">Close</button>' +
        '<button class="btn btn-ghost" data-action="pay.copyInvoice">Copy HTML</button>' +
        '<button class="btn btn-lime" data-action="pay.openInvoice"><i class="fa-solid fa-print"></i> Open &amp; print</button>'
    });
  });
  App.action('pay.openInvoice', () => U.openHTML(App.router.q.invoiceHtml || '', 'invoice'));
  App.action('pay.copyInvoice', () => U.copy(App.router.q.invoiceHtml || '').then(() => ui.toast('Invoice HTML copied', 'lime')));

  function invoiceHTML(p, c) {
    const co = App.store.get('settings.company', {});
    const cur = p.currency || co.currency || 'ETB';
    const method = p.method || 'Bank transfer';
    const methodNote = {
      'Telebirr': 'Telebirr transfer to ' + (co.phone || 'our number') + ' — put ' + p.invoiceNo + ' in the reason.',
      'CBE Birr': 'CBE Birr transfer to ' + (co.phone || 'our number') + ' — reference: ' + p.invoiceNo,
      'M-Pesa': 'M-Pesa transfer — reference: ' + p.invoiceNo,
      'Chapa': 'Chapa payment link can be raised on request.',
      'Bank transfer (CBE)': 'Commercial Bank of Ethiopia — account details shared on request, reference: ' + p.invoiceNo,
      'Bank transfer (Awash)': 'Awash Bank — account details shared on request, reference: ' + p.invoiceNo,
      'Bank transfer (Dashen)': 'Dashen Bank — account details shared on request, reference: ' + p.invoiceNo,
      'Card': 'Card payment link shared on request.',
      'PayPal': 'PayPal invoice can be raised on request.',
      'Wise': 'Wise transfer — reference: ' + p.invoiceNo,
      'Cash': 'Cash / hand delivery.',
      'Crypto/USDT': 'USDT (TRC20) — wallet shared on request.',
      'Other': 'Contact us for the payment details.'
    }[method] || '';
    const rows = [[p.projectTitle || 'Project', p.notes || '', Number(p.amount) || 0]];
    const bal = balance(p);
    return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />' +
      '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
      '<title>Invoice ' + U.esc(p.invoiceNo) + ' — ' + U.esc(co.name || '') + '</title>' +
      '<style>' +
      '*{box-sizing:border-box}body{margin:0;background:#eef1f6;color:#141a23;font-family:"Segoe UI",system-ui,sans-serif;padding:24px}' +
      '.sheet{max-width:820px;margin:0 auto;background:#fff;border:1px solid #e2e7ef;border-radius:18px;padding:32px;box-shadow:0 12px 40px -24px rgba(15,23,42,.35)}' +
      '.top{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #e7ebf2;padding-bottom:20px}' +
      'h1{margin:0;font-size:22px}.mark{width:44px;height:44px;border-radius:12px;background:#cbfa31;color:#0a0b0d;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;margin-bottom:8px}' +
      '.muted{color:#5f6a7a;font-size:12px;margin:2px 0}.badge{display:inline-block;background:#eaf7cf;color:#4a7108;border:1px solid rgba(101,145,22,.35);border-radius:999px;padding:3px 12px;font-size:11px;font-weight:700;text-transform:uppercase}' +
      '.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:24px 0}' +
      'table{width:100%;border-collapse:collapse;margin-top:8px}th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#5f6a7a;padding:8px 6px}' +
      'td{padding:12px 6px;border-top:1px solid #e7ebf2;font-size:13px}.r{text-align:right}' +
      '.totals{margin-top:18px;margin-left:auto;width:280px}.totals div{display:flex;justify-content:space-between;padding:6px 0;font-size:13px}' +
      '.grand{border-top:1px solid #cfd7e3;margin-top:6px;padding-top:10px!important;font-size:17px;font-weight:800;color:#2f5c05}' +
      '.paybox{background:#f6f8fb;border:1px solid #e2e7ef;border-radius:14px;padding:16px;margin-top:22px;font-size:12px}' +
      '.foot{margin-top:24px;border-top:1px solid #e7ebf2;padding-top:16px;font-size:11px;color:#5f6a7a;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}' +
      'button{background:#cbfa31;color:#10130a;border:0;border-radius:10px;padding:10px 16px;font-weight:800;cursor:pointer;margin-top:20px;transition:transform .15s ease}' +
      'button:hover{transform:translateY(-1px)}' +
      '@media print{body{background:#fff;padding:0}.sheet{border:0;box-shadow:none;border-radius:0}button{display:none}}' +
      '</style></head><body><div class="sheet">' +
      '<div class="top"><div><div class="mark">' + U.esc((co.shortName || co.name || 'T').split(' ').map(w => w[0]).slice(0, 2).join('')) + '</div>' +
      '<h1>' + U.esc(co.name || 'Triverse Studio') + '</h1>' +
      '<p class="muted">' + U.esc(co.address || '') + '</p>' +
      '<p class="muted">' + U.esc(co.phone || '') + ' · ' + U.esc(co.email || '') + ' · ' + U.esc(co.website || '') + '</p></div>' +
      '<div style="text-align:right"><span class="badge">' + U.esc(effectiveStatus(p)) + '</span>' +
      '<h1 style="margin-top:10px">INVOICE</h1>' +
      '<p class="muted">No. <b>' + U.esc(p.invoiceNo) + '</b></p>' +
      '<p class="muted">Issued ' + U.esc(U.fmtDate(p.issueDate)) + '</p>' +
      '<p class="muted">Due ' + U.esc(U.fmtDate(p.dueDate)) + '</p></div></div>' +
      '<div class="grid"><div><p class="muted">BILLED TO</p><h1 style="font-size:17px">' + U.esc(c ? c.name : '—') + '</h1>' +
      '<p class="muted">' + U.esc(c && c.contactName ? c.contactName : '') + (c && c.designation ? ' · ' + U.esc(c.designation) : '') + '</p>' +
      '<p class="muted">' + U.esc(c ? (c.address || '') : '') + '</p>' +
      '<p class="muted">' + U.esc(c ? (c.phone || '') : '') + (c && c.email ? ' · ' + U.esc(c.email) : '') + '</p></div>' +
      '<div><p class="muted">PROJECT</p><p style="font-size:13px">' + U.esc(p.projectTitle || '—') + '</p>' +
      '<p class="muted">Payment method: ' + U.esc(method) + '</p>' +
      (p.recurring && p.recurring !== 'none' ? '<p class="muted">Recurring: ' + U.esc(p.recurring) + (p.renewalDate ? ' · next on ' + U.esc(U.fmtDate(p.renewalDate)) : '') + '</p>' : '') +
      '</div></div>' +
      '<table><thead><tr><th>Description</th><th>Notes</th><th class="r">Amount (' + U.esc(cur) + ')</th></tr></thead><tbody>' +
      rows.map(r => '<tr><td>' + U.esc(r[0]) + '</td><td class="muted">' + U.esc(r[1]) + '</td><td class="r">' + U.esc(U.money(r[2], cur)) + '</td></tr>').join('') +
      '</tbody></table>' +
      '<div class="totals"><div><span class="muted">Subtotal</span><span>' + U.esc(U.money(p.amount, cur)) + '</span></div>' +
      '<div><span class="muted">Received</span><span>' + U.esc(U.money(p.amountPaid, cur)) + '</span></div>' +
      '<div class="grand"><span>Balance due</span><span>' + U.esc(U.money(bal, cur)) + '</span></div></div>' +
      '<div class="paybox"><b>How to pay</b><p class="muted" style="margin:8px 0 4px">' + U.esc(methodNote) + '</p>' +
      '<p class="muted">' + U.esc(co.name || '') + ' · ' + U.esc(co.phone || '') + ' · ' + U.esc(co.email || '') + '</p>' +
      '<p class="muted">Please send the transaction reference once paid so we can update your account.</p></div>' +
      '<button onclick="window.print()">Print / Save as PDF</button>' +
      '<div class="foot"><span>Thank you for your business.</span><span>' + U.esc(co.website || '') + '</span></div>' +
      '</div></body></html>';
  }

  App.invoiceHTML = invoiceHTML;
})(window);
