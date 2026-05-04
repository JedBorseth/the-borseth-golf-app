import { ConvexError, v } from 'convex/values'
import { parForHole } from '../src/lib/golf-data'
import { mutation, query } from './_generated/server'
import { rosterPlayerIdsForTeamId } from './golfRoster'

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

    const existing = await ctx.db
      .query('teamHoleScores')
      .withIndex('by_team_hole', (q) =>
        q.eq('teamName', args.teamName).eq('hole', args.hole),
      )
      .unique()

    if (existing) {
      await ctx.db.patch('teamHoleScores', existing._id, {
        teamName: args.teamName,
        teamId: args.teamId,
        strokes: args.strokes,
        teePlayerId: args.teePlayerId,
      })
      return existing._id
    }

    return await ctx.db.insert('teamHoleScores', {
      teamName: args.teamName,
      teamId: args.teamId,
      hole: args.hole,
      strokes: args.strokes,
      teePlayerId: args.teePlayerId,
    })
  },
})

/**
 * Replace this team's entire scorecard on the server. Clients should send every
 * scored hole so nothing is missed after offline play (full round snapshot).
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
    const roster = rosterPlayerIdsForTeamId(args.teamId)
    if (roster.length === 0) {
      throw new ConvexError('Unknown team')
    }

    const byHole = new Map<
      number,
      { hole: number; strokes: number; teePlayerId: string }
    >()
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
  },
})
