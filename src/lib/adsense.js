// AdSense loader shared by the game page and the /learn content page. Both
// pages now carry substantial publisher content (see TruthGuide), so serving
// ads there complies with the AdSense "ads on screens without publisher
// content" policy. The loader appends the adsbygoogle.js script and returns a
// cleanup that removes it on unmount, so navigating away never leaves ads
// loaded on a screen without content.
const ADSENSE_CLIENT = 'ca-pub-3930013508011613';

export function loadAdSense() {
  let s = document.getElementById('adsbygoogle-js');
  if (!s) {
    s = document.createElement('script');
    s.id = 'adsbygoogle-js';
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    s.crossOrigin = 'anonymous';
    document.head.appendChild(s);
  }
  return () => {
    const el = document.getElementById('adsbygoogle-js');
    if (el) el.remove();
  };
}