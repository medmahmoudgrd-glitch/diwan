// Talks to the same Firestore data as the employee web app (reference/employee-web-app.js), under the same rules:
// att/{cid} company, pairs/{code} one-time pairing codes, members/{uid} paired phones, staff/{employeeId} pay summary,
// events/{id} clock-ins. A saved account remembers its company in its profile name: "grd:<cid>:<employeeId>".
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUserWithEmailAndPassword, EmailAuthProvider, linkWithCredential, sendPasswordResetEmail, signInAnonymously,
  signInWithEmailAndPassword, signOut, updateProfile, type User,
} from 'firebase/auth';
import { addDoc, collection, doc, getDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { Platform } from 'react-native';
import { auth, db } from './firebase';
import { OTP_CONFIG_URL } from './config';
import { metres } from './format';

export type Kind = 'bonus' | 'deduction' | 'advance';
export type Item = { kind: Kind; amount: number; reason?: string; date?: string };
export type Month = { period: string; salary: number; advances: number; deductions: number; bonuses: number; net: number; paid?: boolean; paidOn?: string; items: Item[] };
export type Clock = { kind: 'in' | 'out'; at: string };
export type Staff = { name: string; company?: string; jobTitle?: string; updated?: Timestamp; months?: Month[]; attendance?: Clock[] };
export type Me = { cid: string; employeeId: string; name: string; company?: string; recent: Clock[] };

const KEY = 'grdlabs-employee-v1';
const LINK = /^grd:([a-z0-9]{20}):(.+)$/;

export async function loadMe(): Promise<Me | null> {
  try { const v = await AsyncStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
export async function saveMe(me: Me | null) {
  if (me) await AsyncStorage.setItem(KEY, JSON.stringify(me));
  else await AsyncStorage.removeItem(KEY);
}

export const saved = () => !!auth.currentUser && !auth.currentUser.isAnonymous;
export const isDenied = (e: unknown) => /permission/i.test(String((e as { code?: string })?.code || (e as Error)?.message || ''));
export const isOffline = (e: unknown) => /unavailable|network|offline/i.test(String((e as { code?: string })?.code || (e as Error)?.message || ''));

export function authError(e: unknown): string {
  const c = String((e as { code?: string })?.code || '');
  if (isOffline(e)) return 'تأكد من الإنترنت وجرب مرة ثانية.';
  if (c === 'auth/email-already-in-use' || c === 'auth/credential-already-in-use') return 'هذا الإيميل عنده حساب من قبل. اختار «عندي حساب» وادخل بكلمة السر مالته.';
  if (c === 'auth/invalid-email') return 'اكتب الإيميل بشكل صحيح.';
  if (c === 'auth/weak-password') return 'كلمة السر لازم تكون 6 أحرف أو أكثر.';
  if (c === 'auth/too-many-requests') return 'محاولات كثيرة. انتظر شوية وجرب مرة ثانية.';
  if (/wrong-password|user-not-found|invalid-credential|invalid-login/.test(c)) return 'الإيميل أو كلمة السر غلط.';
  return 'صار خطأ. جرب مرة ثانية.';
}

export function checkFields(email: string, pass: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'اكتب الإيميل بشكل صحيح.';
  if (pass.length < 6) return 'كلمة السر لازم تكون 6 أحرف أو أكثر.';
  return null;
}

/** The company and employee this account is linked to, read from its profile, with names from the staff summary. */
export async function restore(): Promise<Me | null> {
  const m = saved() && LINK.exec(auth.currentUser!.displayName || '');
  if (!m) return null;
  const me: Me = { cid: m[1], employeeId: m[2], name: '', recent: (await loadMe())?.recent || [] };
  try {
    const s = (await getDoc(doc(db, `att/${me.cid}/staff/${me.employeeId}`))).data() as Staff | undefined;
    if (s) { me.name = s.name; me.company = s.company; }
  } catch { /* the home screen shows the error */ }
  await saveMe(me);
  return me;
}

export async function signIn(email: string, pass: string) {
  await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), pass);
  return restore();
}
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email.trim().toLowerCase());
export async function logOut() { await saveMe(null); await AsyncStorage.removeItem(CACHE).catch(() => {}); await signOut(auth); }

// ---------- Pairing with the one-time code from the desktop app ----------
export type Pair = { employeeId: string; name: string; exp: Timestamp; used: boolean };

export async function readPair(cid: string, code: string): Promise<Pair | null> {
  if (!auth.currentUser) await signInAnonymously(auth);
  const snap = await getDoc(doc(db, `att/${cid}/pairs/${code}`));
  const p = snap.exists() ? (snap.data() as Pair) : null;
  return p && !p.used && p.exp.toMillis() > Date.now() ? p : null;
}

/** Creates or signs in to the email account, then claims the code and becomes a member of the company. */
export async function pair(cid: string, code: string, p: Pair, mode: 'new' | 'login' | 'keep', email = '', pass = '') {
  if (mode === 'new') {
    const cur = auth.currentUser;
    if (cur?.isAnonymous) await linkWithCredential(cur, EmailAuthProvider.credential(email, pass));
    else await createUserWithEmailAndPassword(auth, email, pass);
  } else if (mode === 'login') await signInWithEmailAndPassword(auth, email, pass);
  const uid = auth.currentUser!.uid, b = writeBatch(db);
  b.update(doc(db, `att/${cid}/pairs/${code}`), { used: true, usedBy: uid });
  b.set(doc(db, `att/${cid}/members/${uid}`), { employeeId: p.employeeId, code, at: serverTimestamp(), label: Platform.OS === 'ios' ? 'iPhone' : 'Android' });
  await b.commit();
  await updateProfile(auth.currentUser as User, { displayName: `grd:${cid}:${p.employeeId}` }).catch(() => {});
  const me: Me = { cid, employeeId: p.employeeId, name: p.name, recent: [] };
  await saveMe(me);
  return me;
}

// ---------- Pay summary and attendance ----------
export async function loadStaff(me: Me): Promise<Staff | null> {
  const snap = await getDoc(doc(db, `att/${me.cid}/staff/${me.employeeId}`));
  return snap.exists() ? (snap.data() as Staff) : null;
}

// The last summary the phone saw, so pay and attendance still show without internet.
const CACHE = 'grdlabs-staff-cache-v1';
export async function cacheStaff(me: Me, s: Staff) {
  const plain = { ...s, updated: s.updated ? s.updated.toMillis() : null };
  await AsyncStorage.setItem(CACHE, JSON.stringify({ cid: me.cid, employeeId: me.employeeId, s: plain })).catch(() => {});
}
export async function cachedStaff(me: Me): Promise<Staff | null> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(CACHE)) || 'null');
    if (!v || v.cid !== me.cid || v.employeeId !== me.employeeId) return null;
    return { ...v.s, updated: v.s.updated ? Timestamp.fromMillis(v.s.updated) : undefined };
  } catch { return null; }
}

// Face ID lock when the app opens; on by default wherever the phone has Face ID or a fingerprint.
const LOCK = 'grdlabs-lock-v1';
export const lockEnabled = async () => (await AsyncStorage.getItem(LOCK).catch(() => null)) !== 'off';
export const setLockEnabled = (on: boolean) => AsyncStorage.setItem(LOCK, on ? 'on' : 'off');

export type ClockResult = { ok: true; at: string; dist: number } | { ok: false; reason: 'far' | 'oldTag'; dist?: number; radius?: number };

/** Writes a clock event if the phone is inside the company's radius; the rules check the same distance and tag again. */
export async function clock(me: Me, tag: string, kind: 'in' | 'out', pos: { lat: number; lng: number; acc: number }): Promise<ClockResult> {
  const co = (await getDoc(doc(db, `att/${me.cid}`))).data() as { lat: number; lng: number; radius: number; tag: string };
  const dist = metres(co.lat, co.lng, pos.lat, pos.lng);
  if (dist > co.radius) return { ok: false, reason: 'far', dist, radius: co.radius };
  if (tag !== co.tag) return { ok: false, reason: 'oldTag' };
  await addDoc(collection(db, `att/${me.cid}/events`), {
    employeeId: me.employeeId, kind, at: serverTimestamp(), lat: pos.lat, lng: pos.lng, acc: pos.acc, dist, tag, uid: auth.currentUser!.uid,
  });
  const at = new Date().toISOString();
  await saveMe({ ...me, recent: [...me.recent, { kind, at }].slice(-60) });
  return { ok: true, at, dist };
}

// ---------- Email codes before creating an account (off while otp.json has no address) ----------
let otpUrl: string | null = null;
export async function otpService(): Promise<string> {
  if (otpUrl !== null) return otpUrl;
  let url = '';
  try {
    const j = await (await fetch(OTP_CONFIG_URL, { cache: 'no-store' })).json();
    if (typeof j.url === 'string' && /^https:\/\//.test(j.url)) url = j.url;
  } catch { /* email codes stay off */ }
  return (otpUrl = url);
}
export async function otpCall(body: Record<string, unknown>): Promise<{ ok?: boolean; error?: string; resendIn?: number; retryIn?: number; left?: number }> {
  if (!auth.currentUser) await signInAnonymously(auth);
  const idToken = await auth.currentUser!.getIdToken();
  const r = await fetch(await otpService(), { method: 'POST', body: JSON.stringify({ idToken, ...body }) });
  return r.json();
}
export const OTP_ERR: Record<string, string> = {
  bad_email: 'اكتب الإيميل بشكل صحيح.', quota: 'وصلنا الحد اليومي للرسائل. جرب باچر.',
  wrong: 'الكود غلط.', expired: 'الكود انتهى. اضغط «دز كود جديد».', blocked: 'محاولات غلط كثيرة. اضغط «دز كود جديد».',
  not_found: 'اضغط «دز كود جديد».', used: 'هذا الكود مستخدم. اضغط «دز كود جديد».',
};
