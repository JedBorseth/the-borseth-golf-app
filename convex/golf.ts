import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  maxTeeDrivesPerPlayer,
  rosterPlayerIdsForTeamId,
} from './golfRoster'

export const leaderboard = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('teamHoleScores').collect()
    const byTeam = new Map<
      string,
      {
        teamId: string | undefined
        displayName: string
        total: number
        holes: Set<number>
      }
    >()

    for (const row of rows) {
      const key = row.teamId ?? row.teamName
      const cur = byTeam.get(key)
      if (!cur) {
        byTeam.set(key, {
          teamId: row.teamId,
          displayName: row.teamName,
          total: row.strokes,
          holes: new Set([row.hole]),
        })
      } else {
        if (row.teamId) cur.teamId = row.teamId
        cur.displayName = row.teamName
        cur.total += row.strokes
        cur.holes.add(row.hole)
      }
    }

    const entries = [...byTeam.values()].map((stats) => ({
      teamName: stats.displayName,
      teamId: stats.teamId ?? null,
      totalStrokes: stats.total,
      holesPlayed: stats.holes.size,
    }))

    entries.sort((a, b) => {
      const af = a.holesPlayed >= 18 ? 0 : 1
      const bf = b.holesPlayed >= 18 ? 0 : 1
      if (af !== bf) return af - bf
      return a.totalStrokes - b.totalStrokes
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

    const cap = maxTeeDrivesPerPlayer()

    const teamRows = await ctx.db
      .query('teamHoleScores')
      .withIndex('by_team_hole', (q) => q.eq('teamName', args.teamName))
      .collect()

    const usage = new Map<string, number>()
    for (const row of teamRows) {
      if (row.hole === args.hole) continue
      if (!row.teePlayerId) continue
      usage.set(
        row.teePlayerId,
        (usage.get(row.teePlayerId) ?? 0) + 1,
      )
    }

    const nextCount = (usage.get(args.teePlayerId) ?? 0) + 1
    if (nextCount > cap) {
      throw new ConvexError(
        `Each player can only be tee player up to ${cap} times per round`,
      )
    }

    const existing = await ctx.db
      .query('teamHoleScores')
      .withIndex('by_team_hole', (q) =>
        q.eq('teamName', args.teamName).eq('hole', args.hole),
      )
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
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
