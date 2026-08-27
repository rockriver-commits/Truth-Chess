// Detects whether the app is running inside a native webview wrapper
// (e.g. the Base44 mobile app), as opposed to a regular desktop/mobile browser.
// Used to hide the Base44 Payments Pro upgrade path inside mobile apps, since
// Apple/Google require their own in-app billing for digital purchases.
export function isMobileApp() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // Android WebView includes the " wv " marker; Chrome mobile does not.
  const androidWv = /android/i.test(ua) && /wv/.test(ua);
  // iOS WKWebView contains "Mobile/" but lacks "Safari/", whereas Mobile Safari has both.
  const iosWv = /iphone|ipad|ipod/i.test(ua) && /mobile/i.test(ua) && !/safari\//i.test(ua);
  // Capacitor-based wrappers inject a global.
  const capacitor = typeof window !== 'undefined' && !!(window.Capacitor && window.Capacitor.isNative?.());
  return androidWv || iosWv || capacitor;
}