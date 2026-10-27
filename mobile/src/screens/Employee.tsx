// The signed-in employee, laid out like the Grdlabs Mobile design: home (today, this week, this month's pay),
// attendance calendar, salary slip and account. Clocking in reads the company's NFC sticker, then Face ID and GPS.
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  cachedStaff, cacheStaff, clock, isDenied, isOffline, loadMe, loadStaff, lockEnabled, logOut, saved, setLockEnabled,
  type Clock, type Item, type Me, type Month, type Staff,
} from '../account';
import { auth } from '../firebase';
import { biometricsReady, confirmOwner, currentPosition, LocationError, nfcSupported, readSticker } from '../device';
import { ar, dateAr, dayKey, dayTitle, dinarWords, greeting, MONTH_NAMES, num, SHORT_DAYS, stamp, tm } from '../format';
import type { Link as StickerLink } from '../links';
import { PRIVACY_URL, SUPPORT_URL } from '../config';
import {
  Btn, Card, Glass, Icon, Label, List, ListRow, Message, NavBtn, Pill, Screen, Segments, Sq, T, Toggle, Waiting, Wall, ui,
} from '../ui';
import { font, ModeContext, useTheme, type Mode } from '../theme';

type Tab = 'home' | 'attendance' | 'pay' | 'account';
type Clocking = { step: 'choose'; link: StickerLink } | { step: 'busy'; title: string } | { step: 'done'; ok: boolean; icon: string; title: string; text: string };

export function EmployeeApp({ me: initial, sticker, onStickerUsed, onSignedOut, preview }: {
  me: Me; sticker: StickerLink | null; onStickerUsed: () => void; onSignedOut: () => void; preview?: Staff;
}) {
  const [me, setMe] = useState(initial);
  const [staff, setStaff] = useState<Staff | null | 'loading' | 'error' | 'gone'>(preview ?? 'loading');
  const [tab, setTab] = useState<Tab>('home');
  const [clocking, setClocking] = useState<Clocking | null>(null);
  const [nfc, setNfc] = useState(false);
  const [offline, setOffline] = useState(false);

  // Shows the saved copy at once, then replaces it with fresh data; without internet the saved copy stays.
  const refresh = useCallback(async () => {
    if (preview) return;
    const kept = await cachedStaff(me);
    if (kept) setStaff((cur) => (typeof cur === 'string' ? kept : cur));
    try {
      const s = await loadStaff(me);
      setStaff(s); setOffline(false);
      if (s) cacheStaff(me, s);
    } catch (e) {
      if (isDenied(e)) return setStaff('gone');
      if (kept) setOffline(true); else setStaff('error');
    }
  }, [me, preview]);
  useEffect(() => { refresh(); nfcSupported().then(setNfc); }, [refresh]);

  // A sticker read by the phone outside the app (background NFC) arrives here as a link.
  useEffect(() => {
    if (!sticker) return;
    onStickerUsed();
    if (sticker.cid !== me.cid) setClocking({ step: 'done', ok: false, icon: '!', title: 'هذا الملصق لشركة ثانية', text: 'حسابك مربوط بشركة ثانية.' });
    else setClocking({ step: 'choose', link: sticker });
  }, [sticker, me.cid, onStickerUsed]);

  const scan = async () => {
    const link = await readSticker();
    if (!link) return;
    if (link.cid !== me.cid) return setClocking({ step: 'done', ok: false, icon: '!', title: 'هذا الملصق لشركة ثانية', text: 'حسابك مربوط بشركة ثانية.' });
    setClocking({ step: 'choose', link });
  };

  const record = async (link: StickerLink, kind: 'in' | 'out') => {
    const fail = (icon: string, title: string, text: string) => setClocking({ step: 'done', ok: false, icon, title, text });
    if (!(await confirmOwner(kind === 'in' ? 'تسجيل الحضور' : 'تسجيل الانصراف'))) return fail('!', 'ما تم التحقق', 'لازم Face ID أو البصمة حتى يتسجل الحضور.');
    setClocking({ step: 'busy', title: 'جاري تحديد موقعك…' });
    let pos;
    try { pos = await currentPosition(); }
    catch (e) {
      return fail('📍', 'ما كدرت أحدد موقعك', e instanceof LocationError && e.message === 'off'
        ? 'شغّل خدمة الموقع (GPS) من إعدادات التلفون وجرب مرة ثانية.' : 'اسمح لـ Grdlabs يوصل للموقع من إعدادات التلفون، وجرب مرة ثانية.');
    }
    setClocking({ step: 'busy', title: kind === 'in' ? 'جاري تسجيل الحضور…' : 'جاري تسجيل الانصراف…' });
    try {
      const r = await clock(me, link.token, kind, pos);
      if (!r.ok && r.reason === 'far') return fail('📍', 'أنت بعيد عن الشركة', `المسافة ${num(r.dist!)} متر، والمسموح ${num(r.radius!)} متر. قرّب من الشركة وجرب مرة ثانية.`);
      if (!r.ok) return fail('!', 'الملصق قديم', 'رابط الملصق تغيّر. خبر مديرك حتى يحدّث الملصق.');
      setMe((await loadMe()) || me);
      setClocking({ step: 'done', ok: true, icon: '✓', title: kind === 'in' ? 'تم تسجيل الحضور' : 'تم تسجيل الانصراف', text: 'الساعة ' + tm(r.at) + ' · على بعد ' + num(r.dist) + ' متر من الشركة.' });
    } catch (e) {
      if (isDenied(e)) return setStaff('gone');
      fail('!', 'ما تسجّل', isOffline(e) ? 'تأكد من الإنترنت وجرب مرة ثانية.' : 'صار خطأ. جرب مرة ثانية.');
    }
  };

  const signOut = async () => { await logOut(); onSignedOut(); };

  if (staff === 'gone') return (
    <Message icon="📱" tone="o" title="حسابك موقوف بهذي الشركة" text="مديرك فك ربط حسابك. اطلب منه رمز ربط جديد، وتكدر تستخدم نفس الإيميل.">
      <Btn title="تسجيل الخروج" kind="glass" onPress={signOut} />
    </Message>
  );
  if (clocking?.step === 'busy') return <Waiting title={clocking.title} />;
  if (clocking?.step === 'done') return (
    <Message icon={clocking.icon} tone={clocking.ok ? 'g' : 'r'} title={clocking.title} text={clocking.text}>
      <Btn title={clocking.ok ? 'عرض حضوري' : 'تمام'} kind={clocking.ok ? 'primary' : 'glass'} onPress={() => { setClocking(null); if (clocking.ok) { setTab('attendance'); refresh(); } }} />
    </Message>
  );
  if (clocking?.step === 'choose') return <ChooseClock me={me} onPick={(k) => record(clocking.link, k)} onCancel={() => setClocking(null)} />;
  if (staff === 'loading') return <Waiting title="جاري التحميل…" />;
  if (staff === 'error') return <Message icon="!" tone="r" title="تعذّر التحميل" text="تأكد من الإنترنت."><Btn title="إعادة المحاولة" onPress={() => { setStaff('loading'); refresh(); }} /></Message>;
  if (staff === null) return (
    <Message icon="⏳" tone="o" title="تم التسجيل" text="بياناتك تظهر هنا بعد ما يحدّث برنامج الشركة، عادةً خلال دقائق.">
      <Btn title="تحديث" onPress={() => { setStaff('loading'); refresh(); }} />
    </Message>
  );

  const props = { s: staff, me, refresh, go: setTab, offline };
  return (
    <Wall>
      {tab === 'home' && <HomeTab {...props} nfc={nfc} onClock={scan} />}
      {tab === 'attendance' && <AttendanceTab {...props} />}
      {tab === 'pay' && <PayTab {...props} />}
      {tab === 'account' && <AccountTab {...props} onSignOut={signOut} />}
      <TabBar tab={tab} onTab={setTab} />
    </Wall>
  );
}

type TabProps = { s: Staff; me: Me; refresh: () => void; go: (t: Tab) => void; offline: boolean };
type Day = { in?: string; out?: string };

function days(s: Staff, me: Me): Map<string, Day> {
  const all: Clock[] = [...(s.attendance || [])];
  for (const x of me.recent || []) if (!all.some((y) => y.kind === x.kind && Math.abs(Date.parse(y.at) - Date.parse(x.at)) < 180000)) all.push(x);
  const map = new Map<string, Day>();
  for (const x of all.sort((a, b) => a.at.localeCompare(b.at))) {
    const k = dayKey(x.at), d = map.get(k) || {};
    if (x.kind === 'in' && !d.in) d.in = x.at;
    if (x.kind === 'out') d.out = x.at;
    map.set(k, d);
  }
  return map;
}
const hours = (d: Day) => d.in && d.out ? Math.max(0, Math.round((Date.parse(d.out) - Date.parse(d.in)) / 36e5)) : 0;

function Updated({ s, offline }: { s: Staff; offline: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      {offline ? <Pill tone="o" label="ما اكو إنترنت · هذي آخر بيانات محفوظة" /> : null}
      <T sec size={13} center>{'آخر تحديث من الشركة: ' + (s.updated ? stamp(s.updated.toDate()) : '—')}</T>
    </View>
  );
}

// ---------- الرئيسية ----------
function HomeTab({ s, me, refresh, go, nfc, onClock, offline }: TabProps & { nfc: boolean; onClock: () => void }) {
  const t = useTheme();
  const map = days(s, me);
  const today = map.get(dayKey(new Date())) || {};
  const [m] = s.months || [];
  const first = (s.name || me.name || '').split(' ')[0];
  const status = !today.in ? <Pill tone="o" label="ما سجلت بعد" /> : !today.out ? <Pill tone="g" label="داخل الدوام" /> : <Pill tone="b" label="خلص الدوام" />;
  const week = useMemo(() => {
    const start = new Date(); start.setHours(12, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 1) % 7));
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, []);
  return (
    <Screen title={greeting() + '، ' + first} subtitle={dateAr(new Date())} onRefresh={refresh}>
      <Card>
        <View style={st.between}>
          <View style={{ gap: 2 }}>
            <T sec size={13}>دوام اليوم</T>
            <T size={22} weight="700" num>{today.in ? tm(today.in) + ' – ' + (today.out ? tm(today.out) : '…') : '—'}</T>
          </View>
          {status}
        </View>
        {nfc ? (
          <Btn title={today.in && !today.out ? 'سجّل انصراف' : 'سجّل حضور'} onPress={onClock} icon={(c) => <Icon.face color={c} size={22} />} testID="button-clock" />
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <View style={[st.dot, { backgroundColor: nfc ? t.g : t.o, shadowColor: nfc ? t.g : t.o }]} />
          <T sec size={13}>{nfc ? 'قرّب التلفون من ستيكر NFC بمدخل الشركة' : Platform.OS === 'web' ? 'تسجيل الحضور يشتغل من التطبيق على التلفون' : 'تلفونك ما بيه NFC · سجّل من تلفون بيه NFC'}</T>
        </View>
      </Card>

      <Card>
        <T sec size={13}>هذا الأسبوع</T>
        <View style={st.week}>
          {week.map((d) => {
            const k = dayKey(d), isToday = k === dayKey(new Date()), day = map.get(k), future = d > new Date();
            const bg = day?.in ? t.g : isToday || future ? 'transparent' : t.fill;
            return (
              <View key={k} style={{ alignItems: 'center', gap: 6 }}>
                <View style={[st.wd, { backgroundColor: bg }, isToday && !day?.in && { borderWidth: 2, borderStyle: 'dashed', borderColor: t.acc }]}>
                  {day?.in ? <Icon.check size={14} color="#fff" /> : null}
                </View>
                <T sec size={11}>{SHORT_DAYS[d.getDay()]}</T>
              </View>
            );
          })}
        </View>
      </Card>

      {m ? (
        <Pressable onPress={() => { ui.tap(); go('pay'); }}>
          <Card>
            <T sec size={13}>راتب هذا الشهر</T>
            <View style={st.between}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={[font('800'), st.big, { color: t.tx }]}>{num(m.net)}</Text>
                <T sec size={15} weight="500">د.ع</T>
              </View>
              <Icon.chev color={t.ter} />
            </View>
            <T sec size={13}>{m.paid ? 'انصرف ' + (m.paidOn ? ar(Number(m.paidOn.slice(8, 10))) + ' ' + MONTH_NAMES[Number(m.paidOn.slice(5, 7)) - 1] : '') : 'يُصرف آخر الشهر'}</T>
          </Card>
        </Pressable>
      ) : null}
      <Updated s={s} offline={offline} />
    </Screen>
  );
}

// ---------- الحضور ----------
function AttendanceTab({ s, me, refresh, offline }: TabProps) {
  const t = useTheme();
  const map = days(s, me);
  const thisMonth = () => { const d = new Date(); d.setDate(1); d.setHours(12, 0, 0, 0); return d; };
  const [cursor, setCursor] = useState(thisMonth);
  const y = cursor.getFullYear(), mo = cursor.getMonth();
  const count = new Date(y, mo + 1, 0).getDate();
  const lead = (new Date(y, mo, 1, 12).getDay() + 1) % 7; // weeks start on Saturday
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const key = (d: number) => `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const todayKey = dayKey(new Date());
  const inMonth = Array.from({ length: count }, (_, i) => map.get(key(i + 1))).filter((d): d is Day => !!d?.in);
  const recent = [...map].filter(([, d]) => d.in).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10);
  const move = (n: number) => setCursor(new Date(y, mo + n, 1, 12));
  const nav = <NavBtn onPress={() => setCursor(thisMonth())}><T weight="500">{MONTH_NAMES[mo]}</T></NavBtn>;
  return (
    <Screen title="الحضور" nav={nav} onRefresh={refresh}>
      <Card style={{ paddingHorizontal: 12 }}>
        <View style={[st.between, { paddingHorizontal: 8 }]}>
          <Pressable hitSlop={10} onPress={() => move(-1)}><Icon.prev color={t.acc} size={18} /></Pressable>
          <T weight="600">{MONTH_NAMES[mo] + ' ' + ar(y)}</T>
          <Pressable hitSlop={10} onPress={() => move(1)}><Icon.next color={t.acc} size={18} /></Pressable>
        </View>
        <View style={st.cal}>
          {['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'].map((w) => <View key={w} style={st.cell7}><T sec size={11} weight="600" center>{w}</T></View>)}
          {cells.map((d, i) => {
            if (!d) return <View key={'e' + i} style={st.cell7} />;
            const k = key(d), isToday = k === todayKey, day = map.get(k), friday = new Date(y, mo, d).getDay() === 5, future = k > todayKey;
            return (
              <View key={k} style={[st.cell7, { height: 40, justifyContent: 'center' }]}>
                {isToday
                  ? <View style={[st.todayDot, { backgroundColor: t.acc }]}><Text style={[font('700'), { color: '#fff', fontSize: 16 }]}>{d}</Text></View>
                  : <T size={16} num center color={friday || future ? t.ter : undefined}>{d}</T>}
                {day?.in && !isToday ? <View style={[st.calDot, { backgroundColor: t.g }]} /> : null}
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
          <View style={[st.legendDot, { backgroundColor: t.g }]} /><T sec size={12}>حاضر</T>
        </View>
      </Card>

      <Glass style={{ borderRadius: 26 }}>
        <View style={st.stats}>
          <View style={st.statCol}><T size={24} weight="700" num>{inMonth.length}</T><T sec size={13}>يوم حضور</T></View>
          <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: t.sep }} />
          <View style={st.statCol}>
            <T size={24} weight="700" num>{inMonth.reduce((n, d) => n + hours(d), 0)}</T><T sec size={13}>ساعة عمل</T>
          </View>
        </View>
      </Glass>

      {recent.length ? (
        <>
          <Label>آخر الأيام</Label>
          <List>
            {recent.map(([k, d]) => (
              <ListRow key={k} title={dayTitle(k)} sub={tm(d.in!) + ' ← ' + (d.out ? tm(d.out) : '—')} value={hours(d) ? ar(hours(d)) + ' ساعات' : 'داخل الدوام'} />
            ))}
          </List>
        </>
      ) : <Card><T sec center>ما اكو بصمات بعد. سجّل حضورك من ستيكر الشركة.</T></Card>}
      <Updated s={s} offline={offline} />
    </Screen>
  );
}

// ---------- الراتب ----------
const KIND: Record<Item['kind'], { label: string; sign: string }> = {
  bonus: { label: 'مكافأة', sign: '+' }, advance: { label: 'سلفة', sign: '–' }, deduction: { label: 'خصم', sign: '–' },
};

function PayTab({ s, refresh, offline }: TabProps) {
  const t = useTheme();
  const months = s.months || [];
  const [i, setI] = useState(0);
  const m: Month | undefined = months[i];
  if (!m) return <Screen title="الراتب" onRefresh={refresh}><Card><T sec center>ما اكو رواتب بعد.</T></Card></Screen>;
  const [py, pm] = m.period.split('-').map(Number);
  const color = (k: Item['kind']) => (k === 'bonus' ? t.g : k === 'advance' ? t.o : t.r);
  const text = (k: Item['kind']) => (k === 'bonus' ? t.gt : k === 'advance' ? t.o : t.r);
  const iconOf = (k: Item['kind']) => (k === 'bonus' ? <Icon.gift /> : k === 'advance' ? <Icon.wallet /> : <Icon.minus />);
  const when = (date?: string) => (date ? ar(Number(date.slice(8, 10))) + ' ' + MONTH_NAMES[Number(date.slice(5, 7)) - 1] : undefined);
  return (
    <Screen title="الراتب" onRefresh={refresh}>
      <Glass level={2} style={st.monthBar}>
        <Pressable hitSlop={10} disabled={i >= months.length - 1} onPress={() => setI(i + 1)} style={{ opacity: i >= months.length - 1 ? 0.3 : 1 }}><Icon.prev color={t.tx} size={18} /></Pressable>
        <T weight="600">{MONTH_NAMES[pm - 1] + ' ' + ar(py)}</T>
        <Pressable hitSlop={10} disabled={i === 0} onPress={() => setI(i - 1)} style={{ opacity: i === 0 ? 0.3 : 1 }}><Icon.next color={t.tx} size={18} /></Pressable>
      </Glass>

      <Card style={{ alignItems: 'center', gap: 2, paddingVertical: 24 }}>
        <T sec size={13}>الصافي</T>
        <Text style={[font('800'), { color: t.tx, fontSize: 44, lineHeight: 58, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }]}>{num(m.net)}</Text>
        <T sec size={13}>{'دينار · ' + (m.paid ? 'انصرف ' + (when(m.paidOn) ?? '') : 'يُصرف آخر الشهر')}</T>
        <T sec size={13} center style={{ marginTop: 6 }}>{dinarWords(m.net)}</T>
      </Card>

      <List indent>
        <ListRow icon={<Sq color={t.acc}><Icon.cash /></Sq>} title="الراتب الأساسي" value={num(m.salary)} bold valueColor={t.tx} />
        {m.items.map((it, n) => (
          <ListRow key={n} icon={<Sq color={color(it.kind)}>{iconOf(it.kind)}</Sq>} title={KIND[it.kind].label}
            sub={[it.reason, when(it.date)].filter(Boolean).join(' · ') || undefined}
            value={KIND[it.kind].sign + ' ' + num(it.amount)} valueColor={text(it.kind)} bold />
        ))}
      </List>
      <Updated s={s} offline={offline} />
    </Screen>
  );
}

// ---------- حسابي ----------
function AccountTab({ s, me, onSignOut }: TabProps & { onSignOut: () => void }) {
  const t = useTheme();
  const { mode, setMode } = useContext(ModeContext);
  const [bio, setBio] = useState(false);
  const [lock, setLock] = useState(true);
  useEffect(() => { biometricsReady().then(setBio); lockEnabled().then(setLock); }, []);
  const toggle = async (on: boolean) => {
    if (!(await confirmOwner(on ? 'تفعيل الدخول بـ Face ID' : 'إيقاف الدخول بـ Face ID'))) return;
    await setLockEnabled(on); setLock(on);
  };
  const name = s.name || me.name;
  return (
    <Screen title="حسابي">
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={[st.avatar, { borderColor: t.stroke, backgroundColor: t.acc + '33' }]}><Text style={[font('700'), { color: t.acc, fontSize: 26 }]}>{name.slice(0, 1)}</Text></View>
        <View style={{ flex: 1, gap: 1 }}>
          <T size={20} weight="700">{name}</T>
          <T sec size={13}>{[s.jobTitle, s.company].filter(Boolean).join(' · ')}</T>
          {saved() ? <T sec size={13}>{auth.currentUser?.email ?? ''}</T> : null}
        </View>
      </Card>

      <Label>المظهر</Label>
      <Segments<Mode> items={[['light', 'فاتح'], ['dark', 'داكن'], ['auto', 'تلقائي']]} value={mode} onChange={setMode} />

      <Label>الأمان والمساعدة</Label>
      <List indent>
        {bio ? <ListRow icon={<Sq color={t.g}><Icon.face /></Sq>} title="الدخول بـ Face ID" right={<Toggle value={lock} onChange={toggle} />} /> : null}
        <ListRow icon={<Sq color={t.p}><Icon.info /></Sq>} title="الدعم" chevron onPress={() => Linking.openURL(SUPPORT_URL)} />
        <ListRow icon={<Sq color={t.grey}><Icon.lock /></Sq>} title="سياسة الخصوصية" chevron onPress={() => Linking.openURL(PRIVACY_URL)} />
      </List>

      <List>
        <ListRow icon={<Sq color={t.t}><Icon.info /></Sq>} title="حول Grdlabs" value="1.0" />
      </List>

      <List>
        <ListRow title="تسجيل الخروج" red onPress={onSignOut} testID="button-logout" />
      </List>
    </Screen>
  );
}

function ChooseClock({ me, onPick, onCancel }: { me: Me; onPick: (k: 'in' | 'out') => void; onCancel: () => void }) {
  const t = useTheme();
  const today = (me.recent || []).filter((x) => dayKey(x.at) === dayKey(new Date())).pop();
  const suggest = today?.kind === 'in' ? 'out' : 'in';
  return (
    <Message icon={<Icon.face color={t.acc} size={64} />} title={'أهلاً ' + (me.name || '').split(' ')[0]} text="اختار شنو تريد تسجل. راح يطلب منك Face ID، وبعدها يتأكد من موقعك.">
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Btn title="حضور" kind={suggest === 'in' ? 'primary' : 'glass'} onPress={() => onPick('in')} testID="button-clock-in" /></View>
        <View style={{ flex: 1 }}><Btn title="انصراف" kind={suggest === 'out' ? 'primary' : 'glass'} onPress={() => onPick('out')} testID="button-clock-out" /></View>
      </View>
      <Btn title="إلغاء" kind="glass" onPress={onCancel} />
    </Message>
  );
}

// ---------- floating tab bar (iOS 26) ----------
const TABS: [Tab, string, 'home' | 'time' | 'cash' | 'me'][] = [['home', 'الرئيسية', 'home'], ['attendance', 'الحضور', 'time'], ['pay', 'الراتب', 'cash'], ['account', 'حسابي', 'me']];

function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const t = useTheme();
  const inset = useSafeAreaInsets();
  return (
    <Glass level={2} style={[st.tabs, { bottom: inset.bottom + 10 }]}>
      {TABS.map(([id, label, icon]) => {
        const on = id === tab, c = on ? t.acc : t.tx, I = Icon[icon];
        return (
          <Pressable key={id} testID={'tab-' + id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { ui.tap(); onTab(id); }}
            style={[st.tab, on && { backgroundColor: t.fill }]}>
            <I color={c} size={24} />
            <Text style={[font('600'), { color: c, fontSize: 10 }]}>{label}</Text>
          </Pressable>
        );
      })}
    </Glass>
  );
}

const st = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  big: { fontSize: 36, lineHeight: 46, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  dot: { width: 7, height: 7, borderRadius: 4, shadowOpacity: 0.4, shadowRadius: 3 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  wd: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cal: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 },
  cell7: { width: `${100 / 7}%`, alignItems: 'center' },
  todayDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  calDot: { position: 'absolute', bottom: 3, width: 5, height: 5, borderRadius: 3 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  stats: { flexDirection: 'row', paddingVertical: 16 },
  statCol: { flex: 1, alignItems: 'center', gap: 2 },
  monthBar: { height: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
  tabs: { position: 'absolute', left: 16, right: 16, height: 64, borderRadius: 32, flexDirection: 'row', padding: 4 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 28 },
});
