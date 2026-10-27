// Links the desktop app prints: pairing QR "#p=<company id>.<code>" and the NFC sticker "#t=<company id>.<tag token>".
// They point at https://grdlabs.site/app/, which opens this app when it is installed (universal / app links).
export type Link = { kind: 'pair' | 'tag'; cid: string; token: string };

const RE = /#([pt])=([a-z0-9]{20})\.([A-Z2-9]{8,16})$/;

export function parseLink(url: string | null | undefined): Link | null {
  const m = url ? RE.exec(url.trim()) : null;
  return m ? { kind: m[1] === 'p' ? 'pair' : 'tag', cid: m[2], token: m[3] } : null;
}
