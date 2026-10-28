// iOS 26 draws a "scroll edge effect" (a separate tinted band with a line) where a web view's scroll view runs under
// the status bar and the home indicator. The app paints its own frosted bars there, so turn the system ones off.
// Runs after every npm install (package.json "postinstall").
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const file = new URL('../node_modules/react-native-webview/apple/RNCWebViewImpl.m', import.meta.url);
if (!existsSync(file)) process.exit(0);
const src = readFileSync(file, 'utf8');
const MARK = '/* grdlabs: no system edge effects */';
if (src.includes(MARK)) process.exit(0);

const anchor = `      _webView.scrollView.contentInsetAdjustmentBehavior = _savedContentInsetAdjustmentBehavior;
    }
#endif  // !TARGET_OS_OSX`;
if (!src.includes(anchor)) { console.warn('patch-webview: anchor not found, skipped'); process.exit(0); }

writeFileSync(file, src.replace(anchor, `${anchor}
#if !TARGET_OS_OSX && defined(__IPHONE_26_0) && __IPHONE_OS_VERSION_MAX_ALLOWED >= __IPHONE_26_0
    ${MARK}
    if (@available(iOS 26.0, *)) {
      _webView.scrollView.topEdgeEffect.hidden = YES;
      _webView.scrollView.bottomEdgeEffect.hidden = YES;
    }
#endif`));
console.log('patch-webview: edge effects off');
