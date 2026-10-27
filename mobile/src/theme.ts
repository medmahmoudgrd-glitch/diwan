// Liquid Glass palette from the Grdlabs Mobile design (reference/prototype.html), light and dark,
// plus the appearance the person picks in حسابي: فاتح، داكن، تلقائي.
import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const light = {
  dark: false,
  wall: '#E9EDF5',
  blobs: ['rgba(0,122,255,0.30)', 'rgba(175,82,222,0.24)', 'rgba(48,176,199,0.26)', 'rgba(255,149,0,0.20)'],
  glass: 'rgba(255,255,255,0.50)', glass2: 'rgba(255,255,255,0.68)', glass3: 'rgba(250,250,252,0.86)',
  stroke: 'rgba(255,255,255,0.80)',
  tx: '#0B0B0F', sec: 'rgba(60,60,67,0.64)', ter: 'rgba(60,60,67,0.34)', sep: 'rgba(60,60,67,0.16)', fill: 'rgba(120,120,128,0.14)', fill2: 'rgba(120,120,128,0.22)',
  acc: '#007AFF', g: '#34C759', gt: '#248A3D', r: '#FF3B30', o: '#FF9500', ot: '#C56A00', p: '#AF52DE', t: '#30B0C7', i: '#5856D6', grey: '#8E8E93',
  shadow: 'rgba(30,40,80,0.28)',
};
export type Theme = typeof light;

const dark: Theme = {
  dark: true,
  wall: '#07080C',
  blobs: ['rgba(10,132,255,0.34)', 'rgba(191,90,242,0.26)', 'rgba(64,200,224,0.20)', 'rgba(255,159,10,0.16)'],
  glass: 'rgba(44,44,52,0.42)', glass2: 'rgba(34,34,40,0.62)', glass3: 'rgba(40,40,46,0.86)',
  stroke: 'rgba(255,255,255,0.13)',
  tx: '#F5F5F7', sec: 'rgba(235,235,245,0.62)', ter: 'rgba(235,235,245,0.30)', sep: 'rgba(84,84,88,0.50)', fill: 'rgba(120,120,128,0.24)', fill2: 'rgba(120,120,128,0.34)',
  acc: '#0A84FF', g: '#30D158', gt: '#30D158', r: '#FF453A', o: '#FF9F0A', ot: '#FF9F0A', p: '#BF5AF2', t: '#40C8E0', i: '#5E5CE6', grey: '#8E8E93',
  shadow: 'rgba(0,0,0,0.7)',
};

export type Mode = 'light' | 'dark' | 'auto';
export const ModeContext = createContext<{ mode: Mode; setMode: (m: Mode) => void }>({ mode: 'auto', setMode: () => {} });

const KEY = 'grdlabs-theme-v1';
export const loadMode = async (): Promise<Mode> => ((await AsyncStorage.getItem(KEY).catch(() => null)) as Mode) || 'auto';
export const saveMode = (m: Mode) => AsyncStorage.setItem(KEY, m).catch(() => {});

export function useTheme(): Theme {
  const system = useColorScheme();
  const { mode } = useContext(ModeContext);
  const isDark = mode === 'auto' ? system === 'dark' : mode === 'dark';
  return isDark ? dark : light;
}

// Noto Sans Arabic, one family per weight (React Native does not synthesise weights for custom fonts).
const FAMILY: Record<string, string> = {
  '400': 'NotoSansArabic_400Regular', '500': 'NotoSansArabic_500Medium', '600': 'NotoSansArabic_600SemiBold',
  '700': 'NotoSansArabic_700Bold', '800': 'NotoSansArabic_800ExtraBold',
};
export const font = (weight: '400' | '500' | '600' | '700' | '800' = '400') => ({ fontFamily: FAMILY[weight] });
