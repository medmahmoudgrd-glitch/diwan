// Liquid Glass building blocks matching the Grdlabs Mobile design: wallpaper blobs, frosted cards, pill buttons,
// inset grouped lists with coloured icon squares, segmented controls and the iOS-style icons.
import React, { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { font, useTheme } from './theme';

const tap = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };
type W = '400' | '500' | '600' | '700' | '800';

export function Wall({ children }: { children: ReactNode }) {
  const t = useTheme();
  // iOS softens the blobs with the blur layer above them; web and Android blur each blob itself.
  const soft = Platform.OS === 'ios' ? null : ({ filter: Platform.OS === 'web' ? 'blur(70px)' : [{ blur: 70 }] } as unknown as ViewStyle);
  const blob = (color: string, pos: ViewStyle) => <View style={[s.blob, { backgroundColor: color }, pos, soft]} />;
  return (
    <View style={{ flex: 1, backgroundColor: t.wall, overflow: 'hidden' }}>
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
        {blob(t.blobs[0], { top: -140, right: -120 })}
        {blob(t.blobs[1], { top: 160, left: -220 })}
        {blob(t.blobs[2], { top: 480, right: -200 })}
        {blob(t.blobs[3], { bottom: -200, left: -160 })}
        {Platform.OS === 'ios' ? <BlurView intensity={90} tint={t.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : null}
      </View>
      {children}
    </View>
  );
}

/** Frosted material. Android has no cheap live blur, so it gets the same tint as a solid layer. */
export function Glass({ children, style, level = 1 }: { children?: ReactNode; style?: ViewStyle | (ViewStyle | false | null | undefined)[]; level?: 1 | 2 | 3 }) {
  const t = useTheme();
  const bg = level === 3 ? t.glass3 : level === 2 ? t.glass2 : t.glass;
  return (
    <View style={[s.glass, { borderColor: t.stroke, shadowColor: t.shadow, backgroundColor: Platform.OS === 'android' ? t.glass3 : 'transparent' }, style]}>
      {Platform.OS !== 'android' && <BlurView intensity={40} tint={t.dark ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />}
      {children}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <Glass style={[s.card, style]}>{children}</Glass>;
}

/** A page: optional glass buttons in the top bar, a large title and subtitle, then the content. */
export function Screen({ children, title, subtitle, nav, onRefresh, bare, tabs = true }: {
  children: ReactNode; title?: string; subtitle?: string; nav?: ReactNode; onRefresh?: () => void; bare?: boolean; tabs?: boolean;
}) {
  const t = useTheme();
  const inset = useSafeAreaInsets();
  const top = Math.max(inset.top, 14);
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: top + (bare ? 20 : 52), paddingBottom: inset.bottom + (tabs ? 112 : 40), paddingHorizontal: 16, gap: 16, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScrollEndDrag={(e) => { if (onRefresh && e.nativeEvent.contentOffset.y < -90) onRefresh(); }}
      >
        {title ? <Text style={[s.large, font('800'), { color: t.tx }]}>{title}</Text> : null}
        {subtitle ? <Text style={[s.sub, font('400'), { color: t.sec }]}>{subtitle}</Text> : null}
        {children}
      </ScrollView>
      {nav ? <View style={[s.nav, { top }]} pointerEvents="box-none">{nav}</View> : null}
    </View>
  );
}

export function T({ children, style, sec, size, weight = '400', center, num, color, lines }: {
  children: ReactNode; style?: TextStyle; sec?: boolean; size?: number; weight?: W; center?: boolean; num?: boolean; color?: string; lines?: number;
}) {
  const t = useTheme();
  const sz = size ?? 16;
  return (
    <Text numberOfLines={lines} style={[font(weight), { color: color ?? (sec ? t.sec : t.tx), fontSize: sz, textAlign: center ? 'center' : undefined, lineHeight: sz * 1.5 },
      num ? { fontVariant: ['tabular-nums'] } : null, style]}>{children}</Text>
  );
}

export function H({ children }: { children: ReactNode }) {
  return <T size={20} weight="700">{children}</T>;
}

export function Label({ children }: { children: ReactNode }) {
  return <T sec size={13} weight="500" style={{ paddingHorizontal: 18, marginTop: 6, marginBottom: -8 }}>{children}</T>;
}

export function Btn({ title, onPress, kind = 'primary', disabled, busy, small, icon, testID, style }: {
  title: string; onPress: () => void; kind?: 'primary' | 'glass' | 'green' | 'red'; disabled?: boolean; busy?: boolean; small?: boolean;
  icon?: (color: string) => ReactNode; testID?: string; style?: ViewStyle;
}) {
  const t = useTheme();
  const solid = kind === 'primary' || kind === 'green';
  const fg = solid ? '#fff' : kind === 'red' ? t.r : t.acc;
  const inner = busy ? <ActivityIndicator color={fg} /> : (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {icon ? icon(fg) : null}
      <Text style={[font('600'), { fontSize: small ? 15 : 17, color: fg }]}>{title}</Text>
    </View>
  );
  const body = ({ pressed }: { pressed: boolean }) => [s.btn, small && s.btnSm, { opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }, style];
  const press = () => { tap(); onPress(); };
  if (!solid) return (
    <Pressable testID={testID} accessibilityRole="button" disabled={disabled || busy} onPress={press} style={body}>
      <Glass level={2} style={[StyleSheet.absoluteFill, { borderRadius: small ? 22 : 26 }]} />
      {inner}
    </Pressable>
  );
  const bg = kind === 'green' ? t.g : t.acc;
  return (
    <Pressable testID={testID} accessibilityRole="button" disabled={disabled || busy} onPress={press}
      style={(st) => [...body(st), { backgroundColor: bg, shadowColor: bg, shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }]}>
      {inner}
    </Pressable>
  );
}

export function Link({ title, onPress, disabled, size = 15 }: { title: string; onPress: () => void; disabled?: boolean; size?: number }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button">
      <Text style={[font('500'), { color: disabled ? t.ter : t.acc, fontSize: size, textAlign: 'center', paddingVertical: 6 }]}>{title}</Text>
    </Pressable>
  );
}

export type InputRef = React.ComponentRef<typeof TextInput>;
/** Glass pill field with a small label above, like the design's sign-in form. */
export const Field = forwardRef<InputRef, TextInputProps & { label: string; ltr?: boolean }>(function Field({ label, style, ltr, ...props }, ref) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T sec size={13} style={{ paddingHorizontal: 6 }}>{label}</T>
      <View>
        <Glass style={[StyleSheet.absoluteFill, { borderRadius: 26, shadowOpacity: 0 }]} />
        <TextInput ref={ref} placeholderTextColor={t.ter} {...props}
          style={[s.input, font('400'), { color: t.tx }, ltr ? { textAlign: 'left', writingDirection: 'ltr' } : null, style]} />
      </View>
    </View>
  );
});

export function Pill({ label, tone }: { label: string; tone: 'g' | 'o' | 'r' | 'b' }) {
  const t = useTheme();
  const c = { g: t.gt, o: t.ot, r: t.r, b: t.acc }[tone];
  const bg = { g: t.g, o: t.o, r: t.r, b: t.acc }[tone];
  return <Text style={[s.pill, font('600'), { color: c, backgroundColor: bg + '29' }]}>{label}</Text>;
}

/** Inset grouped list: rounded glass block whose rows are separated by hairlines. */
export function List({ children, style, indent }: { children: ReactNode; style?: ViewStyle; indent?: boolean }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <Glass style={[{ borderRadius: 26 }, style]}>
      {rows.map((row, i) => <View key={i}>{i > 0 ? <Sep indent={!!indent} /> : null}{row}</View>)}
    </Glass>
  );
}
function Sep({ indent }: { indent: boolean }) {
  const t = useTheme();
  // A spacer on the leading side, so the line starts after the icon in both RTL layouts (native and web).
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: indent ? 60 : 18 }} />
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: t.sep }} />
    </View>
  );
}

export function Sq({ color, children, size = 30 }: { color: string; children: ReactNode; size?: number }) {
  return <View style={[s.sq, { backgroundColor: color, width: size, height: size, borderRadius: size * 0.27 }]}>{children}</View>;
}

export function ListRow({ icon, title, sub, value, valueColor, bold, chevron, right, onPress, red, testID }: {
  icon?: ReactNode; title: string; sub?: string; value?: string; valueColor?: string; bold?: boolean; chevron?: boolean; right?: ReactNode;
  onPress?: () => void; red?: boolean; testID?: string;
}) {
  const t = useTheme();
  const body = (
    <View style={[s.row, red && { justifyContent: 'center' }]}>
      {icon}
      <View style={red ? { flex: 1, alignItems: 'center' } : { flex: 1, minWidth: 0 }}>
        <T lines={1} color={red ? t.r : undefined} weight={red ? '500' : '400'}>{title}</T>
        {sub ? <T sec size={13} lines={1}>{sub}</T> : null}
      </View>
      {value ? <T num weight={bold ? '600' : '400'} color={valueColor ?? (bold ? t.tx : t.sec)}>{value}</T> : null}
      {right}
      {chevron ? <Icon.chev color={t.ter} /> : null}
    </View>
  );
  if (!onPress) return body;
  return <Pressable testID={testID} onPress={() => { tap(); onPress(); }} style={({ pressed }) => pressed && { backgroundColor: t.fill }}>{body}</Pressable>;
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return <Switch value={value} onValueChange={(v) => { tap(); onChange(v); }} trackColor={{ true: t.g, false: t.fill2 }} thumbColor="#fff" ios_backgroundColor={t.fill2} />;
}

export function Segments<K extends string>({ items, value, onChange }: { items: [K, string][]; value: K; onChange: (k: K) => void }) {
  const t = useTheme();
  return (
    <View style={[s.seg, { backgroundColor: t.fill, borderColor: t.stroke }]}>
      {items.map(([k, label]) => (
        <Pressable key={k} onPress={() => { tap(); onChange(k); }}
          style={[s.segItem, k === value && { backgroundColor: t.glass3, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }]}>
          <Text style={[font(k === value ? '600' : '500'), { color: t.tx, fontSize: 14, textAlign: 'center' }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Round glass button in the top bar (bell, month, back). */
export function NavBtn({ children, onPress, badge }: { children: ReactNode; onPress: () => void; badge?: number }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
      <Glass level={2} style={s.nb}>{children}</Glass>
      {badge ? <View style={[s.bdg, { backgroundColor: t.r, borderColor: t.wall }]}><Text style={[font('700'), { color: '#fff', fontSize: 11 }]}>{badge}</Text></View> : null}
    </Pressable>
  );
}

export function Message({ icon, tone = 'b', title, text, children }: { icon: ReactNode; tone?: 'g' | 'o' | 'r' | 'b'; title: string; text?: string; children?: ReactNode }) {
  const t = useTheme();
  const c = { g: t.g, o: t.o, r: t.r, b: t.acc }[tone];
  return (
    <Wall>
      <Screen bare tabs={false}>
        <View style={{ flex: 1, justifyContent: 'center', gap: 14, paddingVertical: 40 }}>
          <Glass level={2} style={[s.face, { alignSelf: 'center' }]}>{typeof icon === 'string' ? <Text style={{ fontSize: 46, color: c }}>{icon}</Text> : icon}</Glass>
          <T size={28} weight="800" center>{title}</T>
          {text ? <T sec center>{text}</T> : null}
        </View>
        <View style={{ gap: 10 }}>{children}</View>
      </Screen>
    </Wall>
  );
}

export function Waiting({ title }: { title: string }) {
  const t = useTheme();
  return (
    <Wall>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <ActivityIndicator size="large" color={t.acc} />
        {title ? <T sec>{title}</T> : null}
      </View>
    </Wall>
  );
}

/** The design's app tile: blue rounded square with the document glyph. */
export function AppLogo() {
  return (
    <View style={s.applogo}>
      <Svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <Rect x={4.5} y={3} width={15} height={18} rx={3} /><Path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
      </Svg>
    </View>
  );
}

// ---------- icons (same paths as the design) ----------
type IP = { color?: string; size?: number };
const ic = (d: ReactNode, w = 1.8, filled = false) => ({ color = '#fff', size = 18 }: IP) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={filled ? 'none' : color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">{d}</Svg>
);
export const Icon = {
  face: ic(<Path d="M3.5 8V6A2.5 2.5 0 0 1 6 3.5h2M16 3.5h2A2.5 2.5 0 0 1 20.5 6v2M20.5 16v2a2.5 2.5 0 0 1-2.5 2.5h-2M8 20.5H6A2.5 2.5 0 0 1 3.5 18v-2M8.5 9v1.5M15.5 9v1.5M12 9v4h-1M9 15.5c1.7 1.4 4.3 1.4 6 0" />, 1.6),
  bell: ic(<Path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />, 2),
  home: ic(<Path d="M12 3.2 3 10.4V20a1 1 0 0 0 1 1h5v-6h6v6h5a1 1 0 0 0 1-1v-9.6z" />, 0, true),
  time: ic(<><Circle cx={12} cy={12} r={9} /><Path d="M12 7v5l3 2" /></>),
  cash: ic(<><Rect x={2.5} y={6} width={19} height={12} rx={2.5} /><Circle cx={12} cy={12} r={2.6} /><Path d="M6 9.5v.01M18 14.5v.01" /></>),
  me: ic(<><Circle cx={12} cy={8} r={4} /><Path d="M4 21a8 8 0 0 1 16 0" /></>),
  wallet: ic(<><Path d="M3 7a2 2 0 0 1 2-2h13v4" /><Rect x={3} y={7} width={18} height={13} rx={2.5} /><Path d="M16 13.5h2" /></>, 2),
  gift: ic(<><Rect x={3} y={8} width={18} height={5} rx={1} /><Path d="M5 13v8h14v-8M12 8v13M12 8C10 4 6 4 7 7s5 1 5 1 4 2 5-1-3-3-5 1" /></>, 2),
  minus: ic(<><Circle cx={12} cy={12} r={9} /><Path d="M8 12h8" /></>, 2),
  lock: ic(<><Rect x={5} y={10} width={14} height={10} rx={2.5} /><Path d="M8 10V7a4 4 0 0 1 8 0v3" /></>, 2),
  info: ic(<><Circle cx={12} cy={12} r={9} /><Path d="M12 11v5M12 8v.01" /></>, 2.2),
  moon: ic(<Path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />, 2),
  printer: ic(<><Path d="M7 8V3h10v5" /><Rect x={3} y={8} width={18} height={9} rx={2} /><Path d="M7 14h10v7H7z" /></>, 2),
  building: ic(<Path d="M4 21V5l8-2v18M12 8h8v13M8 8v.01M8 12v.01M8 16v.01M16 12v.01M16 16v.01M2 21h20" />, 2),
  check: ic(<Path d="m5 12.5 4.5 4.5L19 7.5" />, 2.6),
  next: ic(<Path d="m15 5-7 7 7 7" />, 2.4),
  prev: ic(<Path d="m9 5 7 7-7 7" />, 2.4),
  close: ic(<Path d="M6 6l12 12M18 6 6 18" />, 2.6),
  chev: ({ color = '#999' }: IP) => (
    <Svg width={8} height={14} viewBox="0 0 8 14" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><Path d="M7 1 1 7l6 6" /></Svg>
  ),
};

export const ui = { tap };

const s = StyleSheet.create({
  blob: { position: 'absolute', width: 460, height: 460, borderRadius: 230 },
  glass: { overflow: 'hidden', borderWidth: 0.5, borderRadius: 26, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  card: { padding: 20, gap: 12 },
  nav: { position: 'absolute', left: 12, right: 12, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  large: { fontSize: 34, letterSpacing: -0.2, marginHorizontal: 4, marginBottom: -4, lineHeight: 44 },
  sub: { fontSize: 15, marginHorizontal: 4, marginTop: -12 },
  btn: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, overflow: 'visible' },
  btnSm: { height: 44, borderRadius: 22 },
  input: { height: 52, borderRadius: 26, paddingHorizontal: 20, fontSize: 16, position: 'relative' },
  pill: { fontSize: 12, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden', alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 10, paddingHorizontal: 18 },
  sq: { alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', borderRadius: 22, padding: 3, gap: 2, borderWidth: 0.5 },
  segItem: { flex: 1, height: 34, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  nb: { height: 44, minWidth: 44, borderRadius: 22, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, shadowOpacity: 0.25 },
  bdg: { position: 'absolute', top: -2, left: -2, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderWidth: 2 },
  face: { width: 128, height: 128, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  applogo: { width: 76, height: 76, borderRadius: 20, backgroundColor: '#1F6FEB', alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
    shadowColor: '#0051D5', shadowOpacity: 0.7, shadowRadius: 15, shadowOffset: { width: 0, height: 14 } },
});
