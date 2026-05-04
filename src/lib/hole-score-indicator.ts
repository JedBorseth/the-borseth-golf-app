/**
 * Stroke count vs hole par → tiers. Each tier uses a solid fill with only black or white text.
 */

export type HoleScoreTier =
  | 'eagle'
  | 'birdie'
  | 'par'
  | 'bogey'
  | 'doublePlus'

export function deltaForHole(strokes: number, par: number): number {
  return strokes - par
}

/** E, +2, −1 style (matches leaderboard / footer copy). */
export function relativeToParShortLabel(delta: number): string {
  if (delta === 0) return 'E'
  if (delta > 0) return `+${delta}`
  return `${delta}`
}

/** Eagle or better: Δ ≤ −2 (eagle, albatross, condor). */
export function holeScoreTier(delta: number): HoleScoreTier {
  if (delta <= -2) return 'eagle'
  if (delta === -1) return 'birdie'
  if (delta === 0) return 'par'
  if (delta === 1) return 'bogey'
  return 'doublePlus'
}

function capitalizeWords(phrase: string): string {
  return phrase.split(' ').map(capitalizeSegment).join(' ')
}

function capitalizeSegment(word: string): string {
  if (word.length === 0) return word
  return word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase()
}

/** Golf wording for Δ = strokes − par; each word title-cased. */
export function holeOutcomeName(delta: number): string {
  let raw: string
  if (delta <= -4) raw = 'condor'
  else if (delta === -3) raw = 'albatross'
  else if (delta === -2) raw = 'eagle'
  else if (delta === -1) raw = 'birdie'
  else if (delta === 0) raw = 'par'
  else if (delta === 1) raw = 'bogey'
  else if (delta === 2) raw = 'double bogey'
  else if (delta === 3) raw = 'triple bogey'
  else if (delta === 4) raw = 'quadruple bogey'
  else raw = `${delta} over`

  return capitalizeWords(raw)
}

/** One-line UI: strokes vs hole par • outcome name (`4 • Birdie`). */
export function holeScoreSimpleLine(strokes: number, par: number): string {
  if (strokes === 1)
    return `1 • ${capitalizeWords('hole in one')}`
  const delta = deltaForHole(strokes, par)
  return `${strokes} • ${holeOutcomeName(delta)}`
}

function cnJoin(...parts: Array<string>): string {
  return parts.filter(Boolean).join(' ')
}

/** Per-tier opaque fills — typography is always black or white. */
function solidFg(tier: HoleScoreTier): string {
  switch (tier) {
    case 'eagle':
      return 'bg-lime-400 text-black'
    case 'birdie':
      return 'bg-red-600 text-white'
    case 'par':
      return 'bg-zinc-200 text-black ring-1 ring-black/[0.12] dark:bg-zinc-400 dark:text-black dark:ring-white/15'
    case 'bogey':
      return 'bg-blue-600 text-white'
    case 'doublePlus':
      return 'bg-amber-400 text-black'
  }
}

function cnMdScoreChip(fg: string, textSize: 'base' | 'lg'): string {
  const textMd =
    textSize === 'lg' ? 'text-sm font-semibold' : 'text-xs font-semibold'
  return cnJoin(
    fg,
    'inline-flex min-h-6 max-w-[min(100%,18rem)] items-center justify-center rounded-md px-2 py-0.5 leading-snug',
    textMd,
    'break-words text-center font-semibold shadow-sm',
  )
}

/** Stroke / score line pill (scorecards, footer totals). Use `lg` for slightly larger type. */
export function holeScoreStrokesCardClasses(
  tier: HoleScoreTier,
  options?: { textSize?: 'base' | 'lg' },
): string {
  return cnMdScoreChip(solidFg(tier), options?.textSize ?? 'base')
}

/** Hero: single score line over hole image. */
export function holeScoreHeroMainClasses(tier: HoleScoreTier): string {
  return cnJoin(
    solidFg(tier),
    'inline-flex max-w-[min(100%,20rem)] items-center justify-center rounded-md px-2.5 py-1 text-sm font-semibold leading-snug shadow-sm',
  )
}

/** Dialog quick-picks. */
export function holeScorePresetButtonClasses(tier: HoleScoreTier): string {
  switch (tier) {
    case 'eagle':
      return 'text-xs font-semibold rounded-full border-0 bg-lime-400 !text-black shadow-sm hover:bg-lime-500 hover:!text-black active:bg-lime-600 active:!text-black focus-visible:!text-black dark:bg-lime-400 dark:!text-black dark:hover:bg-lime-500 dark:hover:!text-black dark:active:bg-lime-600 dark:active:!text-black'
    case 'birdie':
      return 'text-xs font-semibold rounded-full border-0 bg-red-600 !text-white shadow-sm hover:bg-red-700 hover:!text-white active:bg-red-800 active:!text-white focus-visible:!text-white dark:bg-red-600 dark:!text-white dark:hover:bg-red-700 dark:hover:!text-white dark:active:bg-red-800 dark:active:!text-white'
    case 'par':
      return 'text-xs font-semibold rounded-full border-0 bg-zinc-200 !text-black shadow-sm ring-1 ring-black/[0.12] hover:bg-zinc-300 hover:!text-black active:bg-zinc-400 active:!text-black focus-visible:!text-black dark:bg-zinc-400 dark:!text-black dark:ring-white/15 dark:hover:bg-zinc-500 dark:hover:!text-black dark:active:bg-zinc-500 dark:active:!text-black'
    case 'bogey':
      return 'text-xs font-semibold rounded-full border-0 bg-blue-600 !text-white shadow-sm hover:bg-blue-700 hover:!text-white active:bg-blue-800 active:!text-white focus-visible:!text-white dark:bg-blue-600 dark:!text-white dark:hover:bg-blue-700 dark:hover:!text-white dark:active:bg-blue-800 dark:active:!text-white'
    case 'doublePlus':
      return 'text-xs font-semibold rounded-full border-0 bg-amber-400 !text-black shadow-sm hover:bg-amber-500 hover:!text-black active:bg-amber-600 active:!text-black focus-visible:!text-black dark:bg-amber-400 dark:!text-black dark:hover:bg-amber-500 dark:hover:!text-black dark:active:bg-amber-600 dark:active:!text-black'
  }
}

/** Strokes field: opaque background and black / white digits. */
export function holeScoreInputTintClasses(tier: HoleScoreTier): string {
  switch (tier) {
    case 'eagle':
      return 'border-transparent bg-lime-400 text-black placeholder:text-black/40 focus-visible:border-transparent focus-visible:bg-lime-400 focus-visible:ring-black/25 dark:bg-lime-400 dark:text-black'
    case 'birdie':
      return 'border-transparent bg-red-600 text-white placeholder:text-white/55 focus-visible:border-transparent focus-visible:bg-red-600 focus-visible:ring-white/35 dark:bg-red-600 dark:text-white'
    case 'par':
      return cnJoin(
        'border-transparent bg-zinc-200 text-black placeholder:text-black/35 ring-1 ring-black/[0.1] focus-visible:border-transparent focus-visible:bg-zinc-200 focus-visible:ring-black/20 dark:bg-zinc-400 dark:text-black dark:ring-white/12 dark:focus-visible:bg-zinc-400',
      )
    case 'bogey':
      return 'border-transparent bg-blue-600 text-white placeholder:text-white/55 focus-visible:border-transparent focus-visible:bg-blue-600 focus-visible:ring-white/35 dark:bg-blue-600 dark:text-white'
    case 'doublePlus':
      return 'border-transparent bg-amber-400 text-black placeholder:text-black/40 focus-visible:border-transparent focus-visible:bg-amber-400 focus-visible:ring-black/25 dark:bg-amber-400 dark:text-black'
  }
}

export function holeVsParAriaLabel(delta: number): string {
  if (delta === 0) return 'Even par on this hole.'
  const abs = Math.abs(delta)
  const u = abs === 1 ? 'stroke' : 'strokes'
  if (delta < 0) return `${abs} ${u} under par on this hole.`
  return `${abs} ${u} over par on this hole.`
}

/** Accessible summary for one hole score (hole in one wins over strokes vs par wording). */
export function holeScoreAriaDescription(strokes: number, par: number): string {
  if (strokes === 1) return 'Hole in one on this hole.'
  return holeVsParAriaLabel(deltaForHole(strokes, par))
}
