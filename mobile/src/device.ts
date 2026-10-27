// Phone hardware used for attendance: Face ID / fingerprint, GPS, and reading the company's NFC sticker.
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Location from 'expo-location';
import { parseLink, type Link } from './links';

export async function biometricsReady(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

/** Resolves true only when the owner of the phone confirmed with Face ID, fingerprint or the device passcode. */
export async function confirmOwner(reason: string): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: 'إلغاء', fallbackLabel: 'استخدم رمز القفل' });
  return r.success;
}

export class LocationError extends Error {}

export async function currentPosition() {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') throw new LocationError('denied');
  if (!(await Location.hasServicesEnabledAsync())) throw new LocationError('off');
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
  return { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy || 0) };
}

// react-native-nfc-manager has no web build and is missing from Expo Go, so it is loaded only where it exists.
type Nfc = typeof import('react-native-nfc-manager');
const nfc: Nfc | null = (() => {
  if (Platform.OS === 'web') return null;
  try { return require('react-native-nfc-manager'); } catch { return null; }
})();

export async function nfcSupported(): Promise<boolean> {
  if (!nfc) return false;
  try { return await nfc.default.isSupported(); } catch { return false; }
}

/** Opens the system NFC sheet and returns the sticker link it reads, or null when cancelled or not a Grdlabs sticker. */
export async function readSticker(): Promise<Link | null> {
  if (!nfc) return null;
  const { default: NfcManager, NfcTech, Ndef } = nfc;
  await NfcManager.start();
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, { alertMessage: 'قرّب أعلى التلفون من ملصق الشركة' });
    const tag = await NfcManager.getTag();
    for (const record of tag?.ndefMessage ?? []) {
      if (!Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI)) continue;
      const link = parseLink(Ndef.uri.decodePayload(new Uint8Array(record.payload)));
      if (link?.kind === 'tag') {
        if (Platform.OS === 'ios') NfcManager.setAlertMessageIOS('تم قراءة الملصق');
        return link;
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}
