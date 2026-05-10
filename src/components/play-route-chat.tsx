import { convexQuery } from '@convex-dev/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ConvexError } from 'convex/values'
import { MessageCircleIcon } from 'lucide-react'

import { api } from '../../convex/_generated/api'
import type { DeviceProfile } from '~/lib/device-profile'
import { Button, buttonVariants } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet'
import { loadProfile } from '~/lib/device-profile'
import { PLAYERS, TEAM_LABELS } from '~/lib/golf-data'
import { cn } from '~/lib/utils'

function chatEligibleProfile(p: DeviceProfile | null): p is DeviceProfile & {
  playerId: string
  playerName: string
  teamId: string
  teamName: string
  role: 'player'
} {
  return !!(
    p?.onboardingComplete &&
    p.role === 'player' &&
    p.playerId &&
    p.playerName &&
    p.teamName &&
    p.teamId
  )
}

function formatChatTime(ms: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms))
}

function teamLabelForPlayerId(playerId: string): string {
  const player = PLAYERS.find((p) => p.id === playerId)
  if (!player) return ''
  return TEAM_LABELS[player.teamId] ?? player.teamId
}

const DEFAULT_DOCK =
  'bottom-[calc(6.25rem+env(safe-area-inset-bottom,0px))] right-4 max-sm:right-[max(1rem,env(safe-area-inset-right))]'

/** Tailwind classes for the chat FAB position on leaderboard (corner above bottom safe area). */
export const LEADERBOARD_CHAT_DOCK =
  'bottom-[max(1rem,env(safe-area-inset-bottom,0px))] right-4 max-sm:right-[max(1rem,env(safe-area-inset-right))]'

type PlayRouteChatProps = {
  /** Fixed-position classes for the FAB (default: above Play hole controls). */
  dockClassName?: string
}

export function PlayRouteChat({ dockClassName }: PlayRouteChatProps = {}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState('')
  const [profile, setProfile] = React.useState<DeviceProfile | null>(null)

  React.useEffect(() => {
    setProfile(loadProfile())
  }, [pathname, open])

  const eligible = chatEligibleProfile(profile)
  const sendChat = useMutation(api.playChat.send)

  const { data: messages, isPending } = useQuery({
    ...convexQuery(api.playChat.recent, { limit: 100 }),
    enabled: open,
  })

  const listScrollRef = React.useRef<HTMLDivElement | null>(null)

  const scrollListToBottom = React.useCallback(() => {
    const el = listScrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  /** Flex layouts need a late layout pass before scrollHeight is final. */
  React.useLayoutEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollListToBottom()
      })
    })
  }, [open, messages, isPending, scrollListToBottom])

  async function submit() {
    if (!eligible) return
    const text = draft.trim()
    if (!text) return
    try {
      await sendChat({ playerId: profile.playerId, body: text })
      setDraft('')
    } catch (e: unknown) {
      if (e instanceof ConvexError && typeof e.data === 'string') {
        window.alert(e.data)
        return
      }
      window.alert(
        e instanceof Error ? e.message : 'Could not send your message.',
      )
    }
  }

  return (
    <div
      className={cn(
        'pointer-events-none fixed z-40',
        dockClassName ?? DEFAULT_DOCK,
      )}
    >
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          type="button"
          className={cn(
            buttonVariants({ variant: 'default', size: 'icon' }),
            'pointer-events-auto size-14 rounded-full shadow-lg',
          )}
          aria-label="Open live chat"
        >
          <MessageCircleIcon className="size-6" />
        </SheetTrigger>

        <SheetContent
          side="bottom"
          showCloseButton
          className="flex h-[min(85dvh,760px)] min-h-0 max-h-[min(92dvh,800px)] flex-col gap-0 overflow-hidden rounded-t-3xl border-t px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
        >
          <SheetHeader className="shrink-0 pb-2 text-left">
            <SheetTitle>Live chat</SheetTitle>
          </SheetHeader>

          <div
            ref={listScrollRef}
            className={cn(
              'mb-4 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]',
              '[scrollbar-gutter:stable]',
            )}
          >
            <div className="space-y-3 pb-2">
              {isPending ? (
                <p className="text-sm text-muted-foreground">
                  Loading messages…
                </p>
              ) : (
                <>
                  {(messages ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No messages yet — say hello to the course.
                    </p>
                  ) : (
                    (messages ?? []).map((m) => {
                      const mine =
                        eligible && m.playerId === profile?.playerId
                      const teamLabel =
                        m.teamDisplayName ?? teamLabelForPlayerId(m.playerId)
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            'rounded-2xl border px-3 py-2 text-sm',
                            mine
                              ? 'ml-6 border-primary/35 bg-primary/10'
                              : 'mr-4 border-border/70 bg-muted/40',
                          )}
                        >
                          <div className="mb-0.5 flex items-baseline justify-between gap-2">
                            <span className="font-medium leading-none">
                              {m.playerName}
                            </span>
                            <time
                              className="tabular-nums text-[10px] text-muted-foreground"
                              dateTime={new Date(m.sentAt).toISOString()}
                            >
                              {formatChatTime(m.sentAt)}
                            </time>
                          </div>
                          {teamLabel ? (
                            <p className="mb-1 text-[11px] leading-tight text-muted-foreground">
                              {teamLabel}
                            </p>
                          ) : null}
                          <p className="whitespace-pre-wrap break-words leading-snug text-foreground">
                            {m.body}
                          </p>
                        </div>
                      )
                    })
                  )}
                </>
              )}
            </div>
          </div>

          {eligible ? (
            <form
              className="pointer-events-auto flex shrink-0 items-center gap-2 border-t pt-3"
              onSubmit={(ev) => {
                ev.preventDefault()
                void submit()
              }}
            >
              <Input
                className="h-11 flex-1 rounded-xl"
                placeholder="Message the course…"
                value={draft}
                maxLength={500}
                onChange={(ev) => setDraft(ev.target.value)}
                aria-label="Chat message"
              />
              <Button
                type="submit"
                className="shrink-0 rounded-xl px-5"
                disabled={!draft.trim()}
              >
                Send
              </Button>
            </form>
          ) : (
            <div className="pointer-events-auto shrink-0 space-y-3 border-t pt-3 pb-0.5">
              <p className="text-xs leading-snug text-muted-foreground">
                You can read the chat anytime. To send messages, finish Play
                setup on this phone (claim your player and register your team).
              </p>
              <Link
                to="/play/setup"
                className={cn(
                  buttonVariants({ variant: 'secondary' }),
                  'inline-flex h-10 w-full rounded-xl sm:w-auto',
                )}
                onClick={() => setOpen(false)}
              >
                Go to Play setup
              </Link>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
