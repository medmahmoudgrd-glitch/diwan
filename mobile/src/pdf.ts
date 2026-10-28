// Turns an invoice, voucher or slip from the page into a real A4 PDF, then opens the share sheet (WhatsApp, Mail,
// Files…) or the system print dialog. The page sends the document as a full HTML page with its own styles.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { cacheDirectory, deleteAsync, moveAsync } from 'expo-file-system/legacy';

// The design draws documents 794×1123 px. iOS's web print renderer puts 1.25 CSS px in each point, so a sheet of
// 635.2×898.4 pt holds the document exactly, edge to edge, and keeps A4's proportions (it prints full-size on A4).
// Checked on the iOS simulator with a framed 794×1123 test sheet: all four edges land on the page edges.
const SCALE = Platform.OS === 'ios' ? 0.8 : 1;
const PAGE = { width: 794 * SCALE, height: 1123 * SCALE, margins: { left: 0, top: 0, right: 0, bottom: 0 } };

export async function sharePdf(html: string, file: string) {
  const { uri } = await Print.printToFileAsync({ html, ...PAGE });
  const safe = (file || 'Grdlabs').replace(/[\\/:*?"<>|]+/g, '-');
  const named = `${cacheDirectory}${safe}.pdf`;
  await deleteAsync(named, { idempotent: true });
  await moveAsync({ from: uri, to: named });
  await Sharing.shareAsync(named, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: safe });
}

export async function printPdf(html: string) {
  await Print.printAsync({ html, ...PAGE });
}

