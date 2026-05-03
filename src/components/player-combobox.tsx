import * as React from 'react'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'

import { cn } from '~/lib/utils'
import { buttonVariants } from '~/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'

type PlayerOption = { id: string; name: string }

export function PlayerCombobox({
  players,
  valueId,
  onSelect,
  placeholder = 'Search players…',
}: {
  players: Array<PlayerOption>
  valueId: string | null
  onSelect: (id: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = React.useState(false)

  const selected = players.find((p) => p.id === valueId) ?? null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'h-12 w-full justify-between rounded-xl border-border/80 px-3 font-normal',
        )}
      >
        <span className="truncate">
          {selected ? selected.name : placeholder}
        </span>
        <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,420px)] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} className="h-11" />
          <CommandList className="max-h-[min(50vh,320px)]">
            <CommandEmpty>No player found.</CommandEmpty>
            <CommandGroup heading="Players">
              {players.map((player) => (
                <CommandItem
                  key={player.id}
                  value={player.name}
                  keywords={[player.name]}
                  onSelect={() => {
                    onSelect(player.id)
                    setOpen(false)
                  }}
                >
                  <CheckIcon
                    className={cn(
                      'mr-2 size-4',
                      valueId === player.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {player.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
