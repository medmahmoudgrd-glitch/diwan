// Face ID lock over the signed-in app: asks when the app opens and again after a minute in the background.
import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { lockEnabled } from '../account';
import { biometricsReady, confirmOwner } from '../device';
import { Btn, Icon, Message } from '../ui';
import { useTheme } from '../theme';

const AWAY_MS = 60_000;

export function Lock({ name, children }: { name: string; children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'locked' | 'open'>('checking');
  const left = useRef(0);

  const unlock = useCallback(async () => {
    if (await confirmOwner('افتح Grdlabs')) setState('open');
  }, []);

  const needed = useCallback(async () => (await lockEnabled()) && (await biometricsReady()), []);

  useEffect(() => {
    needed().then((on) => { setState(on ? 'locked' : 'open'); if (on) unlock(); });
    const sub = AppState.addEventListener('change', async (s) => {
      if (s === 'background') left.current = Date.now();
      if (s === 'active' && left.current && Date.now() - left.current > AWAY_MS && (await needed())) { setState('locked'); unlock(); }
    });
    return () => sub.remove();
  }, [needed, unlock]);

  const t = useTheme();
  if (state === 'open') return <>{children}</>;
  if (state === 'checking') return null;
  return (
    <Message icon={<Icon.face color={t.acc} size={64} />} title={name ? 'أهلاً ' + name.split(' ')[0] : 'Grdlabs'} text="التطبيق مقفول. افتحه بـ Face ID أو البصمة.">
      <Btn title="افتح بـ Face ID" onPress={unlock} icon={(c) => <Icon.face color={c} size={20} />} testID="button-unlock" />
    </Message>
  );
}
