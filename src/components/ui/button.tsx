import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'accent'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ className, variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 cursor-pointer active:scale-[0.98]',
        {
          'bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/20': variant === 'primary',
          'bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary',
          'border border-border bg-white hover:bg-muted': variant === 'outline',
          'hover:bg-muted': variant === 'ghost',
          'bg-destructive text-white hover:bg-destructive/90': variant === 'destructive',
          'bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm shadow-accent/20': variant === 'accent',
        },
        {
          'h-8 px-3 text-xs rounded-lg gap-1.5': size === 'sm',
          'h-10 px-5 text-sm gap-2': size === 'md',
          'h-12 px-6 text-base gap-2': size === 'lg',
        },
        className
      )}
      {...props}
    />
  )
}
