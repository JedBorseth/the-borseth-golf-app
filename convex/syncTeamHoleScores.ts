import { ConvexError } from 'convex/values'

import { rosterPlayerIdsForTeamId } from './golfRoster'
import type { MutationCtx } from './_generated/server'

export type HoleScoreRow = {
  hole: number
  strokes: number
  teePlayerId: string
}

/**
 * Replaces server rows for (teamName) with the provided holes snapshot.
 * Used by syncFullScorecard and admin flows.
 */
export async function replaceFullTeamHoleScores(
  ctx: MutationCtx,
  args: {
    teamName: string
    teamId: string
    holes: Array<HoleScoreRow>
  },
): Promise<void> {
  const roster = rosterPlayerIdsForTeamId(args.teamId)
  if (roster.length === 0) {
    throw new ConvexError('Unknown team')
  }

  const byHole = new Map<number, HoleScoreRow>()
  for (const h of args.holes) {
    byHole.set(h.hole, h)
  }
  const uniqueHoles = [...byHole.values()].sort((a, b) => a.hole - b.hole)

  for (const h of uniqueHoles) {
    if (h.hole < 1 || h.hole > 18) {
      throw new ConvexError('Invalid hole')
    }
    if (!roster.includes(h.teePlayerId)) {
      throw new ConvexError(`Tee player not on this team (hole ${h.hole})`)
    }
  }

  const existing = await ctx.db
    .query('teamHoleScores')
    .withIndex('by_team_hole', (q) => q.eq('teamName', args.teamName))
    .collect()

  for (const row of existing) {
    await ctx.db.delete('teamHoleScores', row._id)
  }

  for (const h of uniqueHoles) {
    await ctx.db.insert('teamHoleScores', {
      teamName: args.teamName,
      teamId: args.teamId,
      hole: h.hole,
      strokes: h.strokes,
      teePlayerId: h.teePlayerId,
    })
  }
}
