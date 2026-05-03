/** Full team scorecard in localStorage (source of truth on the device). */

export type LocalScorecard = {
  teamName: string
  teamId: string
  strokes: Record<string, number>
  teePlayerIdByHole: Record<string, string>
}

const STORAGE_KEY = 'borseth-cup-local-rounds-v2'

function readAll(): Record<string, LocalScorecard> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, LocalScorecard> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (isLocalScorecard(v)) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

function isLocalScorecard(x: unknown): x is LocalScorecard {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (typeof o.teamName !== 'string' || typeof o.teamId !== 'string')
    return false
  if (!o.strokes || typeof o.strokes !== 'object') return false
  if (!o.teePlayerIdByHole || typeof o.teePlayerIdByHole !== 'object')
    return false
  return true
}

function writeAll(map: Record<string, LocalScorecard>) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export function loadLocalScorecard(teamName: string): LocalScorecard | null {
  if (!teamName) return null
  return readAll()[teamName] ?? null
}

export function saveLocalScorecard(card: LocalScorecard) {
  const all = readAll()
  all[card.teamName] = card
  writeAll(all)
}

export function clearLocalScorecard(teamName: string) {
  const all = readAll()
  delete all[teamName]
  writeAll(all)
}

/** Holes to send to Convex (sorted). Only incomplete rows omitted. */
export function holesPayloadFromScorecard(
  strokes: Record<string, number>,
  teePlayerIdByHole: Record<string, string>,
): Array<{ hole: number; strokes: number; teePlayerId: string }> {
  const holes: Array<{ hole: number; strokes: number; teePlayerId: string }> =
    []
  for (const [k, s] of Object.entries(strokes)) {
    const hole = Number(k)
    if (!Number.isInteger(hole) || hole < 1 || hole > 18) continue
    const teeId = teePlayerIdByHole[k]
    if (typeof teeId !== 'string' || !teeId) continue
    if (typeof s !== 'number' || !Number.isFinite(s)) continue
    holes.push({ hole, strokes: s, teePlayerId: teeId })
  }
  holes.sort((a, b) => a.hole - b.hole)
  return holes
}
