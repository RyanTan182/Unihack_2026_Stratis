"use client"

import { Home, Package, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { IconButton } from "@/components/ui/icon-button"

interface NavItem {
  icon: React.ElementType
  label: string
  active?: boolean
  onClick?: () => void
}

interface NavSidebarProps {
  onInventoryClick?: () => void
  isInventoryOpen?: boolean
  onLocationClick?: () => void
  isLocationActive?: boolean
}

export function NavSidebar({
  onInventoryClick,
  isInventoryOpen,
  onLocationClick,
  isLocationActive,
}: NavSidebarProps) {
  const navItems: NavItem[] = [
    { icon: Home, label: "Risk & Locations", active: isLocationActive, onClick: onLocationClick },
    { icon: Package, label: "Inventory", active: isInventoryOpen, onClick: onInventoryClick },
  ]
  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full w-full flex-col items-center border-r border-sidebar-border bg-sidebar py-4 stagger-children">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-1">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg glow-primary">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-[10px] font-semibold tracking-wider text-primary uppercase">Stratis</span>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-1 flex-col items-center gap-1">
          {navItems.map((item) => (
            <Tooltip key={item.label} delayDuration={0}>
              <TooltipTrigger asChild>
                <IconButton
                  icon={<item.icon className="h-5 w-5" />}
                  variant={item.active ? "active" : "ghost"}
                  aria-label={item.label}
                  onClick={item.onClick}
                  className={cn(
                    item.active && "relative"
                  )}
                >
                  {item.active && (
                    <>
                      <span className="absolute inset-0 rounded-lg bg-primary/10" />
                      <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                    </>
                  )}
                </IconButton>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={8}
                className="glass-panel border-border/50 bg-card/95 px-3 py-1.5 text-xs font-medium shadow-xl"
              >
                {item.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </nav>

        {/* Status Indicator */}
        <div className="mt-auto flex flex-col items-center gap-2">
          <div className="relative flex h-10 w-10 items-center justify-center">
            <div className="absolute h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
            <div className="absolute h-3 w-3 animate-ping rounded-full bg-emerald-500/50" />
          </div>
          <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Live</span>
        </div>
      </div>
    </TooltipProvider>
  )
}