import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { ArrowLeftIcon } from 'lucide-react'
import * as React from 'react'

import { api } from '../../convex/_generated/api'
import {
  COURSE_NAME,
  firstNamesLineForTeamId,
  firstNamesLineForTeamName,
} from '~/lib/golf-data'
import { buttonVariants } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { postSetupBackPath } from '~/lib/device-profile'
import { relativeToParShortLabel } from '~/lib/hole-score-indicator'
import { cn } from '~/lib/utils'
import {
  LEADERBOARD_CHAT_DOCK,
  PlayRouteChat,
} from '~/components/play-route-chat'

export const Route = createFileRoute('/leaderboard')({
  component: LeaderboardPage,
})

function LeaderboardPage() {
  const { data, isPending } = useQuery(convexQuery(api.golf.leaderboard, {}))
  const [backTo, setBackTo] = React.useState<
    ReturnType<typeof postSetupBackPath>
  >(() => '/')

  React.useEffect(() => {
    setBackTo(postSetupBackPath())
  }, [])

  return (
    <>
      <div className="mx-auto max-w-md px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mb-6 flex items-center gap-2">
          <Link
            to={backTo}
            aria-label="Back"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
              'rounded-full',
            )}
          >
            <ArrowLeftIcon className="size-5" />
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Leaderboard
            </h1>
            <p className="text-xs text-muted-foreground">{COURSE_NAME}</p>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Standings</CardTitle>
            <CardDescription>
              One score per team per hole. Totals are strokes vs par on holes
              played (completed rounds sort ahead of in-progress teams).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isPending && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {!isPending && (!data || data.length === 0) && (
              <p className="text-sm text-muted-foreground">
                No scores yet. Be the first to log a hole from Play golf.
              </p>
            )}
            {data?.map((row, idx) => (
              <div
                key={row.teamName}
                className="flex items-start justify-between rounded-xl border bg-card px-3 py-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-medium leading-none">{row.teamName}</p>
                      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                        {firstNamesLineForTeamId(row.teamId) ||
                          firstNamesLineForTeamName(row.teamName)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold leading-tight tabular-nums text-foreground">
                    {relativeToParShortLabel(row.relativeToPar)}
                  </p>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {row.holesPlayed}/18 holes
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <PlayRouteChat dockClassName={LEADERBOARD_CHAT_DOCK} />
    </>
  )
}
