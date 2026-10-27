  // ---------- freelancer: projects with a work timer, and a monthly income goal ----------
  // A project is { id, n, c, price, cur, rate, due, status: 'work' | 'review' | 'done', progress, secs, run, inv }.
  const PS = { work: ['قيد العمل', 'pb'], review: ['مراجعة', 'po'], done: ['مسلّم', 'pg'] };
  const projects = () => (B().projects = B().projects || []);
  const projBy = (id) => projects().find((p) => p.id === Number(id));
  const spent = (p) => (p.secs || 0) + (p.run ? Math.floor((Date.now() - p.run) / 1000) : 0);
  const hms = (s) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':');
  const projValue = (p) => p.price || Math.round(spent(p) / 3600 * (p.rate || 0));
  const daysLeft = (p) => p.due ? Math.ceil((new Date(p.due + 'T23:59:59') - Date.now()) / 864e5) : null;
  const dueText = (p) => { const n = daysLeft(p); if (n === null) return 'بدون موعد'; if (p.status === 'done') return 'تسلّم'; if (n < 0) return 'متأخر ' + ar(-n) + ' يوم'; if (n === 0) return 'التسليم اليوم'; return 'باقي ' + ar(n) + (n > 10 ? ' يوم' : ' أيام'); };
  const projRow = (p) => `<button type="button" class="r" data-act="go" data-to="c-projd" data-pid="${p.id}"><span class="av">${esc(p.n[0])}</span>
    <span class="t"><span>${esc(p.n)}</span><span class="s" style="${daysLeft(p) !== null && daysLeft(p) < 0 && p.status !== 'done' ? 'color:var(--r)' : ''}">${esc(p.c)} · ${dueText(p)}</span><span class="pbar"><i style="width:${p.progress || 0}%"></i></span></span>
    <span class="end"><span class="vb">${mny(projValue(p), p)}</span><span class="pill ${PS[p.status][1]}">${PS[p.status][0]}</span></span></button>`;

  function goalCard() {
    const goal = B().goal || 0, m0 = new Date().getMonth();
    const got = iqdOnly(B().invoices).filter((i) => new Date(i.date).getMonth() === m0 && daysAgo(i.date) < 31).reduce((a, i) => a + total(i), 0);
    if (!goal) return `<div class="tip"><div style="flex:1"><div class="k">هدف الشهر</div><div class="m">حدّد كم تريد تحصّل هذا الشهر</div></div><a data-act="setGoal" style="font-weight:600">حدّد</a></div>`;
    const pc = Math.min(100, Math.round(got / goal * 100)), C = 2 * Math.PI * 34;
    return `<a class="card tap" data-act="setGoal" style="display:flex;align-items:center;gap:16px;color:var(--tx);transition:transform .15s">
      <svg width="84" height="84" viewBox="0 0 84 84" style="flex:none;transform:rotate(-90deg)"><circle cx="42" cy="42" r="34" fill="none" stroke="var(--fill)" stroke-width="9"/><circle cx="42" cy="42" r="34" fill="none" stroke="${pc >= 100 ? 'var(--g)' : 'var(--p)'}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pc / 100)}" style="transition:stroke-dashoffset .8s"/></svg>
      <div style="flex:1;min-width:0"><div class="lbl">هدف ${MONTHS[m0]}</div><div style="font-size:22px;font-weight:800" class="num">${ar(pc)}٪</div>
      <div class="lbl">${money(got)} من ${money(goal)} د.ع</div><div class="lbl" style="color:${pc >= 100 ? 'var(--gt)' : 'var(--sec)'}">${pc >= 100 ? 'وصلت هدفك 🎉' : 'باقي ' + money(goal - got) + ' د.ع'}</div></div></a>`;
  }
  function projectsCard() {
    const live = projects().filter((p) => p.status !== 'done');
    if (!live.length) return '';
    return `<p class="hd">المشاريع الجارية</p><div class="list">${live.slice(0, 3).map(projRow).join('')}
      ${live.length > 3 ? `<button type="button" class="r blue" data-act="go" data-to="c-projects" style="justify-content:center">كل المشاريع (${ar(live.length)})</button>` : ''}</div>`;
  }

  V['c-projects'] = () => {
    const tab = S.projTab || 'live', live = projects().filter((p) => p.status !== 'done'), list = tab === 'live' ? live : projects().filter((p) => p.status === 'done');
    return { t: 'المشاريع', back: true, right: `<button type="button" class="nb ic acc" aria-label="مشروع جديد" data-act="addProject">${I.plus}</button>`, body: `
      <div class="row2"><div class="mini glass"><span class="lbl">مشاريع جارية</span><b>${ar(live.length)}</b></div><div class="mini glass"><span class="lbl">قيمتها</span><b>${money(iqdOnly(live).reduce((a, p) => a + projValue(p), 0))}</b>${usdLine(usdSum(live, projValue))}</div></div>
      <div class="seg glass">${[['live', 'الجارية'], ['done', 'المسلّمة']].map(([k, t]) => `<button type="button" data-act="set" data-o="S" data-k="projTab" data-v="${k}" class="${tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      ${list.length ? `<div class="list">${list.map(projRow).join('')}</div>` : `<div class="empty">${sq(I.doc, 'var(--p)').replace('class="sq"', 'class="sq" style="width:56px;height:56px;border-radius:16px;background:var(--p)"')}<span>${tab === 'live' ? 'سجّل مشاريعك، وتابع تقدّمها ووقت شغلك،<br>وحوّلها لفاتورة بضغطة.' : 'ما اكو مشاريع مسلّمة بعد.'}</span>${tab === 'live' ? `<button type="button" class="btn sm" style="width:auto;padding:0 22px" data-act="addProject">${I.plus} مشروع جديد</button>` : ''}</div>`}` };
  };

  V['c-projd'] = () => {
    const p = projBy(S.pid); if (!p) return V['c-projects']();
    const inv = p.inv && invBy(p.inv);
    return { t: esc(p.n), large: false, back: true, right: `<button type="button" class="nb ic" aria-label="المزيد" data-act="projMenu">${I.more}</button>`, body: `
      <div class="card" style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px">
        <span class="av lg">${esc(p.n[0])}</span><h2 style="margin-top:8px">${esc(p.n)}</h2><div class="lbl">${esc(p.c)} · ${dueText(p)}</div>
        <div class="big" style="margin-top:8px">${mny(projValue(p), p)}${curOf(p) === 'USD' ? '' : ' <span class="cur">د.ع</span>'}</div>
        <div class="lbl">${p.price ? 'سعر المشروع' : p.rate ? 'حسب الساعات · ' + mny(p.rate, p) + ' للساعة' : 'بدون سعر'}</div></div>
      <p class="hd">الحالة</p><div class="seg glass">${Object.entries(PS).map(([k, [t]]) => `<button type="button" data-act="projStatus" data-v="${k}" class="${p.status === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><span class="lbl">التقدّم</span><b class="num">${ar(p.progress || 0)}٪</b></div>
        <div class="bar" style="height:10px;margin:12px 0"><i style="width:${p.progress || 0}%;background:var(--p)"></i></div>
        <div class="row2"><button type="button" class="btn gl sm" data-act="projProg" data-d="-10">− ١٠٪</button><button type="button" class="btn gl sm" data-act="projProg" data-d="10">+ ١٠٪</button></div></div>
      <div class="card" style="display:flex;align-items:center;gap:14px">
        ${sq(I.time.replace(/width="24" height="24"/, 'width="20" height="20"'), p.run ? 'var(--g)' : 'var(--i)')}
        <div style="flex:1"><div class="lbl">وقت الشغل</div><div id="ptime" class="num" style="font-size:26px;font-weight:800;direction:ltr;text-align:right">${hms(spent(p))}</div>
        ${p.rate && !p.price ? `<div class="lbl">قيمته ${mny(projValue(p), p)}</div>` : ''}</div>
        <button type="button" class="btn sm" style="width:auto;padding:0 20px;${p.run ? 'background:var(--r)' : ''}" data-act="projTimer">${p.run ? 'وقّف' : 'ابدأ'}</button></div>
      ${inv ? `<button type="button" class="btn gl" data-act="go" data-to="c-invd" data-no="${inv.no}">${I.inv(20)} الفاتورة #${inv.no} · ${pill(inv)}</button>`
        : `<button type="button" class="btn" data-act="projInvoice">${I.inv(20)} سوّي فاتورة للمشروع</button>`}` };
  };

  V['c-tasks'] = () => {
