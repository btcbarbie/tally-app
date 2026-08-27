'use client'

import { useEffect } from 'react'

// Demo token constants — must match prisma/seed.ts
const DEMO_ADMIN_GOAL_ID = 'goal-wedding-tolu'
const DEMO_ADMIN_TOKEN = 'demo-admin-token-tolu-wedding-2026'

const DEMO_MEMBER_GOAL_ID = 'goal-church-retreat'
const DEMO_MEMBER_TOKEN = 'demo-member-token-church-retreat-2026'
const DEMO_MEMBER_ID = 'member-church-you'

const BOOTSTRAP_KEY = 'tally_demo_bootstrapped_v2'

/**
 * Runs once on first load to seed localStorage with the demo admin/member
 * tokens so the GoalCards correctly show "Delete Contribution" and "Leave Group".
 *
 * This is reset (re-runs) if the user clears their localStorage or if the
 * bootstrap version key changes.
 */
export default function DemoSessionBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(BOOTSTRAP_KEY)) return

    // Seed goal 1: admin role
    localStorage.setItem(`tally_admin_${DEMO_ADMIN_GOAL_ID}`, DEMO_ADMIN_TOKEN)

    // Seed goal 2: member role
    localStorage.setItem(`tally_member_${DEMO_MEMBER_GOAL_ID}`, DEMO_MEMBER_TOKEN)
    localStorage.setItem(`tally_memberId_${DEMO_MEMBER_GOAL_ID}`, DEMO_MEMBER_ID)

    localStorage.setItem(BOOTSTRAP_KEY, '1')
  }, [])

  return null
}
