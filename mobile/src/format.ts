// Iraqi month names, dinar amounts and the day/time formats used by the employee web app.
const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const group = (n: number) => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
export const num = (n: number) => (n < 0 ? '-' : '') + group(n);
export const iqd = (n: number | undefined) => group(n || 0) + ' د.ع';
export const monthName = (period: string) => {
  const [y, m] = period.split('-').map(Number);
  return MONTHS[m - 1] + ' ' + y;
};
const pad = (n: number) => String(n).padStart(2, '0');
export const hm = (iso: string) => { const d = new Date(iso); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
export const dayKey = (iso: string | Date) => { const d = new Date(iso); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
export const dayName = (key: string) => { const d = new Date(key + 'T12:00:00'); return DAYS[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1); };
export const shortDate = (key?: string) => (key ? key.slice(8, 10) + '/' + key.slice(5, 7) : '');
export const stamp = (d: Date) => pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());

export function metres(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (d: number) => d * Math.PI / 180, R = 6371000;
  const x = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
}

// ---------- the design's Arabic-digit dates and times, and amounts in words ----------
export const ar = (n: number | string) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
export const MONTH_NAMES = MONTHS;
export const SHORT_DAYS = ['أح', 'اث', 'ث', 'ر', 'خم', 'جم', 'سب'];
export const tm = (iso: string) => { const d = new Date(iso), h = d.getHours(); return ar((h % 12 || 12) + ':' + pad(d.getMinutes())) + (h < 12 ? ' ص' : ' م'); };
export const dateAr = (d: Date) => DAYS[d.getDay()] + ' ' + ar(d.getDate()) + ' ' + MONTHS[d.getMonth()];
export const dayTitle = (key: string) => { const d = new Date(key + 'T12:00:00'); return DAYS[d.getDay()] + ' ' + ar(d.getDate()); };
export const greeting = (d = new Date()) => (d.getHours() < 12 ? 'صباح الخير' : 'مساء الخير');

const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUN = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];
const w999 = (n: number) => {
  const h = Math.floor(n / 100), r = n % 100, p: string[] = [];
  if (h) p.push(HUN[h]);
  if (r) { if (r < 20) p.push(ONES[r]); else { const u = r % 10, t = Math.floor(r / 10); p.push(u ? ONES[u] + ' و' + TENS[t] : TENS[t]); } }
  return p.join(' و');
};
const scale = (n: number, [one, two, few, many]: string[]) => {
  if (n === 1) return one; if (n === 2) return two;
  const w = n % 100 === 0 ? w999(n).replace(/مئتان$/, 'مئتا') : w999(n);
  return w + ' ' + (n % 100 >= 3 && n % 100 <= 10 ? few : many);
};
const words = (v: number) => {
  const n = Math.round(Math.abs(v)); if (!n) return 'صفر';
  const p: string[] = [], b = Math.floor(n / 1e9), m = Math.floor(n / 1e6) % 1000, t = Math.floor(n / 1e3) % 1000, r = n % 1000;
  if (b) p.push(scale(b, ['مليار', 'ملياران', 'مليارات', 'مليار']));
  if (m) p.push(scale(m, ['مليون', 'مليونان', 'ملايين', 'مليون']));
  if (t) p.push(scale(t, ['ألف', 'ألفان', 'آلاف', 'ألف']));
  if (r) p.push(w999(r));
  return p.join(' و');
};
export const dinarWords = (n: number) => 'فقط ' + words(n) + ' دينار عراقي لا غير';
