"use client"

import {
  Home,
  Package,
  AlertTriangle,
  Zap,
  Activity,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  icon: React.ElementType
  label: string
  description?: string
  active?: boolean
  onClick?: () => void
}

interface NavSidebarProps {
  onInventoryClick?: () => void
  isInventoryOpen?: boolean
  onLocationClick?: () => void
  isLocationActive?: boolean
  onAlertsClick?: () => void
  isAlertsActive?: boolean
  onLogoClick?: () => void
  productCount?: number
  riskLevel?: "low" | "medium" | "high"
  alertCount?: number
}

export function NavSidebar({
  onInventoryClick,
  isInventoryOpen,
  onLocationClick,
  isLocationActive,
  onAlertsClick,
  isAlertsActive,
  onLogoClick,
  productCount = 0,
  riskLevel = "low",
  alertCount = 0,
}: NavSidebarProps) {
  const navItems: NavItem[] = [
    {
      icon: Home,
      label: "Risk & Locations",
      description: "Global overview",
      active: isLocationActive,
      onClick: onLocationClick
    },
    {
      icon: Package,
      label: "Inventory",
      description: `${productCount} products`,
      active: isInventoryOpen,
      onClick: onInventoryClick
    },
    {
      icon: AlertTriangle,
      label: "Alerts",
      description: alertCount > 0 ? `${alertCount} active` : "No alerts",
      active: isAlertsActive,
      onClick: onAlertsClick
    },
  ]

  const riskColors = {
    low: "text-emerald-500",
    medium: "text-amber-500",
    high: "text-red-500",
  }

  return (
    <div className="flex h-full w-[200px] flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo Header */}
      <button
        onClick={onLogoClick}
        className="flex cursor-pointer items-center gap-3 border-b border-sidebar-border px-4 py-4 transition-colors hover:bg-sidebar-accent"
        aria-label="Home"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 shadow-md">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="flex flex-col items-start">
          <span className="text-sm font-semibold tracking-tight">Stratis</span>
          <span className="text-[10px] text-muted-foreground">Supply Chain</span>
        </div>
      </button>

      {/* Navigation Items */}
      <nav className="flex-1 p-2">
        <div className="mb-2 px-3 pt-2 pb-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Navigation
          </span>
        </div>
        <div className="space-y-1 stagger-children">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-200",
                "cursor-pointer",
                item.active
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/70 hover:bg-sidebar-accent hover:text-foreground"
              )}
              aria-label={item.label}
            >
              <item.icon className={cn(
                "h-4 w-4 flex-shrink-0",
                item.active ? "text-primary" : "text-muted-foreground"
              )} />
              <div className="flex flex-col min-w-0">
                <span className={cn(
                  "text-sm font-medium truncate",
                  item.active && "text-primary"
                )}>
                  {item.label}
                </span>
                {item.description && (
                  <span className="text-[11px] text-muted-foreground truncate">
                    {item.description}
                  </span>
                )}
              </div>
              {item.active && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
              {item.label === "Alerts" && alertCount > 0 && (
                <div className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-medium text-destructive-foreground">
                  {alertCount}
                </div>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Status Footer */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Activity className={cn("h-4 w-4", riskColors[riskLevel])} />
            <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium">System Status</span>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
