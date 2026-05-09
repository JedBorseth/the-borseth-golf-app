/**
 * Mirror of src/lib/golf-data (team structure) for server-side validation.
 */
export const TEAM_LABELS: Record<string, string> = {
  t1: 'Team Fairway',
  t2: 'Team Bunker',
  t3: 'Team Tap-In',
  t4: 'Team Mulligan',
  t5: 'Team Eagle',
}

/** Keep in sync with PLAYERS in src/lib/golf-data.ts (id + teamId only). */
export const PLAYERS: Array<{ id: string; teamId: string }> = [
  { id: 'p6', teamId: 't1' },
  { id: 'p5', teamId: 't1' },
  { id: 'p7', teamId: 't1' },

  { id: 'p1', teamId: 't2' },
  { id: 'p14', teamId: 't2' },
  { id: 'p17', teamId: 't2' },

  { id: 'p8', teamId: 't3' },
  { id: 'p10', teamId: 't3' },
  { id: 'p2', teamId: 't3' },
  { id: 'p11', teamId: 't3' },

  { id: 'p13', teamId: 't4' },
  { id: 'p12', teamId: 't4' },
  { id: 'p4', teamId: 't4' },

  { id: 'p15', teamId: 't5' },
  { id: 'p16', teamId: 't5' },
  { id: 'p3', teamId: 't5' },
  { id: 'p9', teamId: 't5' },
]

export function rosterPlayerIdsForTeamId(teamId: string): Array<string> {
  if (!TEAM_LABELS[teamId]) return []
  return PLAYERS.filter((p) => p.teamId === teamId).map((p) => p.id)
}
