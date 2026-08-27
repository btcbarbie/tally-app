'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ConfirmDialog from '../../ConfirmDialog'
import {
  ArrowLeft, Sparkles, Users, TrendingUp, Calendar, Target, Copy, Check,
  Send, UploadCloud, RefreshCw, Bell, AlertTriangle, ChevronRight,
  CheckCircle, Clock, AlertCircle, XCircle, Award, Zap, MessageSquare, Trash2, Building2,
  Wallet, Pencil,
} from 'lucide-react'

interface Commitment {
  id: string
  memberId: string
  committedAmount: number
  paidAmount: number
  outstandingAmount: number
  status: 'PENDING' | 'PARTIAL' | 'PAID'
  member: { id: string; name: string }
}

interface Receipt {
  id: string
  paymentId?: string
  memberId: string
  status: string
  fileData?: string
  fileName?: string
  extractedAmount?: number
  extractedPayer?: string
  extractedRef?: string
  extractedDate?: string
  confidence?: number
  flags?: string
  aiRawResponse?: string
  createdAt: string
  member?: { name: string }
}

interface BudgetCategoryView {
  id: string
  name: string
  allocatedAmount: number
  priority: number
  aiReasoning?: string | null
  necessity: 'AFFORDABLE_NOW' | 'NEEDED_NOT_YET_FUNDED'
  spent: number
}

interface BudgetDraftCategory {
  name: string
  allocatedAmount: number
  reasoning: string
  necessity: 'AFFORDABLE_NOW' | 'NEEDED_NOT_YET_FUNDED'
}

interface Goal {
  id: string
  title: string
  description?: string
  targetAmount: number
  deadline: string
  contributionType: string
  paymentType: string
  joinType: string
  status: string
  adminToken: string
  shareToken: string
  expectedParticipants: number
  equalAmount?: number
  bankName?: string
  accountName?: string
  accountNumber?: string
  paymentNote?: string
  commitments: Commitment[]
  payments: Array<{ id: string; amount: number; verificationStatus: string; date: string; memberId: string }>
  receipts: Receipt[]
}

interface FinancialState {
  totalCollected: number
  totalCommitted: number
  totalOutstanding: number
  shortfall: number
  percentFunded: number
  paidCount: number
  partialCount: number
  pendingCount: number
  totalMembers: number
  daysRemaining: number
  momentum: string
  milestone: string | null
  projectedTotal: number
  projectionShortfall: number
  riskStatus: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

function formatCurrency(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function StatusBadge({ status, riskStatus }: { status: string; riskStatus: string }) {
  if (status === 'TARGET_REACHED') return <span className="badge badge-green">🎉 Goal Achieved</span>
  if (status === 'CLOSED') return <span className="badge badge-gray">Closed</span>
  if (status === 'DEADLINE_REACHED') return <span className="badge badge-amber">Deadline Reached</span>
  if (status === 'EXTENDED') return <span className="badge badge-blue">Extended</span>
  if (riskStatus === 'AT_RISK') return <span className="badge badge-red">⚠ At Risk</span>
  if (riskStatus === 'ON_TRACK') return <span className="badge badge-green">✓ On Track</span>
  return <span className="badge badge-forest">Active</span>
}

function ContributorStatus({ status }: { status: string }) {
  if (status === 'PAID') return <span className="badge badge-green"><CheckCircle size={11} /> Paid</span>
  if (status === 'PARTIAL') return <span className="badge badge-amber"><Clock size={11} /> Partial</span>
  return <span className="badge badge-gray"><AlertCircle size={11} /> Pending</span>
}

function MomentumIndicator({ momentum }: { momentum: string }) {
  const config = {
    STRONG: { label: 'Strong', color: 'var(--color-success)', desc: 'Contributions arriving consistently' },
    SLOWING: { label: 'Slowing', color: 'var(--color-warning)', desc: 'Activity has slowed' },
    STALLED: { label: 'Stalled', color: 'var(--color-border)', desc: 'No recent contributions' },
  }[momentum] || { label: momentum, color: 'var(--color-border)', desc: '' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <Zap size={13} color={config.color} />
      <span style={{ fontSize: '13px', fontWeight: '600', color: config.color }}>{config.label}</span>
      <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>· {config.desc}</span>
    </div>
  )
}

export default function GoalOverviewPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const goalId = params.id as string
  const isNew = searchParams.get('new') === '1'
  const adminToken = searchParams.get('adminToken') || (typeof window !== 'undefined' ? localStorage.getItem(`tally_admin_${goalId}`) : null)

  const [tab, setTab] = useState<'overview' | 'contributors' | 'ai' | 'budget'>('overview')
  const [goal, setGoal] = useState<Goal | null>(null)
  const [fs, setFs] = useState<FinancialState | null>(null)
  const [loading, setLoading] = useState(true)

  // AI States
  const [insight, setInsight] = useState<{ insight: string; recommendedAction: string } | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [planCheck, setPlanCheck] = useState<{
    message: string; suggestion?: string; suggestedAmount?: number
    summary?: string; contributionAnalysis?: string; planHealth?: string
    deadlineAnalysis?: string; risks?: string[]; recommendations?: string[]
    overallScore?: 'STRONG' | 'MODERATE' | 'AT_RISK'
  } | null>(null)
  const [planCheckLoading, setPlanCheckLoading] = useState(false)

  // Chat
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Scroll to Payment Review Queue when the pending-review alert is clicked
  const reviewQueueRef = useRef<HTMLDivElement>(null)
  const [pendingScrollToQueue, setPendingScrollToQueue] = useState(false)

  // Reminder
  const [reminder, setReminder] = useState('')
  const [reminderLoading, setReminderLoading] = useState(false)
  const [reminderCopied, setReminderCopied] = useState(false)
  const [reminderSending, setReminderSending] = useState<'ALL' | 'UNPAID' | null>(null)
  const [reminderSentInfo, setReminderSentInfo] = useState<{ audience: 'ALL' | 'UNPAID'; count: number } | null>(null)

  // Budget
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategoryView[]>([])
  const [budgetTotalCollected, setBudgetTotalCollected] = useState(0)
  const [budgetLoading, setBudgetLoading] = useState(false)
  const [budgetProposal, setBudgetProposal] = useState<BudgetDraftCategory[] | null>(null)
  const [budgetSuggesting, setBudgetSuggesting] = useState(false)
  const [budgetSaving, setBudgetSaving] = useState(false)
  const [budgetError, setBudgetError] = useState('')

  // Receipt
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptText, setReceiptText] = useState('')
  const [receiptMemberId, setReceiptMemberId] = useState('')
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [receiptResult, setReceiptResult] = useState<{
    extraction: {
      extractedAmount?: number; extractedPayer?: string; extractedRef?: string;
      extractedDate?: string; confidence: number; flags: string[]; status: string; summary: string
    };
    expectedAmount: number; memberName: string
  } | null>(null)

  // Add member
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberAmount, setNewMemberAmount] = useState('')
  const [addingMember, setAddingMember] = useState(false)

  // Lifecycle
  const [extendDate, setExtendDate] = useState('')
  const [lifecycleLoading, setLifecycleLoading] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  // Payment details editing
  const [editingPayment, setEditingPayment] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ bankName: '', accountName: '', accountNumber: '', paymentNote: '' })
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  // Copied share link
  const [linkCopied, setLinkCopied] = useState(false)

  // Receipt confirm/reject (admin)
  const [confirmLoading, setConfirmLoading] = useState<string | null>(null)

  useEffect(() => {
    if (adminToken && typeof window !== 'undefined') {
      localStorage.setItem(`tally_admin_${goalId}`, adminToken)
    }
  }, [adminToken, goalId])

  const fetchGoal = async () => {
    try {
      const res = await fetch(`/api/goals/${goalId}`)
      const data = await res.json()
      setGoal(data.goal)
      setFs(data.financialState)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGoal()
    fetchBudget()
  }, [goalId])

  useEffect(() => {
    if (isNew && goal && !planCheck) {
      runPlanCheck()
    }
  }, [goal, isNew])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  useEffect(() => {
    if (tab === 'contributors' && pendingScrollToQueue && reviewQueueRef.current) {
      reviewQueueRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setPendingScrollToQueue(false)
    }
  }, [tab, pendingScrollToQueue])

  const runPlanCheck = async () => {
    setPlanCheckLoading(true)
    try {
      const res = await fetch(`/api/goals/${goalId}/plan-check`, { method: 'POST' })
      const data = await res.json()
      setPlanCheck(data.planCheck)
    } catch (e) {
      console.error(e)
    } finally {
      setPlanCheckLoading(false)
    }
  }

  const loadInsight = async () => {
    setInsightLoading(true)
    try {
      const res = await fetch(`/api/goals/${goalId}/insight`, { method: 'POST' })
      const data = await res.json()
      setInsight(data.insight)
    } catch (e) {
      console.error(e)
    } finally {
      setInsightLoading(false)
    }
  }

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const question = chatInput.trim()
    setChatInput('')
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: question }]
    setChatHistory(newHistory)
    setChatLoading(true)
    try {
      const res = await fetch(`/api/goals/${goalId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history: chatHistory }),
      })
      const data = await res.json()
      // Always show the answer — the server returns a friendly error message if AI fails
      setChatHistory([...newHistory, { role: 'assistant', content: data.answer || "Tally AI couldn't respond right now. Please try again." }])
    } catch {
      setChatHistory([...newHistory, { role: 'assistant', content: "Tally AI couldn't process that question right now. Please check your connection and try again." }])
    } finally {
      setChatLoading(false)
    }
  }

  const generateReminderMsg = async () => {
    setReminderLoading(true)
    try {
      const res = await fetch(`/api/goals/${goalId}/reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'english' }),
      })
      const data = await res.json()
      setReminder(data.reminder)
    } catch (e) {
      console.error(e)
    } finally {
      setReminderLoading(false)
    }
  }

  const fetchBudget = async () => {
    setBudgetLoading(true)
    try {
      const res = await fetch(`/api/goals/${goalId}/budget`)
      const data = await res.json()
      setBudgetCategories(data.categories ?? [])
      setBudgetTotalCollected(data.totalCollected ?? 0)
    } catch (e) {
      console.error(e)
    } finally {
      setBudgetLoading(false)
    }
  }

  const suggestBudget = async () => {
    setBudgetSuggesting(true)
    setBudgetError('')
    try {
      const res = await fetch(`/api/goals/${goalId}/budget/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to suggest categories')
      setBudgetProposal(data.categories)
    } catch (e) {
      setBudgetError(e instanceof Error ? e.message : 'Failed to suggest categories')
    } finally {
      setBudgetSuggesting(false)
    }
  }

  const updateProposalCategory = (index: number, field: 'name' | 'allocatedAmount', value: string) => {
    if (!budgetProposal) return
    const updated = [...budgetProposal]
    updated[index] = { ...updated[index], [field]: field === 'allocatedAmount' ? Number(value) : value }
    setBudgetProposal(updated)
  }

  const saveBudget = async () => {
    if (!budgetProposal) return
    const totalAllocated = budgetProposal.reduce((sum, c) => sum + c.allocatedAmount, 0)
    if (goal && totalAllocated > goal.targetAmount) {
      setBudgetError(`Budget categories total ${formatCurrency(totalAllocated)}, which is more than the goal's target of ${formatCurrency(goal.targetAmount)}.`)
      return
    }
    setBudgetSaving(true)
    setBudgetError('')
    try {
      const res = await fetch(`/api/goals/${goalId}/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminToken, categories: budgetProposal }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save budget')
      setBudgetProposal(null)
      fetchBudget()
    } catch (e) {
      setBudgetError(e instanceof Error ? e.message : 'Failed to save budget')
    } finally {
      setBudgetSaving(false)
    }
  }

  const uploadReceipt = async () => {
    if (!receiptMemberId) return
    setReceiptLoading(true)
    setReceiptResult(null)
    try {
      const formData = new FormData()
      formData.append('memberId', receiptMemberId)
      formData.append('goalId', goalId)
      if (receiptFile) formData.append('file', receiptFile)
      if (receiptText) formData.append('textDescription', receiptText)

      const res = await fetch('/api/receipts', { method: 'POST', body: formData })
      const data = await res.json()
      setReceiptResult(data)
      fetchGoal()
    } catch (e) {
      console.error(e)
    } finally {
      setReceiptLoading(false)
    }
  }

  const addMember = async () => {
    if (!newMemberName.trim()) return
    setAddingMember(true)
    try {
      await fetch(`/api/goals/${goalId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newMemberName, committedAmount: Number(newMemberAmount) }),
      })
      setNewMemberName('')
      setNewMemberAmount('')
      fetchGoal()
    } catch (e) {
      console.error(e)
    } finally {
      setAddingMember(false)
    }
  }

  const extendGoal = async () => {
    if (!extendDate) return
    setLifecycleLoading(true)
    try {
      await fetch(`/api/goals/${goalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extendedDeadline: extendDate, adminToken }),
      })
      fetchGoal()
    } catch (e) {
      console.error(e)
    } finally {
      setLifecycleLoading(false)
    }
  }

  const closeGoal = async () => {
    setLifecycleLoading(true)
    try {
      await fetch(`/api/goals/${goalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED', adminToken }),
      })
      fetchGoal()
    } catch (e) {
      console.error(e)
    } finally {
      setLifecycleLoading(false)
    }
  }

  const deleteGoal = async () => {
    setDeleteConfirmOpen(false)
    setLifecycleLoading(true)
    try {
      const res = await fetch(`/api/goals/${goalId}?adminToken=${adminToken || ''}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        window.location.href = '/'
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete goal')
      }
    } catch (e) {
      console.error(e)
      alert('Failed to delete goal')
    } finally {
      setLifecycleLoading(false)
    }
  }

  const startEditPayment = () => {
    setPaymentForm({
      bankName: goal?.bankName ?? '',
      accountName: goal?.accountName ?? '',
      accountNumber: goal?.accountNumber ?? '',
      paymentNote: goal?.paymentNote ?? '',
    })
    setPaymentError('')
    setEditingPayment(true)
  }

  const savePaymentDetails = async () => {
    if (!paymentForm.bankName.trim() || !paymentForm.accountName.trim()) {
      setPaymentError('Bank name and account name are required.')
      return
    }
    if (paymentForm.accountNumber.length !== 10) {
      setPaymentError('Account number must be exactly 10 digits.')
      return
    }
    setPaymentSaving(true)
    setPaymentError('')
    try {
      const res = await fetch(`/api/goals/${goalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...paymentForm, adminToken }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update payment details')
      }
      setEditingPayment(false)
      fetchGoal()
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : 'Failed to update payment details')
    } finally {
      setPaymentSaving(false)
    }
  }

  const copyShareLink = () => {
    if (!goal) return
    const url = `${window.location.origin}/join/${goal.shareToken}`
    navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2500)
  }

  const copyReminder = () => {
    navigator.clipboard.writeText(reminder)
    setReminderCopied(true)
    setTimeout(() => setReminderCopied(false), 2500)
  }

  const sendReminder = async (audience: 'ALL' | 'UNPAID') => {
    if (!reminder.trim()) return
    setReminderSending(audience)
    setReminderSentInfo(null)
    try {
      const res = await fetch(`/api/goals/${goalId}/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminToken, message: reminder, audience }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send reminder')
      setReminderSentInfo({ audience, count: data.recipientCount })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to send reminder')
    } finally {
      setReminderSending(null)
    }
  }

  const confirmReceipt = async (receiptId: string, paymentId: string | undefined, action: 'confirm' | 'reject') => {
    if (!adminToken) return
    setConfirmLoading(receiptId)
    try {
      await fetch('/api/receipts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptId, action, adminToken, paymentId }),
      })
      fetchGoal()
    } catch (e) {
      console.error(e)
    } finally {
      setConfirmLoading(null)
    }
  }

  const getStatusColor = (status: string) => {
    if (status === 'LIKELY_MATCH') return 'var(--color-success)'
    if (status === 'POSSIBLE_DUPLICATE') return 'var(--color-danger)'
    if (status === 'AMOUNT_MISMATCH') return 'var(--color-warning)'
    if (status === 'NEEDS_REVIEW') return 'var(--color-amber)'
    if (status === 'NOT_A_RECEIPT') return 'var(--color-danger)'
    return 'var(--color-muted)'
  }

  const quickQuestions = [
    "Will we reach our goal?",
    "Who still owes?",
    "How much are we short?",
    "What happens if 3 people don't pay?",
    ...(budgetCategories.length > 0 ? ["What can we afford right now?"] : []),
  ]

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
          <p style={{ color: 'var(--color-muted)' }}>Loading workspace...</p>
        </div>
      </div>
    )
  }

  if (!goal || !fs) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>😕</div>
          <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>Goal not found</h2>
          <Link href="/" className="btn btn-primary btn-sm" style={{ marginTop: '16px' }}>Back to My Goals</Link>
        </div>
      </div>
    )
  }

  const isAdmin = !!adminToken
  const memberToken = typeof window !== 'undefined' ? localStorage.getItem(`tally_member_${goalId}`) : null
  const isMember = !!memberToken && !isAdmin
  const isAchieved = goal.status === 'TARGET_REACHED' || fs.percentFunded >= 100
  const isDeadlineReached = goal.status === 'DEADLINE_REACHED'
  const isClosed = goal.status === 'CLOSED'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Nav */}
      <nav className="nav">
        <div className="container nav-inner">
          <Link href="/" className="nav-brand">Tally<span>.</span></Link>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isMember && (
              <Link href={`/goals/${goalId}/member?memberToken=${memberToken}`} className="btn btn-secondary btn-sm">
                View Contribution
              </Link>
            )}
            {goal.joinType === 'OPEN_LINK' && isAdmin && (
              <button className="btn btn-secondary btn-sm" onClick={copyShareLink}>
                {linkCopied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Share Invite Link</>}
              </button>
            )}
            {isAdmin && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={lifecycleLoading}
                style={{ color: '#dc2626', border: '1px solid #fecaca', background: '#fef2f2' }}
                title="Delete Contribution"
              >
                <Trash2 size={14} /> Delete Contribution
              </button>
            )}
            {isAdmin && <span className="badge badge-forest">Admin</span>}
          </div>
        </div>
      </nav>

      {/* Goal Achievement Banner */}
      {isAchieved && (
        <div className="achievement-banner" style={{ margin: '0', borderRadius: '0' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎉</div>
          <h2 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '4px' }}>Goal Achieved!</h2>
          <p style={{ fontSize: '18px', opacity: 0.9 }}>
            {formatCurrency(fs.totalCollected)} raised · {fs.paidCount} contributors
          </p>
        </div>
      )}

      {/* Deadline Reached Banner */}
      {(isDeadlineReached || isClosed) && !isAchieved && (
        <div
          style={{
            background: isClosed ? 'var(--color-charcoal)' : '#fef3c7',
            borderBottom: '1px solid',
            borderColor: isClosed ? 'transparent' : '#fde68a',
            padding: '16px 24px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '14px', fontWeight: '600', color: isClosed ? 'white' : '#92400e' }}>
            {isClosed ? `This goal is closed. Final amount: ${formatCurrency(fs.totalCollected)} (${fs.percentFunded}% of target)` : `Deadline reached. Final: ${formatCurrency(fs.totalCollected)} of ${formatCurrency(goal.targetAmount)}`}
          </p>
        </div>
      )}

      <div className="container" style={{ padding: '32px 24px' }}>
        {/* Back */}
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-muted)', fontSize: '14px', marginBottom: '24px', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> All goals
        </Link>

        {/* Header */}
        <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: '900', letterSpacing: '-0.5px', marginBottom: '6px' }}>
              {goal.title}
            </h1>
            {goal.description && <p style={{ color: 'var(--color-muted)', fontSize: '15px' }}>{goal.description}</p>}
          </div>
          <StatusBadge status={goal.status} riskStatus={fs.riskStatus} />
        </div>

        {/* AI Plan Check (new goals) */}
        {isNew && (
          <div className="ai-card animate-fade-in" style={{ marginBottom: '24px' }}>
            <div className="ai-label"><Sparkles size={12} /> AI Plan Check</div>
            {planCheckLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <RefreshCw size={14} className="spin" style={{ color: 'var(--color-amber)' }} />
                <p style={{ fontSize: '14px', color: 'var(--color-charcoal-mid)' }}>Analyzing your contribution plan...</p>
              </div>
            ) : planCheck ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Score badge */}
                {planCheck.overallScore && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: '800',
                      background: planCheck.overallScore === 'STRONG' ? '#d1fae5' : planCheck.overallScore === 'AT_RISK' ? '#fee2e2' : '#fef3c7',
                      color: planCheck.overallScore === 'STRONG' ? '#065f46' : planCheck.overallScore === 'AT_RISK' ? '#dc2626' : '#92400e',
                    }}>
                      {planCheck.overallScore === 'STRONG' ? '✓ Plan Looks Strong' : planCheck.overallScore === 'AT_RISK' ? '⚠ Plan Needs Attention' : '~ Plan is Moderate'}
                    </span>
                  </div>
                )}
                <p style={{ fontSize: '15px', color: 'var(--color-charcoal)', lineHeight: '1.6' }}>
                  {planCheck.message}
                </p>
                {/* Structured sections */}
                {planCheck.summary && (
                  <div style={{ borderTop: '1px solid #fde68a', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[{ label: '📋 Summary', text: planCheck.summary }, { label: '🔢 Contribution Analysis', text: planCheck.contributionAnalysis }, { label: '❤️ Plan Health', text: planCheck.planHealth }, { label: '📅 Deadline', text: planCheck.deadlineAnalysis }].map(s => s.text ? (
                      <div key={s.label}>
                        <p style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-amber)', marginBottom: '3px' }}>{s.label}</p>
                        <p style={{ fontSize: '13px', color: 'var(--color-charcoal-mid)', lineHeight: '1.5' }}>{s.text}</p>
                      </div>
                    ) : null)}
                    {planCheck.risks && planCheck.risks.length > 0 && (
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#dc2626', marginBottom: '6px' }}>⚠ Risks</p>
                        <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {planCheck.risks.map((r, i) => <li key={i} style={{ fontSize: '13px', color: 'var(--color-charcoal-mid)', lineHeight: '1.5' }}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                    {planCheck.recommendations && planCheck.recommendations.length > 0 && (
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-forest)', marginBottom: '6px' }}>✅ Recommendations</p>
                        <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {planCheck.recommendations.map((r, i) => <li key={i} style={{ fontSize: '13px', color: 'var(--color-charcoal-mid)', lineHeight: '1.5' }}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {planCheck.suggestion && (
                  <p style={{ fontSize: '13px', color: 'var(--color-charcoal-mid)', background: '#fef9ec', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid var(--color-amber)' }}>
                    💡 {planCheck.suggestion}
                  </p>
                )}
              </div>
            ) : (
              <button className="btn btn-amber btn-sm" onClick={runPlanCheck}>
                <Sparkles size={14} /> Run Plan Check
              </button>
            )}
          </div>
        )}

        {/* Admin Alert: Pending Payment Reviews */}
        {isAdmin && goal.receipts && goal.receipts.filter(r => r.status === 'PENDING_REVIEW' || r.status === 'LIKELY_MATCH' || r.status === 'NEEDS_REVIEW').length > 0 && (
          <div
            className="animate-fade-in"
            onClick={() => { setTab('contributors'); setPendingScrollToQueue(true) }}
            style={{
              marginBottom: '20px',
              padding: '14px 18px',
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              border: '1px solid #f59e0b',
              borderLeft: '4px solid #f59e0b',
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Bell size={18} color="#92400e" />
              <div>
                <p style={{ fontSize: '14px', fontWeight: '800', color: '#92400e', marginBottom: '2px' }}>
                  🔔 {goal.receipts.filter(r => r.status === 'PENDING_REVIEW' || r.status === 'LIKELY_MATCH' || r.status === 'NEEDS_REVIEW').length} payment{goal.receipts.filter(r => r.status === 'PENDING_REVIEW' || r.status === 'LIKELY_MATCH' || r.status === 'NEEDS_REVIEW').length > 1 ? 's' : ''} need{goal.receipts.filter(r => r.status === 'PENDING_REVIEW' || r.status === 'LIKELY_MATCH' || r.status === 'NEEDS_REVIEW').length === 1 ? 's' : ''} your review
                </p>
                <p style={{ fontSize: '12px', color: '#92400e', opacity: 0.8 }}>
                  {goal.receipts.filter(r => r.status === 'PENDING_REVIEW' || r.status === 'LIKELY_MATCH' || r.status === 'NEEDS_REVIEW').map(r => r.member?.name ?? 'A member').join(', ')} submitted receipt{goal.receipts.filter(r => r.status === 'PENDING_REVIEW' || r.status === 'LIKELY_MATCH' || r.status === 'NEEDS_REVIEW').length > 1 ? 's' : ''} — click to review
                </p>
              </div>
            </div>
            <ChevronRight size={16} color="#92400e" />
          </div>
        )}

        {/* Financial Stats */}
        <div
          className="stats-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '14px',
            marginBottom: '24px',
          }}
        >
          {[
            { label: 'Target', value: formatCurrency(goal.targetAmount), icon: <Target size={16} color="var(--color-forest)" /> },
            { label: 'Collected', value: formatCurrency(fs.totalCollected), icon: <TrendingUp size={16} color="var(--color-success)" /> },
            { label: 'Outstanding', value: formatCurrency(fs.totalOutstanding), icon: <AlertCircle size={16} color="var(--color-warning)" /> },
            { label: 'Contributors', value: `${fs.totalMembers}`, icon: <Users size={16} color="var(--color-info)" /> },
            { label: 'Paid', value: `${fs.paidCount} / ${fs.totalMembers}`, icon: <CheckCircle size={16} color="var(--color-success)" /> },
            { label: 'Days Left', value: fs.daysRemaining <= 0 ? 'Ended' : `${fs.daysRemaining}`, icon: <Calendar size={16} color={fs.daysRemaining <= 3 ? 'var(--color-danger)' : 'var(--color-muted)'} /> },
          ].map((stat) => (
            <div key={stat.label} className="card" style={{ padding: '18px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                {stat.icon}
                <span className="stat-label">{stat.label}</span>
              </div>
              <div className="stat-value" style={{ fontSize: '20px' }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-charcoal-mid)' }}>
                Progress to Goal
              </span>
              {fs.milestone && !isAchieved && (
                <span style={{ marginLeft: '10px', fontSize: '12px', fontWeight: '600', color: 'var(--color-forest)', background: 'var(--color-forest-subtle)', padding: '2px 8px', borderRadius: '100px' }}>
                  {fs.milestone === '100' ? '🎉 Done!' : fs.milestone === '75' ? '🚀 Almost!' : fs.milestone === '50' ? '⚡ Halfway!' : '✨ Started!'}
                </span>
              )}
            </div>
            <span style={{ fontSize: '24px', fontWeight: '900', color: isAchieved ? 'var(--color-success)' : fs.riskStatus === 'AT_RISK' ? 'var(--color-warning)' : 'var(--color-forest)' }}>
              {fs.percentFunded}%
            </span>
          </div>
          <div className="progress-track" style={{ height: '12px' }}>
            <div
              className={`progress-fill ${fs.riskStatus === 'AT_RISK' && !isAchieved ? 'progress-fill-amber' : ''}`}
              style={{ width: `${Math.min(100, fs.percentFunded)}%` }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', alignItems: 'center' }}>
            <MomentumIndicator momentum={fs.momentum} />
            {fs.shortfall > 0 && <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>₦{fs.shortfall.toLocaleString()} to go</span>}
          </div>
        </div>

        {/* Tab Bar */}
        <div className="tab-bar tabs">
          <button className={`tab-btn ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
            <Target size={15} /> Overview
          </button>
          <button className={`tab-btn ${tab === 'contributors' ? 'active' : ''}`} onClick={() => setTab('contributors')}>
            <Users size={15} /> Contributors ({fs.totalMembers})
          </button>
          <button className={`tab-btn ${tab === 'ai' ? 'active' : ''}`} onClick={() => setTab('ai')}>
            <Sparkles size={15} /> AI Assistant
          </button>
          <button className={`tab-btn ${tab === 'budget' ? 'active' : ''}`} onClick={() => setTab('budget')}>
            <Wallet size={15} /> Budget
          </button>
        </div>

        {/* ─── OVERVIEW TAB ─── */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="animate-fade-in">
            {/* AI Insight */}
            <div>
              {!insight ? (
                <div className="ai-card">
                  <div className="ai-label"><Sparkles size={12} /> AI Financial Insight</div>
                  <p style={{ fontSize: '14px', color: 'var(--color-charcoal-mid)', marginBottom: '14px' }}>
                    Get an AI analysis of your group&apos;s financial progress and recommendations.
                  </p>
                  <button className="btn btn-amber btn-sm" onClick={loadInsight} disabled={insightLoading}>
                    {insightLoading ? <><RefreshCw size={14} className="spin" /> Analyzing...</> : <><Sparkles size={14} /> Generate Insight</>}
                  </button>
                </div>
              ) : (
                <div className="ai-card animate-fade-in">
                  <div className="ai-label"><Sparkles size={12} /> AI Financial Insight</div>
                  <p style={{ fontSize: '15px', color: 'var(--color-charcoal)', lineHeight: '1.7', marginBottom: '14px' }}>
                    {insight.insight}
                  </p>
                  <div style={{ borderTop: '1px solid #fde68a', paddingTop: '12px' }}>
                    <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-amber)', marginBottom: '6px' }}>
                      Recommended Action
                    </p>
                    <p style={{ fontSize: '14px', color: 'var(--color-charcoal-mid)', marginBottom: '12px' }}>{insight.recommendedAction}</p>
                    <button className="btn btn-ghost btn-sm" onClick={loadInsight} disabled={insightLoading}>
                      <RefreshCw size={13} /> Refresh
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bank Account Details Card */}
            {(goal.bankName || goal.accountNumber || goal.accountName) && (
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={16} color="var(--color-forest)" /> Group Payment Account Details
                </h3>

                <div style={{ background: 'var(--color-surface-2)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                      <span style={{ fontWeight: '800', fontSize: '16px', letterSpacing: '0.5px' }}>{goal.accountNumber}</span>
                    </div>
                  )}
                  {goal.paymentNote && (
                    <div style={{ marginTop: '6px', paddingTop: '10px', borderTop: '1px solid var(--color-border)', fontSize: '13px', color: 'var(--color-charcoal-mid)' }}>
                      📝 {goal.paymentNote}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Financial Summary */}
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '18px' }}>Financial Summary</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Target Amount', value: formatCurrency(goal.targetAmount), muted: false },
                  { label: 'Total Committed', value: formatCurrency(fs.totalCommitted), muted: false },
                  { label: 'Total Collected', value: formatCurrency(fs.totalCollected), muted: false, highlight: true },
                  { label: 'Outstanding', value: formatCurrency(fs.totalOutstanding), muted: fs.totalOutstanding === 0 },
                  { label: 'Shortfall to Target', value: formatCurrency(fs.shortfall), muted: fs.shortfall === 0 },
                  { label: 'Completion', value: `${fs.percentFunded}%`, muted: false },
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    <span style={{ fontSize: '14px', color: 'var(--color-muted)' }}>{row.label}</span>
                    <span style={{
                      fontSize: '15px',
                      fontWeight: '700',
                      color: row.highlight ? 'var(--color-forest)' : row.muted ? 'var(--color-success)' : 'var(--color-charcoal)',
                    }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reminder (admin only) */}
            {isAdmin && (
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Generate Reminder</h3>
                  <Bell size={16} color="var(--color-muted)" />
                </div>
                {!reminder ? (
                  <div>
                    <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '14px' }}>
                      AI will draft a friendly reminder for {fs.pendingCount + fs.partialCount} outstanding contributors.
                    </p>
                    <button className="btn btn-secondary btn-sm" onClick={generateReminderMsg} disabled={reminderLoading}>
                      {reminderLoading ? 'Drafting...' : <><Bell size={14} /> Draft Reminder</>}
                    </button>
                  </div>
                ) : (
                  <div>
                    <textarea
                      className="form-input"
                      value={reminder}
                      onChange={(e) => { setReminder(e.target.value); setReminderSentInfo(null) }}
                      rows={5}
                      style={{ marginBottom: '14px', fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}
                    />
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      <button className="btn btn-primary btn-sm" onClick={copyReminder}>
                        {reminderCopied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy Message</>}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setReminder(''); setReminderSentInfo(null); generateReminderMsg() }}>
                        <RefreshCw size={13} /> Regenerate
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
                      <button className="btn btn-amber btn-sm" onClick={() => sendReminder('ALL')} disabled={!!reminderSending || !reminder.trim()}>
                        {reminderSending === 'ALL' ? 'Sending...' : <><Send size={13} /> Send to All Members</>}
                      </button>
                      <button className="btn btn-amber btn-sm" onClick={() => sendReminder('UNPAID')} disabled={!!reminderSending || !reminder.trim()}>
                        {reminderSending === 'UNPAID' ? 'Sending...' : <><Send size={13} /> Send to Unpaid Only</>}
                      </button>
                    </div>
                    {reminderSentInfo && (
                      <p style={{ marginTop: '10px', fontSize: '13px', color: 'var(--color-success)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={13} /> Sent to {reminderSentInfo.count} {reminderSentInfo.audience === 'ALL' ? 'member' : 'unpaid member'}{reminderSentInfo.count === 1 ? '' : 's'}.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Admin Controls / Goal Management */}
            {isAdmin && (
              <div className="card" style={{ padding: '24px', border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px' }}>
                  <AlertTriangle size={18} color="var(--color-warning)" />
                  <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Goal Management</h3>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '16px' }}>
                  Manage the goal lifecycle, extend deadlines, or remove this goal.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Payment Details */}
                  <div style={{ paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700' }}>Payment Account Details</span>
                      {!editingPayment && (
                        <button className="btn btn-ghost btn-sm" onClick={startEditPayment}>Edit</button>
                      )}
                    </div>
                    {!editingPayment ? (
                      <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginTop: '6px' }}>
                        {goal.bankName ? `${goal.bankName} · ${goal.accountName} · ${goal.accountNumber}` : 'No payment details set.'}
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                        {paymentError && (
                          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}>
                            {paymentError}
                          </div>
                        )}
                        <div className="form-group">
                          <label className="form-label">Bank Name</label>
                          <input className="form-input" value={paymentForm.bankName} onChange={(e) => setPaymentForm({ ...paymentForm, bankName: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Account Holder Name</label>
                          <input className="form-input" value={paymentForm.accountName} onChange={(e) => setPaymentForm({ ...paymentForm, accountName: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Account Number</label>
                          <input
                            className="form-input"
                            value={paymentForm.accountNumber}
                            onChange={(e) => setPaymentForm({ ...paymentForm, accountNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                            maxLength={10}
                            inputMode="numeric"
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Payment Instructions <span className="form-label-optional">(Optional)</span></label>
                          <textarea className="form-input" rows={2} value={paymentForm.paymentNote} onChange={(e) => setPaymentForm({ ...paymentForm, paymentNote: e.target.value })} />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-primary btn-sm" onClick={savePaymentDetails} disabled={paymentSaving}>
                            {paymentSaving ? 'Saving...' : 'Save Payment Details'}
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingPayment(false)} disabled={paymentSaving}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {!isClosed && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
                        <label className="form-label">New Deadline</label>
                        <input type="date" className="form-input" value={extendDate} onChange={(e) => setExtendDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                      </div>
                      <button className="btn btn-amber" onClick={extendGoal} disabled={!extendDate || lifecycleLoading}>
                        Extend Deadline
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                    {!isClosed && (
                      <button className="btn btn-ghost btn-sm" onClick={closeGoal} disabled={lifecycleLoading} style={{ color: 'var(--color-muted)' }}>
                        <XCircle size={14} /> Close Goal
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirmOpen(true)} disabled={lifecycleLoading} style={{ color: '#dc2626' }}>
                      <Trash2 size={14} /> Delete Contribution Permanently
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── CONTRIBUTORS TAB ─── */}
        {tab === 'contributors' && (
          <div className="animate-fade-in">
            {/* Add member (admin) */}
            {isAdmin && (
              <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px' }}>Add Contributor</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ flex: '1', minWidth: '160px' }}>
                    <label className="form-label">Name</label>
                    <input className="form-input" placeholder="Contributor name" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} />
                  </div>
                  {goal.contributionType === 'FLEXIBLE' && (
                    <div className="form-group" style={{ width: '140px' }}>
                      <label className="form-label">Amount (₦)</label>
                      <input className="form-input" type="number" placeholder="Amount" value={newMemberAmount} onChange={(e) => setNewMemberAmount(e.target.value)} />
                    </div>
                  )}
                  <button className="btn btn-primary" onClick={addMember} disabled={addingMember || !newMemberName.trim()}>
                    {addingMember ? 'Adding...' : '+ Add'}
                  </button>
                </div>
              </div>
            )}

            {/* Contributor List */}
            <div className="card" style={{ padding: '0' }}>
              {/* Summary */}
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: '20px' }}>
                <div style={{ fontSize: '13px' }}>
                  <span style={{ fontWeight: '700', color: 'var(--color-success)' }}>{fs.paidCount}</span>
                  <span style={{ color: 'var(--color-muted)', marginLeft: '4px' }}>paid</span>
                </div>
                {fs.partialCount > 0 && (
                  <div style={{ fontSize: '13px' }}>
                    <span style={{ fontWeight: '700', color: 'var(--color-warning)' }}>{fs.partialCount}</span>
                    <span style={{ color: 'var(--color-muted)', marginLeft: '4px' }}>partial</span>
                  </div>
                )}
                <div style={{ fontSize: '13px' }}>
                  <span style={{ fontWeight: '700', color: 'var(--color-charcoal-mid)' }}>{fs.pendingCount}</span>
                  <span style={{ color: 'var(--color-muted)', marginLeft: '4px' }}>pending</span>
                </div>
              </div>

              {goal.commitments.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-muted)' }}>
                  No contributors yet. {isAdmin ? 'Add the first one above.' : 'Share the link to invite people.'}
                </div>
              ) : (
                goal.commitments.map((c) => {
                  // Derive explicit payment status
                  const memberReceipts = goal.receipts?.filter(r => r.memberId === c.memberId) ?? []
                  const hasPendingReceipt = memberReceipts.some(
                    r => r.status === 'PENDING_REVIEW' || r.status === 'LIKELY_MATCH' || r.status === 'NEEDS_REVIEW'
                  )
                  const displayStatus = c.status === 'PAID' ? 'PAID'
                    : c.status === 'PARTIAL' ? 'PARTIAL'
                    : hasPendingReceipt ? 'PAYMENT_SUBMITTED'
                    : 'NOT_YET_PAID'
                  return (
                    <div key={c.id} className="contributor-row" style={{ padding: '16px 20px' }}>
                      <div className="avatar">{getInitials(c.member.name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '2px' }}>{c.member.name}</div>
                        <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
                          Committed: {formatCurrency(c.committedAmount)}
                          {c.paidAmount > 0 && ` · Paid: ${formatCurrency(c.paidAmount)}`}
                          {c.outstandingAmount > 0 && ` · Owes: ${formatCurrency(c.outstandingAmount)}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                        {/* Explicit 5-state status display */}
                        {displayStatus === 'PAID' && <span className="badge badge-green"><CheckCircle size={11} /> Paid</span>}
                        {displayStatus === 'PARTIAL' && <span className="badge badge-amber"><Clock size={11} /> Partial</span>}
                        {displayStatus === 'PAYMENT_SUBMITTED' && <span className="badge badge-blue" style={{ whiteSpace: 'nowrap' }}><Clock size={11} /> Needs Review</span>}
                        {displayStatus === 'NOT_YET_PAID' && <span className="badge badge-gray"><AlertCircle size={11} /> Not Paid</span>}
                        {isAdmin && c.status !== 'PAID' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                            onClick={() => { setReceiptMemberId(c.member.id); }}
                          >
                            AI Payment Check
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Pending Receipts — Admin Review Queue */}
            {isAdmin && goal.receipts && goal.receipts.filter(r => r.status === 'PENDING_REVIEW' || r.status === 'LIKELY_MATCH' || r.status === 'NEEDS_REVIEW').length > 0 && (
              <div ref={reviewQueueRef} className="card" style={{ padding: '24px', marginTop: '20px', border: '2px solid #f59e0b' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e' }}>
                  🔔 Payment Review Queue — {goal.receipts.filter(r => r.status === 'PENDING_REVIEW' || r.status === 'LIKELY_MATCH' || r.status === 'NEEDS_REVIEW').length} pending
                </h3>
                <p style={{ fontSize: '13px', color: '#92400e', opacity: 0.8, marginBottom: '16px' }}>
                  Members have submitted payment evidence. Review AI analysis and confirm or reject each payment.
                </p>
                {goal.receipts.filter(r => r.status === 'PENDING_REVIEW' || r.status === 'LIKELY_MATCH' || r.status === 'NEEDS_REVIEW').map(r => {
                  const memberName = r.member?.name ?? goal.commitments.find(c => c.memberId === r.memberId)?.member.name ?? 'Member'
                  const memberCommitment = goal.commitments.find(c => c.memberId === r.memberId)
                  const isGoodMatch = r.status === 'LIKELY_MATCH'
                  return (
                    <div key={r.id} style={{ padding: '16px', background: 'var(--color-surface-2)', borderRadius: '12px', marginBottom: '12px', border: `1px solid ${isGoodMatch ? '#bbf7d0' : '#fde68a'}` }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <span style={{ fontWeight: '800', fontSize: '15px' }}>{memberName}</span>
                          {r.extractedAmount && (
                            <span style={{ marginLeft: '10px', fontSize: '14px', fontWeight: '700', color: 'var(--color-forest)' }}>
                              {formatCurrency(r.extractedAmount)}
                            </span>
                          )}
                          <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '2px' }}>
                            {memberCommitment && `Commitment: ${formatCurrency(memberCommitment.committedAmount)}`}
                            {r.extractedDate && ` · Date: ${r.extractedDate}`}
                          </div>
                        </div>
                        <span style={{
                          fontSize: '11px', fontWeight: '800', padding: '3px 10px', borderRadius: '100px',
                          background: isGoodMatch ? '#d1fae5' : r.status === 'NEEDS_REVIEW' ? '#fef3c7' : '#fee2e2',
                          color: isGoodMatch ? '#065f46' : r.status === 'NEEDS_REVIEW' ? '#92400e' : '#dc2626',
                        }}>
                          {r.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Uploaded receipt image */}
                      {r.fileData && (
                        <a href={r.fileData} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginBottom: '10px' }}>
                          <img
                            src={r.fileData}
                            alt={`Receipt uploaded by ${memberName}`}
                            style={{ maxWidth: '180px', maxHeight: '180px', borderRadius: '8px', border: '1px solid var(--color-border)', objectFit: 'cover' }}
                          />
                        </a>
                      )}

                      {/* AI verification breakdown */}
                      <div style={{ background: 'white', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px', fontSize: '13px' }}>
                        <p style={{ fontWeight: '700', marginBottom: '6px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--color-amber)' }}>🤖 AI Check</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {r.extractedAmount && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: r.extractedAmount === memberCommitment?.committedAmount ? 'var(--color-success)' : 'var(--color-warning)' }}>
                              {r.extractedAmount === memberCommitment?.committedAmount ? '✓' : '⚠'} Amount: {formatCurrency(r.extractedAmount)}
                              {r.extractedAmount !== memberCommitment?.committedAmount && memberCommitment && (
                                <span style={{ color: 'var(--color-muted)', fontSize: '12px' }}>(expected {formatCurrency(memberCommitment.committedAmount)})</span>
                              )}
                            </div>
                          )}
                          {r.extractedPayer && <div style={{ color: 'var(--color-charcoal-mid)' }}>✓ Payer: {r.extractedPayer}</div>}
                          {r.extractedRef && <div style={{ color: 'var(--color-charcoal-mid)' }}>✓ Ref: {r.extractedRef}</div>}
                          {r.confidence && <div style={{ color: 'var(--color-muted)' }}>Confidence: {Math.round(r.confidence * 100)}%</div>}
                        </div>
                        {r.aiRawResponse && (
                          <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-charcoal-mid)', lineHeight: '1.5', borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
                            {r.aiRawResponse}
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={confirmLoading === r.id}
                          onClick={() => confirmReceipt(r.id, r.paymentId, 'confirm')}
                        >
                          {confirmLoading === r.id ? 'Confirming...' : <><CheckCircle size={13} /> Confirm Payment</>}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={confirmLoading === r.id}
                          onClick={() => confirmReceipt(r.id, r.paymentId, 'reject')}
                          style={{ color: 'var(--color-danger)' }}
                        >
                          <XCircle size={13} /> Reject
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Receipt Upload in Contributors tab */}
            {isAdmin && (
              <div className="card" style={{ padding: '24px', marginTop: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UploadCloud size={18} color="var(--color-forest)" /> AI Payment Check
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '16px' }}>
                  Upload a member&apos;s payment receipt — AI will extract the details and flag anything that needs review. Admin confirms the final payment.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Select Contributor</label>
                    <select className="form-input" value={receiptMemberId} onChange={(e) => setReceiptMemberId(e.target.value)}>
                      <option value="">Choose contributor...</option>
                      {goal.commitments.filter((c) => c.status !== 'PAID').map((c) => (
                        <option key={c.member.id} value={c.member.id}>{c.member.name} — owes {formatCurrency(c.outstandingAmount)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="upload-zone" onClick={() => document.getElementById('receipt-input')?.click()}>
                    <UploadCloud size={24} color="var(--color-muted)" style={{ margin: '0 auto 8px' }} />
                    <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-charcoal-mid)', marginBottom: '4px' }}>
                      {receiptFile ? receiptFile.name : 'Upload receipt image'}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--color-muted)' }}>PNG, JPG up to 5MB</p>
                    <input id="receipt-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Or describe the payment <span className="form-label-optional">(text)</span></label>
                    <textarea
                      className="form-input"
                      rows={2}
                      placeholder="e.g. Transfer of ₦20,000 from Musa Aliyu on 24/08/2026, Ref: TXN123456"
                      value={receiptText}
                      onChange={(e) => setReceiptText(e.target.value)}
                    />
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={uploadReceipt}
                    disabled={receiptLoading || !receiptMemberId || (!receiptFile && !receiptText)}
                  >
                    {receiptLoading ? <><RefreshCw size={14} /> Verifying...</> : <><Sparkles size={14} /> Verify with AI</>}
                  </button>
                </div>

                {/* Receipt Result */}
                {receiptResult && (
                  <div
                    className="animate-fade-in"
                    style={{
                      marginTop: '20px',
                      padding: '16px',
                      background: 'var(--color-surface-2)',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${receiptResult.extraction.status === 'LIKELY_MATCH' ? '#bbf7d0' : '#fde68a'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: getStatusColor(receiptResult.extraction.status) }}>
                        {receiptResult.extraction.status.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                        {Math.round(receiptResult.extraction.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--color-charcoal)', marginBottom: '12px', lineHeight: '1.5' }}>
                      {receiptResult.extraction.summary}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                      {receiptResult.extraction.extractedAmount && (
                        <div>
                          <span style={{ color: 'var(--color-muted)' }}>Extracted: </span>
                          <strong>{formatCurrency(receiptResult.extraction.extractedAmount)}</strong>
                          <span style={{ marginLeft: '6px', color: receiptResult.extraction.extractedAmount === receiptResult.expectedAmount ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {receiptResult.extraction.extractedAmount === receiptResult.expectedAmount ? '✓' : '⚠'}
                          </span>
                        </div>
                      )}
                      {receiptResult.extraction.extractedPayer && (
                        <div><span style={{ color: 'var(--color-muted)' }}>Payer: </span><strong>{receiptResult.extraction.extractedPayer}</strong></div>
                      )}
                      {receiptResult.extraction.extractedRef && (
                        <div><span style={{ color: 'var(--color-muted)' }}>Ref: </span><strong>{receiptResult.extraction.extractedRef}</strong></div>
                      )}
                      {receiptResult.extraction.extractedDate && (
                        <div><span style={{ color: 'var(--color-muted)' }}>Date: </span><strong>{receiptResult.extraction.extractedDate}</strong></div>
                      )}
                    </div>
                    {receiptResult.extraction.flags.length > 0 && (
                      <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {receiptResult.extraction.flags.map((f) => (
                          <span key={f} className="badge badge-amber">{f.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                    )}
                    <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--color-muted)', fontStyle: 'italic' }}>
                      AI-assisted extraction — admin must confirm before payment is recorded.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── AI ASSISTANT TAB ─── */}
        {tab === 'ai' && (
          <div className="animate-fade-in">
            {/* Quick Questions */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Quick Questions
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {quickQuestions.map((q) => (
                  <button
                    key={q}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '13px', border: '1px solid var(--color-border)' }}
                    onClick={() => { setChatInput(q) }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Area */}
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
                <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>· Answers grounded in your actual financial data</span>
              </div>

              <div
                style={{
                  height: '400px',
                  overflowY: 'auto',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                {chatHistory.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--color-muted)', marginTop: '60px' }}>
                    <MessageSquare size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                    <p style={{ fontSize: '15px', fontWeight: '600' }}>Ask anything about this goal</p>
                    <p style={{ fontSize: '13px' }}>e.g. &quot;Are we on track?&quot; or &quot;Who still owes?&quot;</p>
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
                  placeholder='Ask about your goal... e.g. "Are we on track?"'
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
                />
                <button className="btn btn-primary" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
                  <Send size={16} />
                </button>
              </div>
            </div>

            {/* AI Feature Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginTop: '16px' }}>
              <button
                className="card"
                style={{ padding: '18px', textAlign: 'left', cursor: 'pointer', border: 'none', background: 'var(--color-surface)', width: '100%' }}
                onClick={() => { setChatInput("Will we reach our target before the deadline?"); }}
              >
                <Award size={20} color="var(--color-forest)" style={{ marginBottom: '8px' }} />
                <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>Forecast</div>
                <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Will we reach our target?</div>
              </button>
            </div>
          </div>
        )}

        {/* ─── BUDGET TAB ─── */}
        {tab === 'budget' && (
          <div className="animate-fade-in">
            {budgetError && (
              <div style={{ background: '#fee2e2', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>
                {budgetError}
              </div>
            )}

            {budgetLoading ? (
              <p style={{ color: 'var(--color-muted)', fontSize: '14px' }}>Loading budget...</p>
            ) : budgetProposal ? (
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Sparkles size={16} color="var(--color-amber)" />
                  <h3 style={{ fontSize: '16px', fontWeight: '700' }}>AI-Suggested Categories — Review Before Saving</h3>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '16px' }}>
                  Edit names or amounts if needed. Order matters — categories are funded top to bottom as money comes in.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                  {budgetProposal.map((c, i) => (
                    <div key={i} style={{ padding: '14px', background: 'var(--color-surface-2)', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                        <input className="form-input" style={{ flex: 1 }} value={c.name} onChange={(e) => updateProposalCategory(i, 'name', e.target.value)} />
                        <input className="form-input" type="number" style={{ width: '140px' }} value={c.allocatedAmount} onChange={(e) => updateProposalCategory(i, 'allocatedAmount', e.target.value)} />
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{c.reasoning}</p>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '13px', color: budgetProposal.reduce((s, c) => s + c.allocatedAmount, 0) > goal.targetAmount ? '#dc2626' : 'var(--color-muted)', fontWeight: budgetProposal.reduce((s, c) => s + c.allocatedAmount, 0) > goal.targetAmount ? '700' : '400', marginBottom: '16px' }}>
                  Total allocated: {formatCurrency(budgetProposal.reduce((s, c) => s + c.allocatedAmount, 0))} · Target: {formatCurrency(goal.targetAmount)}
                  {budgetProposal.reduce((s, c) => s + c.allocatedAmount, 0) > goal.targetAmount && ' — exceeds target, reduce before saving'}
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary" onClick={saveBudget} disabled={budgetSaving}>
                    {budgetSaving ? 'Saving...' : 'Save Budget'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setBudgetProposal(null)} disabled={budgetSaving}>
                    Discard
                  </button>
                </div>
              </div>
            ) : budgetCategories.length === 0 ? (
              <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                <Wallet size={32} color="var(--color-muted)" style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '6px' }}>No budget set up yet</h3>
                <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '16px', maxWidth: '400px', margin: '0 auto 16px' }}>
                  Break the target into spending categories so members can see what the money is actually for — and what&apos;s affordable right now vs. still needed.
                </p>
                <button className="btn btn-amber" onClick={suggestBudget} disabled={budgetSuggesting}>
                  {budgetSuggesting ? <><RefreshCw size={14} className="spin" /> Thinking...</> : <><Sparkles size={14} /> Suggest Categories with AI</>}
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
                    {formatCurrency(budgetTotalCollected)} collected, allocated across {budgetCategories.length} categories
                  </p>
                  <button className="btn btn-ghost btn-sm" onClick={suggestBudget} disabled={budgetSuggesting}>
                    {budgetSuggesting ? <><RefreshCw size={13} className="spin" /> Thinking...</> : <><Pencil size={13} /> Re-suggest with AI</>}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(() => {
                    let running = 0
                    return budgetCategories.map((c) => {
                      const before = running
                      running += c.allocatedAmount
                      const covered = Math.max(0, Math.min(c.allocatedAmount, budgetTotalCollected - before))
                      const pct = c.allocatedAmount > 0 ? Math.round((covered / c.allocatedAmount) * 100) : 0
                      const affordable = c.necessity === 'AFFORDABLE_NOW'
                      return (
                        <div key={c.id} className="card" style={{ padding: '18px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', gap: '10px' }}>
                            <div>
                              <div style={{ fontWeight: '700', fontSize: '15px' }}>{c.name}</div>
                              {c.aiReasoning && <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '2px' }}>{c.aiReasoning}</div>}
                            </div>
                            <span className={`badge ${affordable ? 'badge-green' : 'badge-amber'}`} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {affordable ? '✓ Affordable Now' : 'Needed — Not Yet Funded'}
                            </span>
                          </div>
                          <div className="progress-track" style={{ height: '8px', marginBottom: '6px' }}>
                            <div className={`progress-fill ${!affordable ? 'progress-fill-amber' : ''}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-muted)' }}>
                            <span>{formatCurrency(covered)} of {formatCurrency(c.allocatedAmount)} covered</span>
                            <span>{pct}%</span>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete this contribution?"
        message={`Are you sure you want to delete "${goal?.title}"? All commitments, payments, and receipts for this goal will be deleted. This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={deleteGoal}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  )
}
