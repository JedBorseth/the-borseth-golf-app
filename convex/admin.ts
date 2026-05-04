import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { TEAM_LABELS } from './golfRoster'
import { replaceFullTeamHoleScores } from './syncTeamHoleScores'

function adminPinMatches(pin: string): boolean {
  const expected = process.env.ADMIN_OTP ?? '1234'
  return pin === expected
}

function assertAdminPin(pin: string) {
  if (!adminPinMatches(pin)) {
    throw new ConvexError('Invalid admin PIN')
  }
}

export const allTeamHoleScores = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('teamHoleScores').collect()
    return rows.map((r) => ({
      teamName: r.teamName,
      teamId: r.teamId,
      hole: r.hole,
      strokes: r.strokes,
      teePlayerId: r.teePlayerId,
    }))
  },
})

export const adminResetAllHoleScores = mutation({
  args: { pin: v.string() },
  handler: async (ctx, args) => {
    assertAdminPin(args.pin)
    const rows = await ctx.db.query('teamHoleScores').collect()
    for (const row of rows) {
      await ctx.db.delete('teamHoleScores', row._id)
    }
  },
})

export const adminResetTeamHoleScores = mutation({
  args: {
    pin: v.string(),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    assertAdminPin(args.pin)
    const canonical = TEAM_LABELS[args.teamId]
    if (!canonical) {
      throw new ConvexError('Unknown team')
    }

    const rows = await ctx.db.query('teamHoleScores').collect()
    for (const row of rows) {
      const matchesTeamId = row.teamId === args.teamId
      const legacyCanonical =
        !row.teamId && row.teamName === canonical
      if (matchesTeamId || legacyCanonical) {
        await ctx.db.delete('teamHoleScores', row._id)
      }
    }
  },
})

export const adminSyncFullScorecard = mutation({
  args: {
    pin: v.string(),
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
    assertAdminPin(args.pin)
    await replaceFullTeamHoleScores(ctx, {
      teamName: args.teamName,
      teamId: args.teamId,
      holes: args.holes,
    })
  },
})
