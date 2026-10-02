import type { Member, Room } from "../../games/types";
import { randomInt } from "node:crypto";
export function ability(m: Member) {
  const values = Object.values(m.abilities);
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : 0.5;
}
export function assignTeams(room: Room, smart = false) {
  const members = room.members.filter((m) => !m.removed);
  const teams = room.teams;
  const size = Math.ceil(members.length / teams.length);
  const buckets = teams.map((t) => ({
    id: t.id,
    members: members.filter((m) => m.locked && m.teamId === t.id),
  }));
  const movable = members.filter(
    (m) => !m.locked || !teams.some((t) => t.id === m.teamId),
  );
  if (smart) movable.sort((a, b) => ability(b) - ability(a));
  else
    for (let i = movable.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [movable[i], movable[j]] = [movable[j], movable[i]];
    }
  for (const m of movable) {
    const ranked = buckets
      .filter((b) => b.members.length < size)
      .sort(
        (a, b) =>
          a.members.length - b.members.length ||
          (smart
            ? a.members.reduce((s, p) => s + ability(p), 0) -
              b.members.reduce((s, p) => s + ability(p), 0)
            : 0),
      );
    const bucket =
      ranked[0] ??
      buckets.slice().sort((a, b) => a.members.length - b.members.length)[0];
    bucket.members.push(m);
    m.teamId = bucket.id;
  }
  const cost = () => {
    const avg = members.reduce((s, m) => s + ability(m), 0) / teams.length;
    return buckets.reduce(
      (total, b) =>
        total +
        Math.pow(b.members.reduce((s, m) => s + ability(m), 0) - avg, 2) * 10 +
        b.members.reduce(
          (sum, m, i) =>
            sum +
            b.members
              .slice(i + 1)
              .reduce(
                (n, p) =>
                  n +
                  (room.pairings[[m.id, p.id].sort().join(":")] ?? 0) * 0.02,
                0,
              ),
          0,
        ),
      0,
    );
  };
  if (smart)
    for (let iteration = 0; iteration < 20; iteration++) {
      let improved = false;
      for (let a = 0; a < buckets.length; a++)
        for (let b = a + 1; b < buckets.length; b++)
          for (let i = 0; i < buckets[a].members.length; i++)
            for (let j = 0; j < buckets[b].members.length; j++) {
              const x = buckets[a].members[i],
                y = buckets[b].members[j];
              if (x.locked || y.locked) continue;
              const before = cost();
              [buckets[a].members[i], buckets[b].members[j]] = [y, x];
              if (cost() + 0.00001 < before) {
                y.teamId = buckets[a].id;
                x.teamId = buckets[b].id;
                improved = true;
              } else [buckets[a].members[i], buckets[b].members[j]] = [x, y];
            }
      if (!improved) break;
    }
}
