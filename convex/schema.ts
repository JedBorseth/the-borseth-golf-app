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
})
