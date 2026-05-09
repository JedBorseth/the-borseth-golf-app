export type PlayerRecord = {
  id: string
  name: string
  teamId: string
}

export const COURSE_NAME = 'Cultus Lake Golf Club'

/** Back of official scorecard (reference). */
export const SCORECARD_IMAGE_URL =
  'https://golfcultus.com/wp-content/uploads/2024/02/2021-CLGC-Scorecard-Back.webp'

const HOLE_IMAGE_BASE = 'https://golfcultus.com/wp-content/uploads/2024/03'

export function cultusHoleImageSrc(hole: number): string {
  if (hole === 1) return `${HOLE_IMAGE_BASE}/hole1-1.webp`
  if (hole === 14) return `${HOLE_IMAGE_BASE}/Hole14-1.webp`
  if (hole === 16) {
    return `${HOLE_IMAGE_BASE}/Hole16-e1561986125589.webp`
  }
  return `${HOLE_IMAGE_BASE}/hole${hole}.webp`
}

/** Par and white-tee yardages from Cultus Lake GC scorecard. */
const HOLE_PAR = [3, 3, 3, 4, 4, 5, 3, 3, 4, 4, 4, 4, 3, 3, 4, 3, 3, 3] as const

const WHITE_YARDS = [
  167, 121, 167, 314, 330, 371, 86, 97, 200, 210, 300, 222, 160, 133, 236, 140,
  121, 136,
] as const

/** Short descriptions from Cultus Lake GC hole pages (golfcultus.com astra-portfolio). */
const HOLE_DESCRIPTIONS = [
  'A good test to start your round. 193-yard narrow fairway to sheltered green. Green slopes slightly right to left.',
  'Short par three with a large tree blocking the front left side of the green. Severe back to front sloping green.',
  'Long narrow tree lined fairway with a sand trap short right. Long double green that is shared with #5.',
  'Narrow par four that entices you to use your driver. Stay in the fairway, its the only way to approach the green with a large tree blocking the right corner and traps to the left. Very wide green that slopes gently back to front.',
  'Long par four. Stay left off the tee to avoid fairway bunker and forest to the right. Large double green (shared with #3). Gradual sloping back to front.',
  'The only par five on the course. Play your tee shot to the right, enabling you to reach the dogleg. This gives you a clear approach shot to the green that is guarded by 2 bunkers.',
  'Very short par three with a massive tree blocking the front right of the green. Consider playing a low bump and run to reach this green.',
  'Another short par three. Pond on the left, and two small bunkers in front of the green left and right should prevent a bump and run shot here. Severe back to front sloping green.',
  'Great way to finish the front nine, and turn your score around. This short par four is drivable but large mounds short right of the green with a trap in front and two ponds behind will make you think twice. Green slopes back to front.',
  'This short dogleg offers a risk reward opportunity. A lay-up leaves you with a short chip to a two tiered gently sloping right to left green.',
  'Re-built in memory of Shane Van Vliet. One of the smaller greens on the course that drops down below the fairway, protected by a bunker on the left.',
  'Par four with a different pond to tee shot. 175 yard shot off the tee will stop just short of this pond. 220 to carry the pond from the tee. Traps guard this long narrow back to front sloping green both left and right.',
  'The toughest par three on the course. Deep trap short right of this small flat green. Pond in front of the tee box intimidates most golfers.',
  'Short par three, but there are no gimmies on this green, as it is the most undulating green on this course. Trap short and left.',
  'Narrow par four that entices you to use your driver. Stay in the fairway, its the only way to approach the green with a large tree blocking the right corner and traps to the left. Very wide green that slopes gently back to front.',
  'Very narrow tunnel of trees off the tee. Trap on the left of this right to left, and back to front sloping green.',
  'Short par three that is heavily guarded by 4 bunkers. Right to the left sloping green.',
  'Picturesque par 3 with a fountain decorated pond. Severe back to front left to right sloping green. The smart play here to shoot for the right side of the green, and take your chances putting.',
] as const

export type HoleMeta = {
  hole: number
  par: number
  whiteYards: number
  imageSrc: string
  description: string
}

export const HOLE_META: Array<HoleMeta> = HOLE_PAR.map((par, i) => {
  const hole = i + 1
  return {
    hole,
    par,
    whiteYards: WHITE_YARDS[i] ?? 0,
    imageSrc: cultusHoleImageSrc(hole),
    description: HOLE_DESCRIPTIONS[i] ?? '',
  }
})

export function parForHole(hole: number): number | undefined {
  return HOLE_META[hole - 1]?.par
}

/** Default display names (edit on setup). */
export const TEAM_LABELS: Record<string, string> = {
  t1: 'Team Fairway',
  t2: 'Team Bunker',
  t3: 'Team Tap-In',
  t4: 'Team Mulligan',
  t5: 'Team Eagle',
}

export const PLAYERS: Array<PlayerRecord> = [
  { id: 'p6', name: 'Max', teamId: 't1' },
  { id: 'p5', name: 'Kathi', teamId: 't1' },
  { id: 'p7', name: 'Jones', teamId: 't1' },

  { id: 'p1', name: 'Jason', teamId: 't2' },
  { id: 'p14', name: 'Josh D', teamId: 't2' },
  { id: 'p17', name: 'Lexi', teamId: 't2' },

  { id: 'p8', name: 'Jed', teamId: 't3' },
  { id: 'p10', name: 'Mary-Liz', teamId: 't3' },
  { id: 'p2', name: 'Jasmine', teamId: 't3' },
  { id: 'p11', name: 'Emily', teamId: 't3' },

  { id: 'p13', name: 'Josh B', teamId: 't4' },
  { id: 'p12', name: 'Lily', teamId: 't4' },
  { id: 'p4', name: 'Blake', teamId: 't4' },

  { id: 'p15', name: 'Mike B', teamId: 't5' },
  { id: 'p16', name: 'Mike P', teamId: 't5' },
  { id: 'p3', name: 'Hannah', teamId: 't5' },
  { id: 'p9', name: 'Andrea', teamId: 't5' },
]

export function teammatesForPlayer(playerId: string): Array<PlayerRecord> {
  const player = PLAYERS.find((p) => p.id === playerId)
  if (!player) return []
  return PLAYERS.filter((p) => p.teamId === player.teamId).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
}

/** House rule: minimum tee-ball picks per player per round (no enforced maximum). */
export function minTeeShotsRequiredPerPlayer(_teamSize: number): number {
  return 3
}

export function playerNameById(playerId: string): string | undefined {
  return PLAYERS.find((p) => p.id === playerId)?.name
}

/** Comma-separated roster labels from stable team id (works with custom display team names). */
export function firstNamesLineForTeamId(
  teamId: string | null | undefined,
): string {
  if (!teamId || !TEAM_LABELS[teamId]) return ''
  return PLAYERS.filter((p) => p.teamId === teamId)
    .map((p) => p.name)
    .join(', ')
}

/** @deprecated Prefer firstNamesLineForTeamId when Convex returns teamId. */
export function firstNamesLineForTeamName(teamName: string): string {
  const teamId = Object.entries(TEAM_LABELS).find(
    ([, label]) => label === teamName,
  )?.[0]
  return firstNamesLineForTeamId(teamId)
}
