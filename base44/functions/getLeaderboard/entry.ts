import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Aggregates finished Truth Chess games into a per-player win ranking.
// Runs as the service role so it can read all games and resolve every
// player's display name — any logged-in user can call it.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const games = await base44.asServiceRole.entities.Game.list('-created_date', 1000);
    const users = await base44.asServiceRole.entities.User.list('-created_date', 1000);

    const nameById = new Map();
    for (const u of users) {
      nameById.set(u.id, u.full_name || u.email || u.id);
    }

    const GHOST = '__ghost__';
    const wins = new Map();
    const played = new Map();

    for (const g of games) {
      const w = g.white_player_id;
      const b = g.black_player_id;
      if (w && w !== GHOST) played.set(w, (played.get(w) || 0) + 1);
      if (b && b !== GHOST) played.set(b, (played.get(b) || 0) + 1);
      if (g.result === 'white_wins' && w && w !== GHOST) {
        wins.set(w, (wins.get(w) || 0) + 1);
      } else if (g.result === 'black_wins' && b && b !== GHOST) {
        wins.set(b, (wins.get(b) || 0) + 1);
      }
    }

    const ids = new Set([...wins.keys(), ...played.keys()]);
    const rows = [...ids].map((id) => ({
      user_id: id,
      name: nameById.get(id) || 'Anonymous',
      wins: wins.get(id) || 0,
      games: played.get(id) || 0,
    }));
    rows.sort((a, b) => b.wins - a.wins || b.games - a.games);

    return Response.json({ leaderboard: rows });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}