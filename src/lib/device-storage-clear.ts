import { clearProfile } from '~/lib/device-profile'
import { clearAllLocalScorecards } from '~/lib/local-scores'
import { clearAllLastHolePositions } from '~/lib/play-position'

/** iOS Home Screen install tip (home route). */
export const IOS_PWA_TIP_DISMISSED_KEY = 'borseth-ios-pwa-tip-dismissed-v1'

const LEGACY_ADMIN_SESSION_KEY = 'borseth-admin-session-v1'

/** Clears keyed app data from localStorage and any legacy admin session key. */
export function clearAllAppLocalStorage() {
  clearProfile()
  clearAllLocalScorecards()
  clearAllLastHolePositions()
  try {
    localStorage.removeItem(IOS_PWA_TIP_DISMISSED_KEY)
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(LEGACY_ADMIN_SESSION_KEY)
  } catch {
    /* ignore */
  }
}
