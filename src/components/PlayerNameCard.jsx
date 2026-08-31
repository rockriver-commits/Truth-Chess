import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// One-time prompt for a registered player to pick a display name (shown in
// the lobby instead of their email/real name). Hidden once a name is saved.
export default function PlayerNameCard({ currentName, onSave }) {
  const [name, setName] = useState(currentName || '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5 space-y-3">
      <p className="text-xs uppercase tracking-widest text-stone-400">Your player name</p>
      <p className="text-sm text-stone-500">
        Pick a name other players see in the lobby. Your email stays private.
      </p>
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. NightOwl"
          maxLength={24}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <Button onClick={submit} disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}