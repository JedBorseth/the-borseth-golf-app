import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/play')({
  component: PlayLayout,
})

function PlayLayout() {
  return <Outlet />
}
