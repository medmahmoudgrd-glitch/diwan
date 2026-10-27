// Signing in, scanning the company's pairing QR, and registering once with the code.
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, Pressable } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  authError, checkFields, isDenied, isOffline, otpCall, otpService, OTP_ERR, pair, readPair, resetPassword, saved, setLockEnabled, signIn,
  type Me, type Pair,
} from '../account';
import { auth } from '../firebase';
import { biometricsReady, confirmOwner } from '../device';
import { parseLink, type Link as PairLink } from '../links';
import { AppLogo, Btn, Card, Field, H, Icon, Link, Message, Screen, Segments, T, Waiting, Wall, type InputRef } from '../ui';
import { useTheme } from '../theme';

function useAccountFields() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const passRef = useRef<InputRef>(null);
  const read = () => {
    const e = email.trim().toLowerCase();
    const bad = checkFields(e, pass);
    setErr(bad || '');
    return bad ? null : { email: e, pass };
  };
  const render = (mode: 'login' | 'new', submit: () => void) => (
    <View style={{ gap: 12 }}>
      <Field label="الإيميل" ltr value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none"
        autoComplete="email" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => passRef.current?.focus()} testID="input-email" />
      <Field ref={passRef} ltr label={mode === 'login' ? 'كلمة المرور' : 'اختار كلمة مرور (6 أحرف أو أكثر)'} value={pass} onChangeText={setPass} placeholder="••••••"
        secureTextEntry autoCapitalize="none" textContentType={mode === 'login' ? 'password' : 'newPassword'} returnKeyType="go" onSubmitEditing={submit} testID="input-password" />
      {err ? <ErrorText text={err} /> : null}
    </View>
  );
  return { email, read, err, setErr, render };
}

function ErrorText({ text }: { text: string }) {
  const t = useTheme();
  return <T style={{ color: t.r }} size={14}>{text}</T>;
}

export function Welcome({ onSignedIn, onLink }: { onSignedIn: (me: Me | null) => void; onLink: (l: PairLink) => void }) {
  const t = useTheme();
  const f = useAccountFields();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [scan, setScan] = useState(false);
  const [paste, setPaste] = useState<string | null>(null);

  const login = async () => {
    const v = f.read(); if (!v) return;
    setBusy(true);
    try { onSignedIn(await signIn(v.email, v.pass)); }
    catch (e) { f.setErr(authError(e)); setBusy(false); }
  };
  const forgot = async () => {
    const e = f.email.trim().toLowerCase();
    if (!e) return f.setErr('اكتب إيميلك أول، وبعدين اضغط نسيت كلمة المرور.');
    try { await resetPassword(e); f.setErr(''); setNote('إذا الإيميل مسجل، راح يوصلك رابط لتغيير كلمة المرور.'); }
    catch (x) { f.setErr(authError(x)); }
  };
  const usePaste = () => {
    const l = parseLink(paste);
    if (l?.kind === 'pair') onLink(l);
    else f.setErr('هذا مو رابط ربط صحيح. انسخ الرابط كامل من برنامج الشركة.');
  };

  if (scan) return <Scanner onClose={() => setScan(false)} onLink={(l) => { setScan(false); onLink(l); }} />;
  return (
    <Wall>
      <Screen bare tabs={false}>
        <View style={{ alignItems: 'center', gap: 6, marginTop: 40, marginBottom: 14 }}>
          <AppLogo />
          <T size={30} weight="800" center style={{ marginTop: 14 }}>أهلاً بيك</T>
          <T sec center>ادخل لحسابك بـ Grdlabs</T>
        </View>
        {f.render('login', login)}
        <View style={{ alignItems: 'flex-start', marginTop: -6 }}><Link title="نسيت كلمة المرور؟" onPress={forgot} size={14} /></View>
        {note ? <T size={14} color={t.gt}>{note}</T> : null}
        <Btn title="دخول" onPress={login} busy={busy} testID="button-login" />

        <View style={{ flex: 1, minHeight: 40 }} />
        {paste !== null ? (
          <View style={{ gap: 10 }}>
            <Field label="رابط الربط من برنامج الشركة" ltr value={paste} onChangeText={setPaste} placeholder="https://grdlabs.site/app/#p=…" autoCapitalize="none" autoCorrect={false} testID="input-link" />
            <Btn title="كمّل بالرابط" kind="glass" small onPress={usePaste} disabled={!paste.trim()} />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
          <T sec size={14}>ما عندك حساب؟ </T>
          {Platform.OS !== 'web'
            ? <Link title="سجّل برمز الشركة" onPress={() => setScan(true)} size={14} />
            : null}
          <T sec size={14}>{Platform.OS !== 'web' ? ' أو ' : ''}</T>
          <Link title="الصق رابط الربط" onPress={() => setPaste(paste === null ? '' : null)} size={14} />
        </View>
      </Screen>
    </Wall>
  );
}

/** Shown once after the first sign-in: turn on Face ID for opening the app and clocking in. */
export function FaceIdIntro({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const yes = async () => {
    if (await confirmOwner('فعّل Face ID')) await setLockEnabled(true);
    onDone();
  };
  const no = async () => { await setLockEnabled(false); onDone(); };
  return (
    <Wall>
      <Screen bare tabs={false}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, paddingVertical: 40 }}>
          <View style={[st.face, { backgroundColor: t.glass3, borderColor: t.stroke }]}><Icon.face color={t.acc} size={64} /></View>
          <T size={28} weight="800" center style={{ marginTop: 14 }}>ادخل بنظرة وحدة</T>
          <T sec center>فعّل Face ID حتى تفتح التطبيق وتسجل حضورك بدون كلمة مرور</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon.lock color={t.sec} size={13} />
            <T sec size={13}>صورة وجهك تبقى بموبايلك وما تنرسل لأحد</T>
          </View>
        </View>
        <Btn title="فعّل Face ID" onPress={yes} testID="button-face-on" />
        <Link title="مو هسه" onPress={no} />
      </Screen>
    </Wall>
  );
}

export function Scanner({ onClose, onLink }: { onClose: () => void; onLink: (l: PairLink) => void }) {
  const [perm, ask] = useCameraPermissions();
  const inset = useSafeAreaInsets();
  const done = useRef(false);
  useEffect(() => { if (perm && !perm.granted && perm.canAskAgain) ask(); }, [perm, ask]);
  if (perm && !perm.granted && !perm.canAskAgain)
    return <Message icon="📷" tone="o" title="الكاميرا مقفولة" text="اسمح لـ Grdlabs يستخدم الكاميرا من إعدادات التلفون، أو الصق رابط الربط."><Btn title="رجوع" kind="glass" onPress={onClose} /></Message>;
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          const l = parseLink(data);
          if (l?.kind === 'pair' && !done.current) { done.current = true; onLink(l); }
        }}
      />
      <View style={[st.frame]} pointerEvents="none" />
      <View style={{ position: 'absolute', top: inset.top + 20, left: 20, right: 20 }}>
        <Text style={st.scanTx}>وجّه الكاميرا على رمز الربط اللي يطلع ببرنامج الشركة</Text>
      </View>
      <Pressable onPress={onClose} style={[st.close, { bottom: inset.bottom + 30 }]}><Text style={st.closeTx}>إلغاء</Text></Pressable>
    </View>
  );
}

/** Registration with the one-time pairing code: new account, existing account, or the account already signed in. */
export function PairFlow({ link, onDone, onCancel }: { link: PairLink; onDone: (me: Me) => void; onCancel: () => void }) {
  const [p, setP] = useState<Pair | null | 'loading' | 'error'>('loading');
  const [mode, setMode] = useState<'new' | 'login'>('new');
  const [bio, setBio] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [otp, setOtp] = useState<string | null>(null);
  const verified = useRef(new Set<string>());
  const fNew = useAccountFields(), fLogin = useAccountFields();
  const f = mode === 'new' ? fNew : fLogin;
  const keep = saved();

  useEffect(() => {
    readPair(link.cid, link.token).then(setP, (e) => setP(isOffline(e) ? 'error' : null));
    biometricsReady().then(setBio);
  }, [link]);

  const go = async () => {
    if (p === null || typeof p === 'string') return;
    const v = keep ? { email: '', pass: '' } : f.read();
    if (!v) return;
    if (!keep && mode === 'new' && (await otpService()) && !verified.current.has(v.email)) return setOtp(v.email);
    if (bio && !(await confirmOwner('أكد إنك صاحب التلفون'))) return;
    setBusy(true); setErr('');
    try { onDone(await pair(link.cid, link.token, p, keep ? 'keep' : mode, v.email, v.pass)); }
    catch (e) {
      setBusy(false);
      if (/^auth\//.test(String((e as { code?: string }).code))) return f.setErr(authError(e));
      setErr(isDenied(e) ? 'الرمز استُخدم أو انتهى، أو حسابك مربوط من قبل. جرب تدخل بحسابك، أو اطلب من مديرك رمز جديد.'
        : isOffline(e) ? 'تأكد من الإنترنت وجرب مرة ثانية.' : 'صار خطأ. جرب مرة ثانية.');
    }
  };

  if (p === 'loading') return <Waiting title="جاري التحقق من الرمز…" />;
  if (p === 'error') return <Message icon="!" tone="r" title="تعذّر التحقق" text="تأكد من الإنترنت وجرب مرة ثانية."><Btn title="رجوع" kind="glass" onPress={onCancel} /></Message>;
  if (p === null) return (
    <Message icon="!" tone="r" title="الرمز منتهي أو مستخدم" text="إذا سجلت من قبل، ادخل بإيميلك وكلمة السر. وإلا اطلب من مديرك رمز ربط جديد.">
      <Btn title="تسجيل الدخول" onPress={onCancel} />
    </Message>
  );
  if (otp) return <EmailCode email={otp} onBack={() => setOtp(null)} onVerified={() => { verified.current.add(otp); setOtp(null); }} />;
  return (
    <Wall>
      <Screen>
        <View style={{ height: 30 }} />
        <T size={30} weight="800">{'أهلاً ' + p.name}</T>
        <T sec>تسجل مرة وحدة بس. بعدها تدخل بإيميلك وكلمة السر من أي تلفون، وتشوف راتبك وسلفك وخصوماتك وتسجل حضورك.</T>
        <Card>
          {keep
            ? <T>راح ينربط حسابك <T weight="700">{auth.currentUser?.email ?? ''}</T> بهذي الشركة.</T>
            : <>
                <Segments items={[['new', 'حساب جديد'], ['login', 'عندي حساب']]} value={mode} onChange={setMode} />
                {f.render(mode, go)}
              </>}
          {bio ? <T sec size={14}>راح يطلب منك Face ID أو البصمة حتى يتأكد إنك صاحب التلفون.</T> : null}
          {err ? <ErrorText text={err} /> : null}
          <Btn title={bio ? 'سجّل وفعّل Face ID' : 'سجّل'} onPress={go} busy={busy} testID="button-pair" />
          <Link title="إلغاء" onPress={onCancel} />
        </Card>
      </Screen>
    </Wall>
  );
}

/** Six-digit email code from the company's mail service, asked once before a new account is created. */
function EmailCode({ email, onVerified, onBack }: { email: string; onVerified: () => void; onBack: () => void }) {
  const [code, setCode] = useState('');
  const [info, setInfo] = useState('جاري إرسال الكود…');
  const [err, setErr] = useState('');
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!wait) return; const id = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(id); }, [wait]);
  const send = async () => {
    setErr('');
    try {
      const r = await otpCall({ action: 'send', email, purpose: 'signup' });
      if (r.ok) { setInfo('دزينا كود من 6 أرقام إلى ' + email + '. إذا ما لگيته، شوف مجلد السبام.'); setWait(r.resendIn || 60); return; }
      if (r.error === 'rate_limited') { setInfo('دزينا كود قبل شوية إلى ' + email + '.'); setWait(Math.min(r.retryIn || 60, 3600)); return; }
      setErr(OTP_ERR[r.error || ''] || 'ما گدرنا ندز الكود. جرب مرة ثانية.');
    } catch { setErr('تأكد من الإنترنت وجرب مرة ثانية.'); }
  };
  useEffect(() => { send(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const check = async (value = code) => {
    if (value.length !== 6) return setErr('الكود 6 أرقام.');
    setBusy(true); setErr('');
    try {
      const r = await otpCall({ action: 'verify', email, code: value });
      if (r.ok) return onVerified();
      setErr((OTP_ERR[r.error || ''] || 'صار خطأ. جرب مرة ثانية.') + (r.error === 'wrong' && r.left ? ' باقي ' + r.left + ' محاولات.' : ''));
    } catch { setErr('تأكد من الإنترنت وجرب مرة ثانية.'); }
    setBusy(false);
  };
  return (
    <Wall>
      <Screen>
        <View style={{ height: 50 }} />
        <Card>
          <T size={22} weight="800" center>تأكيد الإيميل</T>
          <T sec center>{info}</T>
          <Field label="الكود" value={code} maxLength={6} keyboardType="number-pad" textContentType="oneTimeCode" placeholder="••••••"
            style={{ textAlign: 'center', fontSize: 26, letterSpacing: 8 }}
            onChangeText={(v) => { const d = v.replace(/\D/g, '').slice(0, 6); setCode(d); if (d.length === 6) check(d); }} testID="input-otp" />
          {err ? <ErrorText text={err} /> : null}
          <Btn title="تأكيد" onPress={() => check()} busy={busy} />
          <Link title={wait ? `دز كود جديد بعد ${wait} ثانية` : 'دز كود جديد'} onPress={send} disabled={wait > 0} />
          <Link title="غيّر الإيميل" onPress={onBack} />
        </Card>
      </Screen>
    </Wall>
  );
}

const st = StyleSheet.create({
  face: { width: 128, height: 128, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
  frame: { position: 'absolute', alignSelf: 'center', top: '30%', width: 250, height: 250, borderRadius: 28, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  scanTx: { color: '#fff', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  close: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 26 },
  closeTx: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
