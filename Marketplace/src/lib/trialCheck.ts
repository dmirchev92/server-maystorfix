/**
 * Client-side trial check utility
 * Checks if user's trial has expired and redirects to upgrade page
 */

export interface TrialStatus {
  isExpired: boolean
  casesUsed: number
  casesRemaining: number
  daysRemaining: number
}

export function checkTrialStatus(): TrialStatus | null {
  try {
    const userData = localStorage.getItem('user_data')
    if (!userData) return null

    const user = JSON.parse(userData)

    // Not a FREE tier user
    if (user.subscription_tier_id !== 'free') {
      return null
    }

    // Check if marked as expired
    if (user.trial_expired === true) {
      return {
        isExpired: true,
        casesUsed: user.trial_cases_used || 0,
        casesRemaining: 0,
        daysRemaining: 0
      }
    }

    // Calculate days elapsed
    if (user.trial_started_at) {
      const startDate = new Date(user.trial_started_at)
      const now = new Date()
      const daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const casesUsed = user.trial_cases_used || 0

      const isExpired = casesUsed >= 5 || daysElapsed >= 14

      return {
        isExpired,
        casesUsed,
        casesRemaining: Math.max(0, 5 - casesUsed),
        daysRemaining: Math.max(0, 14 - daysElapsed)
      }
    }

    return null
  } catch (error) {
    console.error('Error checking trial status:', error)
    return null
  }
}

export function redirectIfTrialExpired(currentPath: string): boolean {
  // Don't redirect if already on upgrade page or auth pages
  const allowedPaths = ['/upgrade-required', '/auth/login', '/auth/logout', '/subscriptions']
  if (allowedPaths.some(path => currentPath.startsWith(path))) {
    return false
  }

  const trialStatus = checkTrialStatus()
  if (trialStatus && trialStatus.isExpired) {
    window.location.href = '/upgrade-required'
    return true
  }

  return false
}
