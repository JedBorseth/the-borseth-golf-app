const STORAGE_KEY = 'borseth-golf-device-profile-v1'

export type GolfRole = 'player' | 'spectator'

export type DeviceProfile = {
  version: 1
  role: GolfRole
  playerId: string | null
  playerName: string | null
  teamId: string | null
  teamName: string | null
  onboardingComplete: boolean
}

const defaultProfile: DeviceProfile = {
  version: 1,
  role: 'spectator',
  playerId: null,
  playerName: null,
  teamId: null,
  teamName: null,
  onboardingComplete: false,
}

function isDeviceProfile(value: unknown): value is DeviceProfile {
  if (typeof value !== 'object' || value === null) return false
  const rec = value as Record<string, unknown>
  return (
    rec.version === 1 &&
    (rec.role === 'player' || rec.role === 'spectator') &&
    typeof rec.onboardingComplete === 'boolean'
  )
}

export function loadProfile(): DeviceProfile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isDeviceProfile(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveProfile(profile: DeviceProfile) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}

export function clearProfile() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function emptyProfile(): DeviceProfile {
  return { ...defaultProfile }
}

/** Where "back" should go from secondary screens (rules, leaderboard) after localStorage is available. */
export type PostSetupBackTarget = '/' | '/play'

export function postSetupBackPath(): PostSetupBackTarget {
  const p = loadProfile()
  if (!p?.onboardingComplete) return '/'
  if (
    p.role === 'player' &&
    p.playerName &&
    p.teamName &&
    p.teamId
  ) {
    return '/play'
  }
  return '/'
}
