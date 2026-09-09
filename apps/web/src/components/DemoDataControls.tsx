import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Database, Eraser } from 'lucide-react'
import { clearDemoData, hasDemoData, resetDemoData } from '@/lib/seed'

/**
 * Loads or wipes the sample records the mock phase runs on.
 *
 * Whoever opens the published link needs to see a populated system, and
 * whoever is checking the empty states needs the opposite. Both are one click
 * away rather than a devtools trip through `localStorage`.
 *
 * The query cache is cleared alongside the data: the screens read from the
 * cache, so leaving it behind would show rows that no longer exist.
 */
export function DemoDataControls() {
  const queryClient = useQueryClient()
  const [loaded, setLoaded] = useState(hasDemoData)

  const apply = (action: () => void, nowLoaded: boolean) => {
    action()
    setLoaded(nowLoaded)
    void queryClient.invalidateQueries()
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="px-2 text-caption text-ink-subtle">Dados de demonstração</p>
      <div className="flex gap-1">
        <DemoButton
          label="Aplicar"
          icon={<Database size={15} aria-hidden />}
          disabled={loaded}
          onClick={() => apply(resetDemoData, true)}
        />
        <DemoButton
          label="Limpar"
          icon={<Eraser size={15} aria-hidden />}
          disabled={!loaded}
          onClick={() => apply(clearDemoData, false)}
        />
      </div>
    </div>
  )
}

function DemoButton({
  label,
  icon,
  disabled,
  onClick,
}: Readonly<{
  label: string
  icon: React.ReactNode
  disabled: boolean
  onClick: () => void
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-chip)] border border-line px-2 py-2 text-caption text-ink-muted transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
      {label}
    </button>
  )
}
