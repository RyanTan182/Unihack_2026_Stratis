/**
 * Demo preferences utility for Stratis.
 * Manages localStorage keys for demo state persistence.
 */

// localStorage keys
export const DEMO_PREFERENCES_KEYS = {
  SKIP_DEMO: 'stratis_skip_demo',
  DEMO_COMPLETED: 'stratis_demo_completed',
  DEFAULT_DESTINATION: 'stratis_default_destination',
} as const

/**
 * Get the skip demo preference.
 * @returns true if user has opted to skip the demo
 */
export function getSkipDemo(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(DEMO_PREFERENCES_KEYS.SKIP_DEMO) === 'true'
}

/**
 * Set the skip demo preference.
 * @param skip - true to skip demo on future visits
 */
export function setSkipDemo(skip: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(DEMO_PREFERENCES_KEYS.SKIP_DEMO, skip ? 'true' : 'false')
}

/**
 * Get the demo completed preference.
 * @returns true if user has completed the demo
 */
export function getDemoCompleted(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(DEMO_PREFERENCES_KEYS.DEMO_COMPLETED) === 'true'
}

/**
 * Set the demo completed preference.
 * @param completed - true if demo has been completed
 */
export function setDemoCompleted(completed: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(DEMO_PREFERENCES_KEYS.DEMO_COMPLETED, completed ? 'true' : 'false')
}

/**
 * Get the default destination country.
 * @returns the default destination country, or 'United States' if not set
 */
export function getDefaultDestination(): string {
  if (typeof window === 'undefined') return 'United States'
  return localStorage.getItem(DEMO_PREFERENCES_KEYS.DEFAULT_DESTINATION) || 'United States'
}

/**
 * Set the default destination country.
 * @param country - the default destination country
 */
export function setDefaultDestination(country: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(DEMO_PREFERENCES_KEYS.DEFAULT_DESTINATION, country)
}

/**
 * Clear all demo preferences.
 * This resets the demo state, allowing the demo to be shown again.
 */
export function clearDemoPreferences(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(DEMO_PREFERENCES_KEYS.SKIP_DEMO)
  localStorage.removeItem(DEMO_PREFERENCES_KEYS.DEMO_COMPLETED)
  localStorage.removeItem(DEMO_PREFERENCES_KEYS.DEFAULT_DESTINATION)
}

/**
 * Check if demo should be shown.
 * @returns true if demo should be shown (not skipped and not completed)
 */
export function shouldShowDemo(): boolean {
  return !getSkipDemo() && !getDemoCompleted()
}
