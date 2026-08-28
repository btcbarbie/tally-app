'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ConfirmDialog from '../../../ConfirmDialog'
import { copyToClipboard } from '@/lib/clipboard'
import {
  Target, Calendar, Users, UploadCloud, RefreshCw, Sparkles,
  CheckCircle, Clock, AlertCircle, Copy, Check, ArrowLeft, Building2, ChevronDown, LogOut,
  MessageSquare, Send, Wallet, Bell, X,
} from 'lucide-react'

interface BudgetCategoryView {
  id: string
  name: string
  allocatedAmount: number
  aiReasoning?: string | null
  necessity: 'AFFORDABLE_NOW' | 'NEEDED_NOT_YET_FUNDED'
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Commitment {
  id: string
  committedAmount: number
  paidAmount: number
  outstandingAmount: number
  status: string
}

interface Receipt {
  id: string
  status: string
  extractedAmount?: number
  extractedPayer?: string
  extractedRef?: string
  extractedDate?: string
  confidence?: number
  flags?: string
  aiRawResponse?: string
  createdAt: string
}

interface Payment {
  id: string
  amount: number
  verificationStatus: string
  date: string
  reference?: string
}

interface MemberData {
  id: string
  name: string
  commitment: Commitment | null
  payments: Payment[]
  receipts: Receipt[]
}

interface ReminderAlert {
  id: string
  message: string
  createdAt: string
}

interface GoalData {
  id: string
  title: string
  description?: string
  targetAmount: number
  deadline: string
  status: string
  equalAmount?: number
  contributionType: string
  paymentType: string
  bankName?: string
  accountName?: string
  accountNumber?: string
  paymentNote?: string
}

interface FinancialState {
  percentFunded: number
  totalCollected: number
  totalMembers: number
  paidCount: number
  daysRemaining: number
  milestone: string | null
  riskStatus: string
  shortfall: number
}

function formatCurrency(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

function StatusBadge({ status, hasPendingReceipt }: { status: string; hasPendingReceipt?: boolean }) {
  if (status === 'PAID') {
    return (
      <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <CheckCircle size={11} /> Paid
      </span>
    )
  }
  if (status === 'PARTIAL') {
    return (
      <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <Clock size={11} /> Partial — More Outstanding
      </span>
    )
  }
  if (hasPendingReceipt) {
    return (
      <span className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <Clock size={11} /> Pending Admin Review
      </span>
    )
  }
  return (
    <span className="badge badge-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <AlertCircle size={11} /> Not Yet Paid
    </span>
  )
}

function ReceiptStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    LIKELY_MATCH: { label: '✓ Likely Match', cls: 'badge-green' },
    CONFIRMED: { label: '✓ Confirmed', cls: 'badge-green' },
    NEEDS_REVIEW: { label: '⚠ Needs Review', cls: 'badge-amber' },
    AMOUNT_MISMATCH: { label: '⚠ Amount Mismatch', cls: 'badge-red' },
    POSSIBLE_DUPLICATE: { label: '⚠ Possible Duplicate', cls: 'badge-red' },
    REJECTED: { label: '✕ Rejected', cls: 'badge-gray' },
    PENDING_REVIEW: { label: '⏳ Pending Admin Review', cls: 'badge-blue' },
  }
  const cfg = map[status] ?? { label: status, cls: 'badge-gray' }
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
}

export default function MemberPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const goalId = params.id as string

  // memberToken from URL param or localStorage
  const urlToken = searchParams.get('memberToken')
  const memberToken =
    urlToken ||
    (typeof window !== 'undefined' ? localStorage.getItem(`tally_member_${goalId}`) : null)

  const [goal, setGoal] = useState<GoalData | null>(null)
  const [fs, setFs] = useState<FinancialState | null>(null)
  const [member, setMember] = useState<MemberData | null>(null)
  const [reminderAlerts, setReminderAlerts] = useState<ReminderAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)

  const handleLeaveGroup = async () => {
    if (!memberToken) return
    setLeaveConfirmOpen(false)
    setLeaving(true)
    try {
      const res = await fetch(`/api/goals/${goalId}/members?memberToken=${memberToken}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`tally_member_${goalId}`)
          localStorage.removeItem(`tally_memberId_${goalId}`)
        }
        window.location.href = '/'
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to leave group')
      }
    } catch {
      alert('Failed to leave group')
    } finally {
      setLeaving(false)
    }
  }

  // Receipt upload
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [receiptResult, setReceiptResult] = useState<{
    extraction: { extractedAmount?: number; extractedPayer?: string; extractedRef?: string; extractedDate?: string; confidence: number; flags: string[]; status: string; summary: string }
    expectedAmount: number
  } | null>(null)

  // Copy goal link
  const [copied, setCopied] = useState(false)

  // Interactive Payment Workflow Step (0: Not Started, 1: Show Account Details, 2: Informed Payment Done -> Request Receipt, 3: Receipt Verified -> Pending Status)
  const [paymentStep, setPaymentStep] = useState<number>(0)

  // Group Budget (shared, read-only — same view every member and the admin sees)
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategoryView[]>([])
  const [budgetTotalCollected, setBudgetTotalCollected] = useState(0)

  const fetchBudget = async () => {
    try {
      const res = await fetch(`/api/goals/${goalId}/budget`)
      const data = await res.json()
      setBudgetCategories(data.categories ?? [])
      setBudgetTotalCollected(data.totalCollected ?? 0)
    } catch (e) {
      console.error(e)
    }
  }

  // Chat
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const quickQuestions = [
    'How much do I still owe?',
    'Are we on track to reach the goal?',
    'How do I upload my payment receipt?',
    "What's our group's progress so far?",
    ...(budgetCategories.length > 0 ? ['What can we afford right now?'] : []),
  ]

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading || !memberToken) return
    const question = chatInput.trim()
    setChatInput('')
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: question }]
    setChatHistory(newHistory)
    setChatLoading(true)
    try {
      const res = await fetch(`/api/goals/${goalId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history: chatHistory, memberToken }),
      })
      const data = await res.json()
      setChatHistory([...newHistory, { role: 'assistant', content: data.answer || "Tally AI couldn't respond right now. Please try again." }])
    } catch {
      setChatHistory([...newHistory, { role: 'assistant', content: "Tally AI couldn't process that question right now. Please check your connection and try again." }])
    } finally {
      setChatLoading(false)
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const fetchStatus = async () => {
    if (!memberToken) { setLoading(false); setNotFound(true); return }
    try {
      const res = await fetch(`/api/goals/${goalId}/member-status?memberToken=${memberToken}`)
      const data = await res.json()
      if (!res.ok) {
        // A definite 404 means this browser is holding a membership token
        // that no longer resolves — almost always a stale demo session left
        // behind after the demo data was rebuilt server-side. Drop the dead
        // token so it stops resurfacing as a broken card on the homepage.
        if (res.status === 404 && typeof window !== 'undefined') {
          localStorage.removeItem(`tally_member_${goalId}`)
          localStorage.removeItem(`tally_memberId_${goalId}`)

          let recordedDemoIds: string[] = []
          try {
            recordedDemoIds = JSON.parse(localStorage.getItem('tally_demo_goal_ids') || '[]')
          } catch {
            recordedDemoIds = []
          }
          const isDemoGoal =
            goalId === 'goal-church-retreat' ||
            goalId === 'goal-wedding-tolu' ||
            recordedDemoIds.includes(goalId)

          if (isDemoGoal) {
            // Clear every stale demo key (the recorded pair plus the legacy
            // fixed ids), reset the bootstrap flag, and send the visitor
            // home — where a fresh, working set of demo goals is created
            // automatically.
            for (const id of [...recordedDemoIds, 'goal-church-retreat', 'goal-wedding-tolu']) {
              localStorage.removeItem(`tally_admin_${id}`)
              localStorage.removeItem(`tally_member_${id}`)
              localStorage.removeItem(`tally_memberId_${id}`)
            }
            localStorage.removeItem('tally_demo_bootstrapped_v3')
            localStorage.removeItem('tally_demo_goal_ids')
            window.location.href = '/'
            return
          }
        }
        setNotFound(true); setLoading(false); return
      }
      setGoal(data.goal)
      setFs(data.financialState)
      setMember(data.member)
      const dismissed: string[] = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem(`tally_dismissed_reminders_${goalId}`) ?? '[]')
        : []
      setReminderAlerts((data.reminders ?? []).filter((r: ReminderAlert) => !dismissed.includes(r.id)))
    } catch (e) {
      console.error(e)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  const dismissReminder = (id: string) => {
    setReminderAlerts((prev) => prev.filter((r) => r.id !== id))
    if (typeof window !== 'undefined') {
      const dismissed: string[] = JSON.parse(localStorage.getItem(`tally_dismissed_reminders_${goalId}`) ?? '[]')
      localStorage.setItem(`tally_dismissed_reminders_${goalId}`, JSON.stringify([...dismissed, id]))
    }
  }

  useEffect(() => {
    fetchStatus()
    fetchBudget()
    // persist token
    if (urlToken && typeof window !== 'undefined') {
      localStorage.setItem(`tally_member_${goalId}`, urlToken)
    }
  }, [goalId, memberToken])

  const uploadReceipt = async () => {
    if (!member) return
    setReceiptLoading(true)
    setReceiptResult(null)
    try {
      const formData = new FormData()
      formData.append('memberId', member.id)
      formData.append('goalId', goalId)
      if (receiptFile) formData.append('file', receiptFile)

      const res = await fetch('/api/receipts', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        setReceiptResult(data)
        setPaymentStep(3)
        fetchStatus()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setReceiptLoading(false)
    }
  }

  const copyGoalLink = async () => {
    if (!goal) return
    const url = window.location.origin + `/goals/${goal.id}`
    const ok = await copyToClipboard(url)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      alert(`Couldn't copy automatically. Here's the link:\n\n${url}`)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-muted)' }}>Loading your contribution...</p>
      </div>
    )
  }

  if (notFound || !goal || !fs || !member) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px' }}>🔗</div>
        <h2 style={{ fontSize: '22px', fontWeight: '700' }}>Member session not found</h2>
        <p style={{ color: 'var(--color-muted)', maxWidth: '360px' }}>
          This member link may have expired, or you need to join the goal first. Ask the group admin to share your invite link again.
        </p>
        <Link href="/" className="btn btn-primary">Go Home</Link>
      </div>
    )
  }

  const commitment = member.commitment
  const confirmedPayments = member.payments.filter(p => p.verificationStatus === 'CONFIRMED')
  const pendingReceipts = member.receipts.filter(r => r.status === 'PENDING_REVIEW' || r.status === 'LIKELY_MATCH' || r.status === 'NEEDS_REVIEW')
  const isFullyPaid = commitment?.status === 'PAID'
  const daysLeft = fs.daysRemaining

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Nav */}
      <nav className="nav">
        <div className="container nav-inner">
          <a href="/" className="nav-brand">Tally<span>.</span></a>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-forest" style={{ fontSize: '11px' }}>Member View</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setLeaveConfirmOpen(true)}
              disabled={leaving}
              style={{ color: '#dc2626', border: '1px solid #fecaca', background: '#fef2f2', fontSize: '12px' }}
              title="Leave Group"
            >
              <LogOut size={13} /> {leaving ? 'Leaving...' : 'Leave Group'}
            </button>
          </div>
        </div>
      </nav>

      {/* Goal Achieved Banner */}
      {fs.percentFunded >= 100 && (
        <div className="achievement-banner" style={{ margin: 0, borderRadius: 0 }}>
          <div style={{ fontSize: '40px', marginBottom: '6px' }}>🎉</div>
          <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '4px' }}>Goal Achieved!</h2>
          <p style={{ opacity: 0.9 }}>{formatCurrency(fs.totalCollected)} raised together</p>
        </div>
      )}

      <div className="container-sm" style={{ padding: '32px 24px' }}>

        {/* Back hint */}
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-muted)', fontSize: '14px', marginBottom: '20px', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> All Goals
        </Link>

        {/* Goal Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: '900', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            {goal.title}
          </h1>
          {goal.description && (
            <p style={{ fontSize: '14px', color: 'var(--color-muted)', lineHeight: '1.5' }}>{goal.description}</p>
          )}
        </div>

        {/* Reminders from the group admin */}
        {reminderAlerts.length > 0 && (
          <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {reminderAlerts.map((r) => (
              <div key={r.id} style={{ padding: '14px 16px', background: '#fef9ec', border: '1px solid #fde68a', borderRadius: '10px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <Bell size={16} color="var(--color-amber)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-amber)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>
                    Reminder from your group admin
                  </p>
                  <p style={{ fontSize: '14px', color: 'var(--color-charcoal)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{r.message}</p>
                </div>
                <button
                  onClick={() => dismissReminder(r.id)}
                  title="Dismiss"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: '2px', flexShrink: 0 }}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Group Progress Card */}
        <div className="card" style={{ padding: '22px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-charcoal-mid)' }}>Group Progress</span>
            <span style={{ fontSize: '22px', fontWeight: '900', color: fs.percentFunded >= 100 ? 'var(--color-success)' : fs.riskStatus === 'AT_RISK' ? 'var(--color-warning)' : 'var(--color-forest)' }}>
              {fs.percentFunded}%
            </span>
          </div>
          <div className="progress-track" style={{ height: '10px', marginBottom: '10px' }}>
            <div
              className={`progress-fill ${fs.riskStatus === 'AT_RISK' && fs.percentFunded < 100 ? 'progress-fill-amber' : ''}`}
              style={{ width: `${Math.min(100, fs.percentFunded)}%` }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-muted)' }}>
            <span>{formatCurrency(fs.totalCollected)} collected</span>
            <span>Target: {formatCurrency(goal.targetAmount)}</span>
          </div>
          {fs.milestone && fs.percentFunded < 100 && (
            <div style={{ marginTop: '10px', fontSize: '13px', fontWeight: '600', color: 'var(--color-forest)' }}>
              {fs.milestone === '75' ? '🚀 Almost there!' : fs.milestone === '50' ? '⚡ Halfway!' : '✨ Great start!'}
            </div>
          )}
          {/* Quick stats */}
          <div style={{ display: 'flex', gap: '20px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-muted)' }}>
              <Users size={13} />
              <span><strong style={{ color: 'var(--color-charcoal)' }}>{fs.paidCount}/{fs.totalMembers}</strong> paid</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-muted)' }}>
              <Calendar size={13} />
              <span style={{ color: daysLeft <= 3 ? 'var(--color-danger)' : 'var(--color-charcoal)', fontWeight: daysLeft <= 3 ? '700' : '400' }}>
                {daysLeft <= 0 ? 'Deadline passed' : `${daysLeft} days left`}
              </span>
            </div>
          </div>
        </div>

        {/* My Contribution Card */}
        <div className="card" style={{ padding: '22px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={16} color="var(--color-forest)" />
            My Contribution — {member.name}
          </h2>

          {commitment ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Commitment', value: formatCurrency(commitment.committedAmount) },
                { label: 'Amount Paid', value: formatCurrency(commitment.paidAmount), highlight: commitment.paidAmount > 0 },
                { label: 'Amount Remaining', value: formatCurrency(commitment.outstandingAmount), warn: commitment.outstandingAmount > 0 },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '14px', color: 'var(--color-muted)' }}>{row.label}</span>
                  <span style={{
                    fontSize: '15px',
                    fontWeight: '700',
                    color: row.highlight ? 'var(--color-success)' : row.warn && commitment.outstandingAmount > 0 ? 'var(--color-warning)' : 'var(--color-charcoal)',
                  }}>
                    {row.value}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                <span style={{ fontSize: '14px', color: 'var(--color-muted)' }}>Status</span>
                <StatusBadge status={commitment.status} hasPendingReceipt={pendingReceipts.length > 0 || paymentStep === 3} />
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--color-muted)', fontSize: '14px' }}>No commitment record found.</p>
          )}
        </div>

        {/* Group Budget — same shared view every member and the admin sees */}
        {budgetCategories.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Wallet size={16} color="var(--color-forest)" />
              <span style={{ fontSize: '14px', fontWeight: '700' }}>Group Budget</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-muted)', marginBottom: '12px' }}>
              What the group's {formatCurrency(budgetTotalCollected)} on ground can cover right now, vs. what's still needed.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(() => {
                let running = 0
                return budgetCategories.map((c) => {
                  const before = running
                  running += c.allocatedAmount
                  const covered = Math.max(0, Math.min(c.allocatedAmount, budgetTotalCollected - before))
                  const pct = c.allocatedAmount > 0 ? Math.round((covered / c.allocatedAmount) * 100) : 0
                  const affordable = c.necessity === 'AFFORDABLE_NOW'
                  return (
                    <div key={c.id} className="card" style={{ padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '10px' }}>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '14px' }}>{c.name}</div>
                          {c.aiReasoning && <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>{c.aiReasoning}</div>}
                        </div>
                        <span className={`badge ${affordable ? 'badge-green' : 'badge-amber'}`} style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '11px' }}>
                          {affordable ? '✓ Affordable Now' : 'Not Yet Funded'}
                        </span>
                      </div>
                      <div className="progress-track" style={{ height: '6px', marginBottom: '6px' }}>
                        <div className={`progress-fill ${!affordable ? 'progress-fill-amber' : ''}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-muted)' }}>
                        <span>{formatCurrency(covered)} of {formatCurrency(c.allocatedAmount)}</span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        )}

        {/* Ask Tally AI */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Quick Questions
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {quickQuestions.map((q) => (
              <button
                key={q}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '13px', border: '1px solid var(--color-border)' }}
                onClick={() => setChatInput(q)}
              >
                {q}
              </button>
            ))}
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(to right, var(--color-forest-subtle), white)',
              }}
            >
              <Sparkles size={16} color="var(--color-forest)" />
              <span style={{ fontWeight: '700', fontSize: '15px' }}>Tally AI</span>
              <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>· Answers grounded in your own contribution</span>
            </div>

            <div style={{ height: '320px', overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {chatHistory.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--color-muted)', marginTop: '50px' }}>
                  <MessageSquare size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                  <p style={{ fontSize: '15px', fontWeight: '600' }}>Ask anything about your contribution</p>
                  <p style={{ fontSize: '13px' }}>e.g. &quot;How much do I still owe?&quot;</p>
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'} style={{ maxWidth: '80%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {msg.role === 'assistant' && (
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-amber)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Sparkles size={10} /> Tally AI
                    </div>
                  )}
                  <p style={{ fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                </div>
              ))}
              {chatLoading && (
                <div className="chat-bubble-ai" style={{ maxWidth: '80%' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-amber)', marginBottom: '4px' }}>
                    <Sparkles size={10} style={{ display: 'inline', marginRight: '4px' }} /> Tally AI
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '20px' }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-forest)', animation: `pulse-ring 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div style={{ padding: '16px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '10px' }}>
              <input
                className="form-input"
                style={{ flex: 1 }}
                placeholder='Ask about your contribution... e.g. "Am I fully paid?"'
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
              />
              <button className="btn btn-primary" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Step-by-Step Interactive Payment & Receipt Flow */}
        {!isFullyPaid && (
          <div className="card" style={{ padding: '24px', marginBottom: '20px', border: '1px solid var(--color-forest-light)' }}>
            <h3 style={{ fontSize: '17px', fontWeight: '800', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={18} color="var(--color-forest)" /> Payment &amp; Receipt Verification
            </h3>

            {/* Step 0: Initial View (Not Started) */}
            {paymentStep === 0 && pendingReceipts.length === 0 && (
              <div>
                <p style={{ fontSize: '14px', color: 'var(--color-muted)', marginBottom: '14px', lineHeight: '1.5' }}>
                  Ready to contribute? Send money to the account below or click to initiate transfer verification.
                </p>

                {/* Account details preview */}
                {(goal.bankName || goal.accountNumber || goal.accountName) ? (
                  <div style={{ background: 'var(--color-surface-2)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                    {goal.bankName && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span style={{ color: 'var(--color-muted)' }}>Bank</span>
                        <span style={{ fontWeight: '700' }}>{goal.bankName}</span>
                      </div>
                    )}

                    {goal.accountName && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span style={{ color: 'var(--color-muted)' }}>Account Name</span>
                        <span style={{ fontWeight: '700' }}>{goal.accountName}</span>
                      </div>
                    )}

                    {goal.accountNumber && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                        <span style={{ color: 'var(--color-muted)' }}>Account Number</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '800', fontSize: '16px', letterSpacing: '0.5px' }}>{goal.accountNumber}</span>
                          <button
                            id="copy-acct-btn-step0"
                            onClick={async () => {
                              const ok = await copyToClipboard(goal.accountNumber!)
                              const btn = document.getElementById('copy-acct-btn-step0')
                              if (!ok) { alert(`Couldn't copy automatically. Account number:\n\n${goal.accountNumber}`); return }
                              if (btn) { btn.textContent = '✓ Copied'; setTimeout(() => { if (btn) btn.innerHTML = '⎘ Copy' }, 2000) }
                            }}
                            style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: 'var(--color-forest)', whiteSpace: 'nowrap' }}
                          >
                            ⎘ Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '14px', background: '#fef9ec', borderRadius: '10px', fontSize: '13px', color: '#854d0e', marginBottom: '16px' }}>
                    ⚠️ The group admin has not added bank account details for this goal yet.
                  </div>
                )}

                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => setPaymentStep(1)}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Building2 size={16} /> I Want to Make a Payment
                </button>
              </div>
            )}

            {/* Step 1: Account Details Displayed + "I Have Made This Payment" button */}
            {paymentStep === 1 && (
              <div className="animate-fade-in">
                <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '14px' }}>
                  Please transfer your contribution of <strong style={{ color: 'var(--color-forest)' }}>{formatCurrency(commitment?.outstandingAmount ?? 0)}</strong> to the account below:
                </p>

                {/* Account Details Box */}
                {(goal.bankName || goal.accountNumber || goal.accountName) ? (
                  <div style={{ background: 'var(--color-surface-2)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                    {goal.bankName && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span style={{ color: 'var(--color-muted)' }}>Bank</span>
                        <span style={{ fontWeight: '700' }}>{goal.bankName}</span>
                      </div>
                    )}

                    {goal.accountName && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span style={{ color: 'var(--color-muted)' }}>Account Name</span>
                        <span style={{ fontWeight: '700' }}>{goal.accountName}</span>
                      </div>
                    )}

                    {goal.accountNumber && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                        <span style={{ color: 'var(--color-muted)' }}>Account Number</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '800', fontSize: '16px', letterSpacing: '0.5px' }}>{goal.accountNumber}</span>
                          <button
                            id="copy-acct-btn-step1"
                            onClick={async () => {
                              const ok = await copyToClipboard(goal.accountNumber!)
                              const btn = document.getElementById('copy-acct-btn-step1')
                              if (!ok) { alert(`Couldn't copy automatically. Account number:\n\n${goal.accountNumber}`); return }
                              if (btn) { btn.textContent = '✓ Copied'; setTimeout(() => { if (btn) btn.innerHTML = '⎘ Copy' }, 2000) }
                            }}
                            style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: 'var(--color-forest)', whiteSpace: 'nowrap' }}
                          >
                            ⎘ Copy
                          </button>
                        </div>
                      </div>
                    )}

                    {commitment && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                        <span style={{ color: 'var(--color-muted)' }}>Amount to Send</span>
                        <span style={{ fontWeight: '800', color: 'var(--color-forest)', fontSize: '16px' }}>
                          {formatCurrency(commitment.outstandingAmount)}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '14px', background: '#fef9ec', borderRadius: '10px', fontSize: '13px', color: '#854d0e', marginBottom: '16px' }}>
                    ⚠️ The group admin has not added bank account details for this goal yet.
                  </div>
                )}

                {goal.paymentNote && (
                  <div style={{ padding: '10px 14px', background: '#fef9ec', borderRadius: '8px', fontSize: '13px', color: 'var(--color-charcoal-mid)', lineHeight: '1.5', marginBottom: '16px' }}>
                    📝 {goal.paymentNote}
                  </div>
                )}

                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => setPaymentStep(2)}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <CheckCircle size={16} /> I Have Made This Payment
                </button>
              </div>
            )}

            {/* Step 2: AI Assistant Request for Receipt Upload */}
            {paymentStep === 2 && (
              <div className="animate-fade-in">
                <div className="ai-card" style={{ marginBottom: '18px', borderLeft: '4px solid var(--color-amber)' }}>
                  <div className="ai-label"><Sparkles size={13} /> Tally AI Payment Assistant</div>
                  <p style={{ fontSize: '14px', color: 'var(--color-charcoal)', lineHeight: '1.6', marginTop: '4px' }}>
                    Great! You&apos;ve indicated that you&apos;ve transferred <strong>{formatCurrency(commitment?.outstandingAmount ?? 0)}</strong>.
                    Please upload your bank payment receipt below so I can verify its authenticity and update your status to <strong>Pending Admin Review</strong>.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div
                    className="upload-zone"
                    onClick={() => document.getElementById('member-receipt-input')?.click()}
                  >
                    <UploadCloud size={24} color="var(--color-muted)" style={{ margin: '0 auto 8px' }} />
                    <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-charcoal-mid)', marginBottom: '4px' }}>
                      {receiptFile ? receiptFile.name : 'Click to select receipt image'}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--color-muted)' }}>PNG, JPG up to 5MB</p>
                    <input
                      id="member-receipt-input"
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                    />
                  </div>

                  <button
                    className="btn btn-primary btn-lg"
                    onClick={uploadReceipt}
                    disabled={receiptLoading || !receiptFile}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {receiptLoading
                      ? <><RefreshCw size={15} className="spin" /> Verifying Receipt Authenticity with AI...</>
                      : <><Sparkles size={15} /> Upload Receipt for AI Verification</>}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 or Existing Pending Receipts: AI Scanned & Status Moved to Pending Admin Review */}
            {(receiptResult || pendingReceipts.length > 0 || paymentStep === 3) && (
              <div className="animate-fade-in" style={{ marginTop: paymentStep > 0 ? '16px' : '0' }}>
                {receiptResult?.extraction?.status === 'NOT_A_RECEIPT' ? (
                  <div style={{ padding: '16px', background: '#fee2e2', borderRadius: 'var(--radius-md)', border: '1px solid #fecaca' }}>
                    <div style={{ marginBottom: '10px' }}>
                      <ReceiptStatusBadge status="REJECTED" />
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--color-charcoal)', marginBottom: '10px', lineHeight: '1.5' }}>
                      🤖 {receiptResult.extraction.summary || "This doesn't look like a payment receipt."}
                    </p>
                    <p style={{ fontSize: '13px', color: '#dc2626', fontWeight: '600', marginBottom: '14px' }}>
                      This wasn&apos;t sent to the admin for review — please upload the actual bank transfer receipt or payment confirmation for your contribution.
                    </p>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => { setReceiptResult(null); setReceiptFile(null); setPaymentStep(2) }}
                    >
                      Try Again
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '16px',
                      background: 'var(--color-surface-2)',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${receiptResult?.extraction?.status === 'LIKELY_MATCH' || pendingReceipts.some(r => r.status === 'LIKELY_MATCH') ? '#bbf7d0' : '#fde68a'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <ReceiptStatusBadge status={receiptResult?.extraction?.status ?? pendingReceipts[0]?.status ?? 'PENDING_REVIEW'} />
                      <span className="badge badge-blue">Status: Pending Admin Review</span>
                    </div>

                    {receiptResult ? (
                      <div>
                        <p style={{ fontSize: '14px', color: 'var(--color-charcoal)', marginBottom: '10px', lineHeight: '1.5' }}>
                          🤖 <strong>AI Verification:</strong> {receiptResult.extraction.summary}
                        </p>
                        {receiptResult.extraction.extractedAmount && (
                          <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
                            Extracted Amount: <strong style={{ color: 'var(--color-charcoal)' }}>{formatCurrency(receiptResult.extraction.extractedAmount)}</strong>
                            {' '}{receiptResult.extraction.extractedAmount === receiptResult.expectedAmount
                              ? <span style={{ color: 'var(--color-success)' }}>✓ Verified real payment</span>
                              : <span style={{ color: 'var(--color-warning)' }}>⚠ Differs from commitment of {formatCurrency(receiptResult.expectedAmount)}</span>}
                          </div>
                        )}
                        <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-forest)', fontWeight: '600' }}>
                          ✓ Your status has been updated to <strong>Pending Admin Review</strong>. The group admin will confirm your payment.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p style={{ fontSize: '13px', color: 'var(--color-charcoal-mid)' }}>
                          Your payment receipt has been scanned and verified by AI. Your payment status is now <strong>Pending Admin Review</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Fully paid confirmation */}
        {isFullyPaid && (
          <div className="card" style={{ padding: '24px', marginBottom: '20px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
            <CheckCircle size={36} color="var(--color-success)" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '6px' }}>You&apos;re fully paid! 🎉</h3>
            <p style={{ fontSize: '14px', color: 'var(--color-muted)' }}>
              Your contribution of {formatCurrency(commitment?.committedAmount ?? 0)} has been fully confirmed. Thank you!
            </p>
          </div>
        )}

        {/* Footer note */}
        <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--color-muted)', fontSize: '12px' }}>
          <p>Questions? Contact your group admin.</p>
        </div>
      </div>

      <ConfirmDialog
        open={leaveConfirmOpen}
        title="Leave this group?"
        message={`Are you sure you want to leave "${goal?.title}"? Your commitment and record will be removed from this goal.`}
        confirmLabel="Leave Group"
        onConfirm={handleLeaveGroup}
        onCancel={() => setLeaveConfirmOpen(false)}
      />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  )
}
