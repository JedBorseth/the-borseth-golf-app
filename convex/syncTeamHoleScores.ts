import { ConvexError } from 'convex/values'

import { rosterPlayerIdsForTeamId } from './golfRoster'
import type { MutationCtx } from './_generated/server'
import {
  canonicalTeamDisplayNameForTeamId,
  unifyHoleScoreDocsToTeamDisplayName,
} from './teamHoleScoreCanon'

export type HoleScoreRow = {
  hole: number
  strokes: number
  teePlayerId: string
}

/**
 * Replaces server rows for (teamName) with the provided holes snapshot.
 * Used by admin flows.
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

  const allRowsBefore = await ctx.db.query('teamHoleScores').collect()
  const rowsToRemove = allRowsBefore.filter((r) => {
    const matchesTeamId = r.teamId === args.teamId
    const legacyCanonical =
      !r.teamId && r.teamName === args.teamName.trim()
    return matchesTeamId || legacyCanonical
  })
  for (const row of rowsToRemove) {
    await ctx.db.delete('teamHoleScores', row._id)
  }

  for (const h of uniqueHoles) {
    await ctx.db.insert('teamHoleScores', {
      teamName: args.teamName.trim(),
      teamId: args.teamId,
      hole: h.hole,
      strokes: h.strokes,
      teePlayerId: h.teePlayerId,
    })
  }
}

/**
 * Upserts holes for (teamName). Rows for holes not in the payload are left unchanged.
 * Used by player syncFullScorecard so partial payloads cannot wipe teammate holes.
 */
export async function upsertTeamHoleScores(
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

  const trimmedClient = args.teamName.trim()

  for (const h of uniqueHoles) {
    let rowsSnap = await ctx.db.query('teamHoleScores').collect()
    const canonicalName =
      canonicalTeamDisplayNameForTeamId(args.teamId, rowsSnap) ??
      trimmedClient

    let sameHole = rowsSnap.filter(
      (r) => r.teamId === args.teamId && r.hole === h.hole,
    )
    sameHole.sort((a, b) => (a._id < b._id ? -1 : 1))

    while (sameHole.length > 1) {
      const dup = sameHole[sameHole.length - 1]
      if (!dup) break
      await ctx.db.delete('teamHoleScores', dup._id)
      rowsSnap = rowsSnap.filter((r) => r._id !== dup._id)
      sameHole = sameHole.slice(0, -1)
    }

    const existing = rowsSnap.find(
      (r) => r.teamId === args.teamId && r.hole === h.hole,
    )

    if (existing) {
      await ctx.db.patch('teamHoleScores', existing._id, {
        teamName: canonicalName,
        teamId: args.teamId,
        strokes: h.strokes,
        teePlayerId: h.teePlayerId,
      })
    } else {
      await ctx.db.insert('teamHoleScores', {
        teamName: canonicalName,
        teamId: args.teamId,
        hole: h.hole,
        strokes: h.strokes,
        teePlayerId: h.teePlayerId,
      })
    }
  }

  let finalRows = await ctx.db.query('teamHoleScores').collect()
  const finalCanon =
    canonicalTeamDisplayNameForTeamId(args.teamId, finalRows) ??
    trimmedClient
  await unifyHoleScoreDocsToTeamDisplayName(
    ctx,
    finalRows,
    args.teamId,
    finalCanon,
  )
}
