import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'
import * as React from 'react'
import type { ReactNode } from 'react'

import { buttonVariants } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { postSetupBackPath } from '~/lib/device-profile'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/rules')({
  component: RulesPage,
})

function RulesPage() {
  const [backTo, setBackTo] = React.useState<
    ReturnType<typeof postSetupBackPath>
  >(() => '/')

  React.useEffect(() => {
    setBackTo(postSetupBackPath())
  }, [])

  return (
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
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Tournament rules
        </h1>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Scramble match</CardTitle>
          <CardDescription>Format, pace, and gimmes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <RuleSection title="Format">
            <ul className="list-disc space-y-1 pl-5">
              <li>18-hole stroke play scramble match.</li>
              <li>
                You must use 3 tee shots from each team member during the round.
              </li>
            </ul>
          </RuleSection>
          <RuleSection title="Scoring">
            <ul className="list-disc space-y-1 pl-5">
              <li>Enter scores on each hole before hopping to the next.</li>
              <li>The leaderboard updates live for everyone.</li>
            </ul>
          </RuleSection>
          <RuleSection title="Etiquette">
            <ul className="list-disc space-y-1 pl-5">
              <li>Repair ball marks and rake bunkers.</li>
              <li>Cart-path-only when posted.</li>
            </ul>
          </RuleSection>
          <RuleSection title="Questions?">
            <p>
              Ask <strong>Josh</strong> or <strong>Jed</strong> before teeing
              off hole 1.
            </p>
          </RuleSection>
        </CardContent>
      </Card>
    </div>
  )
}

function RuleSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  )
}
