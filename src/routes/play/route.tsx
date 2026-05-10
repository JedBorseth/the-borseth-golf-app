import { Outlet, createFileRoute } from '@tanstack/react-router'

import { PlayRouteChat } from '~/components/play-route-chat'

export const Route = createFileRoute('/play')({
  component: PlayLayout,
})

function PlayLayout() {
  return (
    <>
      <Outlet />
      <PlayRouteChat />
    </>
  )
}
