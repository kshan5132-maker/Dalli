interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="text-text-muted mb-3">{icon}</div>
      )}
      <h3 className="text-base font-semibold text-text-secondary mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-text-muted mb-4 max-w-[260px]">{description}</p>
      )}
      {action}
    </div>
  )
}
