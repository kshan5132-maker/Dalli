interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  hover?: boolean
}

export default function Card({
  children,
  className = '',
  onClick,
  hover = false,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-bg-card rounded-2xl border border-border p-4 ${
        hover ? 'hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer' : ''
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
