'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Target, Users, Calendar, TrendingUp, ArrowRight, Trash2, LogOut } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'

interface GoalCardProps {
  goal: {
    id: string
    title: string
    description?: string | null
    targetAmount: number
    deadline: string | Date
    status: string
    shareToken: string
  }
  financialState: {
    totalCollected: number
    totalOutstanding: number
    percentFunded: number
    paidCount: number
    totalMembers: number
    riskStatus: string
  }
  isSample?: boolean
}

function formatCurrency(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

function calcDaysRemaining(deadline: string | Date): number {
  const d = new Date(deadline)
  const now = new Date()
  const diffTime = d.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

function getStatusBadge(status: string, riskStatus: string) {
  if (status === 'TARGET_REACHED') return { label: 'Goal Achieved! 🎉', cls: 'badge-green' }
  if (status === 'CLOSED') return { label: 'Closed', cls: 'badge-gray' }
  if (status === 'DEADLINE_REACHED') return { label: 'Deadline Reached', cls: 'badge-amber' }
  if (status === 'EXTENDED') return { label: 'Extended', cls: 'badge-blue' }
  if (riskStatus === 'AT_RISK') return { label: 'At Risk', cls: 'badge-red' }
  if (riskStatus === 'ON_TRACK') return { label: 'On Track', cls: 'badge-green' }
  return { label: 'Active', cls: 'badge-forest' }
}

function getMilestoneMessage(percent: number): string | null {
  if (percent >= 100) return '🎉 Goal Achieved!'
  if (percent >= 75) return '🚀 Almost there!'
  if (percent >= 50) return '⚡ Halfway there!'
  if (percent >= 25) return '✨ Great start!'
  return null
}

export default function GoalCard({ goal, financialState: fs, isSample = false }: GoalCardProps) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const [memberToken, setMemberToken] = useState<string | null>(null)
  const [adminToken, setAdminToken] = useState<string | null>(null)
  const [deleted, setDeleted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const aToken = localStorage.getItem(`tally_admin_${goal.id}`)
      const mToken = localStorage.getItem(`tally_member_${goal.id}`)
      if (aToken) {
        setIsAdmin(true)
        setAdminToken(aToken)
      } else if (mToken) {
        setIsMember(true)
        setMemberToken(mToken)
      }
    }
  }, [goal.id])

  const requestDestructiveAction = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setConfirmOpen(true)
  }

  const confirmDestructiveAction = async () => {
    setConfirmOpen(false)
    setLoading(true)
    if (isAdmin) {
      try {
        const res = await fetch(`/api/goals/${goal.id}?adminToken=${adminToken || ''}`, {
          method: 'DELETE',
        })
        if (res.ok) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem(`tally_admin_${goal.id}`)
          }
          setDeleted(true)
        } else {
          const data = await res.json()
          alert(data.error || 'Failed to delete goal')
        }
      } catch {
        alert('Failed to delete goal')
      } finally {
        setLoading(false)
      }
    } else {
      try {
        const res = await fetch(`/api/goals/${goal.id}/members?memberToken=${memberToken || ''}`, {
          method: 'DELETE',
        })
        if (res.ok) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem(`tally_member_${goal.id}`)
            localStorage.removeItem(`tally_memberId_${goal.id}`)
          }
          setDeleted(true)
        } else {
          const data = await res.json()
          alert(data.error || 'Failed to leave group')
        }
      } catch {
        alert('Failed to leave group')
      } finally {
        setLoading(false)
      }
    }
  }

  if (deleted) return null

  const statusBadge = getStatusBadge(goal.status, fs.riskStatus)
  const milestone = getMilestoneMessage(fs.percentFunded)
  const daysLeft = calcDaysRemaining(goal.deadline)

  const targetLink = isMember && memberToken
    ? `/goals/${goal.id}/member?memberToken=${memberToken}`
    : `/goals/${goal.id}${adminToken ? `?adminToken=${adminToken}` : ''}`

  return (
    <Link href={targetLink} className="card card-clickable animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-charcoal)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {goal.title}
          </h2>
          {goal.description && (
            <p style={{ fontSize: '13px', color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {goal.description}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', marginLeft: '12px', flexShrink: 0 }}>
          {isSample && (
            <span className="badge badge-gray" style={{ letterSpacing: '0.4px' }}>
              Sample
            </span>
          )}
          <span className={`badge ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
        </div>
      </div>

      {/* Milestone Banner */}
      {milestone && fs.percentFunded < 100 && (
        <div style={{ background: 'var(--color-forest-subtle)', color: 'var(--color-forest)', fontSize: '12px', fontWeight: '600', padding: '6px 10px', borderRadius: '6px', marginBottom: '14px' }}>
          {milestone}
        </div>
      )}

      {/* Progress */}
      <div style={{ marginBottom: '20px', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
          <div>
            <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-charcoal)', letterSpacing: '-0.5px' }}>
              {formatCurrency(fs.totalCollected)}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--color-muted)', marginLeft: '4px' }}>
              / {formatCurrency(goal.targetAmount)}
            </span>
          </div>
          <span style={{ fontSize: '16px', fontWeight: '800', color: fs.percentFunded >= 100 ? 'var(--color-success)' : fs.riskStatus === 'AT_RISK' ? 'var(--color-warning)' : 'var(--color-forest)' }}>
            {fs.percentFunded}%
          </span>
        </div>

        <div className="progress-track">
          <div
            className={`progress-fill ${fs.riskStatus === 'AT_RISK' && fs.percentFunded < 100 ? 'progress-fill-amber' : ''}`}
            style={{ width: `${Math.min(100, fs.percentFunded)}%` }}
          />
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '13px' }}>
            <div style={{ color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              <Users size={12} /> Paid
            </div>
            <div style={{ fontWeight: '700', color: 'var(--color-charcoal)' }}>
              {fs.paidCount} / {fs.totalMembers}
            </div>
          </div>

          <div style={{ fontSize: '13px' }}>
            <div style={{ color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              <Calendar size={12} /> Deadline
            </div>
            <div style={{ fontWeight: '700', color: daysLeft <= 3 ? 'var(--color-danger)' : 'var(--color-charcoal)' }}>
              {daysLeft <= 0 ? 'Ended' : `${daysLeft}d left`}
            </div>
          </div>

          <div style={{ fontSize: '13px' }}>
            <div style={{ color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              <TrendingUp size={12} /> Remaining
            </div>
            <div style={{ fontWeight: '700', color: 'var(--color-charcoal)' }}>
              {formatCurrency(fs.totalOutstanding)}
            </div>
          </div>
        </div>
      </div>

      {/* Card Actions Footer */}
      <div style={{ paddingTop: '14px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {isAdmin ? (
          <button
            onClick={requestDestructiveAction}
            disabled={loading}
            style={{
              background: 'none', border: 'none', color: '#dc2626', fontSize: '12px',
              fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 8px', borderRadius: '4px', transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            title="Delete Contribution"
          >
            <Trash2 size={13} /> {loading ? 'Deleting...' : 'Delete Contribution'}
          </button>
        ) : isMember ? (
          <button
            onClick={requestDestructiveAction}
            disabled={loading}
            style={{
              background: 'none', border: 'none', color: '#dc2626', fontSize: '12px',
              fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 8px', borderRadius: '4px', transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            title="Leave Group"
          >
            <LogOut size={13} /> {loading ? 'Leaving...' : 'Leave Group'}
          </button>
        ) : (
          <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Group Goal</span>
        )}

        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-forest)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          View Contribution <ArrowRight size={14} />
        </span>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title={isAdmin ? 'Delete this contribution?' : 'Leave this group?'}
        message={
          isAdmin
            ? `Are you sure you want to delete "${goal.title}"? All commitments and payments for this goal will be removed.`
            : `Are you sure you want to leave "${goal.title}"? You will be removed from this group.`
        }
        confirmLabel={isAdmin ? 'Delete' : 'Leave Group'}
        onConfirm={confirmDestructiveAction}
        onCancel={() => setConfirmOpen(false)}
      />
    </Link>
  )
}
