import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { buildGoalFinancialState } from '@/lib/finance'
import { Plus, Sparkles } from 'lucide-react'
import DemoSessionBootstrap from './DemoSessionBootstrap'
import MyGoalsList from './MyGoalsList'

// This page reads directly from the database with no dynamic API (no
// cookies/headers/searchParams), so Next.js can statically prerender it at
// build time — which happens before the production volume is mounted, baking
// in an empty goals list forever. Force per-request rendering so it always
// reflects the live database.
export const dynamic = 'force-dynamic'

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
            AI-Powered · Group Budgeting &amp; Finance
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
            Plan, budget, and achieve shared financial goals — together.
          </p>
        </div>

        {/* Goal Grid — filtered client-side to just the goals this browser has a token for */}
        <MyGoalsList
          goals={goals.map((goal) => {
            const fs = buildGoalFinancialState(goal)
            return {
              id: goal.id,
              title: goal.title,
              description: goal.description,
              targetAmount: goal.targetAmount,
              deadline: goal.deadline,
              status: goal.status,
              shareToken: goal.shareToken,
              financialState: {
                totalCollected: fs.totalCollected,
                totalOutstanding: fs.totalOutstanding,
                percentFunded: fs.percentFunded,
                paidCount: fs.paidCount,
                totalMembers: fs.totalMembers,
                riskStatus: fs.riskStatus,
              },
            }
          })}
        />

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
