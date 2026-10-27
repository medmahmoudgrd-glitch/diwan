// Grdlabs phone app: sign in, pair with the company once, then the employee's own screens.
// Links from the company's QR (#p=) and NFC sticker (#t=) open the app through grdlabs.site/app.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { I18nManager, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts, NotoSansArabic_400Regular, NotoSansArabic_500Medium, NotoSansArabic_600SemiBold, NotoSansArabic_700Bold, NotoSansArabic_800ExtraBold,
} from '@expo-google-fonts/noto-sans-arabic';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/firebase';
import { loadMe, restore, saved, type Me } from './src/account';
import { biometricsReady } from './src/device';
import { parseLink, type Link } from './src/links';
import { FaceIdIntro, PairFlow, Scanner, Welcome } from './src/screens/Auth';
import { WebHost } from './src/screens/WebHost';
import { EmployeeApp } from './src/screens/Employee';
import { Lock } from './src/screens/Lock';
import { loadMode, ModeContext, saveMode, useTheme, type Mode } from './src/theme';
import { Waiting } from './src/ui';
import { demoMe, demoStaff } from './src/preview';

const demo = Platform.OS === 'web' && typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');

if (Platform.OS !== 'web' && !I18nManager.isRTL) { I18nManager.allowRTL(true); I18nManager.forceRTL(true); }
if (Platform.OS === 'web' && typeof document !== 'undefined') { document.documentElement.dir = 'rtl'; document.documentElement.lang = 'ar'; }

type State = { phase: 'boot' } | { phase: 'out' } | { phase: 'pair'; link: Link } | { phase: 'face'; me: Me } | { phase: 'in'; me: Me };
const FACE_SEEN = 'grdlabs-face-intro-v1';

export default function App() {
  const [mode, setModeState] = useState<Mode>('auto');
  const [fonts] = useFonts({ NotoSansArabic_400Regular, NotoSansArabic_500Medium, NotoSansArabic_600SemiBold, NotoSansArabic_700Bold, NotoSansArabic_800ExtraBold });
  useEffect(() => { loadMode().then(setModeState); }, []);
  const modeValue = useMemo(() => ({ mode, setMode: (m: Mode) => { setModeState(m); saveMode(m); } }), [mode]);
  return (
    <ModeContext.Provider value={modeValue}>
      <SafeAreaProvider>
        {fonts ? <Root /> : null}
      </SafeAreaProvider>
    </ModeContext.Provider>
  );
}

function Root() {
  return Platform.OS === 'web' ? <WebRoot /> : <PhoneRoot />;
}

// On phones the screens are the design page in a WebView; pairing and the QR scanner stay native.
function PhoneRoot() {
  const t = useTheme();
  const [step, setStep] = useState<{ phase: 'web' } | { phase: 'scan' } | { phase: 'pair'; link: Link }>({ phase: 'web' });
  const [sticker, setSticker] = useState<Link | null>(null);
  const [paired, setPaired] = useState<Me | null>(null);
  const open = useCallback((url: string | null) => {
    const link = parseLink(url);
    if (link?.kind === 'pair') setStep({ phase: 'pair', link });
    else if (link?.kind === 'tag') setSticker(link);
  }, []);
  useEffect(() => {
    const off = onAuthStateChanged(auth, () => { off(); Linking.getInitialURL().then(open); });
    const sub = Linking.addEventListener('url', ({ url }) => open(url));
    return () => { off(); sub.remove(); };
  }, [open]);
  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <WebHost sticker={sticker} onStickerUsed={() => setSticker(null)} onScan={() => setStep({ phase: 'scan' })} paired={paired} />
      {step.phase === 'scan' ? <Scanner onClose={() => setStep({ phase: 'web' })} onLink={(link) => setStep({ phase: 'pair', link })} /> : null}
      {step.phase === 'pair' ? <PairFlow link={step.link} onDone={(me) => { setPaired(me); setStep({ phase: 'web' }); }} onCancel={() => setStep({ phase: 'web' })} /> : null}
    </>
  );
}

function WebRoot() {
  const t = useTheme();
  const [state, setState] = useState<State>(demo ? { phase: 'in', me: demoMe } : { phase: 'boot' });
  const [sticker, setSticker] = useState<Link | null>(null);

  const home = useCallback(async () => {
    const me = (saved() && (await loadMe())) || (await restore());
    setState(me ? { phase: 'in', me } : { phase: 'out' });
  }, []);

  // After a fresh sign-in or pairing, offer Face ID once.
  const signedIn = useCallback(async (me: Me | null) => {
    if (!me) return setState({ phase: 'out' });
    const seen = await AsyncStorage.getItem(FACE_SEEN).catch(() => '1');
    setState(!seen && (await biometricsReady()) ? { phase: 'face', me } : { phase: 'in', me });
  }, []);

  const open = useCallback((url: string | null) => {
    const link = parseLink(url);
    if (link?.kind === 'pair') setState({ phase: 'pair', link });
    else if (link?.kind === 'tag') setSticker(link);
  }, []);

  useEffect(() => {
    if (demo) return;
    const off = onAuthStateChanged(auth, () => {
      off();
      home().then(() => Linking.getInitialURL().then(open));
    });
    const sub = Linking.addEventListener('url', ({ url }) => open(url));
    return () => { off(); sub.remove(); };
  }, [home, open]);

  let screen;
  if (state.phase === 'boot') screen = <Waiting title="" />;
  else if (state.phase === 'pair') screen = <PairFlow link={state.link} onDone={signedIn} onCancel={home} />;
  else if (state.phase === 'face') {
    const me = state.me;
    screen = <FaceIdIntro onDone={() => { AsyncStorage.setItem(FACE_SEEN, '1').catch(() => {}); setState({ phase: 'in', me }); }} />;
  } else if (state.phase === 'in') screen = (
    <Lock name={state.me.name}>
      <EmployeeApp me={state.me} sticker={sticker} onStickerUsed={() => setSticker(null)} onSignedOut={() => setState({ phase: 'out' })} preview={demo ? demoStaff : undefined} />
    </Lock>
  );
  else screen = <Welcome onSignedIn={signedIn} onLink={(link) => setState({ phase: 'pair', link })} />;

  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      {screen}
    </>
  );
}
