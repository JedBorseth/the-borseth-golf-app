import { ConvexError, v } from 'convex/values'
import { PLAYERS } from '../src/lib/golf-data'
import { TEAM_LABELS } from './golfRoster'
import { mutation, query } from './_generated/server'
import { canonicalTeamDisplayNameForTeamId } from './teamHoleScoreCanon'

const GLOBAL_ROOM = 'global' as const
const MAX_BODY_LEN = 500
const MAX_LIMIT = 200

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const take = Math.min(
      Math.max(args.limit ?? 100, 1),
      MAX_LIMIT,
    )
    const rows = await ctx.db
      .query('lobbyChatMessages')
      .withIndex('by_room_and_sentAt', (q) => q.eq('room', GLOBAL_ROOM))
      .order('desc')
      .take(take)
    return rows.reverse().map((r) => ({
      id: r._id,
      playerId: r.playerId,
      playerName: r.playerName,
      teamDisplayName: r.teamDisplayName,
      body: r.body,
      sentAt: r.sentAt,
    }))
  },
})

export const send = mutation({
  args: {
    playerId: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const pid = args.playerId.trim()
    const player = PLAYERS.find((p) => p.id === pid)
    if (!player) {
      throw new ConvexError('Unknown player.')
    }

    const claim = await ctx.db
      .query('assignedPlayers')
      .withIndex('by_player_id', (q) => q.eq('playerId', pid))
      .unique()

    if (claim === null) {
      throw new ConvexError(
        'Finish setup and claim your player on this phone before chatting.',
      )
    }

    const body = args.body.trim()
    if (!body) {
      throw new ConvexError('Message cannot be empty.')
    }
    if (body.length > MAX_BODY_LEN) {
      throw new ConvexError(`Keep messages under ${MAX_BODY_LEN} characters.`)
    }

    const scoreRows = await ctx.db.query('teamHoleScores').collect()
    const teamDisplayName =
      canonicalTeamDisplayNameForTeamId(player.teamId, scoreRows) ??
      TEAM_LABELS[player.teamId] ??
      player.teamId

    await ctx.db.insert('lobbyChatMessages', {
      room: GLOBAL_ROOM,
      playerId: player.id,
      playerName: player.name,
      teamDisplayName,
      body,
      sentAt: Date.now(),
    })
    return null
  },
})
