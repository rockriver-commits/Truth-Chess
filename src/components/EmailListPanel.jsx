import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

// Admin-only: lists every registered player's email so the app owner can
// export the mailing list. Non-admins never render this panel, and the
// underlying User list is admin-only by built-in row-level security.
export default function EmailListPanel() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function load() {
    setError('');
    try {
      const list = await base44.entities.User.list('-created_date', 1000);
      setUsers(list || []);
    } catch (e) {
      setError('Could not load players.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  const emails = (users || []).map((u) => u.email).filter(Boolean);
  const emailsText = emails.join('\n');

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(emailsText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-400">Admin</p>
          <h2 className="text-lg font-display font-semibold text-stone-800">Registered players</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
          <Button size="sm" variant="outline" onClick={copyAll} disabled={!emails.length}>
            {copied ? 'Copied!' : 'Copy emails'}
          </Button>
        </div>
      </div>
      {users === null ? (
        <p className="text-sm text-stone-400">Loading…</p>
      ) : error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : emails.length === 0 ? (
        <p className="text-sm text-stone-400">No registered players yet.</p>
      ) : (
        <>
          <p className="text-xs text-stone-500">
            {emails.length} player{emails.length === 1 ? '' : 's'}
          </p>
          <div className="max-h-72 overflow-y-auto rounded-lg ring-1 ring-stone-200 divide-y divide-stone-100">
            {users.map((u) => (
              <div key={u.id} className="px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-sm text-stone-700 truncate">{u.email || '(no email)'}</span>
                <span className="text-[0.65rem] uppercase tracking-widest text-stone-400">{u.role}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}