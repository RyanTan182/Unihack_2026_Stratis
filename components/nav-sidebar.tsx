"use client"

import {
  Home,
  Mail,
  BarChart2,
  FileText,
  Flag,
  MapPin,
  List,
  Users,
  Globe,
  Compass,
  HelpCircle,
  Layers,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type ActiveItem = "locations" | "inventory"

interface NavItem {
  icon: React.ElementType
  label: string
  key?: ActiveItem
}

const navItems: NavItem[] = [
  { icon: Home, label: "Dashboard" },
  { icon: Mail, label: "Alerts" },
  { icon: BarChart2, label: "Analytics" },
  { icon: FileText, label: "Reports" },
  { icon: Flag, label: "Flags" },
  { icon: MapPin, label: "Locations", key: "locations" },
  { icon: List, label: "Inventory", key: "inventory" },
  { icon: Users, label: "Suppliers" },
  { icon: Globe, label: "Global View" },
  { icon: Compass, label: "Routes" },
  { icon: Layers, label: "Layers" },
  { icon: HelpCircle, label: "Help" },
]

interface NavSidebarProps {
  activeItem?: ActiveItem
  onNavigate?: (item: ActiveItem) => void
}

export function NavSidebar({ activeItem = "locations", onNavigate }: NavSidebarProps) {
  return (
    <TooltipProvider>
      <div className="flex h-full w-12 flex-col items-center border-r border-sidebar-border bg-sidebar py-4">
        {/* Logo */}
        <div className="mb-6 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <span className="text-lg font-bold">S</span>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-1 flex-col items-center gap-1">
          {navItems.map((item) => {
            const isActive = item.key === activeItem
            const isInteractive = !!item.key

            return (
              <Tooltip key={item.label} delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      !isInteractive && "cursor-default"
                    )}
                    onClick={() => {
                      if (isInteractive && onNavigate) {
                        onNavigate(item.key!)
                      }
                    }}
                  >
                    <item.icon className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        {/* Status Indicator */}
        <div className="mt-auto">
          <div className="flex h-10 w-10 items-center justify-center">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
