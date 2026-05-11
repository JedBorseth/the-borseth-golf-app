/** Full team scorecard in localStorage (source of truth on the device). */

export type LocalScorecard = {
  teamName: string
  teamId: string
  strokes: Record<string, number>
  teePlayerIdByHole: Record<string, string>
}

const STORAGE_KEY = 'borseth-cup-local-rounds-v2'

/** Hole numbers awaiting server echo — keep local edits from being stomped during merge/sync. */
const PENDING_SYNC_KEY = 'borseth-cup-pending-hole-sync-v1'

type PendingHoleMapJson = Record<string, Array<number>>

function readPendingAll(): PendingHoleMapJson {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: PendingHoleMapJson = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (!Array.isArray(v)) continue
      const nums = v
        .map((x) => (typeof x === 'number' ? x : Number(x)))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 18)
      if (nums.length) out[k] = [...new Set(nums)]
    }
    return out
  } catch {
    return {}
  }
}

function writePendingAll(map: PendingHoleMapJson) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(map))
}

/** Holes edited on this device until server echo matches saved local scores. */
export function loadPendingHoleSyncSet(teamName: string): Set<number> {
  if (!teamName) return new Set()
  const list = readPendingAll()[teamName]
  return new Set(Array.isArray(list) ? list : [])
}

/** Mark a hole after save so merges prefer local until the server echoes the same strokes/tee. */
export function addPendingHoleSync(teamName: string, hole: number) {
  if (!teamName || !Number.isInteger(hole) || hole < 1 || hole > 18) return
  const all = readPendingAll()
  const cur = new Set(all[teamName] ?? [])
  cur.add(hole)
  all[teamName] = [...cur].sort((a, b) => a - b)
  writePendingAll(all)
}

/** Remove one hole from the pending set (e.g. after clearing scores for that hole). */
export function removePendingHoleSyncForHole(teamName: string, hole: number) {
  if (!teamName || !Number.isInteger(hole) || hole < 1 || hole > 18) return
  const all = readPendingAll()
  const list = all[teamName]
  if (!Array.isArray(list) || !list.includes(hole)) return
  const next = list.filter((h) => h !== hole)
  if (next.length === 0) {
    delete all[teamName]
  } else {
    all[teamName] = next
  }
  writePendingAll(all)
}

export function clearPendingHoleSyncForTeam(teamName: string) {
  if (!teamName) return
  const all = readPendingAll()
  delete all[teamName]
  writePendingAll(all)
}

export function migratePendingHoleSyncTeamKey(fromKey: string, toKey: string) {
  if (!fromKey || !toKey || fromKey === toKey) return
  const all = readPendingAll()
  const mv = all[fromKey] ?? []
  if (mv.length === 0) {
    delete all[fromKey]
    writePendingAll(all)
    return
  }
  const merged = new Set([...(all[toKey] ?? []), ...mv])
  all[toKey] = [...merged].sort((a, b) => a - b)
  delete all[fromKey]
  writePendingAll(all)
}

/**
 * When server query reports the same strokes + tee ball as localStorage for pending holes,
 * drop those holes from the pending set (sync confirmed).
 */
export function reconcilePendingHoleSyncWithServer(
  teamName: string,
  local: LocalScorecard | null,
  server: ScorecardHoleMaps,
): boolean {
  if (!teamName) return false
  const pending = loadPendingHoleSyncSet(teamName)
  if (pending.size === 0 || !local) return false

  let changed = false
  const nextPending = new Set(pending)

  const localMaps: ScorecardHoleMaps = {
    strokes: local.strokes,
    teePlayerIdByHole: local.teePlayerIdByHole,
  }

  for (const hole of pending) {
    if (
      !isCompleteHole(server.strokes, server.teePlayerIdByHole, hole) ||
      !isCompleteHole(localMaps.strokes, localMaps.teePlayerIdByHole, hole)
    ) {
      continue
    }
    const k = String(hole)
    if (
      server.strokes[k] === localMaps.strokes[k] &&
      server.teePlayerIdByHole[k] === localMaps.teePlayerIdByHole[k]
    ) {
      nextPending.delete(hole)
      changed = true
    }
  }

  if (!changed) return false

  const all = readPendingAll()
  if (nextPending.size === 0) {
    delete all[teamName]
  } else {
    all[teamName] = [...nextPending].sort((a, b) => a - b)
  }
  writePendingAll(all)
  return true
}

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

/**
 * Moves the device's scorecard from an old leaderboard key (team name string) to
 * the canonical server name without losing strokes.
 */
export function migrateLocalScorecardTeamNameKey(
  fromKey: string,
  toKey: string,
  teamId: string,
): void {
  if (typeof localStorage === 'undefined') return
  const prev = fromKey ? loadLocalScorecard(fromKey) : null
  const dest = loadLocalScorecard(toKey)

  const trustedPrev =
    prev && prev.teamId === teamId ? prev : null
  const trustedDest =
    dest && dest.teamId === teamId ? dest : null

  if (!trustedPrev && !trustedDest) return

  const leftHoleMaps: ScorecardHoleMaps =
    trustedPrev !== null
      ? {
          strokes: trustedPrev.strokes,
          teePlayerIdByHole: trustedPrev.teePlayerIdByHole,
        }
      : { strokes: {}, teePlayerIdByHole: {} }

  const rightHoleMaps: ScorecardHoleMaps =
    trustedDest !== null
      ? {
          strokes: trustedDest.strokes,
          teePlayerIdByHole: trustedDest.teePlayerIdByHole,
        }
      : { strokes: {}, teePlayerIdByHole: {} }

  const merged = mergeScorecardsByCompleteness(leftHoleMaps, rightHoleMaps)

  saveLocalScorecard({
    teamName: toKey,
    teamId,
    strokes: merged.strokes,
    teePlayerIdByHole: merged.teePlayerIdByHole,
  })

  if (fromKey !== toKey && fromKey) {
    migratePendingHoleSyncTeamKey(fromKey, toKey)
    clearLocalScorecard(fromKey)
  }
}

export function clearLocalScorecard(teamName: string) {
  const all = readAll()
  delete all[teamName]
  writeAll(all)
  clearPendingHoleSyncForTeam(teamName)
}

export function clearAllLocalScorecards() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(PENDING_SYNC_KEY)
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

/**
 * Multi-device Convex sync: holes with pending local edits keep this device's stroke/tee
 * rows; otherwise prefer the server snapshot (fills teammate holes ahead of us; propagates
 * edits and clears). Do not resurrect holes from local when the server omits them unless that
 * hole is still pending — otherwise cleared holes would reappear after teammate refresh/sync.
 */
export function mergeScorecardsRealtime(
  local: ScorecardHoleMaps,
  server: ScorecardHoleMaps,
  pendingLocalEdits: ReadonlySet<number>,
): ScorecardHoleMaps {
  const strokes: Record<string, number> = {}
  const teePlayerIdByHole: Record<string, string> = {}

  for (let hole = 1; hole <= 18; hole++) {
    const pk = holeKey(hole)
    const lc = isCompleteHole(local.strokes, local.teePlayerIdByHole, hole)
    const sc = isCompleteHole(server.strokes, server.teePlayerIdByHole, hole)

    if (pendingLocalEdits.has(hole) && lc) {
      strokes[pk] = local.strokes[pk]
      teePlayerIdByHole[pk] = local.teePlayerIdByHole[pk]
    } else if (sc) {
      strokes[pk] = server.strokes[pk]
      teePlayerIdByHole[pk] = server.teePlayerIdByHole[pk]
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
