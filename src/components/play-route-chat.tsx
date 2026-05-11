import { convexQuery } from '@convex-dev/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ConvexError } from 'convex/values'
import { ImagePlusIcon, MessageCircleIcon, XIcon } from 'lucide-react'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { DeviceProfile } from '~/lib/device-profile'
import { Button, buttonVariants } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet'
import { loadProfile } from '~/lib/device-profile'
import { compressLobbyChatImage } from '~/lib/chat-image-compress'
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
  const [busy, setBusy] = React.useState(false)
  const [pendingImage, setPendingImage] = React.useState<{
    blob: Blob
    previewUrl: string
  } | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [photoLightbox, setPhotoLightbox] = React.useState<{
    src: string
    alt: string
  } | null>(null)

  React.useEffect(() => {
    setProfile(loadProfile())
  }, [pathname, open])

  React.useEffect(() => {
    return () => {
      if (pendingImage?.previewUrl) {
        URL.revokeObjectURL(pendingImage.previewUrl)
      }
    }
  }, [pendingImage?.previewUrl])

  React.useEffect(() => {
    if (!open) {
      setPhotoLightbox(null)
    }
  }, [open])

  const eligible = chatEligibleProfile(profile)
  const myChatPlayerId = eligible ? profile.playerId : ''
  const sendChat = useMutation(api.playChat.send)
  const sendChatWithImage = useMutation(api.playChat.sendWithImage)
  const generateUploadUrl = useMutation(
    api.playChat.generateChatImageUploadUrl,
  )

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
    if (!eligible || busy) return
    const text = draft.trim()
    if (!text && !pendingImage) return
    try {
      setBusy(true)
      if (pendingImage) {
        const endpoint = await generateUploadUrl({})
        const post = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: pendingImage.blob,
        })
        if (!post.ok) {
          throw new Error('Photo upload failed. Check your connection and try again.')
        }
        type UploadResponse = { storageId: string }
        const uploaded = (await post.json()) as UploadResponse
        if (!uploaded.storageId) {
          throw new Error('Upload did not return a file id.')
        }
        await sendChatWithImage({
          playerId: profile.playerId,
          storageId: uploaded.storageId as Id<'_storage'>,
          caption: text || undefined,
        })
        if (pendingImage.previewUrl) {
          URL.revokeObjectURL(pendingImage.previewUrl)
        }
        setPendingImage(null)
        setDraft('')
      } else if (text) {
        await sendChat({ playerId: profile.playerId, body: text })
        setDraft('')
      }
    } catch (e: unknown) {
      if (e instanceof ConvexError && typeof e.data === 'string') {
        window.alert(e.data)
        return
      }
      window.alert(
        e instanceof Error ? e.message : 'Could not send your message.',
      )
    } finally {
      setBusy(false)
    }
  }

  function clearPendingImage() {
    setPendingImage((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
  }

  async function onPickPhoto(fileList: FileList | null) {
    const file = fileList?.item(0)
    if (!file || !eligible) return
    try {
      setBusy(true)
      const blob = await compressLobbyChatImage(file)
      if (pendingImage?.previewUrl) {
        URL.revokeObjectURL(pendingImage.previewUrl)
      }
      setPendingImage({
        blob,
        previewUrl: URL.createObjectURL(blob),
      })
    } catch (e: unknown) {
      window.alert(
        e instanceof Error ? e.message : 'Could not process that photo.',
      )
    } finally {
      setBusy(false)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
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
                        myChatPlayerId !== '' &&
                        m.playerId === myChatPlayerId
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
                          {m.imageUrl ? (
                            <div className="mt-2 flex justify-center rounded-lg border border-border/40 bg-muted/25 p-1.5">
                              <button
                                type="button"
                                className={cn(
                                  'touch-manipulation rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                                )}
                                aria-label={
                                  m.body.trim()
                                    ? `View larger: ${m.body.slice(0, 80)}`
                                    : `View ${m.playerName}'s photo larger`
                                }
                                onClick={() => {
                                  const src = m.imageUrl
                                  if (!src) return
                                  setPhotoLightbox({
                                    src,
                                    alt: m.body.trim()
                                      ? m.body
                                      : `Photo shared by ${m.playerName}`,
                                  })
                                }}
                              >
                                <img
                                  src={m.imageUrl}
                                  alt={
                                    m.body.trim()
                                      ? m.body
                                      : `Photo shared by ${m.playerName}`
                                  }
                                  loading="lazy"
                                  className="pointer-events-none block h-auto max-h-[7.25rem] w-auto max-w-[9rem] object-contain"
                                />
                              </button>
                            </div>
                          ) : null}
                          {m.body.trim() !== '' ? (
                            <p
                              className={cn(
                                'whitespace-pre-wrap break-words leading-snug text-foreground',
                                m.imageUrl ? 'mt-2' : '',
                              )}
                            >
                              {m.body}
                            </p>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </>
              )}
            </div>
          </div>

          {eligible ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
                onChange={(ev) => void onPickPhoto(ev.target.files)}
              />
              {pendingImage ? (
                <div className="pointer-events-auto relative mb-3 flex justify-center rounded-xl border border-border/50 bg-muted/30 px-2 py-2">
                  <button
                    type="button"
                    className={cn(
                      buttonVariants({
                        variant: 'secondary',
                        size: 'icon',
                      }),
                      'absolute right-1.5 top-1.5 z-[1] size-8 shrink-0 rounded-full bg-background/90 shadow-md',
                    )}
                    onClick={() => clearPendingImage()}
                    aria-label="Remove photo attachment"
                  >
                    <XIcon className="size-4" />
                  </button>
                  <img
                    src={pendingImage.previewUrl}
                    alt=""
                    className="block h-auto max-h-[5.5rem] w-auto max-w-[7rem] object-contain"
                  />
                </div>
              ) : null}
              <form
                className="pointer-events-auto flex shrink-0 items-center gap-2 border-t pt-3 pb-2"
                onSubmit={(ev) => {
                  ev.preventDefault()
                  void submit()
                }}
              >
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-xl"
                  aria-label="Attach photo"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlusIcon className="size-5" />
                </Button>
                <Input
                  className="h-11 flex-1 rounded-xl"
                  placeholder={
                    pendingImage
                      ? 'Add a caption (optional)…'
                      : 'Message the course…'
                  }
                  value={draft}
                  maxLength={500}
                  disabled={busy}
                  onChange={(ev) => setDraft(ev.target.value)}
                  aria-label="Chat message"
                />
                <Button
                  type="submit"
                  className="shrink-0 rounded-xl px-5"
                  disabled={
                    busy || (!draft.trim() && pendingImage === null)
                  }
                >
                  {busy ? 'Sending…' : 'Send'}
                </Button>
              </form>
            </>
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
      <Dialog
        open={photoLightbox !== null}
        onOpenChange={(next) => {
          if (!next) setPhotoLightbox(null)
        }}
      >
        <DialogContent
          showCloseButton={false}
          className={cn(
            'inset-0 flex h-[100dvh] w-screen max-h-none max-w-none translate-none rounded-none border-0 bg-black/95 p-0 shadow-none ring-0',
            'gap-0 outline-none sm:max-w-none sm:rounded-none',
          )}
        >
          <DialogTitle className="sr-only">
            {photoLightbox?.alt ?? 'Photo'}
          </DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-[max(0.5rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-[51] size-11 rounded-full text-white hover:bg-white/15"
            onClick={() => setPhotoLightbox(null)}
            aria-label="Close fullscreen photo"
          >
            <XIcon className="size-6" />
          </Button>
          {photoLightbox ? (
            <div
              role="presentation"
              className="flex min-h-0 flex-1 flex-col items-center justify-center px-3 pt-16 pb-[max(1rem,env(safe-area-inset-bottom))]"
              onClick={() => setPhotoLightbox(null)}
            >
              <img
                src={photoLightbox.src}
                alt={photoLightbox.alt}
                onClick={(ev) => ev.stopPropagation()}
                className="max-h-[min(88dvh,calc(100dvh-5.5rem))] max-w-[min(92vw,calc(100vw-1.5rem))] object-contain"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
