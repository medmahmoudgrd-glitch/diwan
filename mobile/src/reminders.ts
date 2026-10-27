// System notifications for the freelancer's tasks (المهام): one-off on its date, daily, or weekly on its day,
// at the time picked on the page. The whole list is rescheduled each time the page saves it.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type Task = { id: number; t: string; kind: 'once' | 'daily' | 'weekly'; date?: string; day?: number; time?: string; remind?: boolean };

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const TAG = 'grdlabs-task';

export async function scheduleTasks(tasks: Task[]) {
  if (Platform.OS === 'web') return;
  const wanted = tasks.filter((k) => k.remind && /^\d\d:\d\d$/.test(k.time || ''));
  if (wanted.length) {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && !(await Notifications.requestPermissionsAsync()).granted) return;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('tasks', { name: 'المهام', importance: Notifications.AndroidImportance.HIGH });
  }
  for (const n of await Notifications.getAllScheduledNotificationsAsync()) {
    if (n.content.data?.tag === TAG) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
  for (const k of wanted) {
    const [hour, minute] = k.time!.split(':').map(Number);
    let trigger: Notifications.NotificationTriggerInput;
    if (k.kind === 'daily') trigger = { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'tasks' };
    else if (k.kind === 'weekly') trigger = { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: (k.day ?? 0) + 1, hour, minute, channelId: 'tasks' };
    else {
      const at = new Date(`${k.date}T${k.time}:00`);
      if (!(at.getTime() > Date.now())) continue;
      trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'tasks' };
    }
    await Notifications.scheduleNotificationAsync({ content: { title: 'تذكير مهمة', body: k.t, data: { tag: TAG, id: k.id } }, trigger });
  }
}
