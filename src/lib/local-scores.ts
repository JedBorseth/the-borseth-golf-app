/** Pending hole scores stored locally until Convex sync succeeds. */

export type PendingHoleScore = {
  teamName: string
  teamId: string
  hole: number
  strokes: number
  teePlayerId: string
}

const STORAGE_KEY = 'borseth-cup-pending-scores-v1'

function readRaw(): unknown {
  if (typeof localStorage === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
  } catch {
    return []
  }
}

function isPendingHoleScore(x: unknown): x is PendingHoleScore {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.teamName === 'string' &&
    typeof o.teamId === 'string' &&
    typeof o.hole === 'number' &&
    Number.isFinite(o.hole) &&
    typeof o.strokes === 'number' &&
    Number.isFinite(o.strokes) &&
    typeof o.teePlayerId === 'string'
  )
}

export function listPendingScores(): Array<PendingHoleScore> {
  const raw = readRaw()
  if (!Array.isArray(raw)) return []
  return raw.filter(isPendingHoleScore)
}

function writeScores(items: Array<PendingHoleScore>) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function upsertPendingScore(item: PendingHoleScore) {
  const next = listPendingScores().filter(
    (p) => !(p.teamName === item.teamName && p.hole === item.hole),
  )
  next.push(item)
  writeScores(next)
}

export function removePendingScore(teamName: string, hole: number) {
  writeScores(
    listPendingScores().filter(
      (p) => !(p.teamName === teamName && p.hole === hole),
    ),
  )
}

export function pendingScoresForTeam(teamName: string): Map<number, PendingHoleScore> {
  const m = new Map<number, PendingHoleScore>()
  for (const p of listPendingScores()) {
    if (p.teamName === teamName) m.set(p.hole, p)
  }
  return m
}

export function mergePendingStrokes(
  server: Record<string, number>,
  teamName: string,
): Record<string, number> {
  const pending = pendingScoresForTeam(teamName)
  if (pending.size === 0) return server
  const out = { ...server }
  for (const [hole, row] of pending) {
    out[String(hole)] = row.strokes
  }
  return out
}

export function mergePendingTeePlayers(
  server: Record<string, string>,
  teamName: string,
): Record<string, string> {
  const pending = pendingScoresForTeam(teamName)
  if (pending.size === 0) return server
  const out = { ...server }
  for (const [hole, row] of pending) {
    out[String(hole)] = row.teePlayerId
  }
  return out
}

export function countPendingForTeam(teamName: string): number {
  return listPendingScores().filter((p) => p.teamName === teamName).length
}
