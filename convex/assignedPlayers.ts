import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const listTakenPlayerIds = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('assignedPlayers').collect()
    const ids = new Set<string>()
    for (const row of rows) {
      ids.add(row.playerId)
    }
    return [...ids]
  },
})

export const claimPlayer = mutation({
  args: { playerId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('assignedPlayers')
      .withIndex('by_player_id', (q) => q.eq('playerId', args.playerId))
      .collect()

    if (existing.length > 0) {
      throw new ConvexError(
        'That player is already assigned on another device. Pick someone else or ask them to clear their device.',
      )
    }

    return await ctx.db.insert('assignedPlayers', { playerId: args.playerId })
  },
})

export const releasePlayer = mutation({
  args: { playerId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('assignedPlayers')
      .withIndex('by_player_id', (q) => q.eq('playerId', args.playerId))
      .collect()

    for (const row of rows) {
      await ctx.db.delete('assignedPlayers', row._id)
    }
  },
})
