import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ConvexError } from 'convex/values'
import * as React from 'react'
import { useMutation } from 'convex/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MinusIcon,
  NotebookTabsIcon,
  PlusIcon,
  TrophyIcon,
} from 'lucide-react'

import { api } from '../../../convex/_generated/api'
import type { DeviceProfile } from '~/lib/device-profile'
import { Button, buttonVariants } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet'
import { loadProfile } from '~/lib/device-profile'
import {
  COURSE_NAME,
  HOLE_META,
  maxTeeDrivesPerPlayer,
  playerNameById,
  teammatesForPlayer,
} from '~/lib/golf-data'
import {
  clearLocalScorecard,
  holesPayloadFromScorecard,
  loadLocalScorecard,
  saveLocalScorecard,
  type LocalScorecard,
} from '~/lib/local-scores'
import { isOfflineOrNetworkError } from '~/lib/network-error'
import {
  clearLastHoleForTeam,
  loadLastHoleForTeam,
  saveLastHoleForTeam,
} from '~/lib/play-position'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/play/')({
  component: PlayGolfPage,
})

function PlayGolfPage() {
  const navigate = useNavigate()
  const [hydrated, setHydrated] = React.useState(false)
  const [profile, setProfile] = React.useState<DeviceProfile | null>(null)
  const [currentHole, setCurrentHole] = React.useState(1)

  const [scoreDialogOpen, setScoreDialogOpen] = React.useState(false)
  const [scoreTargetHole, setScoreTargetHole] = React.useState<number | null>(
    null,
  )
  /** After canceling the score dialog from Next, pressing Next again skips without prompting. */
  const [skipNextScorePromptForHole, setSkipNextScorePromptForHole] =
    React.useState<number | null>(null)
  const [scoreOpenedViaNext, setScoreOpenedViaNext] = React.useState(false)
  const [localSyncVersion, setLocalSyncVersion] = React.useState(0)
  const [serverInSync, setServerInSync] = React.useState(true)
  const [finishingRound, setFinishingRound] = React.useState(false)

  const queryClient = useQueryClient()

  React.useEffect(() => {
    const nextProfile = loadProfile()
    if (
      !nextProfile?.onboardingComplete ||
      nextProfile.role !== 'player' ||
      !nextProfile.playerName ||
      !nextProfile.teamName ||
      !nextProfile.teamId
    ) {
      void navigate({ to: '/play/setup', replace: true })
      return
    }
    setProfile(nextProfile)
    setHydrated(true)
  }, [navigate])

  const teamName = profile?.teamName ?? ''

  const skipNextHolePersist = React.useRef(true)

  React.useEffect(() => {
    if (!hydrated || !teamName) return
    skipNextHolePersist.current = true
    const saved = loadLastHoleForTeam(teamName)
    setCurrentHole(saved ?? 1)
  }, [hydrated, teamName])

  React.useEffect(() => {
    if (!hydrated || !teamName) return
    if (skipNextHolePersist.current) {
      skipNextHolePersist.current = false
      return
    }
    saveLastHoleForTeam(teamName, currentHole)
  }, [hydrated, teamName, currentHole])

  const scoresQuery = useQuery({
    ...convexQuery(api.golf.scoresForTeam, { teamName }),
    enabled: hydrated && !!teamName,
    gcTime: 1000 * 60 * 60 * 24,
  })

  const serverStrokes = scoresQuery.data?.strokes ?? {}
  const serverTeeByHole = scoresQuery.data?.teePlayerIdByHole ?? {}

  React.useEffect(() => {
    if (!hydrated || !teamName || !profile?.teamId || !scoresQuery.isSuccess)
      return
    if (loadLocalScorecard(teamName)) return
    const s = scoresQuery.data?.strokes ?? {}
    const t = scoresQuery.data?.teePlayerIdByHole ?? {}
    if (Object.keys(s).length === 0) return
    saveLocalScorecard({
      teamName,
      teamId: profile.teamId,
      strokes: { ...s },
      teePlayerIdByHole: { ...t },
    })
    setLocalSyncVersion((v) => v + 1)
  }, [
    hydrated,
    teamName,
    profile?.teamId,
    scoresQuery.isSuccess,
    scoresQuery.data,
  ])

  const strokes = React.useMemo(() => {
    const local = loadLocalScorecard(teamName)
    if (local && local.teamId === profile?.teamId) {
      return local.strokes
    }
    return serverStrokes
  }, [teamName, profile?.teamId, serverStrokes, localSyncVersion])

  const teePlayerIdByHole = React.useMemo(() => {
    const local = loadLocalScorecard(teamName)
    if (local && local.teamId === profile?.teamId) {
      return local.teePlayerIdByHole
    }
    return serverTeeByHole
  }, [teamName, profile?.teamId, serverTeeByHole, localSyncVersion])

  const syncFullScorecard = useMutation(api.golf.syncFullScorecard)

  const pushFullScorecardToConvex = React.useCallback(
    async (opts?: { silentConvexError?: boolean }) => {
      if (!teamName || !profile?.teamId) return
      const card = loadLocalScorecard(teamName)
      if (!card || card.teamId !== profile.teamId) return
      const holes = holesPayloadFromScorecard(
        card.strokes,
        card.teePlayerIdByHole,
      )
      if (holes.length === 0) return
      try {
        await syncFullScorecard({
          teamName: card.teamName,
          teamId: card.teamId,
          holes,
        })
        setServerInSync(true)
        void queryClient.invalidateQueries({
          queryKey: convexQuery(api.golf.scoresForTeam, { teamName }).queryKey,
        })
      } catch (e: unknown) {
        setServerInSync(false)
        if (e instanceof ConvexError && typeof e.data === 'string') {
          if (!opts?.silentConvexError) window.alert(e.data)
          return
        }
        if (!opts?.silentConvexError && !isOfflineOrNetworkError(e)) {
          const msg =
            e instanceof Error ? e.message : 'Could not reach score server'
          window.alert(msg)
        }
      }
    },
    [teamName, profile?.teamId, syncFullScorecard, queryClient],
  )

  React.useEffect(() => {
    if (!hydrated || !teamName) return
    void pushFullScorecardToConvex({ silentConvexError: true })
    const id = setInterval(
      () => void pushFullScorecardToConvex({ silentConvexError: true }),
      45_000,
    )
    const onOnline = () =>
      void pushFullScorecardToConvex({ silentConvexError: true })
    window.addEventListener('online', onOnline)
    return () => {
      clearInterval(id)
      window.removeEventListener('online', onOnline)
    }
  }, [hydrated, teamName, pushFullScorecardToConvex])

  const teammates = React.useMemo(
    () => (profile?.playerId ? teammatesForPlayer(profile.playerId) : []),
    [profile?.playerId],
  )

  const teeCap = maxTeeDrivesPerPlayer(teammates.length || 1)

  const myTeeDriveCount = React.useMemo(() => {
    if (!profile?.playerId) return 0
    return Object.values(teePlayerIdByHole).filter(
      (id) => id === profile.playerId,
    ).length
  }, [profile?.playerId, teePlayerIdByHole])

  const completeHolesCount = React.useMemo(
    () => holesPayloadFromScorecard(strokes, teePlayerIdByHole).length,
    [strokes, teePlayerIdByHole],
  )

  const scorecardFooter = React.useMemo(() => {
    let totalStrokes = 0
    let totalPar = 0
    let holesWithScore = 0
    for (const h of HOLE_META) {
      const s = strokes[String(h.hole)]
      if (typeof s === 'number') {
        totalStrokes += s
        totalPar += h.par
        holesWithScore++
      }
    }
    const vsPar = totalStrokes - totalPar
    const vsParLabel =
      holesWithScore === 0
        ? null
        : vsPar === 0
          ? 'E'
          : vsPar > 0
            ? `+${vsPar}`
            : `${vsPar}`

    const teeByPlayer = new Map<string, number>()
    for (const id of Object.values(teePlayerIdByHole)) {
      teeByPlayer.set(id, (teeByPlayer.get(id) ?? 0) + 1)
    }

    return {
      totalStrokes,
      totalPar,
      holesWithScore,
      vsParLabel,
      teeByPlayer,
    }
  }, [strokes, teePlayerIdByHole])

  function scoreForHole(hole: number): number | undefined {
    const val = strokes[String(hole)]
    return typeof val === 'number' ? val : undefined
  }

  function teePlayerForHole(hole: number): string | undefined {
    return teePlayerIdByHole[String(hole)]
  }

  function navigateHole(direction: 'next' | 'prev') {
    setSkipNextScorePromptForHole(null)
    setScoreOpenedViaNext(false)
    setScoreDialogOpen(false)
    setScoreTargetHole(null)
    setCurrentHole((hole) => {
      if (direction === 'next') return Math.min(18, hole + 1)
      return Math.max(1, hole - 1)
    })
  }

  function openHoleScoreEditor(hole: number, options?: { viaNext?: boolean }) {
    if (!options?.viaNext) {
      setSkipNextScorePromptForHole((s) => (s === hole ? null : s))
    }
    setScoreTargetHole(hole)
    setScoreOpenedViaNext(options?.viaNext ?? false)
    setScoreDialogOpen(true)
  }

  function handleForward() {
    if (currentHole >= 18) return
    const h = currentHole
    if (scoreForHole(h) !== undefined) {
      navigateHole('next')
      return
    }
    if (skipNextScorePromptForHole === h) {
      setSkipNextScorePromptForHole(null)
      navigateHole('next')
      return
    }
    openHoleScoreEditor(h, { viaNext: true })
  }

  async function confirmScore(strokesArg: number, teePlayerId: string) {
    if (!profile?.teamName || !profile.teamId || scoreTargetHole === null)
      return
    const hole = scoreTargetHole

    const prev =
      loadLocalScorecard(profile.teamName) ?? {
        teamName: profile.teamName,
        teamId: profile.teamId,
        strokes: {},
        teePlayerIdByHole: {},
      }

    const next: LocalScorecard = {
      teamName: profile.teamName,
      teamId: profile.teamId,
      strokes: { ...prev.strokes, [String(hole)]: strokesArg },
      teePlayerIdByHole: {
        ...prev.teePlayerIdByHole,
        [String(hole)]: teePlayerId,
      },
    }
    saveLocalScorecard(next)
    setLocalSyncVersion((v) => v + 1)

    setSkipNextScorePromptForHole((s) => (s === hole ? null : s))
    setScoreOpenedViaNext(false)
    setScoreDialogOpen(false)
    setScoreTargetHole(null)

    const holes = holesPayloadFromScorecard(next.strokes, next.teePlayerIdByHole)
    if (holes.length === 0) return

    try {
      await syncFullScorecard({
        teamName: next.teamName,
        teamId: next.teamId,
        holes,
      })
      setServerInSync(true)
      void queryClient.invalidateQueries({
        queryKey: convexQuery(api.golf.scoresForTeam, {
          teamName: profile.teamName,
        }).queryKey,
      })
    } catch (e: unknown) {
      setServerInSync(false)
      if (e instanceof ConvexError && typeof e.data === 'string') {
        window.alert(e.data)
        return
      }
      if (isOfflineOrNetworkError(e)) {
        return
      }
      const msg =
        e instanceof Error ? e.message : 'Could not reach score server'
      window.alert(
        `${msg}\n\nYour full scorecard is saved on this device; it will sync when the connection allows.`,
      )
    }
  }

  async function handleFinishRound() {
    if (!profile?.teamName || !profile.teamId) return
    const card = loadLocalScorecard(profile.teamName)
    if (!card || card.teamId !== profile.teamId) {
      window.alert('Scorecard not found on this device.')
      return
    }
    const holes = holesPayloadFromScorecard(
      card.strokes,
      card.teePlayerIdByHole,
    )
    if (holes.length !== 18) {
      window.alert(
        'Enter a score and tee player for all 18 holes before finishing your round.',
      )
      return
    }
    setFinishingRound(true)
    try {
      await syncFullScorecard({
        teamName: card.teamName,
        teamId: card.teamId,
        holes,
      })
      clearLocalScorecard(profile.teamName)
      clearLastHoleForTeam(profile.teamName)
      setCurrentHole(1)
      setLocalSyncVersion((v) => v + 1)
      setServerInSync(true)
      void queryClient.invalidateQueries({
        queryKey: convexQuery(api.golf.scoresForTeam, {
          teamName: profile.teamName,
        }).queryKey,
      })
      void navigate({ to: '/leaderboard', replace: true })
    } catch (e: unknown) {
      if (e instanceof ConvexError && typeof e.data === 'string') {
        window.alert(e.data)
      } else if (isOfflineOrNetworkError(e)) {
        window.alert(
          'You need a working internet connection to submit a completed round to the server. Your scorecard is still saved on this device — try again when you are online.',
        )
      } else {
        window.alert(
          e instanceof Error ? e.message : 'Could not submit your round.',
        )
      }
    } finally {
      setFinishingRound(false)
    }
  }

  function cancelScoreDialog() {
    if (scoreOpenedViaNext && scoreTargetHole !== null) {
      setSkipNextScorePromptForHole(scoreTargetHole)
    }
    setScoreOpenedViaNext(false)
    setScoreDialogOpen(false)
    setScoreTargetHole(null)
  }

  if (!hydrated || !profile) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">
        Loading your round…
      </div>
    )
  }

  const meta = HOLE_META[currentHole - 1]
  const recorded = scoreForHole(currentHole)
  const greetingName =
    profile.playerName?.split(' ')[0] ?? profile.playerName ?? 'Player'

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            aria-label="Home"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
              'rounded-full',
            )}
          >
            <ArrowLeftIcon className="size-5" />
          </Link>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {COURSE_NAME}
            </p>
            <p className="font-heading text-lg font-semibold leading-none">
              Hi, {greetingName}
            </p>
            {profile.playerId && teammates.length > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Your tee drives: {myTeeDriveCount} / {teeCap}
              </p>
            )}
            {!serverInSync && scorecardFooter.holesWithScore > 0 && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Scorecard saved on this device. The leaderboard will update when
                the server sync succeeds.
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/leaderboard"
            aria-label="Leaderboard"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'rounded-full gap-1.5',
            )}
          >
            <TrophyIcon className="size-4" />
            Board
          </Link>
          <Sheet>
            <SheetTrigger
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'rounded-full gap-2',
              )}
            >
              <NotebookTabsIcon className="size-4" />
              Card
            </SheetTrigger>
            <SheetContent
              side="bottom"
              showCloseButton
              className="flex max-h-[min(92dvh,840px)] flex-col gap-0 rounded-t-3xl p-0"
            >
              <SheetHeader className="shrink-0 px-4 pt-4 pb-2 text-left">
                <SheetTitle>Team scorecard</SheetTitle>
                <SheetDescription>
                  {profile.teamName} • Scramble (white tees) •{' '}
                  {profile.playerName}. Tap a hole to enter or edit the team
                  score.
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
                <div className="space-y-2">
                  {HOLE_META.map((hole) => {
                    const value = scoreForHole(hole.hole)
                    const teeId = teePlayerForHole(hole.hole)
                    const teeLabel = teeId ? playerNameById(teeId) : null
                    const relative =
                      value === undefined
                        ? '—'
                        : value - hole.par === 0
                          ? 'E'
                          : value - hole.par > 0
                            ? `+${value - hole.par}`
                            : `${value - hole.par}`
                    return (
                      <button
                        key={hole.hole}
                        type="button"
                        onClick={() => openHoleScoreEditor(hole.hole)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                          'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          hole.hole === currentHole &&
                            'border-emerald-500/60 bg-emerald-50/60 dark:bg-emerald-950/40',
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                            {hole.hole}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium leading-none">
                              Hole {hole.hole}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Par {hole.par} • {hole.whiteYards} yds
                              {teeLabel ? ` • Tee: ${teeLabel}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right tabular-nums">
                          <p className="text-base font-semibold">
                            {value ?? '—'}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {relative}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="shrink-0 border-t bg-muted/40 px-4 pt-3 pb-[max(1.25rem,calc(0.75rem+env(safe-area-inset-bottom)))]">
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Team vs par
                    </p>
                    {scorecardFooter.holesWithScore === 0 ? (
                      <p className="mt-0.5 text-muted-foreground">
                        No holes scored yet.
                      </p>
                    ) : (
                      <>
                        <p className="mt-0.5 text-lg font-semibold leading-tight tabular-nums">
                          {scorecardFooter.vsParLabel}
                          <span className="ml-2 text-sm font-normal text-muted-foreground">
                            ({scorecardFooter.holesWithScore} hole
                            {scorecardFooter.holesWithScore === 1 ? '' : 's'})
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {scorecardFooter.totalStrokes} strokes ·{' '}
                          {scorecardFooter.totalPar} par so far
                        </p>
                      </>
                    )}
                  </div>
                  {teammates.length > 0 && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Tee shots used
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {teammates.map((tm) => {
                          const n =
                            scorecardFooter.teeByPlayer.get(tm.id) ?? 0
                          const first =
                            tm.name.split(/\s+/)[0] ?? tm.name
                          return (
                            <li
                              key={tm.id}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-foreground">{first}</span>
                              <span className="tabular-nums text-muted-foreground">
                                {n} / {teeCap}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="mb-4 overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="relative aspect-3/2 w-full bg-muted pb-20">
          <img
            src={meta.imageSrc}
            alt={`Hole ${meta.hole} view`}
            className="size-full object-contain"
            loading="lazy"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-white">
            <p className="text-xs uppercase tracking-[0.18em] text-white/80">
              Hole {meta.hole}{' '}
              <span className="text-white/60">
                • Par {meta.par} • {meta.whiteYards} yds (white)
              </span>
            </p>
            <p className="text-lg font-semibold">
              {recorded !== undefined ? `${recorded} strokes` : 'Score pending'}
            </p>
          </div>
        </div>
        <div className="border-t border-border/80 px-4 py-3">
          <p className="text-sm leading-snug text-muted-foreground">
            {meta.description}
          </p>
        </div>
      </div>

      <div className="mt-auto flex items-center gap-3 pt-2">
        <Button
          variant="outline"
          className="h-12 flex-1 rounded-xl gap-2"
          disabled={currentHole <= 1}
          onClick={() => navigateHole('prev')}
        >
          <ChevronLeftIcon className="size-5" />
          Back
        </Button>
        {currentHole < 18 ? (
          <Button
            className="h-12 flex-1 rounded-xl gap-2"
            onClick={handleForward}
          >
            Next
            <ChevronRightIcon className="size-5" />
          </Button>
        ) : (
          <Button
            className="h-12 flex-1 rounded-xl gap-2"
            disabled={completeHolesCount !== 18 || finishingRound}
            onClick={() => void handleFinishRound()}
          >
            {finishingRound
              ? 'Submitting…'
              : completeHolesCount === 18
                ? 'Finish round'
                : 'All holes required'}
            <ChevronRightIcon className="size-5" />
          </Button>
        )}
      </div>

      <ScoreCaptureDialog
        open={scoreDialogOpen}
        hole={scoreTargetHole}
        existingStrokes={
          scoreTargetHole ? scoreForHole(scoreTargetHole) : undefined
        }
        existingTeePlayerId={
          scoreTargetHole ? teePlayerForHole(scoreTargetHole) : undefined
        }
        teammates={teammates}
        teePlayerIdByHole={teePlayerIdByHole}
        teeCap={teeCap}
        openedFromNextNavigation={scoreOpenedViaNext}
        onConfirm={(strokeTotal, pickPlayerId) =>
          void confirmScore(strokeTotal, pickPlayerId)
        }
        onCancel={cancelScoreDialog}
      />
    </div>
  )
}

function teeUsageExcludingHole(
  teePlayerIdByHole: Record<string, string>,
  excludeHole: number,
): Map<string, number> {
  const usage = new Map<string, number>()
  for (const [h, id] of Object.entries(teePlayerIdByHole)) {
    if (Number(h) === excludeHole) continue
    usage.set(id, (usage.get(id) ?? 0) + 1)
  }
  return usage
}

function ScoreCaptureDialog({
  open,
  hole,
  existingStrokes,
  existingTeePlayerId,
  teammates,
  teePlayerIdByHole,
  teeCap,
  openedFromNextNavigation,
  onConfirm,
  onCancel,
}: {
  open: boolean
  hole: number | null
  existingStrokes?: number
  existingTeePlayerId?: string
  teammates: Array<{ id: string; name: string }>
  teePlayerIdByHole: Record<string, string>
  teeCap: number
  openedFromNextNavigation: boolean
  onConfirm: (strokes: number, teePlayerId: string) => void
  onCancel: () => void
}) {
  const meta = hole ? HOLE_META[hole - 1] : null
  const par = meta?.par ?? 4
  const [strokesInput, setStrokesInput] = React.useState('')
  const [teePlayerId, setTeePlayerId] = React.useState('')
  const [teeTouched, setTeeTouched] = React.useState(false)

  const usageExHole = React.useMemo(
    () => (hole ? teeUsageExcludingHole(teePlayerIdByHole, hole) : new Map()),
    [hole, teePlayerIdByHole],
  )

  React.useEffect(() => {
    if (!open || hole === null) return
    setStrokesInput((existingStrokes ?? par).toString())
    setTeePlayerId(existingTeePlayerId ?? '')
    setTeeTouched(false)
  }, [open, hole, existingStrokes, existingTeePlayerId, par])

  function submit() {
    const strokeCount = Number.parseInt(strokesInput, 10)
    if (!Number.isFinite(strokeCount) || strokeCount < 1 || strokeCount > 20)
      return
    if (!teePlayerId) {
      setTeeTouched(true)
      return
    }
    onConfirm(strokeCount, teePlayerId)
  }

  function bumpStrokes(delta: number) {
    const parsed = Number.parseInt(strokesInput, 10)
    const base = Number.isFinite(parsed) ? parsed : par
    setStrokesInput(String(Math.min(20, Math.max(1, base + delta))))
  }

  const quick = Array.from(new Set([par - 2, par - 1, par, par + 1, par + 2]))
    .filter((n) => n >= 1)
    .sort((a, b) => a - b)

  const teeError = teeTouched && !teePlayerId

  return (
    <Dialog
      open={open}
      onOpenChange={(next, details) => {
        if (next) return
        if (
          details.reason === 'outside-press' ||
          details.reason === 'escape-key'
        ) {
          onCancel()
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="rounded-2xl sm:max-w-sm"
      >
        <DialogHeader>
          <DialogTitle>
            {hole === null ? 'Score' : `Hole ${hole} score`}
          </DialogTitle>
          <DialogDescription>
            {openedFromNextNavigation ? (
              <>
                Add your team&apos;s score and tee-ball player, or tap outside
                the dialog and press Next again to skip this hole for now.
              </>
            ) : (
              <>
                Choose whose drive was used and enter the team&apos;s gross
                strokes. Tap outside the dialog to close without saving.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {hole !== null && meta && teammates.length > 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tee-player">Whose tee shot did you use?</Label>
              <select
                id="tee-player"
                className={cn(
                  'flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none',
                  'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  teeError && 'border-destructive ring-1 ring-destructive/40',
                )}
                value={teePlayerId}
                onChange={(e) => {
                  setTeePlayerId(e.target.value)
                  setTeeTouched(true)
                }}
                required
              >
                <option value="">Select a teammate…</option>
                {teammates.map((tm) => {
                  const usedElsewhere = usageExHole.get(tm.id) ?? 0
                  const disabled =
                    usedElsewhere >= teeCap && teePlayerId !== tm.id
                  return (
                    <option key={tm.id} value={tm.id} disabled={disabled}>
                      {tm.name}
                      {disabled ? ' (tee cap reached)' : ''}
                    </option>
                  )
                })}
              </select>
              {teeError && (
                <p className="text-xs text-destructive">
                  Pick whose tee shot counted before saving.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Each player can be tee player up to {teeCap} times (18 holes).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 shrink-0 rounded-xl"
                aria-label="Subtract one stroke"
                onClick={() => bumpStrokes(-1)}
              >
                <MinusIcon className="size-5" />
              </Button>
              <div className="flex min-w-0 flex-1 flex-wrap gap-2 justify-center">
                {quick.map((score) => (
                  <Button
                    key={score}
                    type="button"
                    size="sm"
                    variant={score === par ? 'default' : 'outline'}
                    className="rounded-full"
                    onClick={() => setStrokesInput(score.toString())}
                  >
                    {score}
                    {score === par ? ' • Par' : ''}
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 shrink-0 rounded-xl"
                aria-label="Add one stroke"
                onClick={() => bumpStrokes(1)}
              >
                <PlusIcon className="size-5" />
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="strokes">Strokes</Label>
              <Input
                id="strokes"
                className="h-11 text-center text-lg font-semibold tabular-nums"
                inputMode="numeric"
                pattern="[0-9]*"
                value={strokesInput}
                onChange={(e) => setStrokesInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Par {par} on this hole. Accepts 1–20.
              </p>
            </div>
          </div>
        )}

        {hole !== null && meta && teammates.length === 0 && (
          <p className="text-sm text-destructive">
            Your profile is missing a team roster. Re-run setup on this device.
          </p>
        )}

        <div className="mt-2 border-t border-border/60 pt-4">
          <Button
            type="button"
            className="h-14 w-full rounded-xl text-base font-semibold"
            disabled={teammates.length === 0}
            onClick={submit}
          >
            Save hole
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
