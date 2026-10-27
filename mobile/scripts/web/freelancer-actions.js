    // projects
    addProject: () => {
      S.pjCur = 'IQD';
      const cs = B().customers.map((c) => `<option>${esc(c.n)}</option>`).join('');
      openSheet(`${sheetHead('مشروع جديد', 'projSave')}
      <div class="fld"><label for="pjN">اسم المشروع</label><input id="pjN" placeholder="مثلاً: هوية بصرية لمتجر لمسة"></div>
      <div class="fld"><label for="pjC">${cl()}</label>${cs ? `<select id="pjC" style="height:52px;border-radius:26px;border:.5px solid var(--stroke);background:var(--glass);padding:0 18px;font-size:16px">${cs}</select>` : '<input id="pjC" placeholder="اسم العميل">'}</div>
      <div class="row2"><div class="fld"><label for="pjP">سعر المشروع</label><input id="pjP" inputmode="decimal" dir="ltr" placeholder="0" data-num></div><div class="fld"><label for="pjR">أو سعر الساعة</label><input id="pjR" inputmode="decimal" dir="ltr" placeholder="اختياري" data-num></div></div>
      <div class="seg" id="pjCur">${[['IQD', 'دينار عراقي'], ['USD', 'دولار أمريكي $']].map(([k, n]) => `<button type="button" data-act="pjCur" data-v="${k}" class="${k === 'IQD' ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="fld"><label for="pjD">موعد التسليم</label><input id="pjD" type="date"></div>
      <div class="list"><div class="r ind">${sq(I.bellS(), 'var(--o)')}<span class="t"><span>ذكّرني قبل التسليم بيوم</span></span><button type="button" class="sw on" id="pjRem" role="switch" aria-checked="true" data-act="tkRemind"></button></div></div>
      <button type="button" class="btn" data-act="projSave">أضف المشروع</button>`);
    },
    pjCur: (el) => { S.pjCur = el.dataset.v; for (const b of $('#pjCur').children) b.classList.toggle('on', b === el); haptic(); },
    projSave: () => {
      const n = $('#pjN').value.trim(), c = $('#pjC').value.trim();
      if (!n) return ok('اكتب اسم المشروع'); if (!c) return ok('اكتب اسم ' + cl());
      if (!B().customers.some((x) => x.n === c)) B().customers.push({ n: c, ph: '' });
      const p = { id: Date.now(), n, c, price: digits($('#pjP').value), rate: digits($('#pjR').value), cur: S.pjCur || 'IQD', due: $('#pjD').value || '', status: 'work', progress: 0, secs: 0, run: null, inv: 0 };
      projects().unshift(p);
      if (p.due && $('#pjRem').classList.contains('on')) {
        const d = new Date(p.due + 'T10:00:00'); d.setDate(d.getDate() - 1);
        tasks().push({ id: p.id + 1, t: 'تسليم مشروع ' + n + ' باچر', kind: 'once', date: dayKeyOf(d), time: '10:00', remind: true, done: {} });
      }
      syncTasks(); closeAll(); hud('انضاف المشروع'); S.pid = p.id; go('c-projd');
    },
    projStatus: (el) => { const p = projBy(S.pid); p.status = el.dataset.v; if (p.status === 'done') { p.progress = 100; if (p.run) { p.secs = spent(p); p.run = null; } } save(); haptic(); render(); },
    projProg: (el) => { const p = projBy(S.pid); p.progress = Math.max(0, Math.min(100, (p.progress || 0) + Number(el.dataset.d))); if (p.progress === 100 && p.status === 'work') p.status = 'review'; save(); haptic(); render(); },
    projTimer: () => { const p = projBy(S.pid); if (p.run) { p.secs = spent(p); p.run = null; hud('توقف المؤقت'); } else { p.run = Date.now(); if (p.status === 'done') p.status = 'work'; } save(); render(); },
    projInvoice: () => {
      const p = projBy(S.pid), v = projValue(p);
      if (!v) return ok('حدّد سعر المشروع', 'اكتب سعر المشروع أو سعر الساعة وشغّل المؤقت حتى نحسب المبلغ.');
      const hrs = spent(p) / 3600;
      draft = { no: nextNo('inv'), c: p.c, cur: p.cur, pay: 'تحويل', due: String(B().print.dueDays), disc: 0, paid: 0, note: '', proj: p.id,
        items: [p.price ? { n: p.n, p: p.price, q: 1 } : { n: p.n + ' (ساعات عمل)', p: p.rate, q: Math.max(1, Math.round(hrs * 10) / 10) }] };
      go('c-new');
    },
    projMenu: () => { const p = projBy(S.pid); openMenu([{ t: 'احذف المشروع', i: I.trash, cls: 'des', f: () => { B().projects = projects().filter((x) => x !== p); save(); go('c-projects', false); hud('انحذف'); } }], esc(p.n)); },
    setGoal: () => openSheet(`${sheetHead('هدف الشهر', 'goalSave')}<p class="lbl" style="text-align:center">كم تريد تحصّل من فواتيرك هذا الشهر؟</p><input id="goalIn" class="amt" inputmode="numeric" dir="ltr" placeholder="0" data-num value="${B().goal ? money(B().goal) : ''}"><div class="lbl" style="text-align:center">دينار عراقي</div>
      <div class="chips" style="justify-content:center">${[1000000, 2000000, 3000000, 5000000].map((v) => `<button type="button" class="chip" data-act="goalAmt" data-v="${v}">${money(v)}</button>`).join('')}</div><button type="button" class="btn" data-act="goalSave">احفظ الهدف</button>`),
    goalAmt: (el) => { $('#goalIn').value = money(el.dataset.v); haptic(); },
    goalSave: () => { B().goal = digits($('#goalIn').value); save(); closeAll(); hud(B().goal ? 'انحفظ الهدف' : 'انشال الهدف'); render(); },
