'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import GoalCard from './GoalCard'
import { Plus, Target, Sparkles } from 'lucide-react'
import { buildGoalFinancialState } from '@/lib/finance'

// Bump this if the demo-cloning shape ever changes, to force a fresh clone
// for browsers that already bootstrapped under an older scheme.
const DEMO_BOOTSTRAP_KEY = 'tally_demo_bootstrapped_v3'

// IDs of the two demo goals cloned for this browser, so their cards can be
// clearly labelled as interactive samples rather than groups the visitor made.
const DEMO_IDS_KEY = 'tally_demo_goal_ids'

// Known titles of the seeded demo goals — a fallback so browsers that
// bootstrapped before DEMO_IDS_KEY existed still get the "Sample" label.
const DEMO_TITLES = ["Tolu's Wedding Gift", 'Church Youth Retreat']

export interface GoalListItem {
  id: string
  title: string
  description?: string | null
  targetAmount: number
  deadline: string | Date
  status: string
  shareToken: string
  financialState: {
    totalCollected: number
    totalOutstanding: number
    percentFunded: number
    paidCount: number
    totalMembers: number
    riskStatus: string
  }
}

// Shape returned by GET /api/goals — a raw goal row with its relations,
// before it's been reduced to the financial-state summary GoalCard wants.
interface RawGoal {
  id: string
  title: string
  description?: string | null
  targetAmount: number
  deadline: string
  status: string
  shareToken: string
  equalAmount?: number | null
  expectedParticipants: number
  contributionType: string
  commitments: Array<{
    committedAmount: number
    paidAmount: number
    outstandingAmount: number
    status: string
    member: { name: string }
  }>
  payments: Array<{ amount: number; verificationStatus: string; date: string }>
}

function toGoalListItem(g: RawGoal): GoalListItem {
  const fs = buildGoalFinancialState(g)
  return {
    id: g.id,
    title: g.title,
    description: g.description,
    targetAmount: g.targetAmount,
    deadline: g.deadline,
    status: g.status,
    shareToken: g.shareToken,
    financialState: {
      totalCollected: fs.totalCollected,
      totalOutstanding: fs.totalOutstanding,
      percentFunded: fs.percentFunded,
      paidCount: fs.paidCount,
      totalMembers: fs.totalMembers,
      riskStatus: fs.riskStatus,
    },
  }
}

// The server hands us every goal in the database (it has no access to this
// browser's localStorage). We filter down to only the goals this browser
// actually holds an admin or member token for — so a goal a member just
// left (which removes that token) drops off their dashboard immediately,
// and strangers visiting the homepage don't see everyone else's groups.
//
// On a brand-new browser (no bootstrap flag yet), we also create this
// visitor their own private copy of the two demo goals via /api/demo,
// instead of everyone sharing — and being able to break — one global demo.
export default function MyGoalsList({ goals }: { goals: GoalListItem[] }) {
  const [myGoals, setMyGoals] = useState<GoalListItem[] | null>(null)
  const [demoIds, setDemoIds] = useState<string[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false

    // A browser that bootstrapped earlier but whose recorded demo goals have
    // all disappeared from the database (e.g. the demo data was rebuilt on
    // the server) is left holding dead tokens — which surface as a broken
    // "Member session not found" page. Detect that and re-bootstrap a fresh
    // set, clearing the stale keys first. Guarded on `goals.length > 0` so a
    // transient empty response (DB hiccup) doesn't wipe a valid session.
    let orphanedDemoIds: string[] = []
    if (localStorage.getItem(DEMO_BOOTSTRAP_KEY) && goals.length > 0) {
      let recorded: string[] = []
      try {
        recorded = JSON.parse(localStorage.getItem(DEMO_IDS_KEY) || '[]')
      } catch {
        recorded = []
      }
      const liveIds = new Set(goals.map((g) => g.id))
      if (recorded.length > 0 && !recorded.some((id) => liveIds.has(id))) {
        orphanedDemoIds = recorded
      }
    }

    // Claim the bootstrap flag synchronously, before any await, so React's
    // dev-mode double-invocation of effects (or any other re-entrant call)
    // can't both see it unset and both fire a clone request.
    const needsBootstrap = !localStorage.getItem(DEMO_BOOTSTRAP_KEY) || orphanedDemoIds.length > 0
    if (needsBootstrap) {
      orphanedDemoIds.forEach((id) => {
        localStorage.removeItem(`tally_admin_${id}`)
        localStorage.removeItem(`tally_member_${id}`)
        localStorage.removeItem(`tally_memberId_${id}`)
      })
      if (orphanedDemoIds.length > 0) localStorage.removeItem(DEMO_IDS_KEY)
      localStorage.setItem(DEMO_BOOTSTRAP_KEY, '1')
    }

    ;(async () => {
      let source = goals

      if (needsBootstrap) {
        try {
          const res = await fetch('/api/demo', { method: 'POST' })
          if (res.ok) {
            const data = await res.json()
            localStorage.setItem(`tally_admin_${data.adminGoalId}`, data.adminToken)
            localStorage.setItem(`tally_member_${data.memberGoalId}`, data.memberToken)
            localStorage.setItem(DEMO_IDS_KEY, JSON.stringify([data.adminGoalId, data.memberGoalId]))
          }
        } catch (e) {
          console.error(e)
        }

        // The `goals` prop was fetched by the server before the clone
        // above, so it won't include the new demo goals yet. Re-fetch
        // fresh from the client instead of reloading the page — a page
        // reload's result depends on HTTP caching behavior we don't
        // control, while this fetch is explicitly told not to use the
        // cache.
        try {
          const res = await fetch('/api/goals', { cache: 'no-store' })
          if (res.ok) {
            const data = await res.json()
            source = (data.goals as RawGoal[]).map(toGoalListItem)
          }
        } catch (e) {
          console.error(e)
        }
      }

      const mine = source.filter(
        (g) => localStorage.getItem(`tally_admin_${g.id}`) || localStorage.getItem(`tally_member_${g.id}`)
      )

      let storedDemoIds: string[] = []
      try {
        storedDemoIds = JSON.parse(localStorage.getItem(DEMO_IDS_KEY) || '[]')
      } catch {
        storedDemoIds = []
      }
      const resolvedDemoIds = mine
        .filter((g) => storedDemoIds.includes(g.id) || DEMO_TITLES.includes(g.title))
        .map((g) => g.id)

      if (!cancelled) {
        setDemoIds(resolvedDemoIds)
        setMyGoals(mine)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [goals])

  if (myGoals === null) {
    return <p style={{ color: 'var(--color-muted)', fontSize: '14px' }}>Loading your goals…</p>
  }

  if (myGoals.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '80px 24px',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            background: 'var(--color-forest-subtle)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <Target size={28} color="var(--color-forest)" />
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>No shared goals yet</h2>
        <p style={{ color: 'var(--color-muted)', marginBottom: '24px' }}>
          Create your first group financial goal to get started.
        </p>
        <Link href="/goals/create" className="btn btn-primary">
          <Plus size={16} />
          Create Your First Goal
        </Link>
      </div>
    )
  }

  const hasSamples = myGoals.some((g) => demoIds.includes(g.id))

  return (
    <>
      {hasSamples && (
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
            background: 'var(--color-forest-subtle)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            padding: '14px 16px',
            marginBottom: '20px',
            fontSize: '13px',
            lineHeight: '1.55',
            color: 'var(--color-charcoal-mid)',
          }}
        >
          <Sparkles size={16} color="var(--color-forest)" style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>
            <strong>These are sample groups</strong> — pre-filled with example members and payments
            so you can explore how Tally works. Poke around freely, then create your own goal when
            you&apos;re ready.
          </span>
        </div>
      )}
      <div
        className="goals-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px',
        }}
      >
        {myGoals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={{
              id: goal.id,
              title: goal.title,
              description: goal.description,
              targetAmount: goal.targetAmount,
              deadline: goal.deadline,
              status: goal.status,
              shareToken: goal.shareToken,
            }}
            financialState={goal.financialState}
            isSample={demoIds.includes(goal.id)}
          />
        ))}
      </div>
    </>
  )
}
