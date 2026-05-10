import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ConvexError } from 'convex/values'
import { useMutation } from 'convex/react'
import * as React from 'react'
import { ArrowLeftIcon } from 'lucide-react'

import { api } from '../../../convex/_generated/api'
import { PlayerCombobox } from '~/components/player-combobox'
import { Button, buttonVariants } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { emptyProfile, loadProfile, saveProfile } from '~/lib/device-profile'
import {
  PLAYERS,
  TEAM_LABELS,
  teammatesForPlayer,
} from '~/lib/golf-data'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/play/setup')({
  component: PlaySetupPage,
})

type Step = 'role' | 'name' | 'team'

function PlaySetupPage() {
  const navigate = useNavigate()
  const [ready, setReady] = React.useState(false)
  const [step, setStep] = React.useState<Step>('role')
  const [playerId, setPlayerId] = React.useState<string | null>(null)

  const takenOpts = convexQuery(api.assignedPlayers.listTakenPlayerIds, {})
  const { data: takenPlayerIds, isPending: takenPending } = useQuery(takenOpts)
  const claimPlayer = useMutation(api.assignedPlayers.claimPlayer)
  const ensureTeamPlaceholder = useMutation(api.golf.ensureTeamPlaceholderScorecard)

  const takenSet = React.useMemo(
    () => new Set(takenPlayerIds ?? []),
    [takenPlayerIds],
  )
  const availablePlayers = React.useMemo(
    () => PLAYERS.filter((p) => !takenSet.has(p.id)),
    [takenSet],
  )
  const comboboxPlayers = React.useMemo(
    () => availablePlayers.map((p) => ({ id: p.id, name: p.name })),
    [availablePlayers],
  )

  React.useEffect(() => {
    if (step !== 'name') return
    if (playerId === null) return
    if (!takenSet.has(playerId)) return
    setPlayerId(null)
  }, [step, playerId, takenSet])

  React.useEffect(() => {
    const existing = loadProfile()
    if (existing?.onboardingComplete) {
      if (existing.role === 'player') {
        void navigate({ to: '/play', replace: true })
        return
      }
      void navigate({ to: '/leaderboard', replace: true })
      return
    }
    setReady(true)
  }, [navigate])

  function finishSpectator() {
    saveProfile({
      ...emptyProfile(),
      role: 'spectator',
      onboardingComplete: true,
    })
    void navigate({ to: '/leaderboard' })
  }

  async function finishPlayer(
    selectedId: string,
    teamDisplayName: string,
  ): Promise<void> {
    const player = PLAYERS.find((p) => p.id === selectedId)
    if (!player) return
    try {
      await claimPlayer({ playerId: selectedId })
    } catch (e: unknown) {
      if (e instanceof ConvexError && typeof e.data === 'string') {
        window.alert(e.data)
        return
      }
      window.alert(
        e instanceof Error ? e.message : 'Could not save your player pick.',
      )
      return
    }
    const fallback = TEAM_LABELS[player.teamId] ?? 'Team'
    const name = teamDisplayName.trim() || fallback
    let serverTeamDisplayName: string
    try {
      const ensured = await ensureTeamPlaceholder({
        teamId: player.teamId,
        teamName: name,
      })
      serverTeamDisplayName = ensured.teamDisplayName
    } catch (e: unknown) {
      if (e instanceof ConvexError && typeof e.data === 'string') {
        window.alert(e.data)
        return
      }
      window.alert(
        e instanceof Error
          ? e.message
          : 'Could not register your team on the leaderboard. Try again.',
      )
      return
    }
    saveProfile({
      version: 1,
      role: 'player',
      playerId: player.id,
      playerName: player.name,
      teamId: player.teamId,
      teamName: serverTeamDisplayName,
      onboardingComplete: true,
    })
    void navigate({ to: '/play' })
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">
        Loading setup…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mb-6 flex items-center gap-2">
        <Link
          to="/"
          aria-label="Back home"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
            'rounded-full',
          )}
        >
          <ArrowLeftIcon className="size-5" />
        </Link>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Play golf
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Quick setup
          </h1>
        </div>
      </div>

      {step === 'role' && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Are you playing?</CardTitle>
            <CardDescription>
              Spectators jump straight to the live leaderboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              size="lg"
              className="h-12 rounded-xl text-base"
              onClick={() => setStep('name')}
            >
              I&apos;m playing
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-xl text-base"
              onClick={finishSpectator}
            >
              Just spectating
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'name' && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Who are you?</CardTitle>
            <CardDescription>
              Search the roster — names already picked on another phone are
              hidden.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {takenPending ? (
              <p className="text-sm text-muted-foreground">Loading roster…</p>
            ) : comboboxPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Everyone on the roster is already assigned on another device.
                Ask a teammate to clear their device from Admin if this is a
                mistake.
              </p>
            ) : (
              <PlayerCombobox
                players={comboboxPlayers}
                valueId={playerId}
                onSelect={setPlayerId}
              />
            )}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              variant="ghost"
              className="flex-1 rounded-xl"
              onClick={() => setStep('role')}
            >
              Back
            </Button>
            <Button
              className="flex-1 rounded-xl"
              disabled={
                !playerId || takenPending || comboboxPlayers.length === 0
              }
              onClick={() => setStep('team')}
            >
              Continue
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 'team' && playerId && (
        <TeamConfirmCard
          playerId={playerId}
          onBack={() => setStep('name')}
          onConfirm={(teamDisplayName) => finishPlayer(playerId, teamDisplayName)}
        />
      )}
    </div>
  )
}

function TeamConfirmCard({
  playerId,
  onBack,
  onConfirm,
}: {
  playerId: string
  onBack: () => void
  onConfirm: (teamDisplayName: string) => Promise<void>
}) {
  const teammates = teammatesForPlayer(playerId)
  const player = PLAYERS.find((p) => p.id === playerId)
  const teamIdForQuery = player?.teamId ?? ''
  const label = player ? TEAM_LABELS[player.teamId] ?? 'Team' : 'Team'

  const serverTeamNameOpts = convexQuery(api.golf.teamDisplayNameOnServer, {
    teamId: teamIdForQuery || '__unset__',
  })
  const { data: serverTeamNameRaw, isFetched: serverNameFetched } = useQuery({
    ...serverTeamNameOpts,
    enabled: teamIdForQuery.length > 0,
  })

  const serverSuggestedName =
    serverNameFetched &&
    typeof serverTeamNameRaw === 'string' &&
    serverTeamNameRaw.length > 0
      ? serverTeamNameRaw
      : undefined

  const defaultTeamName = serverSuggestedName ?? label
  const [teamNameInput, setTeamNameInput] = React.useState(defaultTeamName)
  const [confirming, setConfirming] = React.useState(false)

  React.useEffect(() => {
    setTeamNameInput(defaultTeamName)
  }, [playerId, defaultTeamName])

  const hintBaseline = serverSuggestedName ?? label

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Your teammates</CardTitle>
        <CardDescription>
          Confirm this is the squad you are walking with today.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="team-display-name">Team name</Label>
          <Input
            id="team-display-name"
            value={teamNameInput}
            onChange={(e) => setTeamNameInput(e.target.value)}
            placeholder={label}
            className="rounded-xl"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Defaults to {hintBaseline}. Change it if your group uses another name
            on the leaderboard.
          </p>
        </div>
        <ul className="space-y-2 rounded-xl border bg-card px-3 py-3 text-sm">
          {teammates.map((t) => (
            <li key={t.id} className="flex items-center justify-between">
              <span>{t.name}</span>
              {t.id === playerId && (
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  You
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="ghost"
          className="flex-1 rounded-xl"
          onClick={onBack}
          disabled={confirming}
        >
          No, pick another name
        </Button>
        <Button
          className="flex-1 rounded-xl"
          disabled={confirming}
          onClick={() => {
            setConfirming(true)
            void (async () => {
              try {
                await onConfirm(teamNameInput)
              } finally {
                setConfirming(false)
              }
            })()
          }}
        >
          {confirming ? 'Saving…' : "Yes, that's my team"}
        </Button>
      </CardFooter>
    </Card>
  )
}
