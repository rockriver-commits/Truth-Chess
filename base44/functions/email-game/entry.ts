import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Sends the player an HTML email with a picture of the final board position
// and the game's moves in a readable format. The board image is uploaded by
// the client (UploadFile) and passed in as a public URL; the moves come in as
// a SAN list and are formatted into a numbered PGN-style block.
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const to = typeof body.to === 'string' ? body.to.trim() : '';
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl : '';
    const sans = Array.isArray(body.sans) ? body.sans : [];
    const resultStr =
      typeof body.resultStr === 'string' && body.resultStr ? body.resultStr : '*';
    const maidenMode = !!body.maidenMode;
    const appUrl =
      (typeof body.appUrl === 'string' ? body.appUrl.trim().replace(/\/$/, '') : '') ||
      (req.headers.get('X-Base44-App-Url') || '').trim().replace(/\/$/, '') ||
      (process.env.WIX_CHECKOUT_APP_URL || '').trim().replace(/\/$/, '');
    const gameLink = appUrl ? `${appUrl}${maidenMode ? '/?maiden=1' : '/'}` : '';
    const gameTitle = maidenMode ? 'TruthMaidin Chess' : 'Truth Chess';

    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return Response.json(
        { error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    let movetext = '';
    for (let i = 0; i < sans.length; i++) {
      if (i % 2 === 0) movetext += `${i / 2 + 1}. `;
      movetext += String(sans[i]) + ' ';
    }
    movetext = movetext.trim();
    const movesLine = movetext ? `${movetext} ${resultStr}` : resultStr;

    const esc = (s) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const imgHtml = imageUrl
      ? `<div style="text-align:center;margin:18px 0;"><img src="${esc(imageUrl)}" alt="Final board position" style="max-width:100%;width:500px;border:10px solid #b89372;border-radius:14px;display:inline-block;"/></div>`
      : '';

    const playAgainHtml = gameLink
      ? `<p style="margin:14px 0;"><a href="${esc(gameLink)}" style="display:inline-block;padding:10px 18px;background:#b45309;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;">Play ${esc(gameTitle)} →</a></p>`
      : '';

    const html = [
      '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;">',
      `<h2 style="margin:0 0 8px;color:#b45309;">My ${esc(gameTitle)} Game</h2>`,
      `<p style="margin:0 0 8px;color:#52525b;">Result: <strong>${esc(resultStr)}</strong></p>`,
      imgHtml,
      playAgainHtml,
      '<h3 style="margin:18px 0 8px;color:#1f2937;">Moves</h3>',
      `<pre style="background:#f5f5f4;border:1px solid #e7e5e4;border-radius:10px;padding:14px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:14px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;">${esc(movesLine)}</pre>`,
      `<p style="margin:14px 0 0;color:#a1a1aa;font-size:12px;">Played on ${esc(gameTitle)} — a 10×9 chess variant.</p>`,
      '</div>',
    ].join('');

    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.integrations.Core.SendEmail({
      to,
      subject: `My ${gameTitle} Game`,
      body: html,
      from_name: gameTitle,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}