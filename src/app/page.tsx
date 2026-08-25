import Link from 'next/link'
import GoalCard from './GoalCard'
import { prisma } from '@/lib/prisma'
import { buildGoalFinancialState } from '@/lib/finance'
import { Plus, Sparkles, Target } from 'lucide-react'
import DemoSessionBootstrap from './DemoSessionBootstrap'

function getStatusBadge(status: string, riskStatus: string) {
  if (status === 'TARGET_REACHED') return { label: 'Goal Achieved! 🎉', cls: 'badge-green' }
  if (status === 'CLOSED') return { label: 'Closed', cls: 'badge-gray' }
  if (status === 'DEADLINE_REACHED') return { label: 'Deadline Reached', cls: 'badge-amber' }
  if (status === 'EXTENDED') return { label: 'Extended', cls: 'badge-blue' }
  if (riskStatus === 'AT_RISK') return { label: 'At Risk', cls: 'badge-red' }
  if (riskStatus === 'ON_TRACK') return { label: 'On Track', cls: 'badge-green' }
  return { label: 'Active', cls: 'badge-forest' }
}

function getProgressColor(percent: number, riskStatus: string) {
  if (percent >= 100) return 'progress-fill'
  if (riskStatus === 'AT_RISK') return 'progress-fill progress-fill-amber'
  return 'progress-fill'
}

function getMilestoneMessage(percent: number): string | null {
  if (percent >= 100) return '🎉 Goal Achieved!'
  if (percent >= 75) return '🚀 Almost there!'
  if (percent >= 50) return '⚡ Halfway there!'
  if (percent >= 25) return '✨ Great start!'
  return null
}

async function getGoals() {
  try {
    const goals = await prisma.goal.findMany({
      include: {
        commitments: { include: { member: true } },
        payments: true,
        members: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return goals
  } catch {
    return []
  }
}

export default async function HomePage() {
  const goals = await getGoals()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <DemoSessionBootstrap />
      {/* Nav */}
      <nav className="nav">
        <div className="container nav-inner">
          <a href="/" className="nav-brand">
            Tally<span>.</span>
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-muted)', display: 'none' }} className="hide-mobile">
              Collaborative Financial Planning
            </span>
            <Link href="/goals/create" className="btn btn-primary btn-sm">
              <Plus size={15} />
              Create Goal
            </Link>
          </div>
        </div>
      </nav>

      <div className="container" style={{ padding: '40px 24px' }}>
        {/* Hero */}
        <div style={{ marginBottom: '40px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--color-forest-subtle)',
              color: 'var(--color-forest)',
              padding: '6px 14px',
              borderRadius: '100px',
              fontSize: '12px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              marginBottom: '16px',
            }}
          >
            <Sparkles size={12} />
            AI-Powered · Group Finance
          </div>
          <h1
            style={{
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: '900',
              color: 'var(--color-charcoal)',
              letterSpacing: '-1px',
              lineHeight: '1.15',
              marginBottom: '10px',
            }}
          >
            My Shared Goals
          </h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '16px', maxWidth: '480px' }}>
            Plan, track, and achieve shared financial goals — together.
          </p>
        </div>

        {/* Goal Grid */}
        {goals.length === 0 ? (
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
        ) : (
          <div
            className="goals-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '20px',
            }}
          >
            {goals.map((goal) => {
              const fs = buildGoalFinancialState(goal)
              return (
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
                  financialState={{
                    totalCollected: fs.totalCollected,
                    totalOutstanding: fs.totalOutstanding,
                    percentFunded: fs.percentFunded,
                    paidCount: fs.paidCount,
                    totalMembers: fs.totalMembers,
                    riskStatus: fs.riskStatus,
                  }}
                />
              )
            })}
          </div>
        )}

        {/* Create CTA */}
        <div
          style={{
            marginTop: '32px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Link
            href="/goals/create"
            className="btn btn-primary btn-lg"
            style={{ gap: '10px' }}
          >
            <Plus size={20} />
            Create Shared Goal
          </Link>
        </div>

        {/* Footer tagline */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '48px',
            paddingTop: '32px',
            borderTop: '1px solid var(--color-border)',
            color: 'var(--color-muted)',
            fontSize: '13px',
          }}
        >
          <p style={{ marginBottom: '4px' }}>
            <strong style={{ color: 'var(--color-forest)' }}>Tally</strong> — AI-powered collaborative financial
            planning for groups, communities, and organizations.
          </p>
          <p>Plan · Commit · Track · Reconcile · Forecast · Decide · Close</p>
        </div>
      </div>
    </div>
  )
}
