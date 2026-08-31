import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayLocalDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Records one game played on the given date by incrementing that date's
// DailyStat counter. Public (no auth) so anonymous guests' games count too;
// writes use the service role so RLS can't block them. Returns the day's new
// total. Duplicate records for the same date are tolerated — the caller sums
// all of them, so concurrent first-of-day calls never lose a count.
export default async function(req) {
  try {
    let payload = {};
    try { payload = await req.json(); } catch (e) { payload = {}; }
    let date = typeof payload.date === 'string' ? payload.date : '';
    if (!DATE_RE.test(date)) date = todayLocalDate();

    const base44 = createClientFromRequest(req);
    const recs = await base44.asServiceRole.entities.DailyStat.filter({ date }, 'created_date', 10);
    if (recs.length > 0) {
      await base44.asServiceRole.entities.DailyStat.update(recs[0].id, {
        count: (recs[0].count || 0) + 1,
      });
    } else {
      await base44.asServiceRole.entities.DailyStat.create({ date, count: 1 });
    }

    const all = await base44.asServiceRole.entities.DailyStat.filter({ date }, 'created_date', 10);
    const count = all.reduce((s, r) => s + (r.count || 0), 0);
    return Response.json({ date, count });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}