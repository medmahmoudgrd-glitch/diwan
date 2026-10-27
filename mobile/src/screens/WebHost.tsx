// The app's screens are the Grdlabs Mobile design page (src/web/appHtml.ts, built by scripts/build-web.mjs) shown in a
// WebView. The page asks for what only the phone can do (sign-in, Firebase data, NFC, Face ID, GPS) and this host answers.
import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { authError, clock, isDenied, isOffline, loadMe, loadStaff, logOut, restore, saved, setLockEnabled, signIn, type Me, type Staff } from '../account';
import { auth } from '../firebase';
import { confirmOwner, currentPosition, LocationError, readSticker } from '../device';
import { num } from '../format';
import type { Link } from '../links';
import { useTheme } from '../theme';
import { APP_HTML } from '../web/appHtml';
import { scheduleTasks, type Task } from '../reminders';
import { printPdf, sharePdf } from '../pdf';

// react-native-webview's class typings do not match this React version's JSX types; the runtime component is fine.
const WV = WebView as unknown as React.ComponentType<Record<string, unknown> & { ref?: React.Ref<WebView> }>;

type Msg = { type: 'ready' | 'login' | 'scan' | 'clock' | 'faceOn' | 'faceUnlock' | 'logout' | 'tasks' | 'pdf'; email?: string; pass?: string; user?: unknown; tasks?: Task[]; html?: string; file?: string; mode?: 'share' | 'print' };

// The page reads attendance timestamps as ISO strings and does not need Firestore types.
const plain = (s: Staff | null) => (s ? { ...s, updated: s.updated ? s.updated.toMillis() : null } : null);

export function WebHost({ sticker, onStickerUsed, onScan, paired }: {
  sticker: Link | null; onStickerUsed: () => void; onScan: () => void; paired: Me | null;
}) {
  const t = useTheme();
  const web = useRef<WebView>(null);
  const me = useRef<Me | null>(null);

  const call = useCallback((fn: string, ...args: unknown[]) => {
    web.current?.injectJavaScript(`window.grd && window.grd.${fn}(${args.map((a) => JSON.stringify(a ?? null)).join(',')}); true;`);
  }, []);

  const enter = useCallback(async (who: Me | null) => {
    if (!who) return call('failed', 'حسابك مو مربوط بشركة', 'اطلب من مديرك رمز الربط من برنامج Grdlabs، واضغط «سجّل برمز الشركة».');
    me.current = who;
    try { call('signedIn', { email: auth.currentUser?.email ?? '', name: who.name }, plain(await loadStaff(who))); }
    catch (e) { call('failed', 'تعذّر التحميل', isOffline(e) ? 'تأكد من الإنترنت.' : 'جرب مرة ثانية.'); }
  }, [call]);

  const doClock = useCallback(async (link: Link | null) => {
    const who = me.current;
    if (!who) return;
    const l = link ?? (await readSticker());
    if (!l) return;
    if (l.cid !== who.cid) return call('failed', 'هذا الملصق لشركة ثانية', 'حسابك مربوط بشركة ثانية.');
    const today = (who.recent || []).filter((x) => new Date(x.at).toDateString() === new Date().toDateString()).pop();
    const kind = today?.kind === 'in' ? 'out' : 'in';
    if (!(await confirmOwner(kind === 'in' ? 'تسجيل الحضور' : 'تسجيل الانصراف'))) return call('failed', 'ما تم التحقق', 'لازم Face ID أو البصمة حتى يتسجل الحضور.');
    call('busy', 'جاري تحديد موقعك…');
    try {
      const pos = await currentPosition();
      const r = await clock(who, l.token, kind, pos);
      if (!r.ok) return call('failed', r.reason === 'far' ? 'أنت بعيد عن الشركة' : 'الملصق قديم',
        r.reason === 'far' ? `المسافة ${num(r.dist!)} متر، والمسموح ${num(r.radius!)} متر.` : 'رابط الملصق تغيّر. خبر مديرك حتى يحدّث الملصق.');
      me.current = (await loadMe()) || who;
      call('staff', plain(await loadStaff(me.current).catch(() => null)));
      call('done', kind === 'in' ? 'سجّلت حضورك' : 'يعطيك العافية');
    } catch (e) {
      if (e instanceof LocationError) return call('failed', 'ما كدرت أحدد موقعك', 'اسمح لـ Grdlabs يوصل للموقع وشغّل الـ GPS، وجرب مرة ثانية.');
      call('failed', 'ما تسجّل', isDenied(e) ? 'حسابك موقوف بهذي الشركة. اطلب رمز ربط جديد.' : isOffline(e) ? 'تأكد من الإنترنت وجرب مرة ثانية.' : 'صار خطأ. جرب مرة ثانية.');
    }
  }, [call]);

  const onMessage = useCallback(async (e: WebViewMessageEvent) => {
    let m: Msg;
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === 'ready') {
      // A page that still thinks an employee is signed in, but Firebase does not: send it back to sign-in.
      if (m.user && !saved()) call('signedOut');
    } else if (m.type === 'login') {
      try { await enter(await signIn(m.email || '', m.pass || '')); }
      catch (x) { call('failed', 'ما گدرنا ندخلك', authError(x)); }
    } else if (m.type === 'faceUnlock') {
      if (!saved()) return call('failed', 'ادخل بالإيميل أول', 'ادخل بالإيميل وكلمة المرور مرة وحدة، وبعدها تگدر تدخل بـ Face ID.');
      if (await confirmOwner('ادخل لـ Grdlabs')) enter((await loadMe()) || (await restore()));
    } else if (m.type === 'faceOn') {
      setLockEnabled(true).catch(() => {});
    } else if (m.type === 'scan') {
      onScan();
    } else if (m.type === 'clock') {
      doClock(null);
    } else if (m.type === 'pdf') {
      try { await (m.mode === 'print' ? printPdf(m.html || '') : sharePdf(m.html || '', m.file || 'Grdlabs')); }
      catch { call('failed', 'ما گدرنا نسوي الـ PDF', 'جرب مرة ثانية.'); }
    } else if (m.type === 'tasks') {
      scheduleTasks(m.tasks || []).catch(() => {});
    } else if (m.type === 'logout') {
      me.current = null;
      logOut().catch(() => {});
    }
  }, [call, enter, doClock, onScan]);

  // A phone that just finished pairing comes back signed in.
  useEffect(() => { if (paired) setTimeout(() => enter(paired), 400); }, [paired, enter]);
  // A sticker read outside the app arrives as a link.
  useEffect(() => { if (sticker && me.current) { onStickerUsed(); doClock(sticker); } }, [sticker, onStickerUsed, doClock]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: t.wall }]}>
      <WV
        ref={web}
        source={{ html: APP_HTML, baseUrl: 'https://grdlabs.site/app/' }}
        originWhitelist={['https://*', 'about:*']}
        onMessage={onMessage}
        style={{ backgroundColor: 'transparent' }}
        bounces={false}
        scrollEnabled={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        overScrollMode="never"
        allowsBackForwardNavigationGestures={false}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
        setSupportMultipleWindows={false}
        textZoom={100}
        domStorageEnabled
        javaScriptEnabled
      />
    </View>
  );
}
