// Builds the app's screens from the Grdlabs Mobile design page (reference/prototype.html), unchanged in look,
// with the demo data taken out and a bridge to the native app: sign-in, pairing, clock-in (NFC, Face ID, GPS) and
// the employee's real pay and attendance come from src/ (Firebase), the rest of the page stays as designed.
// Output: src/web/appHtml.ts (loaded by the WebView) and web-preview/index.html (opened in a browser while building).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const src = readFileSync(new URL('../reference/prototype.html', import.meta.url), 'utf8');
let html = src;
const patch = (from, to) => {
  if (!html.includes(from)) throw new Error('design page changed, patch not found: ' + from.slice(0, 80));
  html = html.split(from).join(to);
};

// ---------- storage: a fresh key, so nothing from the demo carries over ----------
patch("const KEY = 'grdlabs-mobile-ui-v3';", "const KEY = 'grdlabs-app-v1';");

// ---------- bridge to the native app ----------
patch("  const $ = (s, r = document) => r.querySelector(s);", `  const $ = (s, r = document) => r.querySelector(s);
  // Native bridge: the page asks, the app answers through window.grd (defined at the end).
  const RN = window.ReactNativeWebView;
  const post = (m) => { try { RN ? RN.postMessage(JSON.stringify(m)) : window.parent.postMessage({ grd: m }, '*'); } catch {} };
  const G = { staff: null, att: {} };`);

// ---------- start empty instead of with the demo company, freelancer and staff ----------
patch('  const fresh = () => ({', '  const demoFresh = () => ({');
patch('  let S;\n', `  const fresh = () => {
    const s = demoFresh();
    s.staff = []; for (const k in s.inbox) s.inbox[k] = [];
    s.advance = { name: '', amount: 0, status: 'none' };
    for (const b of Object.values(s.biz)) {
      b.customers = []; b.invoices = []; b.receipts = []; b.expenses = []; b.products = [];
      Object.assign(b.company, { name: '', tag: '', addr: '', phone: '', email: '', bank: '', footer: 'شكراً لتعاملكم معنا' });
    }
    return s;
  };
  let S;
`);

// ---------- employee pay and attendance from the company's real summary ----------
patch('  function salary(k) {', `  const KINDS = { bonus: 'مكافأة', advance: 'سلفة', deduction: 'خصم' };
  const salCount = () => (G.staff ? Math.max(1, (G.staff.months || []).length) : 3);
  const dk = (y, m, d) => y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  function salary(k) {
    if (G.staff) {
      const mo = (G.staff.months || [])[k];
      if (!mo) { const d = new Date(); return { m: d.getMonth(), y: d.getFullYear(), items: [], net: 0, paid: false }; }
      const [y, m] = mo.period.split('-').map(Number);
      const when = (s) => s ? ar(Number(s.slice(8, 10))) + ' ' + MONTHS[Number(s.slice(5, 7)) - 1].split(' ')[0] : '';
      const items = [['الراتب الأساسي', '', mo.salary], ...(mo.items || []).map((i) => [KINDS[i.kind] || 'حركة', [i.reason, when(i.date)].filter(Boolean).join(' · '), i.kind === 'bonus' ? i.amount : -i.amount])];
      return { m: m - 1, y, items, net: mo.net, paid: !!mo.paid };
    }`);
patch('  function month() {\n    const d = new Date(), y = d.getFullYear(), m = d.getMonth(), td = d.getDate(), n = new Date(y, m + 1, 0).getDate();\n    const out = [];\n    for (let i = 1; i <= n; i++) {\n      const wd = new Date(y, m, i).getDay(); let k;\n',
  `  function month() {
    const d = new Date(), y = d.getFullYear(), m = d.getMonth(), td = d.getDate(), n = new Date(y, m + 1, 0).getDate();
    const out = [];
    for (let i = 1; i <= n; i++) {
      const wd = new Date(y, m, i).getDay(); let k;
      if (G.staff) { const r = G.att[dk(y, m, i)]; k = i === td ? (r && r.in ? 'p' : 't') : i > td ? 'f' : r && r.in ? 'p' : wd === 5 ? 'o' : ''; out.push({ i, wd, k, today: i === td }); continue; }
`);
patch(`<div class="num" style="font-size:26px;font-weight:700;margin-top:2px">٨:٠٠ – ٤:٠٠</div>`,
  `<div class="num" style="font-size:26px;font-weight:700;margin-top:2px">\${G.staff ? (c.in ? tm(c.in) + ' – ' + (c.out ? tm(c.out) : '…') : '—') : '٨:٠٠ – ٤:٠٠'}</div>`);
patch(`<span class="dot"></span>أنت بموقع الشركة · ستيكر NFC المدخل</div>`, `<span class="dot"></span>قرّب التلفون من ستيكر NFC بمدخل الشركة</div>`);
patch(`.filter((d) => (d.i < new Date().getDate() || (d.today && S.clock.in)) && d.k !== 'o')`,
  `.filter((d) => (d.i < new Date().getDate() || (d.today && S.clock.in)) && d.k !== 'o' && (!G.staff || d.k === 'p'))`);
patch("const s = d.today ? `${tm(S.clock.in)} ← ${S.clock.out ? tm(S.clock.out) : 'هسه'}` : d.k === 'x' ? 'ما مسجّل' : d.k === 'l' ? '٨:٢٠ ص ← ٤:٠٠ م' : '٧:٥٨ ص ← ٤:٠٢ م';",
  "const r = G.att[dk(mo.y, mo.m, d.i)]; const hrs = r && r.in && r.out ? Math.round((new Date(r.out) - new Date(r.in)) / 36e5) : 0;\n        const s = r && r.in ? `${tm(r.in)} ← ${r.out ? tm(r.out) : 'هسه'}` : d.today ? `${tm(S.clock.in)} ← ${S.clock.out ? tm(S.clock.out) : 'هسه'}` : d.k === 'x' ? 'ما مسجّل' : d.k === 'l' ? '٨:٢٠ ص ← ٤:٠٠ م' : '٧:٥٨ ص ← ٤:٠٢ م';");
patch("`<span class=\"v\">${d.today ? 'حاضر' : '٨ ساعات'}</span>`", "`<span class=\"v\">${hrs ? ar(hrs) + ' ساعات' : d.today ? 'حاضر' : G.staff ? 'حاضر' : '٨ ساعات'}</span>`");
patch("${S.salMonth >= 2 ? 'disabled' : ''}", "${S.salMonth >= salCount() - 1 ? 'disabled' : ''}");

// ---------- sign-in screen: no demo buttons; company code and Face ID go to the app ----------
patch(`
      <div class="demo"><span>تجربة:</span>
        <button type="button" class="btn gl sm" style="width:auto" data-act="demo" data-role="employee">موظف</button>
        <button type="button" class="btn gl sm" style="width:auto" data-act="demo" data-role="owner">صاحب شركة</button>
        <button type="button" class="btn gl sm" style="width:auto" data-act="demo" data-role="freelancer">فري لانسر</button></div></div>`, `</div>`);
patch(`<a data-act="freeSignup">افتح حساب فري لانسر</a></span>`, `<a data-act="freeSignup">افتح حساب فري لانسر</a> أو <a data-act="ownerSignup">حساب شركة</a></span>`);
patch(`      <p class="ft" style="text-align:center;margin-top:0">نسخة تجريبية للواجهة · البيانات وهمية</p>\``, '`');
patch("'برنامج المبيعات والفواتير والمحاسبة.<br>هذه نسخة تجريبية للواجهة ببيانات وهمية.'", "'برنامج المبيعات والفواتير والمحاسبة.'");

patch(`    register: () => openSheet(`, `    register: () => post({ type: 'scan' }),
    registerSheet: () => openSheet(`);
patch(`    faceLogin: () => {`, `    faceLogin: () => {
      if (S.faceOn && S.last && S.last.role === 'employee') return post({ type: 'faceUnlock' });`);
patch(`    faceOn: () => { S.seenFace = true; S.faceOn = true;`, `    faceOn: () => { post({ type: 'faceOn' }); S.seenFace = true; S.faceOn = true;`);
patch(`    clock: () => {`, `    clock: () => {
      if (G.staff) return post({ type: 'clock' });`);
patch(`{ t: 'خروج', cls: 'des', f: () => { S.user = null;`, `{ t: 'خروج', cls: 'des', f: () => { if (S.user && S.user.role === 'employee') { G.staff = null; G.att = {}; post({ type: 'logout' }); } S.user = null;`);

// Owner sign-up on the phone: the same sheet as the freelancer one, kept on this phone until the desktop link exists.
patch(`    freeGo: () => {`, `    ownerSignup: () => { A.freeSignup(); const h = $('.sheet .sh h3'); if (h) h.textContent = 'حساب شركة'; const n = $('#fN'); if (n) n.placeholder = 'مثلاً: شركة النور'; const tl = $('label[for="fN"]'); if (tl) tl.textContent = 'اسم الشركة'; const tg = $('label[for="fT"]'); if (tg) tg.textContent = 'نشاط الشركة'; S.signupRole = 'owner'; },
    freeGo: () => {`);
patch(`      Object.assign(S.biz.freelancer.company, { name: n, tag: t || 'فري لانسر', email: e }); closeAll(); hud('انفتح حسابك'); signIn(e, 'freelancer');`,
  `      const r = S.signupRole === 'owner' ? 'owner' : 'freelancer'; S.signupRole = '';
      Object.assign(S.biz[r].company, { name: n, tag: t || (r === 'owner' ? 'شركة' : 'فري لانسر'), email: e }); S.biz[r].pw = $('#fP').value; closeAll(); hud('انفتح حسابك'); signIn(e, r);`);
patch(`    S.user = { email, role: r, name: r === 'freelancer' ? S.biz.freelancer.company.name : NAMES[r] };`,
  `    S.user = { email, role: r, name: r === 'freelancer' ? S.biz.freelancer.company.name : r === 'owner' ? S.biz.owner.company.name : (G.staff && G.staff.name) || NAMES[r] };`);

// Email + password: a business account made on this phone signs in here; everyone else is an employee checked by Firebase.
patch(`    signIn(em, /^(owner|admin|boss)/.test(em) ? 'owner' : /^(free|sara)/.test(em) || em.endsWith('@sara.design') ? 'freelancer' : 'employee');`,
  `    for (const r of ['owner', 'freelancer']) { const b = S.biz[r]; if (b.company.email === em && b.pw) return b.pw === pw ? signIn(em, r) : ok('كلمة المرور غلط'); }
    hudEl.innerHTML = '<span class="face scan" style="width:auto;height:auto">' + I.face(54) + '</span><span>جاري الدخول</span>'; hudEl.classList.add('show');
    post({ type: 'login', email: em, pass: pw });`);

// ---------- freelancer: المهام (daily, weekly and one-off tasks with reminders) ----------
patch("    me: sv('<circle cx=\"12\" cy=\"8\" r=\"4\"/>", "    tasks: sv('<rect x=\"3.5\" y=\"3.5\" width=\"17\" height=\"17\" rx=\"4.5\"/><path d=\"m8.5 12.2 2.4 2.4 4.6-5\"/>', 24),\n    me: sv('<circle cx=\"12\" cy=\"8\" r=\"4\"/>");
patch("['c-clients', 'العملاء', I.team], ['c-fin', 'المالية', I.wallet], ['me', 'الإعدادات', I.gear]],\n  };",
  "['c-tasks', 'المهام', I.tasks], ['c-fin', 'المالية', I.wallet], ['me', 'الإعدادات', I.gear]],\n  };");
patch('${isOwner() ? `<button type="button" class="r ind" data-act="go" data-to="c-clients">', '<button type="button" class="r ind" data-act="go" data-to="c-clients">');
patch('\n        <button type="button" class="r ind" data-act="code">', '\n        ${isOwner() ? `<button type="button" class="r ind" data-act="code">');
patch("return { t: isFree() ? 'العملاء' : 'الزباين', back: isOwner(),", "return { t: isFree() ? 'العملاء' : 'الزباين', back: true,");
patch("      <div class=\"card\">\n        <div style=\"display:flex;justify-content:space-between;align-items:center\"><span class=\"lbl\">${free ? 'دخل هذا الشهر'",
  "      ${free ? tasksCard() : ''}\n      <div class=\"card\">\n        <div style=\"display:flex;justify-content:space-between;align-items:center\"><span class=\"lbl\">${free ? 'دخل هذا الشهر'");
patch("  V.doc = () => {", `  // A task is { id, t, kind: 'once' | 'daily' | 'weekly', date (once), day 0-6 (weekly), time 'HH:MM', remind, done: { [YYYY-MM-DD]: true } }.
  const TK = { once: 'مرة وحدة', daily: 'يومية', weekly: 'أسبوعية' };
  const tasks = () => (B().tasks = B().tasks || []);
  const dayKeyOf = (d) => dk(d.getFullYear(), d.getMonth(), d.getDate());
  const onDay = (k, d) => k.kind === 'daily' || (k.kind === 'weekly' && k.day === d.getDay()) || (k.kind === 'once' && k.date === dayKeyOf(d));
  const time12 = (hm) => { if (!hm) return ''; const [h, m] = hm.split(':').map(Number); return ar((h % 12 || 12) + ':' + String(m).padStart(2, '0')) + (h < 12 ? ' ص' : ' م'); };
  const syncTasks = () => { save(); post({ type: 'tasks', tasks: tasks() }); };
  const taskRow = (k, d) => {
    const key = dayKeyOf(d), done = !!(k.done && k.done[key]);
    return \`<div class="r ind"><button type="button" class="tk \${done ? 'on' : ''}" aria-label="\${done ? 'رجّعها' : 'خلصت'}" data-act="taskDone" data-id="\${k.id}" data-d="\${key}">\${done ? rs(I.check, 16) : ''}</button>
      <button type="button" class="t" style="border:0;background:none;text-align:start;padding:0;color:inherit;font:inherit" data-act="taskMenu" data-id="\${k.id}"><span style="\${done ? 'text-decoration:line-through;color:var(--sec)' : ''}">\${esc(k.t)}</span><span class="s">\${TK[k.kind]}\${k.kind === 'weekly' ? ' · ' + DAYS[k.day] : ''}\${k.time ? ' · ' + time12(k.time) : ''}</span></button>
      \${k.remind && k.time ? \`<span style="color:var(--o)">\${I.bellS(16)}</span>\` : ''}</div>\`;
  };
  function tasksCard() {
    const now = new Date(), list = tasks().filter((k) => onDay(k, now)), left = list.filter((k) => !(k.done && k.done[dayKeyOf(now)]));
    return \`<a class="card tap" data-act="go" data-to="c-tasks" style="display:flex;align-items:center;gap:14px;color:var(--tx);transition:transform .15s">\${sq(rs(I.tasks, 20), 'var(--i)')}
      <div style="flex:1;min-width:0"><div class="lbl">المهم اليوم</div><div style="font-size:17px;font-weight:600;margin-top:2px">\${list.length ? (left.length ? ar(left.length) + ' باقية من ' + ar(list.length) : 'خلصت كل مهام اليوم 👏') : 'ما عندك مهام اليوم'}</div>
      \${left[0] ? \`<div class="lbl" style="margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">التالية: \${esc(left[0].t)}\${left[0].time ? ' · ' + time12(left[0].time) : ''}</div>\` : ''}</div>\${I.chev}</a>\`;
  }
  V['c-tasks'] = () => {
    const now = new Date(), tab = S.taskTab || 'today';
    const days7 = Array.from({ length: 7 }, (_, n) => { const d = new Date(now); d.setDate(now.getDate() + n); return d; });
    const today = tasks().filter((k) => onDay(k, now)), doneN = today.filter((k) => k.done && k.done[dayKeyOf(now)]).length;
    let body;
    if (tab === 'today') body = today.length ? \`<div class="list">\${today.sort((a, b) => (a.time || '99').localeCompare(b.time || '99')).map((k) => taskRow(k, now)).join('')}</div>\` : '';
    else if (tab === 'week') body = days7.map((d, n) => { const l = tasks().filter((k) => onDay(k, d)); return l.length ? \`<p class="hd">\${n === 0 ? 'اليوم' : n === 1 ? 'باچر' : DAYS[d.getDay()] + ' ' + ar(d.getDate())}</p><div class="list">\${l.map((k) => taskRow(k, d)).join('')}</div>\` : ''; }).join('');
    else body = tasks().length ? \`<div class="list">\${tasks().map((k) => taskRow(k, now)).join('')}</div>\` : '';
    return { t: 'المهام', right: \`<button type="button" class="nb ic acc" aria-label="مهمة جديدة" data-act="addTask">\${I.plus}</button>\`, body: \`
      <div class="row2"><div class="mini glass"><span class="lbl">مهام اليوم</span><b>\${ar(today.length)}</b></div><div class="mini glass"><span class="lbl">خلصت</span><b style="color:var(--gt)">\${ar(doneN)}</b></div></div>
      \${today.length ? \`<div class="bar"><i style="width:\${Math.round(doneN / today.length * 100)}%"></i></div>\` : ''}
      <div class="seg glass">\${[['today', 'اليوم'], ['week', 'الأسبوع'], ['all', 'الكل']].map(([k, t]) => \`<button type="button" data-act="set" data-o="S" data-k="taskTab" data-v="\${k}" class="\${tab === k ? 'on' : ''}">\${t}</button>\`).join('')}</div>
      \${body || \`<div class="empty">\${sq(I.tasks, 'var(--i)').replace('class="sq"', 'class="sq" style="width:56px;height:56px;border-radius:16px;background:var(--i)"')}<span>سجّل شغلك اليومي والأسبوعي،<br>ويجيك تنبيه بوقته.</span><button type="button" class="btn sm" style="width:auto;padding:0 22px" data-act="addTask">\${I.plus} مهمة جديدة</button></div>\`}\` };
  };
  V.doc = () => {`);
patch("    brandTip: () => go('c-print'),", `    brandTip: () => go('c-print'),
    addTask: () => { S.tkKind = 'once'; S.tkDay = new Date().getDay(); openSheet(\`\${sheetHead('مهمة جديدة', 'taskSave')}
      <div class="fld"><label for="tkT">شنو المهمة؟</label><input id="tkT" placeholder="مثلاً: تسليم تصاميم متجر لمسة"></div>
      <p class="hd" style="margin:0">التكرار</p><div class="seg" id="tkKind">\${Object.entries(TK).map(([k, t]) => \`<button type="button" data-act="tkKind" data-v="\${k}" class="\${k === 'once' ? 'on' : ''}">\${t}</button>\`).join('')}</div>
      <div class="chips" id="tkDays" hidden>\${DAYS.map((d, i) => \`<button type="button" class="chip \${i === new Date().getDay() ? 'on' : ''}" data-act="tkDay" data-v="\${i}">\${d.replace('ال', '')}</button>\`).join('')}</div>
      <div class="row2"><div class="fld" id="tkDateF"><label for="tkD">اليوم</label><input id="tkD" type="date" value="\${dayKeyOf(new Date())}"></div><div class="fld"><label for="tkH">الوقت</label><input id="tkH" type="time" value="09:00"></div></div>
      <div class="list"><div class="r ind">\${sq(I.bellS(), 'var(--o)')}<span class="t"><span>نبّهني بوقتها</span></span><button type="button" class="sw on" id="tkR" role="switch" aria-checked="true" data-act="tkRemind"></button></div></div>
      <button type="button" class="btn" data-act="taskSave">أضف المهمة</button>\`); },
    tkKind: (el) => { S.tkKind = el.dataset.v; for (const b of $('#tkKind').children) b.classList.toggle('on', b === el); $('#tkDays').hidden = S.tkKind !== 'weekly'; $('#tkDateF').style.visibility = S.tkKind === 'once' ? 'visible' : 'hidden'; haptic(); },
    tkDay: (el) => { S.tkDay = Number(el.dataset.v); for (const b of $('#tkDays').children) b.classList.toggle('on', b === el); haptic(); },
    tkRemind: (el) => { el.classList.toggle('on'); el.setAttribute('aria-checked', el.classList.contains('on')); haptic(); },
    taskSave: () => {
      const t = $('#tkT').value.trim(); if (!t) return ok('اكتب المهمة');
      const k = { id: Date.now(), t, kind: S.tkKind || 'once', time: $('#tkH').value || '', remind: $('#tkR').classList.contains('on'), done: {} };
      if (k.kind === 'once') k.date = $('#tkD').value || dayKeyOf(new Date());
      if (k.kind === 'weekly') k.day = S.tkDay ?? new Date().getDay();
      tasks().push(k); syncTasks(); closeAll(); hud('انضافت المهمة'); render();
    },
    taskDone: (el) => { const k = tasks().find((x) => x.id === Number(el.dataset.id)); if (!k) return; k.done = k.done || {}; if (k.done[el.dataset.d]) delete k.done[el.dataset.d]; else { k.done[el.dataset.d] = true; haptic(); } syncTasks(); render(); },
    taskMenu: (el) => { const k = tasks().find((x) => x.id === Number(el.dataset.id)); if (!k) return; openMenu([{ t: 'احذف المهمة', i: I.trash, cls: 'des', f: () => { B().tasks = tasks().filter((x) => x !== k); syncTasks(); render(); hud('انحذفت'); } }], esc(k.t)); },`);
// Reminders while the app is open (the phone app also schedules system notifications from post({ type: 'tasks' })).
patch("  tick(); setInterval(tick, 15000);", `  tick(); setInterval(tick, 15000);
  const remind = () => {
    if (!isFree()) return;
    const now = new Date(), hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), key = dayKeyOf(now);
    for (const k of tasks()) if (k.remind && k.time === hm && onDay(k, now) && !(k.done && k.done[key]) && S.flags['tk' + k.id] !== key) { S.flags['tk' + k.id] = key; push('freelancer', 'تذكير مهمة', k.t, 'c-tasks'); }
  };
  setInterval(remind, 20000);`);
patch("  .bar i { display: block;", "  .tk { width: 26px; height: 26px; border-radius: 13px; border: 2px solid var(--ter); background: none; flex: none; padding: 0; display: flex; align-items: center; justify-content: center; color: #fff; transition: background .2s, border-color .2s; }\n  .tk.on { background: var(--g); border-color: var(--g); }\n  .bar i { display: block;");

// ---------- currency: every invoice, receipt and expense is in dinar or dollar ----------
patch("B().customers[0].n", "(B().customers[0] || { n: 'زبون نقدي' }).n");
patch("  const debtTotal = () => B().invoices.reduce((a, i) => a + due(i), 0);", `  const CUR = { IQD: 'د.ع', USD: '$' };
  const curOf = (x) => (x && x.cur) || 'IQD';
  const sym = (x) => CUR[curOf(x)];
  const usdFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  // Amount with its currency, for lists: "250,000" for dinar (the screens already say د.ع), "$1,250" for dollar.
  const mny = (n, x) => curOf(x) === 'USD' ? '$' + usdFmt.format(n || 0) : money(n);
  const wordsOf = (n, x) => curOf(x) === 'USD' ? dinarWords(n).replace('دينار عراقي', 'دولار أمريكي') : dinarWords(n);
  const iqdOnly = (arr) => arr.filter((x) => curOf(x) === 'IQD');
  const usdSum = (arr, f) => arr.filter((x) => curOf(x) === 'USD').reduce((a, x) => a + f(x), 0);
  const usdLine = (v) => v ? \`<div class="lbl" style="margin-top:2px;color:var(--acc);font-weight:600">+ $\${usdFmt.format(v)}</div>\` : '';
  const curSeg = (o, v) => \`<p class="hd">العملة</p><div class="seg">\${[['IQD', 'دينار عراقي'], ['USD', 'دولار أمريكي $']].map(([k, n]) => \`<button type="button" data-act="set" data-o="\${o}" data-k="cur" data-v="\${k}" class="\${(v || 'IQD') === k ? 'on' : ''}">\${n}</button>\`).join('')}</div>\`;
  const debtTotal = () => iqdOnly(B().invoices).reduce((a, i) => a + due(i), 0);
  const debtUSD = () => usdSum(B().invoices, due);`);
patch("  const salesOn = (n) => B().invoices.filter((i) => daysAgo(i.date) === n)", "  const salesOn = (n) => iqdOnly(B().invoices).filter((i) => daysAgo(i.date) === n)");
// Printed documents: the dollar ones say $ and "دولار أمريكي" wherever the design says د.ع and "دينار عراقي".
patch("  function doPrint() {", `  for (const k of ['inv', 'rcpt', 'exp']) {
    const f = DOC[k];
    DOC[k] = (x) => { const r = f(x); if (curOf(x) === 'USD') r.html = r.html.split(' د.ع').join(' $').split('دينار عراقي').join('دولار أمريكي'); return r; };
  }
  function doPrint() {`);
// Lists and detail screens show each amount in its own currency.
{
  const a = html.indexOf('  // ---------- views ----------'), b = html.indexOf('  // ---------- actions ----------');
  let v = html.slice(a, b);
  for (const [from, to] of [['money(total(i))', 'mny(total(i), i)'], ['money(due(i))', 'mny(due(i), i)'], ['money(r.amt)', 'mny(r.amt, r)'], ['money(e.amt)', 'mny(e.amt, e)'], ['money(x.p)', 'mny(x.p, draft)'], ['money(x.q * x.p)', 'mny(x.q * x.p, draft)']]) v = v.split(from).join(to);
  v = v.split('${money(t)} <span class="cur">د.ع</span>').join('${curOf(i) === "USD" ? mny(t, i) : money(t) + \' <span class="cur">د.ع</span>\'}');
  html = html.slice(0, a) + v + html.slice(b);
}
patch("const monthInv = B().invoices.filter(", "const monthInv = iqdOnly(B().invoices).filter(");
patch("<div class=\"lbl\" style=\"margin-top:2px\">${ar(cnt)} فاتورة ${free ? 'هذا الشهر' : 'اليوم'}</div>",
  "${usdLine(usdSum(B().invoices.filter((i) => free ? new Date(i.date).getMonth() === m0 && daysAgo(i.date) < 31 : daysAgo(i.date) === 0), total))}<div class=\"lbl\" style=\"margin-top:2px\">${ar(cnt)} فاتورة ${free ? 'هذا الشهر' : 'اليوم'}</div>");
patch("const mOut = ex.filter((e) => new Date(e.date).getMonth() === mo).reduce((a, e) => a + e.amt, 0), mIn = rcs.filter((r) => new Date(r.date).getMonth() === mo).reduce((a, r) => a + r.amt, 0);",
  "const exM = ex.filter((e) => new Date(e.date).getMonth() === mo), rcM = rcs.filter((r) => new Date(r.date).getMonth() === mo);\n    const mOut = iqdOnly(exM).reduce((a, e) => a + e.amt, 0), mIn = iqdOnly(rcM).reduce((a, r) => a + r.amt, 0);");
patch("<b style=\"color:var(--r)\">${money(mOut)}</b></div>", "<b style=\"color:var(--r)\">${money(mOut)}</b>${usdLine(usdSum(exM, (e) => e.amt))}</div>");
patch("<b style=\"color:var(--gt)\">${money(mIn)}</b></div>", "<b style=\"color:var(--gt)\">${money(mIn)}</b>${usdLine(usdSum(rcM, (r) => r.amt))}</div>");
patch("<b style=\"color:var(--ot)\">${money(debtTotal())}</b>", "<b style=\"color:var(--ot)\">${money(debtTotal())}</b>${usdLine(debtUSD())}");
// New invoice, expense and receipt: pick the currency.
patch("    <p class=\"hd\">الدفع</p><div class=\"seg\">${['نقد', 'آجل', 'تحويل', 'جزئي']", "    ${curSeg('draft', draft.cur)}\n    <p class=\"hd\">الدفع</p><div class=\"seg\">${['نقد', 'آجل', 'تحويل', 'جزئي']");
patch("const inv = { no: draft.no, c: draft.c,", "const inv = { cur: draft.cur || 'IQD', no: draft.no, c: draft.c,");
patch('<label for="amt" class="lbl">المبلغ بالدينار</label>', '<label for="amt" class="lbl">المبلغ ${exp.cur === "USD" ? "بالدولار" : "بالدينار"}</label>');
patch("<div class=\"words\" id=\"expW\">${exp.amt ? dinarWords(exp.amt) : ''}</div></div>", "<div class=\"words\" id=\"expW\">${exp.amt ? wordsOf(exp.amt, exp) : ''}</div></div>\n    ${curSeg('exp', exp.cur)}");
patch("const e = { no: nextNo('ex'), cat: exp.cat,", "const e = { cur: exp.cur || 'IQD', no: nextNo('ex'), cat: exp.cat,");
patch("<div class=\"words\" id=\"rcW\">${rc.amt ? dinarWords(rc.amt) : ''}</div></div>", "<div class=\"words\" id=\"rcW\">${rc.amt ? wordsOf(rc.amt, rc) : ''}</div></div>\n      ${rc.inv ? '' : curSeg('rc', rc.cur)}");
patch("rc = { c: d.c || (i ? i.c : (B().customers[0] || { n: 'زبون نقدي' }).n), inv: i ? i.no : 0,", "rc = { cur: i ? curOf(i) : 'IQD', c: d.c || (i ? i.c : (B().customers[0] || { n: 'زبون نقدي' }).n), inv: i ? i.no : 0,");
patch("    rcInv: (el) => { rc.inv = Number(el.dataset.no); const i = invBy(rc.inv); if (i) rc.amt = due(i);", "    rcInv: (el) => { rc.inv = Number(el.dataset.no); const i = invBy(rc.inv); if (i) { rc.amt = due(i); rc.cur = curOf(i); }");
patch("{ no: nextNo('rc'), c: rc.c, amt: rc.amt,", "{ cur: rc.cur || 'IQD', no: nextNo('rc'), c: rc.c, amt: rc.amt,");

patch("if (o === 'exp' && k === 'amt') $('#expW').textContent = exp.amt ? dinarWords(exp.amt) : '';", "if (o === 'exp' && k === 'amt') $('#expW').textContent = exp.amt ? wordsOf(exp.amt, exp) : '';");
patch("if (o === 'rc' && k === 'amt') $('#rcW').textContent = rc.amt ? dinarWords(rc.amt) : '';", "if (o === 'rc' && k === 'amt') $('#rcW').textContent = rc.amt ? wordsOf(rc.amt, rc) : '';");
patch("<span class=\"s\" style=\"white-space:normal\">${t ? dinarWords(t) : ''}</span></span><span class=\"vb\" style=\"font-size:22px\">${money(t)}</span>",
  "<span class=\"s\" style=\"white-space:normal\">${t ? wordsOf(t, draft) : ''}</span></span><span class=\"vb\" style=\"font-size:22px\">${mny(t, draft)}</span>");

patch("<span class=\"t\"><span>المجموع</span></span><span class=\"v\">${money(s)}</span></div>${draft.disc ? `<div class=\"r\"><span class=\"t\"><span>الخصم</span></span><span class=\"v\" style=\"color:var(--r)\">− ${money(draft.disc)}</span>",
  "<span class=\"t\"><span>المجموع</span></span><span class=\"v\">${mny(s, draft)}</span></div>${draft.disc ? `<div class=\"r\"><span class=\"t\"><span>الخصم</span></span><span class=\"v\" style=\"color:var(--r)\">− ${mny(draft.disc, draft)}</span>");

for (const [from, to] of [
  ['`فاتورة #${inv.no} · ${money(t)} د.ع`', '`فاتورة #${inv.no} · ${curOf(inv) === "USD" ? mny(t, inv) : money(t) + " د.ع"}`'],
  ['هو ${money(due(i))} د.ع.`', 'هو ${curOf(i) === "USD" ? mny(due(i), i) : money(due(i)) + " د.ع"}.`'],
  ['`سند قبض #${r.no} · ${money(r.amt)} د.ع`', '`سند قبض #${r.no} · ${curOf(r) === "USD" ? mny(r.amt, r) : money(r.amt) + " د.ع"}`'],
  ['`سند صرف #${e.no} · ${money(e.amt)} د.ع`', '`سند صرف #${e.no} · ${curOf(e) === "USD" ? mny(e.amt, e) : money(e.amt) + " د.ع"}`'],
]) patch(from, to);

// ---------- modern invoice + "printing" entrance ----------
{
  const a = html.indexOf('    inv: (i) => { const s = status(i); return {'), b = html.indexOf('    rcpt: (r) => {');
  if (a < 0 || b < 0) throw new Error('invoice template not found');
  html = html.slice(0, a) + `    inv: (i) => { const s = status(i), c = B().company, t = total(i), pd = Math.min(100, t ? Math.round((i.paid || 0) / t * 100) : 0), U = curOf(i) === 'USD';
      const am = (n) => U ? '$' + usdFmt.format(n || 0) : money(n);
      return { title: 'فاتورة #' + i.no, file: 'فاتورة-' + i.no, html: \`<div class="iv">
      <div class="iv-hero"><div class="iv-glow g1"></div><div class="iv-glow g2"></div>
        <div class="iv-top"><div class="iv-brand"><div class="logo">\${logoHTML(c)}</div><div><b>\${esc(c.name)}</b>\${c.tag ? \`<span>\${esc(c.tag)}</span>\` : ''}</div></div>
          <div class="iv-chip \${ST[s][2]}">\${ST[s][0]}</div></div>
        <div class="iv-title"><div><span class="iv-k">فاتورة</span><h1>#\${i.no}</h1></div>
          <div class="iv-total"><span>المبلغ المستحق</span><b>\${am(due(i))}\${U ? '' : '<small>د.ع</small>'}</b></div></div></div>
      <div class="iv-cards">
        <div class="iv-card"><span>\${isFree() ? 'فاتورة إلى' : 'الزبون'}</span><b>\${esc(i.c)}</b>\${phoneOf(i.c) ? \`<small dir="ltr">\${esc(phoneOf(i.c))}</small>\` : ''}</div>
        <div class="iv-card"><span>تاريخ الإصدار</span><b>\${dateAr(i.date)}</b><small>\${tm(i.date)}</small></div>
        <div class="iv-card"><span>الاستحقاق</span><b>\${due(i) > 0 || i.due ? dateAr(dueDate(i)) : 'عند الاستلام'}</b><small>\${esc(i.pay)} · \${U ? 'دولار أمريكي' : 'دينار عراقي'}</small></div></div>
      <div class="iv-items"><div class="iv-head"><span>\${isFree() ? 'الخدمة' : 'المادة'}</span><span>الكمية</span><span>السعر</span><span>المجموع</span></div>
        \${i.items.map((x, k) => \`<div class="iv-row"><span class="iv-n"><i>\${k + 1}</i>\${esc(x.n)}</span><span>\${nf.format(x.q)}</span><span>\${am(x.p)}</span><b>\${am(x.q * x.p)}</b></div>\`).join('')}</div>
      <div class="iv-bottom">
        <div class="iv-side">\${B().print.words ? \`<div class="iv-box"><span>المبلغ كتابةً</span><p>\${wordsOf(t, i)}</p></div>\` : ''}
          \${c.bank ? \`<div class="iv-box"><span>معلومات الدفع</span><p>\${esc(c.bank)}</p></div>\` : ''}\${i.note ? \`<div class="iv-box"><span>ملاحظات</span><p>\${esc(i.note)}</p></div>\` : ''}</div>
        <div class="iv-sum"><div class="kv"><span>المجموع</span><b>\${am(sub(i))}</b></div>\${i.disc ? \`<div class="kv"><span>الخصم</span><b>− \${am(i.disc)}</b></div>\` : ''}
          <div class="iv-grand"><span>الإجمالي</span><b>\${am(t)}\${U ? '' : ' <small>د.ع</small>'}</b></div>
          <div class="kv"><span>المدفوع</span><b>\${am(i.paid || 0)}</b></div><div class="iv-bar"><i style="width:\${pd}%"></i></div><div class="kv"><span>نسبة السداد</span><b>\${ar(pd)}٪</b></div></div></div>
      \${s === 'paid' ? '<div class="stamp">مدفوعة</div>' : s === 'late' ? '<div class="stamp r">متأخرة</div>' : ''}
      \${B().print.sign ? '<div class="iv-sign"><div>' + (isFree() ? 'التوقيع' : 'توقيع البائع') + '</div><div>توقيع المستلم</div></div>' : '<div class="spacer"></div>'}
      <div class="iv-foot"><span>\${esc(c.footer)}</span><span>\${[c.phone, c.email].filter(Boolean).map(esc).join(' · ')}</span><span>أُنشئت بـ <b>Grdlabs</b></span></div>
      <div class="iv-tear"></div></div>\` }; },
` + html.slice(b);
}
patch('      <div class="pwrap" id="pwrap"><div class="paper">${docEl(d)}</div></div>',
  '      <div class="printer" aria-hidden="true"><div class="p-led"></div><div class="p-name">Grdlabs Print</div><div class="p-slot"></div></div>\n      <div class="pwrap" id="pwrap"><div class="feed"><div class="paper">${docEl(d)}</div></div></div>');
patch("  #print { display: none; }", `  /* ---------- modern invoice ---------- */
  .doc .iv { display: flex; flex-direction: column; min-height: 1123px; position: relative; background: #fff; }
  .doc .iv-hero { position: relative; overflow: hidden; margin: 22px 22px 0; border-radius: 30px; padding: 30px 34px 32px; color: #fff;
    background: linear-gradient(135deg, color-mix(in srgb, var(--bc) 92%, #000) 0%, var(--bc) 55%, color-mix(in srgb, var(--bc) 55%, #fff) 100%); }
  .doc .iv-glow { position: absolute; border-radius: 50%; filter: blur(40px); opacity: .55; }
  .doc .iv-glow.g1 { width: 320px; height: 320px; left: -80px; top: -140px; background: color-mix(in srgb, var(--bc) 40%, #fff); }
  .doc .iv-glow.g2 { width: 260px; height: 260px; right: 30%; bottom: -170px; background: color-mix(in srgb, var(--bc) 50%, #000); }
  .doc .iv-top, .doc .iv-title { position: relative; display: flex; justify-content: space-between; align-items: center; gap: 20px; }
  .doc .iv-brand { display: flex; align-items: center; gap: 14px; }
  .doc .iv-brand .logo { width: 62px; height: 62px; border-radius: 18px; background: rgba(255,255,255,.18); box-shadow: inset 0 0 0 1px rgba(255,255,255,.35); font-size: 28px; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; overflow: hidden; }
  .doc .iv-brand .logo img { width: 100%; height: 100%; object-fit: cover; }
  .doc .iv-brand b { display: block; font-size: 22px; font-weight: 800; color: #fff; }
  .doc .iv-brand span { display: block; font-size: 13px; color: rgba(255,255,255,.8); }
  .doc .iv-chip { padding: 7px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; background: rgba(255,255,255,.92); }
  .doc .iv-title { margin-top: 34px; align-items: flex-end; }
  .doc .iv-k { font-size: 14px; letter-spacing: 2px; color: rgba(255,255,255,.75); font-weight: 600; }
  .doc .iv-title h1 { margin: 0; font-size: 54px; line-height: 1.05; font-weight: 800; color: #fff; letter-spacing: -1px; font-variant-numeric: tabular-nums; }
  .doc .iv-total { text-align: left; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.28); border-radius: 22px; padding: 14px 20px; backdrop-filter: blur(10px); }
  .doc .iv-total span { display: block; font-size: 12px; color: rgba(255,255,255,.8); }
  .doc .iv-total b { font-size: 32px; font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; }
  .doc .iv-total small, .doc .iv-grand small { font-size: 14px; font-weight: 600; opacity: .85; }
  .doc .iv-cards { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 12px; margin: 18px 22px 0; }
  .doc .iv-card { background: #F5F6FA; border-radius: 20px; padding: 14px 18px; }
  .doc .iv-card span, .doc .iv-box span { display: block; font-size: 11.5px; color: #8E8E93; font-weight: 600; }
  .doc .iv-card b { display: block; font-size: 15px; font-weight: 700; margin-top: 2px; }
  .doc .iv-card small { display: block; font-size: 12px; color: #6E6E73; }
  .doc .iv-items { margin: 22px 22px 0; display: flex; flex-direction: column; gap: 8px; }
  .doc .iv-head, .doc .iv-row { display: grid; grid-template-columns: 1fr 80px 120px 130px; gap: 10px; align-items: center; padding: 0 18px; }
  .doc .iv-head { font-size: 12px; font-weight: 700; color: var(--bc); padding-bottom: 2px; }
  .doc .iv-head span:not(:first-child), .doc .iv-row > :not(:first-child) { text-align: left; font-variant-numeric: tabular-nums; }
  .doc .iv-row { min-height: 56px; border-radius: 18px; border: 1px solid #EEEFF4; background: linear-gradient(90deg, #fff, #FAFBFD); }
  .doc .iv-row b { font-weight: 800; }
  .doc .iv-n { display: flex; align-items: center; gap: 12px; font-weight: 600; }
  .doc .iv-n i { font-style: normal; width: 28px; height: 28px; border-radius: 9px; background: color-mix(in srgb, var(--bc) 12%, #fff); color: var(--bc); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; flex: none; }
  .doc .iv-bottom { display: flex; gap: 22px; margin: 22px 22px 0; align-items: flex-start; }
  .doc .iv-side { flex: 1; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .doc .iv-box { border-radius: 18px; padding: 12px 16px; border: 1px dashed #DADCE4; }
  .doc .iv-box p { margin: 2px 0 0; font-size: 13px; }
  .doc .iv-sum { width: 320px; flex: none; background: #F5F6FA; border-radius: 24px; padding: 14px 16px; }
  .doc .iv-sum .kv { display: flex; justify-content: space-between; padding: 6px 4px; font-variant-numeric: tabular-nums; }
  .doc .iv-sum .kv span { color: #6E6E73; }
  .doc .iv-grand { display: flex; justify-content: space-between; align-items: center; margin: 8px 0; padding: 14px 18px; border-radius: 18px; color: #fff; background: linear-gradient(135deg, var(--bc), color-mix(in srgb, var(--bc) 60%, #fff)); box-shadow: 0 12px 24px -14px var(--bc); }
  .doc .iv-grand span { color: rgba(255,255,255,.85); font-weight: 600; }
  .doc .iv-grand b { font-size: 22px; font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; }
  .doc .iv-bar { height: 8px; border-radius: 4px; background: #E4E6EE; overflow: hidden; margin: 4px 4px; }
  .doc .iv-bar i { display: block; height: 100%; border-radius: 4px; background: linear-gradient(90deg, #34C759, #30D158); }
  .doc .iv-sign { display: flex; gap: 40px; margin: auto 56px 0; padding-top: 56px; }
  .doc .iv-sign div { flex: 1; border-top: 1.5px dashed #C7C7CC; padding-top: 8px; text-align: center; color: #6E6E73; font-size: 12px; }
  .doc .iv .spacer { margin-top: auto; }
  .doc .iv-foot { display: flex; justify-content: space-between; gap: 14px; margin: 26px 22px 0; padding: 14px 20px; border-radius: 18px; background: #F5F6FA; color: #8E8E93; font-size: 11.5px; }
  .doc .iv-foot b { color: var(--bc); }
  .doc .iv-tear { height: 18px; margin-top: 18px; background: radial-gradient(circle at 10px -2px, transparent 10px, #F2F3F7 10.5px) 0 0 / 20px 18px repeat-x; opacity: .9; }
  .doc .iv .stamp { top: 360px; }

  /* ---------- the paper comes out of a printer ---------- */
  .printer { position: relative; height: 54px; margin: 0 -4px -26px; border-radius: 22px; z-index: 2; flex: none;
    background: linear-gradient(180deg, color-mix(in srgb, var(--tx) 80%, #555), color-mix(in srgb, var(--tx) 95%, #000)); box-shadow: 0 14px 30px -12px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.25); }
  :root[data-theme="dark"] .printer, .printer { --pg: #2C2C30; }
  .printer .p-led { position: absolute; top: 14px; left: 18px; width: 8px; height: 8px; border-radius: 4px; background: #30D158; box-shadow: 0 0 10px #30D158; animation: led .5s steps(2) 6; }
  @keyframes led { 50% { opacity: .2; } }
  .printer .p-name { position: absolute; top: 9px; right: 20px; font-size: 11px; font-weight: 700; letter-spacing: 1px; color: rgba(255,255,255,.55); direction: ltr; }
  .printer .p-slot { position: absolute; left: 22px; right: 22px; bottom: 12px; height: 8px; border-radius: 4px; background: #000; box-shadow: inset 0 2px 4px rgba(0,0,0,.9), 0 1px 0 rgba(255,255,255,.12); }
  .pwrap { position: relative; padding-top: 6px; }
  .feed { transform-origin: top center; animation: feed 2.8s cubic-bezier(.4,0,.2,1) both; }
  @keyframes feed {
    0% { transform: translateY(-100%); } 12% { transform: translateY(-86%); } 20% { transform: translateY(-84%); } 34% { transform: translateY(-62%); }
    42% { transform: translateY(-60%); } 58% { transform: translateY(-36%); } 66% { transform: translateY(-34%); } 84% { transform: translateY(-8%); } 100% { transform: translateY(0); } }
  .feed .paper::after { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 100%; pointer-events: none;
    background: linear-gradient(180deg, rgba(0,0,0,.18), transparent 12%); animation: ink 2.8s ease-out both; }
  @keyframes ink { to { opacity: 0; } }
  .paper { position: relative; }
  @media (prefers-reduced-motion: reduce) { .feed, .feed .paper::after, .printer .p-led { animation: none; } }
  #print { display: none; }`);

// ---------- freelancer: projects, work timer, monthly goal (code kept in scripts/web/ as plain page JS) ----------
{
  const views = readFileSync(new URL('./web/freelancer-views.js', import.meta.url), 'utf8');
  const actions = readFileSync(new URL('./web/freelancer-actions.js', import.meta.url), 'utf8');
  patch("  V['c-tasks'] = () => {\n", views);
  patch("    addTask: () => {", actions + "    addTask: () => {");
}
patch("    go: (el) => { if (el.dataset.no) S.cur = Number(el.dataset.no); go(el.dataset.to); },", "    go: (el) => { if (el.dataset.no) S.cur = Number(el.dataset.no); if (el.dataset.pid) S.pid = Number(el.dataset.pid); go(el.dataset.to); },");
patch("${free ? `<button type=\"button\" class=\"act\" data-act=\"addClient\">${sq(I.user(20), 'var(--p)')}عميل</button>` : ''}",
  "${free ? `<button type=\"button\" class=\"act\" data-act=\"go\" data-to=\"c-projects\">${sq(I.doc.replace(/width=\"24\" height=\"24\"/, 'width=\"20\" height=\"20\"'), 'var(--p)')}المشاريع</button>` : ''}");
patch("      ${free ? tasksCard() : ''}\n", "      ${free ? tasksCard() + goalCard() : ''}\n");
patch("      ${isOwner() && a.status === 'pending' ?", "      ${free ? projectsCard() : ''}\n      ${isOwner() && a.status === 'pending' ?");
patch("      const t = total(inv); inv.paid =", "      if (draft.proj) { const pj = projBy(draft.proj); if (pj) { pj.inv = inv.no; pj.status = 'done'; pj.progress = 100; if (pj.run) { pj.secs = spent(pj); pj.run = null; } } }\n      const t = total(inv); inv.paid =");
patch("  setInterval(remind, 20000);", "  setInterval(remind, 20000);\n  setInterval(() => { if (route !== 'c-projd') return; const p = projBy(S.pid), el = $('#ptime'); if (p && el && p.run) el.textContent = hms(spent(p)); }, 1000);");
patch("  .tk.on {", "  .pbar { display: block; height: 4px; border-radius: 2px; background: var(--fill); margin-top: 6px; overflow: hidden; }\n  .pbar i { display: block; height: 100%; background: var(--p); border-radius: 2px; }\n  .tk.on {");

patch("const v = B().invoices.filter((i) => Math.floor(daysAgo(i.date) / 7) === w)", "const v = iqdOnly(B().invoices).filter((i) => Math.floor(daysAgo(i.date) / 7) === w)");

// ---------- share / print: a real PDF from the phone app ----------
patch("  function doPrint() {\n    const d = docData();", `  // A self-contained page for the PDF: the design's own styles plus the document, on white A4.
  const docPage = (d) => '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=794">'
    + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700;800&display=swap">'
    + '<style>' + [...document.querySelectorAll('style')].map((s) => s.textContent).join('\\n') + '</style>'
    + '<style>@page{size:794px 1123px;margin:0}html,body{margin:0;padding:0;height:auto;min-height:0;overflow:hidden;background:#fff;display:block;direction:ltr}body>.doc{direction:rtl;margin:0;width:794px;height:1123px;min-height:1123px;overflow:hidden}.doc .iv{min-height:1093px}</style>'
    // The phone's print renderer lays the page out at its own width (not 794), then shrinks it onto the sheet;
    // zooming the document to that width makes it fill the A4 page exactly, edge to edge.
    + '<script>function fit(){var w=document.documentElement.clientWidth||window.innerWidth||794;document.body.style.zoom=String(w/794);}fit();addEventListener("resize",fit);addEventListener("load",fit);</script>'
    + '</head><body>' + docEl(d) + '<script>fit()</script></body></html>';
  function doPrint() {
    const d = docData();
    if (RN) return post({ type: 'pdf', mode: 'print', file: d.file, html: docPage(d) });`);
patch("  async function doShare() {\n    const d = docData(),", "  async function doShare() {\n    if (RN) { const d0 = docData(); return post({ type: 'pdf', mode: 'share', file: d0.file, html: docPage(d0) }); }\n    const d = docData(),");

// ---------- frosted band behind the floating tab bar, like iOS ----------
patch('  <nav id="tabs" class="tabs" aria-label="التبويبات" hidden></nav>', '  <div class="tabblur" id="tabblur" aria-hidden="true" hidden></div>\n  <nav id="tabs" class="tabs" aria-label="التبويبات" hidden></nav>');
patch("tabs.hidden = !showTabs;", "tabs.hidden = !showTabs; $('#tabblur').hidden = !showTabs;");
patch("  .tab { flex: 1;", `  .tabblur { position: absolute; left: 0; right: 0; bottom: 0; height: calc(var(--bot) + 104px); z-index: 29; pointer-events: none;
    -webkit-backdrop-filter: blur(16px) saturate(180%); backdrop-filter: blur(16px) saturate(180%);
    background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--wall) 75%, transparent) 55%, color-mix(in srgb, var(--wall) 92%, transparent));
    -webkit-mask: linear-gradient(to bottom, transparent, #000 38%); mask: linear-gradient(to bottom, transparent, #000 38%); }
  #nav::before { opacity: .85; }
  #nav.solid::before { opacity: 1; }
  .tab { flex: 1;`);

// ---------- what the app calls back ----------
patch(`  applyTheme();\n  route = S.user ? homeOf() : 'login';`, `  const applyStaff = (staff) => {
    G.staff = staff; G.att = {};
    for (const x of (staff && staff.attendance) || []) { const d = new Date(x.at), k = dk(d.getFullYear(), d.getMonth(), d.getDate()), r = G.att[k] || (G.att[k] = {}); if (x.kind === 'in' && !r.in) r.in = x.at; if (x.kind === 'out') r.out = x.at; }
    const t = new Date(), r = G.att[dk(t.getFullYear(), t.getMonth(), t.getDate())] || {};
    S.clock = { day: t.toDateString(), in: r.in || null, out: r.out || null };
  };
  window.grd = {
    signedIn: (u, staff) => { hudEl.classList.remove('show'); applyStaff(staff); signIn(u.email, 'employee'); },
    staff: (staff) => { applyStaff(staff); if (S.user && S.user.role === 'employee') { if (staff && staff.name) S.user.name = staff.name; save(); render(); } },
    failed: (title, msg) => { hudEl.classList.remove('show'); ok(title, msg || ''); },
    busy: (text) => { hudEl.innerHTML = '<span class="face scan" style="width:auto;height:auto">' + I.face(54) + '</span><span>' + esc(text) + '</span>'; hudEl.classList.add('show'); },
    done: (text) => { hudEl.classList.remove('show'); if (text) hud(text); render(); },
    signedOut: () => { G.staff = null; G.att = {}; if (S.user && S.user.role === 'employee') { S.user = null; save(); go('login', false); } },
  };
  applyTheme();
  route = S.user && (S.user.role !== 'employee') ? homeOf() : 'login';
  post({ type: 'ready', user: S.user && S.user.role === 'employee' ? S.user : null });
  if (S.biz.freelancer.tasks) post({ type: 'tasks', tasks: S.biz.freelancer.tasks });`);

// The page title follows the screen; the phone app has no browser chrome, so keep the tab title plain.
const ts = 'export const APP_HTML = ' + JSON.stringify(html) + ';\n';
mkdirSync(new URL('../src/web/', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/web/appHtml.ts', import.meta.url), '// Generated by scripts/build-web.mjs from reference/prototype.html. Do not edit by hand.\n' + ts);
mkdirSync(new URL('../web-preview/', import.meta.url), { recursive: true });
writeFileSync(new URL('../web-preview/app.html', import.meta.url), html);
console.log('ok', html.length);
