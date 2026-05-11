import { ConvexError, v } from 'convex/values'
import { PLAYERS } from '../src/lib/golf-data'
import { TEAM_LABELS } from './golfRoster'
import { canonicalTeamDisplayNameForTeamId } from './teamHoleScoreCanon'
import { mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

const GLOBAL_ROOM = 'global' as const
const MAX_BODY_LEN = 500
const MAX_LIMIT = 200

/** Slightly above the client’s 250KB target so harmless drift isn’t rejected. */
const MAX_CHAT_IMAGE_BYTES = 278_528

const ALLOWED_CHAT_IMAGE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/webp',
])

function normalizeContentType(ct: string | undefined | null): string | null {
  if (ct === undefined || ct === null) return null
  const raw = ct.split(';')[0]
  const normalized = raw.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

async function validatedChatAttachment(
  ctx: MutationCtx,
  storageId: Id<'_storage'>,
) {
  const meta = await ctx.db.system.get('_storage', storageId)
  if (meta === null) {
    throw new ConvexError(
      'That upload URL expired or failed — compress and upload again.',
    )
  }

  const ct = normalizeContentType(meta.contentType)

  const badType = ct === null || !ALLOWED_CHAT_IMAGE_CONTENT_TYPES.has(ct)

  if (badType || meta.size > MAX_CHAT_IMAGE_BYTES || meta.size < 512) {
    await ctx.storage.delete(storageId)
    if (badType) {
      throw new ConvexError('Chat photos must be JPEG or WebP from this app.')
    }
    throw new ConvexError(
      meta.size > MAX_CHAT_IMAGE_BYTES
        ? `Keep photos under roughly 250KB (got ${Math.round(meta.size / 1024)}KB).`
        : 'Image upload looks empty or corrupted.',
    )
  }

  return null
}

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const take = Math.min(Math.max(args.limit ?? 100, 1), MAX_LIMIT)
    const rows = await ctx.db
      .query('lobbyChatMessages')
      .withIndex('by_room_and_sentAt', (q) => q.eq('room', GLOBAL_ROOM))
      .order('desc')
      .take(take)

    const ordered = rows.reverse()

    return Promise.all(
      ordered.map(async (r) => {
        let imageUrl: string | null = null
        if (r.imageStorageId !== undefined) {
          imageUrl = await ctx.storage.getUrl(r.imageStorageId)
        }
        return {
          id: r._id,
          playerId: r.playerId,
          playerName: r.playerName,
          teamDisplayName: r.teamDisplayName,
          body: r.body,
          sentAt: r.sentAt,
          imageUrl,
        }
      }),
    )
  },
})

export const generateChatImageUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const url = await ctx.storage.generateUploadUrl()
    return url
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
      canonicalTeamDisplayNameForTeamId(player.teamId, scoreRows) ||
      TEAM_LABELS[player.teamId] ||
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

export const sendWithImage = mutation({
  args: {
    playerId: v.string(),
    storageId: v.id('_storage'),
    caption: v.optional(v.string()),
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

    await validatedChatAttachment(ctx, args.storageId)

    const caption = args.caption === undefined ? '' : args.caption.trim()
    if (caption.length > MAX_BODY_LEN) {
      throw new ConvexError(`Keep captions under ${MAX_BODY_LEN} characters.`)
    }

    const scoreRows = await ctx.db.query('teamHoleScores').collect()
    const teamDisplayName =
      canonicalTeamDisplayNameForTeamId(player.teamId, scoreRows) ||
      TEAM_LABELS[player.teamId] ||
      player.teamId

    await ctx.db.insert('lobbyChatMessages', {
      room: GLOBAL_ROOM,
      playerId: player.id,
      playerName: player.name,
      teamDisplayName,
      body: caption,
      imageStorageId: args.storageId,
      sentAt: Date.now(),
    })
    return null
  },
})
