import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

// Max feedback messages a single caller IP may submit per day. A real player
// won't approach this; it exists to stop a stranger from looping the public
// URL to spam the owner inbox.
const IP_CAP = 5;

function todayLocalDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Best-effort caller IP from the platform's forwarded headers.
function callerIp(req) {
  const fwd = req.headers.get('x-forwarded-for') || '';
  const first = fwd.split(',')[0].trim();
  if (first) return first;
  return (req.headers.get('x-real-ip') || '').trim();
}

// djb2 hash — store IP hashes, not raw IPs, for privacy.
function ipHash(ip) {
  let h = 5381;
  for (let i = 0; i < ip.length; i++) h = ((h << 5) + h + ip.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// Public feedback form handler. Players submit a comment about the game; it is
// emailed to the owner (FEEDBACK_TO_EMAIL) without ever exposing that address
// to the player. No user auth required — guests can comment too. A per-caller
// IP rate limit (stored as hashed IPs on the day's FeedbackStat record) caps
// how many messages any one caller can send per day.
export default async function(req) {
  try {
    const toEmail = secrets.get("FEEDBACK_TO_EMAIL");
    if (!toEmail) {
      return Response.json(
        { error: "Feedback is not configured yet. Please try again later." },
        { status: 503 }
      );
    }
    const body = await req.json().catch(() => ({}));
    // Strip CR/LF and other control chars so a crafted name/email can't inject
    // extra mail headers (Bcc, etc.) via the subject line — email header injection.
    const stripControls = (s) => s.replace(/[\r\n\0]/g, ' ').replace(/[^\x20-\x7E]/g, ' ');
    const name = typeof body.name === 'string' ? stripControls(body.name.trim()).slice(0, 100) : '';
    const email = typeof body.email === 'string' ? stripControls(body.email.trim()).slice(0, 200) : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message || message.length > 5000) {
      return Response.json(
        { error: "Please enter a comment (up to 5000 characters)." },
        { status: 400 }
      );
    }

    const base44 = createClientFromRequest(req);

    // Per-IP daily rate limit: a stranger looping the public URL can't spam
    // the owner inbox more than IP_CAP times per day from one address.
    const date = todayLocalDate();
    const ipKey = ipHash(callerIp(req));
    const recs = await base44.asServiceRole.entities.FeedbackStat.filter({ date }, 'created_date', 10);
    const master = recs[0];
    if (master) {
      const ips = (master.ips && typeof master.ips === 'object' && !Array.isArray(master.ips))
        ? { ...master.ips }
        : {};
      const ipCount = (ips[ipKey] || 0) + 1;
      if (ipCount > IP_CAP) {
        return Response.json(
          { error: "You've sent a lot of comments today. Please try again tomorrow." },
          { status: 429 }
        );
      }
      ips[ipKey] = ipCount;
      await base44.asServiceRole.entities.FeedbackStat.update(master.id, {
        count: (master.count || 0) + 1,
        ips,
      });
    } else {
      await base44.asServiceRole.entities.FeedbackStat.create({
        date,
        count: 1,
        ips: { [ipKey]: 1 },
      });
    }

    const subject = "Truth Chess — new comment" + (name ? ` from ${name}` : "");
    const emailBody =
      "You received a new comment on Truth Chess.\n\n" +
      (name ? `Name: ${name}\n` : "") +
      (email ? `Reply email: ${email}\n` : "") +
      "\nMessage:\n" + message + "\n";

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: toEmail,
      subject,
      body: emailBody,
      from_name: "Truth Chess Feedback",
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}