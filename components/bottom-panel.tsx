'use client'

import * as React from 'react'
import { Drawer } from 'vaul'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BottomPanelProps {
  isOpen: boolean
  onClose: () => void
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  defaultHeight?: string // default: '40vh'
  maxHeight?: string // default: '80vh'
  showCloseButton?: boolean // default: true
}

export function BottomPanel({
  isOpen,
  onClose,
  title,
  icon,
  children,
  defaultHeight = '40vh',
  maxHeight = '80vh',
  showCloseButton = true,
}: BottomPanelProps) {
  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      direction="bottom"
      modal={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay
          className="pointer-events-none fixed inset-0 z-40 bg-black/20"
          style={{ '--drawer-transition-duration': '300ms' } as React.CSSProperties}
        />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl border-t border-border bg-background shadow-2xl"
          style={{
            height: defaultHeight,
            maxHeight: maxHeight,
            '--drawer-transition-duration': '300ms',
          } as React.CSSProperties}
          onEscapeKeyDown={onClose}
        >
          {/* Drag Handle */}
          <div className="flex items-center justify-center pt-3 pb-2">
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 pb-3">
            <div className="flex items-center gap-2">
              {icon && <span className="text-muted-foreground">{icon}</span>}
              <Drawer.Title className="text-lg font-semibold text-foreground">
                {title}
              </Drawer.Title>
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label="Close panel"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Content Area - Scrollable */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-4">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
