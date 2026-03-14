'use client'
import { useState, useEffect } from "react"
import { CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

type ToastType = "success" | "error" | "warning" | "info"

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, "id">) => void
  removeToast: (id: string) => void
}

// Simple toast notification system
let toastId = 0
let listeners: Array<(toasts: Toast[]) => void> = []
let currentToasts: Toast[] = []

function emitChange() {
  listeners.forEach((listener) => listener([...currentToasts]))
}

function addToast(toast: Omit<Toast, "id">) {
  const id = `toast-${++toastId}`
  currentToasts = [...currentToasts, { ...toast, id }]
  emitChange()

  // Auto-remove after 4 seconds
  setTimeout(() => {
    removeToast(id)
  }, 4000)
}

function removeToast(id: string) {
  currentToasts = currentToasts.filter((t) => t.id !== id)
  emitChange()
}

/**
 * useToasts - Hook for toast notifications
 */
export function useToasts(): ToastContextValue {
  const [toasts, setToasts] = useState<Toast[]>(currentToasts)

  useEffect(() => {
    listeners.push(setToasts)
    return () => {
      listeners = listeners.filter((l) => l !== setToasts)
    }
  }, [])

  return { toasts, addToast, removeToast }
}

const toastStyles: Record<ToastType, { bg: string; border: string; icon: typeof CheckCircle }> = {
  success: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    icon: CheckCircle,
  },
  error: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    icon: XCircle,
  },
  warning: {
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    icon: AlertTriangle,
  },
  info: {
    bg: "bg-primary/10",
    border: "border-primary/30",
    icon: Info,
  },
}

const toastIconColors: Record<ToastType, string> = {
  success: "text-emerald-400",
  error: "text-red-400",
  warning: "text-yellow-400",
  info: "text-primary",
}

/**
 * ToastContainer - Container for displaying toast notifications
 */
export function ToastContainer() {
  const { toasts, removeToast } = useToasts()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const style = toastStyles[toast.type]
        const Icon = style.icon

        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl animate-in slide-in-from-right-4 backdrop-blur-xl",
              style.bg,
              style.border
            )}
          >
            <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", toastIconColors[toast.type])} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{toast.title}</p>
              {toast.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
