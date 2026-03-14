'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidePanelProps {
  isOpen: boolean
  onClose: () => void
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  width?: string // default: '380px'
  showCloseButton?: boolean // default: true
}

export function SidePanel({
  isOpen,
  onClose,
  title,
  icon,
  children,
  width = '380px',
  showCloseButton = true,
}: SidePanelProps) {
  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return (
    <>
      {/* Backdrop - subtle, doesn't block map/sidebar interaction */}
      <div
        className={cn(
          "fixed inset-0 z-20 bg-black/10 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{ left: 'var(--sidebar-width)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 h-full border-l border-border bg-background/95 backdrop-blur-xl shadow-2xl",
          "transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        style={{ width }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2.5">
            {icon && <span className="text-primary">{icon}</span>}
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
          </div>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Content Area - Scrollable */}
        <div className="h-[calc(100vh-57px)] overflow-y-auto overscroll-contain p-4">
          {children}
        </div>
      </div>
    </>
  )
}
