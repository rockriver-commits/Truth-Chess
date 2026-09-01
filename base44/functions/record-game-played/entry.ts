import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Max increments a single caller IP may contribute per day. A real player
// (even on a shared NAT) won't approach this; it exists to stop a stranger
// from looping the public URL to inflate the "games played today" counter.
const IP_CAP = 150;

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

// Records one game played on the given date by incrementing that date's
// DailyStat counter. Public (no auth) so anonymous guests' games count too;
// writes use the service role so RLS can't block them. A per-caller-IP rate
// limit (stored as hashed IPs on the day's record) caps how much any one
// caller can inflate the counter. Returns the day's new total. Duplicate
// records for the same date are tolerated — the caller sums all of them, so
// concurrent first-of-day calls never lose a count.
export default async function(req) {
  try {
    let payload = {};
    try { payload = await req.json(); } catch (e) { payload = {}; }
    let date = typeof payload.date === 'string' ? payload.date : '';
    if (!DATE_RE.test(date)) date = todayLocalDate();

    const base44 = createClientFromRequest(req);
    const recs = await base44.asServiceRole.entities.DailyStat.filter({ date }, 'created_date', 10);
    const master = recs[0];
    const ipKey = ipHash(callerIp(req));

    if (master) {
      const ips = (master.ips && typeof master.ips === 'object' && !Array.isArray(master.ips))
        ? { ...master.ips }
        : {};
      const ipCount = (ips[ipKey] || 0) + 1;
      if (ipCount > IP_CAP) {
        // Rate limited: return the current total without incrementing.
        const all = await base44.asServiceRole.entities.DailyStat.filter({ date }, 'created_date', 10);
        const count = all.reduce((s, r) => s + (r.count || 0), 0);
        return Response.json({ date, count, rateLimited: true });
      }
      ips[ipKey] = ipCount;
      await base44.asServiceRole.entities.DailyStat.update(master.id, {
        count: (master.count || 0) + 1,
        ips,
      });
    } else {
      await base44.asServiceRole.entities.DailyStat.create({
        date,
        count: 1,
        ips: { [ipKey]: 1 },
      });
    }

    const all = await base44.asServiceRole.entities.DailyStat.filter({ date }, 'created_date', 10);
    const count = all.reduce((s, r) => s + (r.count || 0), 0);
    return Response.json({ date, count });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}