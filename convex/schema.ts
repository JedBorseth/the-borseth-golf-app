import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  /** One row per team per hole (scramble). */
  teamHoleScores: defineTable({
    teamName: v.string(),
    /** Stable id (t1–t5) for roster validation and leaderboard extras. */
    teamId: v.optional(v.string()),
    hole: v.number(),
    strokes: v.number(),
    /** Player id (e.g. p1) whose drive was the team tee ball for this hole. */
    teePlayerId: v.optional(v.string()),
  }).index('by_team_hole', ['teamName', 'hole']),

  assignedPlayers: defineTable({
    playerId: v.string(),
  }).index('by_player_id', ['playerId']),

  /** One global room for competitors on the Play tab (filtered by Convex query bounds). */
  lobbyChatMessages: defineTable({
    room: v.literal('global'),
    playerId: v.string(),
    playerName: v.string(),
    /** Server-resolved team display name at send time (custom name from scoreboard). */
    teamDisplayName: v.optional(v.string()),
    /** Text body, or caption when `imageStorageId` is set. */
    body: v.string(),
    /** Convex storage id for a lobby chat attachment (JPEG/WebP compressed on the client). */
    imageStorageId: v.optional(v.id('_storage')),
    sentAt: v.number(),
  }).index('by_room_and_sentAt', ['room', 'sentAt']),
})
