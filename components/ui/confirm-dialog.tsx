"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  onConfirm: () => void
  loading?: boolean
}

/**
 * ConfirmDialog - Standardized confirmation dialog
 * Use for: Destructive actions, important decisions
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-border/50 bg-card/95 backdrop-blur-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-border/50 hover:bg-muted/50">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            asChild
            onClick={onConfirm}
          >
            <Button
              variant={variant === "destructive" ? "destructive" : "default"}
              disabled={loading}
              className={variant === "destructive" ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90"}
            >
              {loading ? "Processing..." : confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * useConfirmDialog - Hook for managing confirmation dialog state
 */
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  const requestConfirm = (action: () => void) => {
    setPendingAction(() => action)
    setIsOpen(true)
  }

  const handleConfirm = () => {
    if (pendingAction) {
      pendingAction()
      setPendingAction(null)
    }
    setIsOpen(false)
  }

  const handleCancel = () => {
    setPendingAction(null)
    setIsOpen(false)
  }

  return {
    isOpen,
    setIsOpen,
    requestConfirm,
    handleConfirm,
    handleCancel,
  }
}
