import * as React from 'react'

/**
 * DemoStep interface for the Stratis supply chain demo auto-play feature.
 * Each step represents an action that can be executed during the demo.
 */
export interface DemoStep {
  id: string
  action: 'zoom' | 'popup' | 'highlight' | 'route' | 'alert' | 'wait'
  target?: string
  params?: Record<string, any>
  duration: number // milliseconds
  description: string // Human-readable description for UI
}

/**
 * Predefined demo steps for the Stratis supply chain demo.
 * This array contains 5 steps that demonstrate the key features:
 * 1. Zoom to Taiwan
 * 2. Show Taiwan semiconductor info popup
 * 3. Highlight Strait of Hormuz chokepoint
 * 4. Animate Taiwan-US route through Hormuz
 * 5. Show high risk alert banner
 */
export const DEMO_STEPS: DemoStep[] = [
  {
    id: 'step-1',
    action: 'zoom',
    target: 'Taiwan',
    params: {
      zoom: 4,
      center: { lat: 23.6978, lng: 120.9605 }
    },
    duration: 2000,
    description: 'Zooming to Taiwan - the heart of global semiconductor manufacturing'
  },
  {
    id: 'step-2',
    action: 'popup',
    target: 'Taiwan',
    params: {
      title: 'Taiwan Semiconductor Industry',
      content: 'Taiwan produces over 60% of the world\'s semiconductors and more than 90% of the most advanced chips. TSMC alone manufactures chips for Apple, AMD, Nvidia, and Qualcomm.',
      type: 'info'
    },
    duration: 3000,
    description: 'Displaying Taiwan semiconductor industry information'
  },
  {
    id: 'step-3',
    action: 'highlight',
    target: 'Strait of Hormuz',
    params: {
      color: '#FF4444',
      pulse: true,
      coordinates: { lat: 26.5476, lng: 56.4667 }
    },
    duration: 2000,
    description: 'Highlighting Strait of Hormuz - a critical maritime chokepoint'
  },
  {
    id: 'step-4',
    action: 'route',
    target: 'Taiwan-US',
    params: {
      origin: { lat: 23.6978, lng: 120.9605 },
      destination: { lat: 37.7749, lng: -122.4194 },
      waypoints: [{ lat: 26.5476, lng: 56.4667 }],
      color: '#FF6B35',
      animate: true
    },
    duration: 3000,
    description: 'Animating Taiwan-US supply chain route through Hormuz'
  },
  {
    id: 'step-5',
    action: 'alert',
    target: 'risk-banner',
    params: {
      level: 'high',
      title: 'High Risk Alert',
      message: 'Strait of Hormuz transit shows elevated risk due to current geopolitical tensions. Consider alternative routing through Cape of Good Hope.',
      autoDismiss: false
    },
    duration: 3000,
    description: 'Showing high risk alert banner for supply chain disruption'
  }
]

/**
 * State interface for the demo mode hook.
 */
export interface DemoModeState {
  isDemoMode: boolean
  isPaused: boolean
  currentStep: number
  totalSteps: number
  progress: number // 0-100
}

/**
 * Actions interface for the demo mode hook.
 */
export interface DemoModeActions {
  startDemo: () => void
  stopDemo: () => void
  pauseDemo: () => void
  resumeDemo: () => void
  nextStep: () => void
  prevStep: () => void
}

/**
 * Custom hook for managing demo auto-play state and controls.
 *
 * @param onStepExecute - Optional callback function that executes when a step runs.
 *                        This allows the parent component to handle the actual step execution.
 * @returns DemoModeState & DemoModeActions - The current state and action handlers.
 *
 * @example
 * ```tsx
 * const { isDemoMode, currentStep, progress, startDemo, stopDemo } = useDemoMode(async (step) => {
 *   console.log('Executing step:', step.description)
 *   // Handle step execution (e.g., zoom map, show popup, etc.)
 * })
 * ```
 */
export function useDemoMode(
  onStepExecute?: (step: DemoStep) => Promise<void>
): DemoModeState & DemoModeActions {
  const [isDemoMode, setIsDemoMode] = React.useState<boolean>(false)
  const [isPaused, setIsPaused] = React.useState<boolean>(false)
  const [currentStep, setCurrentStep] = React.useState<number>(0)

  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const isExecutingRef = React.useRef<boolean>(false)

  const totalSteps = DEMO_STEPS.length

  // Calculate progress percentage (0-100)
  const progress = isDemoMode
    ? Math.round(((currentStep + 1) / totalSteps) * 100)
    : 0

  // Clear any pending timeout
  const clearPendingTimeout = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  // Execute a step and schedule the next one
  const executeStep = React.useCallback(async (stepIndex: number) => {
    if (!isDemoMode || isPaused || stepIndex >= totalSteps) {
      return
    }

    const step = DEMO_STEPS[stepIndex]
    isExecutingRef.current = true

    try {
      // Execute the step callback if provided
      if (onStepExecute) {
        await onStepExecute(step)
      }
    } catch (error) {
      console.error('Error executing demo step:', step.id, error)
    }

    // Schedule the next step after the duration
    if (stepIndex < totalSteps - 1 && isDemoMode && !isPaused) {
      timeoutRef.current = setTimeout(() => {
        setCurrentStep(prev => prev + 1)
      }, step.duration)
    }

    isExecutingRef.current = false
  }, [isDemoMode, isPaused, totalSteps, onStepExecute])

  // Start the demo
  const startDemo = React.useCallback(() => {
    setIsDemoMode(true)
    setIsPaused(false)
    setCurrentStep(0)
  }, [])

  // Stop the demo
  const stopDemo = React.useCallback(() => {
    clearPendingTimeout()
    setIsDemoMode(false)
    setIsPaused(false)
    setCurrentStep(0)
  }, [clearPendingTimeout])

  // Pause the demo
  const pauseDemo = React.useCallback(() => {
    clearPendingTimeout()
    setIsPaused(true)
  }, [clearPendingTimeout])

  // Resume the demo
  const resumeDemo = React.useCallback(() => {
    if (isDemoMode && isPaused) {
      setIsPaused(false)
    }
  }, [isDemoMode, isPaused])

  // Go to next step
  const nextStep = React.useCallback(() => {
    if (currentStep < totalSteps - 1) {
      clearPendingTimeout()
      setCurrentStep(prev => prev + 1)
    }
  }, [currentStep, totalSteps, clearPendingTimeout])

  // Go to previous step
  const prevStep = React.useCallback(() => {
    if (currentStep > 0) {
      clearPendingTimeout()
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep, clearPendingTimeout])

  // Effect to execute step when currentStep changes
  React.useEffect(() => {
    if (isDemoMode && !isPaused) {
      executeStep(currentStep)
    }
  }, [isDemoMode, isPaused, currentStep, executeStep])

  // Effect to stop demo when reaching the last step
  React.useEffect(() => {
    if (isDemoMode && currentStep >= totalSteps - 1) {
      const lastStep = DEMO_STEPS[totalSteps - 1]
      // After the last step duration, stop the demo
      timeoutRef.current = setTimeout(() => {
        setIsDemoMode(false)
      }, lastStep.duration)
    }
  }, [isDemoMode, currentStep, totalSteps])

  // Keyboard shortcut support (press 'D' to toggle)
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only trigger if not in an input field
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      if (event.key === 'd' || event.key === 'D') {
        event.preventDefault()
        if (isDemoMode) {
          stopDemo()
        } else {
          startDemo()
        }
      }

      // Space to pause/resume
      if (event.key === ' ' && isDemoMode) {
        event.preventDefault()
        if (isPaused) {
          resumeDemo()
        } else {
          pauseDemo()
        }
      }

      // Arrow keys for navigation
      if (isDemoMode) {
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          nextStep()
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault()
          prevStep()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDemoMode, isPaused, startDemo, stopDemo, pauseDemo, resumeDemo, nextStep, prevStep])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      clearPendingTimeout()
    }
  }, [clearPendingTimeout])

  return {
    // State
    isDemoMode,
    isPaused,
    currentStep,
    totalSteps,
    progress,
    // Actions
    startDemo,
    stopDemo,
    pauseDemo,
    resumeDemo,
    nextStep,
    prevStep
  }
}
