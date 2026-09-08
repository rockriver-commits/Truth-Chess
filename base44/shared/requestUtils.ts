// Shared helpers for the public per-day counters (games played, site visits).
// Plain module — imported by backend functions, never served on its own.

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayLocalDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Best-effort caller IP from the platform's forwarded headers.
export function callerIp(req) {
  const fwd = req.headers.get('x-forwarded-for') || '';
  const first = fwd.split(',')[0].trim();
  if (first) return first;
  return (req.headers.get('x-real-ip') || '').trim();
}

// djb2 hash — store IP hashes, not raw IPs, for privacy.
export function ipHash(ip) {
  let h = 5381;
  for (let i = 0; i < ip.length; i++) h = ((h << 5) + h + ip.charCodeAt(i)) >>> 0;
  return h.toString(36);
}