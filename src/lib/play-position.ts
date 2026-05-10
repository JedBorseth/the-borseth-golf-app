/** Last viewed hole per team (Play route). */

const STORAGE_KEY = 'borseth-cup-last-hole-v1'

function readAll(): Record<string, number> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

function writeAll(map: Record<string, number>) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export function loadLastHoleForTeam(teamName: string): number | null {
  if (!teamName) return null
  const v = readAll()[teamName]
  return typeof v === 'number'
    ? Math.max(1, Math.min(18, Math.round(v)))
    : null
}

export function saveLastHoleForTeam(teamName: string, hole: number) {
  if (!teamName) return
  const h = Math.max(1, Math.min(18, Math.round(hole)))
  const all = readAll()
  all[teamName] = h
  writeAll(all)
}

export function clearLastHoleForTeam(teamName: string) {
  if (!teamName) return
  const all = readAll()
  delete all[teamName]
  writeAll(all)
}

export function migrateLastHoleTeamNameKey(fromKey: string, toKey: string) {
  if (typeof localStorage === 'undefined') return
  if (!fromKey || !toKey || fromKey === toKey) return
  const hole = loadLastHoleForTeam(fromKey)
  if (hole === null) return
  saveLastHoleForTeam(toKey, hole)
  clearLastHoleForTeam(fromKey)
}

export function clearAllLastHolePositions() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
