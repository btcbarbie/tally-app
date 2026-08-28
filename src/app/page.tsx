import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { buildGoalFinancialState } from '@/lib/finance'
import { Plus, Sparkles } from 'lucide-react'
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
        <div style={{ marginBottom: '48px', maxWidth: '640px' }}>
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
              fontSize: 'clamp(30px, 5vw, 46px)',
              fontWeight: '900',
              color: 'var(--color-charcoal)',
              letterSpacing: '-1.5px',
              lineHeight: '1.1',
              marginBottom: '16px',
            }}
          >
            Plan money together.
            {' '}
            <span style={{ color: 'var(--color-forest)' }}>Reach your goal together.</span>
          </h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '17px', lineHeight: '1.6', marginBottom: '16px' }}>
            Tally helps groups manage shared financial goals — from weddings and group trips
            to church projects and community initiatives.
          </p>
          <p style={{ color: 'var(--color-muted)', fontSize: '17px', lineHeight: '1.6', marginBottom: '28px' }}>
            Set a target, invite contributors, track commitments and payments, reconcile
            receipts, and see whether your group is on track — all in one place.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <Link href="/goals/create" className="btn btn-primary btn-lg" style={{ gap: '8px' }}>
              <Plus size={18} />
              Create a goal
            </Link>
            <a href="#how-it-works" className="btn btn-secondary btn-lg">
              See how it works
            </a>
          </div>
        </div>

        {/* How it works */}
        <div id="how-it-works" style={{ marginBottom: '48px', scrollMarginTop: '80px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--color-muted)', marginBottom: '20px' }}>
            How Tally works
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {[
              { n: '1', t: 'Create a goal', d: 'Set your target amount, deadline, and how much each person contributes.' },
              { n: '2', t: 'Share one link', d: 'Members join in seconds — no app to install, no account to create.' },
              { n: '3', t: 'Let AI do the chasing', d: 'Automatic payment tracking, receipt verification, smart reminders, and a live forecast.' },
            ].map((s) => (
              <div key={s.n} className="card" style={{ padding: '20px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'var(--color-forest-subtle)',
                    color: 'var(--color-forest)',
                    fontWeight: '800',
                    fontSize: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px',
                  }}
                >
                  {s.n}
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--color-charcoal)', marginBottom: '6px' }}>{s.t}</h3>
                <p style={{ fontSize: '13px', color: 'var(--color-muted)', lineHeight: '1.55' }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Your groups */}
        <h2
          style={{
            fontSize: 'clamp(22px, 3vw, 28px)',
            fontWeight: '900',
            color: 'var(--color-charcoal)',
            letterSpacing: '-0.8px',
            marginBottom: '16px',
          }}
        >
          Your groups
        </h2>

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
