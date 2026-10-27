// Turns an invoice, voucher or slip from the page into a real A4 PDF, then opens the share sheet (WhatsApp, Mail,
// Files…) or the system print dialog. The page sends the document as a full HTML page with its own styles.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { cacheDirectory, deleteAsync, moveAsync } from 'expo-file-system/legacy';

// The design draws documents 794×1123 px, the size of an A4 sheet at 96 dpi.
const PAGE = { width: 794, height: 1123 };

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
