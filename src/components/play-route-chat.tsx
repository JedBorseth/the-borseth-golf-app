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
import { ScrollArea } from '~/components/ui/scroll-area'
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

export function PlayRouteChat() {
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
    enabled: open && eligible,
  })

  const bottomSentinel = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!(open && messages?.length)) return
    bottomSentinel.current?.scrollIntoView({
      behavior: messages.length <= 15 ? 'auto' : 'smooth',
      block: 'end',
    })
  }, [messages, open])

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
        'bottom-[calc(6.25rem+env(safe-area-inset-bottom,0px))] right-4',
        // Keep clear of notch / horizontal safe area on landscape phones
        'max-sm:right-[max(1rem,env(safe-area-inset-right))]',
      )}
    >
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          type="button"
          className={cn(
            buttonVariants({ variant: 'default', size: 'icon' }),
            'pointer-events-auto size-14 rounded-full shadow-lg',
          )}
          aria-label="Play tab chat"
        >
          <MessageCircleIcon className="size-6" />
        </SheetTrigger>

        <SheetContent
          side="bottom"
          showCloseButton
          className="flex max-h-[min(92dvh,760px)] flex-col gap-0 rounded-t-3xl border-t px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
        >
          <SheetHeader className="shrink-0 pb-2 text-left">
            <SheetTitle>Live chat</SheetTitle>
          </SheetHeader>

          {!eligible ? (
            <div className="text-sm text-muted-foreground">
              <p className="mb-4">
                Chat uses your claimed player identity. Finish Golf Play setup
                on this phone (pick your name and register your team) to join.
              </p>
              <Link
                to="/play/setup"
                className={cn(
                  buttonVariants({ variant: 'default' }),
                  'pointer-events-auto inline-flex rounded-full',
                )}
                onClick={() => setOpen(false)}
              >
                Go to setup
              </Link>
            </div>
          ) : (
            <>
              <ScrollArea className="mb-4 min-h-[40dvh] flex-1 pr-2">
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
                            eligible && m.playerId === profile.playerId
                          const teamLabel = teamLabelForPlayerId(m.playerId)
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
                              <p className="whitespace-pre-wrap break-words text-foreground leading-snug">
                                {m.body}
                              </p>
                            </div>
                          )
                        })
                      )}
                    </>
                  )}
                  <div ref={bottomSentinel} />
                </div>
              </ScrollArea>

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
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
