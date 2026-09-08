import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { DATE_RE, todayLocalDate, callerIp, ipHash } from '../../shared/requestUtils.ts';

// One count per caller IP per day: the counter shows distinct visitors seen
// today, so refreshing the page or replaying the same IP all day does not
// inflate it.
const IP_CAP = 1;

// Records one distinct visitor for the given date by incrementing that date's
// VisitorStat counter. Public (no auth) so anonymous guests count too; writes
// use the service role so RLS can't block them. Each caller IP counts once per
// day (stored as hashed IP marks on the day's record). Returns the day's
// total. Duplicate records for the same date are tolerated — the totals are
// summed, so concurrent first-of-day calls never lose a count.
export default async function(req) {
  try {
    let payload = {};
    try { payload = await req.json(); } catch (e) { payload = {}; }
    let date = typeof payload.date === 'string' ? payload.date : '';
    if (!DATE_RE.test(date)) date = todayLocalDate();

    const base44 = createClientFromRequest(req);
    const recs = await base44.asServiceRole.entities.VisitorStat.filter({ date }, 'created_date', 10);
    const master = recs[0];
    const ipKey = ipHash(callerIp(req));
    const masterIps = master && master.ips && typeof master.ips === 'object' && !Array.isArray(master.ips) ? master.ips : {};

    if (master && (masterIps[ipKey] || 0) >= IP_CAP) {
      // Already counted this visitor today — return the current total.
      const all = await base44.asServiceRole.entities.VisitorStat.filter({ date }, 'created_date', 10);
      const count = all.reduce((s, r) => s + (r.count || 0), 0);
      return Response.json({ date, count, alreadyCounted: true });
    }

    if (master) {
      const ips = { ...masterIps };
      ips[ipKey] = (ips[ipKey] || 0) + 1;
      await base44.asServiceRole.entities.VisitorStat.update(master.id, {
        count: (master.count || 0) + 1,
        ips,
      });
    } else {
      await base44.asServiceRole.entities.VisitorStat.create({
        date,
        count: 1,
        ips: { [ipKey]: 1 },
      });
    }

    const all = await base44.asServiceRole.entities.VisitorStat.filter({ date }, 'created_date', 10);
    const count = all.reduce((s, r) => s + (r.count || 0), 0);
    return Response.json({ date, count });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}