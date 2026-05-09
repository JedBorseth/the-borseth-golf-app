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

export function clearAllLocalScorecards() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

/** Stroke + tee maps only (no team metadata). */
export type ScorecardHoleMaps = {
  strokes: Record<string, number>
  teePlayerIdByHole: Record<string, string>
}

function holeKey(hole: number): string {
  return String(hole)
}

/** Same validity as a row included in {@link holesPayloadFromScorecard}. */
export function isCompleteHole(
  strokes: Record<string, number>,
  teePlayerIdByHole: Record<string, string>,
  hole: number,
): boolean {
  const k = holeKey(hole)
  const s = strokes[k]
  const teeId = teePlayerIdByHole[k]
  if (typeof teeId !== 'string' || !teeId) return false
  if (typeof s !== 'number' || !Number.isFinite(s)) return false
  if (!Number.isInteger(hole) || hole < 1 || hole > 18) return false
  return true
}

export function countCompleteHoles(
  strokes: Record<string, number>,
  teePlayerIdByHole: Record<string, string>,
): number {
  let n = 0
  for (let hole = 1; hole <= 18; hole++) {
    if (isCompleteHole(strokes, teePlayerIdByHole, hole)) n++
  }
  return n
}

export type MergeScorecardsOptions = {
  /** When complete-hole counts tie, prefer server's values on conflicts. Default true. */
  preferServerOnTie?: boolean
}

/**
 * Merges local + server hole maps: primary is the side with more complete holes;
 * on tie, `preferServerOnTie` picks primary. Each hole uses primary if complete,
 * else secondary, else omitted.
 */
export function mergeScorecardsByCompleteness(
  local: ScorecardHoleMaps,
  server: ScorecardHoleMaps,
  opts?: MergeScorecardsOptions,
): ScorecardHoleMaps {
  const preferServerOnTie = opts?.preferServerOnTie !== false
  const localCount = countCompleteHoles(local.strokes, local.teePlayerIdByHole)
  const serverCount = countCompleteHoles(server.strokes, server.teePlayerIdByHole)

  let primary: ScorecardHoleMaps
  let secondary: ScorecardHoleMaps
  if (localCount > serverCount) {
    primary = local
    secondary = server
  } else if (serverCount > localCount) {
    primary = server
    secondary = local
  } else if (preferServerOnTie) {
    primary = server
    secondary = local
  } else {
    primary = local
    secondary = server
  }

  const strokes: Record<string, number> = {}
  const teePlayerIdByHole: Record<string, string> = {}

  for (let hole = 1; hole <= 18; hole++) {
    const pk = holeKey(hole)
    if (isCompleteHole(primary.strokes, primary.teePlayerIdByHole, hole)) {
      strokes[pk] = primary.strokes[pk]
      teePlayerIdByHole[pk] = primary.teePlayerIdByHole[pk]
    } else if (
      isCompleteHole(secondary.strokes, secondary.teePlayerIdByHole, hole)
    ) {
      strokes[pk] = secondary.strokes[pk]
      teePlayerIdByHole[pk] = secondary.teePlayerIdByHole[pk]
    }
  }

  return { strokes, teePlayerIdByHole }
}

export function scorecardsHoleDataEqual(a: ScorecardHoleMaps, b: ScorecardHoleMaps): boolean {
  for (let hole = 1; hole <= 18; hole++) {
    const ka = isCompleteHole(a.strokes, a.teePlayerIdByHole, hole)
    const kb = isCompleteHole(b.strokes, b.teePlayerIdByHole, hole)
    if (ka !== kb) return false
    if (ka) {
      const k = holeKey(hole)
      if (a.strokes[k] !== b.strokes[k]) return false
      if (a.teePlayerIdByHole[k] !== b.teePlayerIdByHole[k]) return false
    }
  }
  return true
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
