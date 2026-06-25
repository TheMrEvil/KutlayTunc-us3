// Sync groups — keep looping clips of different lengths phase-matched (Unreal sync
// groups). A leader is chosen (highest weight / role), and followers are placed at
// the same normalized phase so feet/strides line up while blending.

export type SyncRole = 'canLead' | 'alwaysLeader' | 'follower';

export interface SyncMember {
  id: string;
  weight: number;
  duration: number;
  role?: SyncRole;
}

/** Place a follower at the leader's normalized phase. */
export function syncedTime(leaderTime: number, leaderDuration: number, followerDuration: number): number {
  if (leaderDuration <= 0) return 0;
  const phase = (leaderTime % leaderDuration) / leaderDuration;
  return phase * followerDuration;
}

/** Pick the sync-group leader: an `alwaysLeader` wins, else the highest-weight
 *  member eligible to lead (`canLead`/undefined). Returns null if none eligible. */
export function pickLeader(members: SyncMember[]): SyncMember | null {
  const always = members.find((m) => m.role === 'alwaysLeader');
  if (always) return always;
  let best: SyncMember | null = null;
  for (const m of members) {
    if (m.role === 'follower') continue;
    if (!best || m.weight > best.weight) best = m;
  }
  return best;
}

/** Given members + the leader's current time, return each member's synced time. */
export function resolveSync(members: SyncMember[], leaderTime: number): Record<string, number> {
  const leader = pickLeader(members);
  const out: Record<string, number> = {};
  if (!leader) { for (const m of members) out[m.id] = 0; return out; }
  for (const m of members) out[m.id] = m.id === leader.id ? leaderTime % m.duration : syncedTime(leaderTime, leader.duration, m.duration);
  return out;
}
