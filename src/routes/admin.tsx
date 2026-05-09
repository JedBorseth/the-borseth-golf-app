import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { ArrowLeftIcon } from 'lucide-react'
import * as React from 'react'

import { api } from '../../convex/_generated/api'
import { ADMIN_OTP_CODE } from '~/lib/admin-otp'
import { loadProfile } from '~/lib/device-profile'
import { clearAllAppLocalStorage } from '~/lib/device-storage-clear'
import { TEAM_LABELS } from '~/lib/golf-data'
import { relativeToParShortLabel } from '~/lib/hole-score-indicator'
import { cn } from '~/lib/utils'

import { Button, buttonVariants } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '~/components/ui/input-otp'

export const Route = createFileRoute('/admin')({
  component: AdminPage,
})

const TEAM_IDS = ['t1', 't2', 't3', 't4', 't5'] as const

type TeamId = (typeof TEAM_IDS)[number]

function convexErrMessage(e: unknown): string {
  if (e instanceof ConvexError) {
    if (typeof e.data === 'string') return e.data
    if (
      typeof e.data === 'object' &&
      e.data &&
      typeof (e.data as { message?: string }).message === 'string'
    ) {
      return (e.data as { message: string }).message
    }
  }
  if (e instanceof Error) return e.message
  return 'Something went wrong'
}

function AdminPage() {
  const navigate = useNavigate()
  /** In-memory only until you leave /admin — not stored */
  const [adminPin, setAdminPin] = React.useState<string | null>(null)
  const [otpValue, setOtpValue] = React.useState('')
  const [otpError, setOtpError] = React.useState<string | null>(null)

  const locked = adminPin === null

  const leaderboardOpts = convexQuery(api.golf.leaderboard, {})
  const { data: leaderboardRows } = useQuery({
    ...leaderboardOpts,
    enabled: !locked,
  })

  const adminResetAll = useMutation(api.admin.adminResetAllHoleScores)
  const adminResetTeam = useMutation(api.admin.adminResetTeamHoleScores)
  const releasePlayer = useMutation(api.assignedPlayers.releasePlayer)

  const [inlineError, setInlineError] = React.useState<string | null>(null)
  const [pendingAction, setPendingAction] = React.useState<
    null | 'all' | 'device'
  >(null)
  const [pendingTeamId, setPendingTeamId] = React.useState<TeamId | null>(null)
  const [teamConfirmId, setTeamConfirmId] = React.useState<TeamId | null>(
    null,
  )
  const [showDangerDialog, setShowDangerDialog] = React.useState(false)

  const anyBusy = pendingAction !== null || pendingTeamId !== null

  async function wipeAllServer() {
    const pinVal = adminPin
    if (!pinVal) return
    setInlineError(null)
    setPendingAction('all')
    try {
      await adminResetAll({ pin: pinVal })
    } catch (e: unknown) {
      setInlineError(convexErrMessage(e))
    } finally {
      setPendingAction(null)
      setShowDangerDialog(false)
    }
  }

  async function resetTeamServer(teamId: TeamId) {
    const pinVal = adminPin
    if (!pinVal) return
    setInlineError(null)
    setPendingTeamId(teamId)
    setTeamConfirmId(null)
    try {
      await adminResetTeam({ pin: pinVal, teamId })
    } catch (e: unknown) {
      setInlineError(convexErrMessage(e))
    } finally {
      setPendingTeamId(null)
    }
  }

  async function wipeThisDevice() {
    setInlineError(null)
    setPendingAction('device')
    try {
      const p = loadProfile()
      if (p?.playerId) {
        await releasePlayer({ playerId: p.playerId })
      }
      clearAllAppLocalStorage()
      void navigate({ to: '/' })
    } catch (e: unknown) {
      setInlineError(convexErrMessage(e))
    } finally {
      setPendingAction(null)
    }
  }

  if (locked) {
    return (
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link
          to="/"
          aria-label="Back home"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
            'absolute left-4 top-[max(1rem,env(safe-area-inset-top))] rounded-full',
          )}
        >
          <ArrowLeftIcon className="size-5" />
        </Link>
        <div className="flex flex-1 flex-col items-center justify-center pb-24">
          <InputOTP
            autoFocus
            maxLength={4}
            aria-label="Admin code"
            aria-invalid={!!otpError}
            aria-describedby={otpError ? 'admin-otp-err' : undefined}
            value={otpValue}
            containerClassName="justify-center"
            onChange={(v) => {
              const next = v.replace(/\D/g, '').slice(0, 4)
              setOtpError(null)
              setOtpValue(next)
              if (next.length !== 4) return
              if (next !== ADMIN_OTP_CODE) {
                setOtpError('Incorrect')
                setOtpValue('')
                return
              }
              setAdminPin(next)
            }}
          >
            <InputOTPGroup>
              {[0, 1, 2, 3].map((slot) => (
                <InputOTPSlot index={slot} key={slot} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {otpError ? (
            <p
              id="admin-otp-err"
              className="mt-3 text-sm text-destructive"
              role="alert"
            >
              {otpError}
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
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
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Admin
        </h1>
      </div>

      {inlineError && (
        <p className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {inlineError}
        </p>
      )}

      <Dialog open={showDangerDialog} onOpenChange={setShowDangerDialog}>
        <DialogContent className="max-w-[min(calc(100vw-2rem),22rem)]">
          <DialogHeader>
            <DialogTitle>Wipe leaderboard?</DialogTitle>
            <DialogDescription>
              This deletes every hole score for every team on the server.
              Phones keep their copies until something syncs again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={pendingAction !== null || pendingTeamId !== null}
              className="w-full rounded-xl sm:w-auto"
              onClick={() => void wipeAllServer()}
            >
              {pendingAction === 'all' ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={teamConfirmId !== null}
        onOpenChange={(open) => {
          if (!open) setTeamConfirmId(null)
        }}
      >
        <DialogContent className="max-w-[min(calc(100vw-2rem),22rem)]">
          <DialogHeader>
            <DialogTitle>
              Reset {teamConfirmId ? TEAM_LABELS[teamConfirmId] : 'team'}?
            </DialogTitle>
            <DialogDescription>
              This removes every hole logged for this team on the server. Other teams are unchanged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={teamConfirmId === null || pendingTeamId !== null}
              className="w-full rounded-xl sm:w-auto"
              onClick={() => {
                if (teamConfirmId) void resetTeamServer(teamConfirmId)
              }}
            >
              {teamConfirmId && pendingTeamId === teamConfirmId
                ? 'Resetting…'
                : 'Reset team'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Teams</CardTitle>
          <CardDescription>Server leaderboard snapshot — tap reset per team.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {TEAM_IDS.map((id) => {
              const row =
                leaderboardRows === undefined
                  ? undefined
                  : leaderboardRows.find(
                      (entry) =>
                        entry.teamId === id ||
                        (entry.teamId == null &&
                          entry.teamName === TEAM_LABELS[id]),
                    )
              const loadingRow = leaderboardRows === undefined

              let statsUi: React.ReactNode
              if (loadingRow) {
                statsUi = (
                  <span className="text-muted-foreground">Loading server…</span>
                )
              } else if (row) {
                statsUi = (
                  <>
                    <span className="tabular-nums font-medium text-foreground">
                      {relativeToParShortLabel(row.relativeToPar)}
                    </span>
                    <span className="text-muted-foreground"> vs par · </span>
                    <span className="tabular-nums">{row.holesPlayed}</span>
                    <span className="text-muted-foreground">/18 holes</span>
                  </>
                )
              } else {
                statsUi = 'No server scores'
              }

              const loadingThisTeam = pendingTeamId === id

              return (
                <li
                  key={id}
                  className="flex flex-row items-start justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{TEAM_LABELS[id]}</p>
                    <p className="text-xs leading-snug text-muted-foreground">
                      {statsUi}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 rounded-lg"
                    disabled={anyBusy}
                    onClick={() => setTeamConfirmId(id)}
                  >
                    {loadingThisTeam ? '…' : 'Reset'}
                  </Button>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button
          variant="destructive"
          type="button"
          className="rounded-xl sm:flex-1"
          disabled={anyBusy}
          onClick={() => setShowDangerDialog(true)}
        >
          Clear all scores (server)
        </Button>
        <Button
          variant="destructive"
          type="button"
          className="rounded-xl sm:flex-1"
          disabled={anyBusy}
          onClick={() => wipeThisDevice()}
        >
          Clear this device
        </Button>
      </div>
    </div>
  )
}
