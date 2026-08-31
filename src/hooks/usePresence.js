// Live presence for the online lobby. Each visitor heartbeats a Presence
// record (registered users use their user id + chosen player name; guests use
// a stable localStorage id and show as "Anonymous"). The lobby reads the
// list and filters out stale heartbeats.
import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const STALE_MS = 60000; // consider a player offline if no heartbeat for 60s
const HEARTBEAT_MS = 15000; // refresh our heartbeat every 15s

export function usePresence(identity) {
  const [online, setOnline] = useState([]);
  const myRecId = useRef(null);

  // Heartbeat: upsert our own presence record.
  useEffect(() => {
    if (!identity?.id) return undefined;
    let cancelled = false;
    const beat = async () => {
      try {
        const now = new Date().toISOString();
        const existing = await base44.entities.Presence.filter({ identity_id: identity.id }, '-last_seen', 5);
        if (cancelled) return;
        if (existing && existing.length) {
          myRecId.current = existing[0].id;
          await base44.entities.Presence.update(existing[0].id, {
            player_name: identity.player_name || 'Anonymous',
            is_guest: !!identity.is_guest,
            last_seen: now,
          });
        } else {
          const rec = await base44.entities.Presence.create({
            identity_id: identity.id,
            player_name: identity.player_name || 'Anonymous',
            is_guest: !!identity.is_guest,
            last_seen: now,
          });
          if (!cancelled) myRecId.current = rec.id;
        }
      } catch (e) {
        // heartbeat failure is non-fatal (e.g. transient network)
      }
    };
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [identity?.id, identity?.player_name, identity?.is_guest]);

  // Remove our presence when leaving the page.
  useEffect(() => {
    return () => {
      if (myRecId.current) {
        base44.entities.Presence.delete(myRecId.current).catch(() => {});
        myRecId.current = null;
      }
    };
  }, []);

  // Live list of currently-online players.
  useEffect(() => {
    const refresh = async () => {
      try {
        const list = await base44.entities.Presence.list('-last_seen', 200);
        const cutoff = Date.now() - STALE_MS;
        setOnline((list || []).filter((p) => new Date(p.last_seen).getTime() > cutoff));
      } catch (e) {
        // ignore
      }
    };
    refresh();
    const unsub = base44.entities.Presence.subscribe(() => {
      refresh();
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  return online;
}