import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ChevronDown,
  FlagIcon,
  ListOrderedIcon,
  ScrollTextIcon,
  ShareIcon,
  XIcon,
} from 'lucide-react'
import * as React from 'react'

import { buttonVariants } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { clearProfile, loadProfile } from '~/lib/device-profile'
import { IOS_PWA_TIP_DISMISSED_KEY } from '~/lib/device-storage-clear'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/')({
  component: WelcomePage,
})

function WelcomePage() {
  const navigate = useNavigate()
  const [showIosInstallTip, setShowIosInstallTip] = React.useState(false)
  const [showSpectatorReplayLink, setShowSpectatorReplayLink] =
    React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isAppleTouchDevice() || isStandalonePwa()) return
    try {
      if (window.localStorage.getItem(IOS_PWA_TIP_DISMISSED_KEY) === '1') return
    } catch {
      /* ignore */
    }
    setShowIosInstallTip(true)
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const p = loadProfile()
    setShowSpectatorReplayLink(
      !!p?.onboardingComplete && p.role === 'spectator',
    )
  }, [])

  function replaySetup() {
    clearProfile()
    void navigate({ to: '/play/setup' })
  }

  return (
    <div
      className={cn(
        'relative mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]',
        showIosInstallTip && 'pb-32 sm:pb-36',
      )}
    >
      <header className="space-y-2 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Family weekend
        </p>
        <h1 className="text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Borseth{' '}
          <Link to="/admin" className="cursor-text">
            Cup
          </Link>
        </h1>
        <p className="text-pretty text-sm text-muted-foreground">
          Rules, live leaderboard, and an easy phone-first scorecard for the
          group.
        </p>
      </header>

      <Card className="border-emerald-900/15 bg-gradient-to-b from-emerald-50/90 to-card shadow-sm dark:border-emerald-100/10 dark:from-emerald-950/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Play golf</CardTitle>
          <CardDescription>
            One-time prompts on this device, then jump straight into the round.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link
            to="/play/setup"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'h-14 justify-center rounded-xl text-base shadow-sm',
            )}
          >
            <FlagIcon className="mr-2 size-5" aria-hidden />
            Start playing
          </Link>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/rules"
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'h-auto flex-col gap-2 rounded-xl py-5',
          )}
        >
          <ScrollTextIcon className="size-6 opacity-80" aria-hidden />
          <span className="font-medium">Rules</span>
        </Link>
        <Link
          to="/leaderboard"
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'h-auto flex-col gap-2 rounded-xl py-5',
          )}
        >
          <ListOrderedIcon className="size-6 opacity-80" aria-hidden />
          <span className="font-medium">Leaderboard</span>
        </Link>
      </div>

      {showSpectatorReplayLink && (
        <p className="mt-auto text-center text-[11px] leading-snug text-muted-foreground">
          <button
            type="button"
            onClick={replaySetup}
            className="text-muted-foreground underline-offset-2 hover:underline"
            title="Clears this device and opens setup again"
          >
            Not a spectator?
          </button>
        </p>
      )}

      {showIosInstallTip && (
        <IosAddToHomeScreenTip
          onDismiss={() => {
            try {
              window.localStorage.setItem(IOS_PWA_TIP_DISMISSED_KEY, '1')
            } catch {
              /* ignore */
            }
            setShowIosInstallTip(false)
          }}
        />
      )}
    </div>
  )
}

function IosAddToHomeScreenTip({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4"
      role="note"
      aria-label="How to add this app to your Home Screen on iPhone or iPad"
    >
      <div className="flex w-full max-w-sm flex-col items-center pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto relative w-full rounded-2xl border border-border/80 bg-card/95 px-4 py-3 pr-10 text-center shadow-lg backdrop-blur-md supports-[backdrop-filter]:bg-card/85">
          <button
            type="button"
            onClick={onDismiss}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
              'absolute right-1 top-1 rounded-full text-muted-foreground hover:text-foreground',
            )}
            aria-label="Dismiss install tip"
          >
            <XIcon className="size-4" aria-hidden />
          </button>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Tip: install like an app
          </p>
          <p className="mt-2 text-left text-xs leading-relaxed text-foreground">
            In <strong>Safari</strong>, tap the{' '}
            <span className="inline-flex items-center gap-0.5 font-semibold">
              <ShareIcon
                className="inline size-3.5 translate-y-px"
                aria-hidden
              />
              Share
            </span>{' '}
            button <strong className="font-semibold">at the bottom</strong> of
            the screen (square with an arrow pointing up). Scroll the list, tap{' '}
            <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
          </p>
        </div>
        <ChevronDown
          className="-mt-px size-8 text-muted-foreground motion-safe:animate-bounce"
          strokeWidth={2}
          aria-hidden
        />
      </div>
    </div>
  )
}

function isAppleTouchDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return (
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
    true
  )
}
