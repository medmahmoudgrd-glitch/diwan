// Sample employee for checking the screens in a browser: open the web build with ?demo. Never used on phones.
import { Timestamp } from 'firebase/firestore';
import type { Me, Staff } from './account';

const d = (daysAgo: number, h: number, m: number) => { const x = new Date(); x.setDate(x.getDate() - daysAgo); x.setHours(h, m, 0, 0); return x.toISOString(); };
const period = (monthsAgo: number) => { const x = new Date(); x.setDate(1); x.setMonth(x.getMonth() - monthsAgo); return x.toISOString().slice(0, 7); };

export const demoMe: Me = { cid: 'demo0000000000000000', employeeId: 'e1', name: 'أحمد علي', company: 'الظل تك', recent: [] };

export const demoStaff: Staff = {
  name: 'أحمد علي', company: 'الظل تك', jobTitle: 'مصمم', updated: Timestamp.now(),
  months: [
    { period: period(0), salary: 900000, advances: 150000, deductions: 25000, bonuses: 50000, net: 775000, paid: false, items: [
      { kind: 'advance', amount: 150000, reason: 'سلفة شخصية', date: period(0) + '-08' },
      { kind: 'deduction', amount: 25000, reason: 'تأخير', date: period(0) + '-12' },
      { kind: 'bonus', amount: 50000, reason: 'إنجاز مشروع', date: period(0) + '-20' },
    ] },
    { period: period(1), salary: 900000, advances: 0, deductions: 0, bonuses: 0, net: 900000, paid: true, paidOn: period(0) + '-01', items: [] },
  ],
  attendance: [
    { kind: 'in', at: d(0, 8, 57) },
    { kind: 'in', at: d(1, 9, 4) }, { kind: 'out', at: d(1, 17, 2) },
    { kind: 'in', at: d(2, 8, 49) }, { kind: 'out', at: d(2, 16, 58) },
  ],
};
