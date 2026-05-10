import type { Doc } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'

/** Row used only until the first scoring row exists (see golf.ensureTeamPlaceholderScorecard). */
export const SETUP_PLACEHOLDER_HOLE = 0

export type TeamHoleScoreDoc = Doc<'teamHoleScores'>

/**
 * One display name string per team id: prefers names on playable holes over the setup
 * placeholder so renames propagate correctly.
 */
export function canonicalTeamDisplayNameForTeamId(
  teamId: string,
  allRows: Array<TeamHoleScoreDoc>,
): string | null {
  const mine = allRows.filter((r) => r.teamId === teamId)
  if (mine.length === 0) return null

  const playable = mine.filter((r) => r.hole >= 1 && r.hole <= 18)
  if (playable.length > 0) {
    const counts = new Map<string, number>()
    for (const r of playable) {
      counts.set(r.teamName, (counts.get(r.teamName) ?? 0) + 1)
    }
    let best: string | null = null
    let bestN = -1
    for (const [name, n] of counts) {
      if (n > bestN) {
        bestN = n
        best = name
      }
    }
    return best
  }

  const ph = mine.find((r) => r.hole === SETUP_PLACEHOLDER_HOLE)
  if (ph) return ph.teamName
  return mine[0]?.teamName ?? null
}

/** Ensure every Convex row for this team uses the canonical display string (indexes are by teamName). */
export async function unifyHoleScoreDocsToTeamDisplayName(
  ctx: MutationCtx,
  rows: Array<TeamHoleScoreDoc>,
  teamId: string,
  canonical: string,
): Promise<void> {
  for (const row of rows) {
    if (row.teamId !== teamId || row.teamName === canonical) continue
    await ctx.db.patch('teamHoleScores', row._id, {
      teamName: canonical,
      teamId,
    })
  }
}
