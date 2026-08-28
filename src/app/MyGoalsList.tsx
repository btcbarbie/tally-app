'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import GoalCard from './GoalCard'
import { Plus, Target } from 'lucide-react'

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

// The server hands us every goal in the database (it has no access to this
// browser's localStorage). We filter down to only the goals this browser
// actually holds an admin or member token for — so a goal a member just
// left (which removes that token) drops off their dashboard immediately,
// and strangers visiting the homepage don't see everyone else's groups.
export default function MyGoalsList({ goals }: { goals: GoalListItem[] }) {
  const [myGoals, setMyGoals] = useState<GoalListItem[] | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mine = goals.filter(
      (g) => localStorage.getItem(`tally_admin_${g.id}`) || localStorage.getItem(`tally_member_${g.id}`)
    )
    setMyGoals(mine)
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

  return (
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
        />
      ))}
    </div>
  )
}
