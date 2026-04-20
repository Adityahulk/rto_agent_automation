import type { ReactNode } from 'react'

type EmptyStateProps = {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="text-text-secondary/40">{icon}</div>
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      <p className="max-w-sm text-sm text-text-secondary">{description}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}
