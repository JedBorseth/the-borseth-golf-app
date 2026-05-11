import { ConvexError, v } from 'convex/values'
import { parForHole } from '../src/lib/golf-data'
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { rosterPlayerIdsForTeamId } from './golfRoster'
import { upsertTeamHoleScores } from './syncTeamHoleScores'
import {
  canonicalTeamDisplayNameForTeamId,
  SETUP_PLACEHOLDER_HOLE,
  unifyHoleScoreDocsToTeamDisplayName,
} from './teamHoleScoreCanon'

export { SETUP_PLACEHOLDER_HOLE } from './teamHoleScoreCanon'

export const teamDisplayNameOnServer = query({
  args: { teamId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query('teamHoleScores').collect()
    return canonicalTeamDisplayNameForTeamId(args.teamId, rows)
  },
})

export const ensureTeamPlaceholderScorecard = mutation({
  args: {
    teamId: v.string(),
    teamName: v.string(),
  },
  handler: async (ctx, args) => {
    const roster = rosterPlayerIdsForTeamId(args.teamId)
    if (roster.length === 0) {
      throw new ConvexError('Unknown team')
    }

    const name = args.teamName.trim()
    if (!name) {
      throw new ConvexError('Team name is required')
    }

    let allRows = await ctx.db.query('teamHoleScores').collect()
    const teamRows = allRows.filter((r) => r.teamId === args.teamId)
    const hasPlayableHole = teamRows.some(
      (r) => r.hole >= 1 && r.hole <= 18,
    )

    if (teamRows.length === 0) {
      await ctx.db.insert('teamHoleScores', {
        teamName: name,
        teamId: args.teamId,
        hole: SETUP_PLACEHOLDER_HOLE,
        strokes: 0,
      })
    } else if (!hasPlayableHole) {
      // Pre-round setup only: teammate devices may confirm with different names;
      // adopt this confirmation so server canon and leaderboard stay coherent.
      await unifyHoleScoreDocsToTeamDisplayName(ctx, allRows, args.teamId, name)
    }

    allRows = await ctx.db.query('teamHoleScores').collect()
    const finalCanon =
      canonicalTeamDisplayNameForTeamId(args.teamId, allRows) ?? name

    return { teamDisplayName: finalCanon }
  },
})

export const leaderboard = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('teamHoleScores').collect()
    const byTeam = new Map<
      string,
      {
        teamId: string | undefined
        displayName: string
        vsPar: number
        holes: Set<number>
      }
    >()

    for (const row of rows) {
      const par = parForHole(row.hole)
      if (par === undefined) continue

      const key = row.teamId ?? row.teamName
      const cur = byTeam.get(key)
      if (!cur) {
        byTeam.set(key, {
          teamId: row.teamId,
          displayName: row.teamName,
          vsPar: row.strokes - par,
          holes: new Set([row.hole]),
        })
      } else {
        if (row.teamId) cur.teamId = row.teamId
        cur.displayName = row.teamName
        cur.vsPar += row.strokes - par
        cur.holes.add(row.hole)
      }
    }

    const entries = [...byTeam.values()].map((stats) => ({
      teamName: stats.displayName,
      teamId: stats.teamId ?? null,
      relativeToPar: stats.vsPar,
      holesPlayed: stats.holes.size,
    }))

    entries.sort((a, b) => {
      const af = a.holesPlayed >= 18 ? 0 : 1
      const bf = b.holesPlayed >= 18 ? 0 : 1
      if (af !== bf) return af - bf
      return a.relativeToPar - b.relativeToPar
    })

    return entries
  },
})

export const scoresForTeam = query({
  args: { teamName: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('teamHoleScores')
      .withIndex('by_team_hole', (q) => q.eq('teamName', args.teamName))
      .collect()

    const strokes: Record<string, number> = {}
    const teePlayerIdByHole: Record<string, string> = {}

    for (const row of rows) {
      if (row.hole < 1 || row.hole > 18) continue
      strokes[String(row.hole)] = row.strokes
      if (row.teePlayerId) {
        teePlayerIdByHole[String(row.hole)] = row.teePlayerId
      }
    }

    return { strokes, teePlayerIdByHole }
  },
})

export const submitHoleScore = mutation({
  args: {
    teamName: v.string(),
    teamId: v.string(),
    hole: v.number(),
    strokes: v.number(),
    teePlayerId: v.string(),
  },
  handler: async (ctx, args) => {
    const roster = rosterPlayerIdsForTeamId(args.teamId)
    if (roster.length === 0) {
      throw new ConvexError('Unknown team')
    }
    if (!roster.includes(args.teePlayerId)) {
      throw new ConvexError('Tee player not on this team')
    }

    let rowsSnap = await ctx.db.query('teamHoleScores').collect()
    const clientName = args.teamName.trim()
    const canonicalName =
      canonicalTeamDisplayNameForTeamId(args.teamId, rowsSnap) ?? clientName

    let sameHole = rowsSnap.filter(
      (r) => r.teamId === args.teamId && r.hole === args.hole,
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
      (r) => r.teamId === args.teamId && r.hole === args.hole,
    )

    let resultId: Id<'teamHoleScores'>

    if (existing) {
      await ctx.db.patch('teamHoleScores', existing._id, {
        teamName: canonicalName,
        teamId: args.teamId,
        strokes: args.strokes,
        teePlayerId: args.teePlayerId,
      })
      resultId = existing._id
    } else {
      resultId = await ctx.db.insert('teamHoleScores', {
        teamName: canonicalName,
        teamId: args.teamId,
        hole: args.hole,
        strokes: args.strokes,
        teePlayerId: args.teePlayerId,
      })
    }

    rowsSnap = await ctx.db.query('teamHoleScores').collect()
    const finalCanon =
      canonicalTeamDisplayNameForTeamId(args.teamId, rowsSnap) ??
      canonicalName
    await unifyHoleScoreDocsToTeamDisplayName(
      ctx,
      rowsSnap,
      args.teamId,
      finalCanon,
    )

    return resultId
  },
})

/**
 * Upsert scored holes for this team. Holes omitted from the payload are not deleted
 * (teammate devices may send partial updates). Send every scored hole you know about.
 */
export const syncFullScorecard = mutation({
  args: {
    teamName: v.string(),
    teamId: v.string(),
    holes: v.array(
      v.object({
        hole: v.number(),
        strokes: v.number(),
        teePlayerId: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await upsertTeamHoleScores(ctx, args)
  },
})

/** Deletes server rows for one hole (sync upserts only — clears need an explicit delete). */
export const clearHoleScore = mutation({
  args: {
    teamName: v.string(),
    teamId: v.string(),
    hole: v.number(),
  },
  handler: async (ctx, args) => {
    const roster = rosterPlayerIdsForTeamId(args.teamId)
    if (roster.length === 0) {
      throw new ConvexError('Unknown team')
    }
    if (args.hole < 1 || args.hole > 18) {
      throw new ConvexError('Invalid hole')
    }
    const rows = await ctx.db.query('teamHoleScores').collect()
    const matches = rows.filter(
      (r) => r.teamId === args.teamId && r.hole === args.hole,
    )
    for (const row of matches) {
      await ctx.db.delete('teamHoleScores', row._id)
    }
  },
})
