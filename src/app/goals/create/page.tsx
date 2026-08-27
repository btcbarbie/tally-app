'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Target,
  Calendar,
  Users,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronRight,
  Sparkles,
  Link2,
  Lock,
  Building2,
  CreditCard,
  User,
} from 'lucide-react'

interface GoalFormData {
  adminName: string
  title: string
  description: string
  targetAmount: string
  deadline: string
  expectedParticipants: string
  contributionType: 'EQUAL' | 'FLEXIBLE'
  paymentType: 'FULL' | 'PARTIAL'
  joinType: 'INVITE_ONLY' | 'OPEN_LINK'
  bankName: string
  accountName: string
  accountNumber: string
  paymentNote: string
}

const STEPS = ['Goal Details', 'Contribution', 'Payment Details', 'Settings', 'Review']

export default function CreateGoalPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<GoalFormData>({
    adminName: '',
    title: '',
    description: '',
    targetAmount: '',
    deadline: '',
    expectedParticipants: '',
    contributionType: 'EQUAL',
    paymentType: 'FULL',
    joinType: 'OPEN_LINK',
    bankName: '',
    accountName: '',
    accountNumber: '',
    paymentNote: '',
  })

  const update = (field: keyof GoalFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  const equalAmount =
    form.contributionType === 'EQUAL' && form.targetAmount && form.expectedParticipants
      ? Math.ceil(Number(form.targetAmount) / Number(form.expectedParticipants))
      : null

  const validateStep = () => {
    if (step === 0) {
      if (!form.adminName.trim()) return 'Please enter your name.'
      if (!form.title.trim()) return 'Please enter a goal title.'
      if (!form.targetAmount || Number(form.targetAmount) <= 0) return 'Please enter a valid target amount.'
      if (!form.deadline) return 'Please select a deadline.'
      const deadline = new Date(form.deadline)
      if (deadline <= new Date()) return 'Deadline must be in the future.'
      if (!form.expectedParticipants || Number(form.expectedParticipants) < 1)
        return 'Please enter the expected number of participants.'
    }
    if (step === 2) {
      if (!form.bankName.trim()) return 'Please enter the bank name.'
      if (!form.accountName.trim()) return 'Please enter the account holder name.'
      if (!form.accountNumber.trim()) return 'Please enter the account number.'
    }
    return null
  }

  const handleNext = () => {
    const err = validateStep()
    if (err) { setError(err); return }
    setStep((s) => s + 1)
  }

  const handleBack = () => setStep((s) => s - 1)

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          targetAmount: Number(form.targetAmount),
          expectedParticipants: Number(form.expectedParticipants),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create goal')
      router.push(`/goals/${data.goal.id}?new=1&adminToken=${data.adminToken}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const formatNum = (v: string) => {
    const n = Number(v)
    return isNaN(n) ? v : n.toLocaleString('en-NG')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Nav */}
      <nav className="nav">
        <div className="container nav-inner">
          <a href="/" className="nav-brand">Tally<span>.</span></a>
          <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Create Shared Goal</span>
        </div>
      </nav>

      <div className="container-sm" style={{ padding: '24px 16px 48px' }}>
        {/* Step Indicator */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: i < STEPS.length - 1 ? '1' : 'none' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: '700', flexShrink: 0,
                  background: i <= step ? 'var(--color-forest)' : 'var(--color-border)',
                  color: i <= step ? 'white' : 'var(--color-muted)',
                  transition: 'all 0.3s ease',
                }}>
                  {i < step ? <Check size={13} /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: '2px', background: i < step ? 'var(--color-forest)' : 'var(--color-border)', transition: 'background 0.3s ease' }} />
                )}
              </div>
            ))}
          </div>
          <div>
            <h1 style={{ fontSize: 'clamp(20px, 4vw, 26px)', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '2px' }}>
              {STEPS[step]}
            </h1>
            <p style={{ color: 'var(--color-muted)', fontSize: '13px' }}>
              Step {step + 1} of {STEPS.length}
            </p>
          </div>
        </div>

        {/* Step Content */}
        <div className="card animate-fade-in" style={{ padding: 'clamp(20px, 4vw, 32px)' }}>
          {error && (
            <div style={{ background: '#fee2e2', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '20px', fontWeight: '500' }}>
              {error}
            </div>
          )}

          {/* ─── Step 0: Goal Details ─── */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="form-group">
                <label className="form-label">
                  <User size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Your Name
                </label>
                <input
                  className="form-input"
                  placeholder="e.g. Adaeze Okonkwo"
                  value={form.adminName}
                  onChange={(e) => update('adminName', e.target.value)}
                  maxLength={80}
                />
                <span className="form-hint">You&apos;re automatically the group&apos;s first contributor.</span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Target size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Goal Title
                </label>
                <input
                  className="form-input"
                  placeholder="e.g. Tolu's Wedding Gift, Church Youth Retreat"
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  maxLength={80}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Description <span className="form-label-optional">(Optional)</span>
                </label>
                <textarea
                  className="form-input"
                  placeholder="Briefly describe the goal or occasion..."
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  rows={3}
                  style={{ resize: 'vertical' }}
                  maxLength={280}
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">
                    <DollarSign size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                    Target Amount (₦)
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="500000"
                    value={form.targetAmount}
                    onChange={(e) => update('targetAmount', e.target.value)}
                    min={1}
                    inputMode="numeric"
                  />
                  {form.targetAmount && (
                    <span className="form-hint">₦{formatNum(form.targetAmount)}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <Users size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                    Expected Participants
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="25"
                    value={form.expectedParticipants}
                    onChange={(e) => update('expectedParticipants', e.target.value)}
                    min={1}
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Calendar size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Deadline
                </label>
                <input
                  className="form-input"
                  type="date"
                  value={form.deadline}
                  onChange={(e) => update('deadline', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          )}

          {/* ─── Step 1: Contribution Structure ─── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: '12px' }}>Contribution Structure</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className={`option-card ${form.contributionType === 'EQUAL' ? 'selected' : ''}`} onClick={() => update('contributionType', 'EQUAL')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '700', marginBottom: '2px' }}>Equal Contribution</div>
                        <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Everyone contributes the same amount</div>
                      </div>
                      {form.contributionType === 'EQUAL' && (
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={13} color="white" />
                        </div>
                      )}
                    </div>
                    {form.contributionType === 'EQUAL' && equalAmount && (
                      <div style={{ marginTop: '10px', padding: '10px', background: 'white', borderRadius: '8px', fontSize: '13px', color: 'var(--color-forest)', fontWeight: '600' }}>
                        ₦{equalAmount.toLocaleString()} per person ({form.expectedParticipants} people → ₦{(equalAmount * Number(form.expectedParticipants)).toLocaleString()} total)
                      </div>
                    )}
                  </div>

                  <div className={`option-card ${form.contributionType === 'FLEXIBLE' ? 'selected' : ''}`} onClick={() => update('contributionType', 'FLEXIBLE')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '700', marginBottom: '2px' }}>Flexible Contribution</div>
                        <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Members choose their own amount</div>
                      </div>
                      {form.contributionType === 'FLEXIBLE' && (
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={13} color="white" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ marginBottom: '12px' }}>Payment Structure</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className={`option-card ${form.paymentType === 'FULL' ? 'selected' : ''}`} onClick={() => update('paymentType', 'FULL')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '700', marginBottom: '2px' }}>Full Payment Only</div>
                        <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Members pay their full commitment at once</div>
                      </div>
                      {form.paymentType === 'FULL' && (
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={13} color="white" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`option-card ${form.paymentType === 'PARTIAL' ? 'selected' : ''}`} onClick={() => update('paymentType', 'PARTIAL')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '700', marginBottom: '2px' }}>Partial Payments Allowed</div>
                        <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Members can pay in instalments</div>
                      </div>
                      {form.paymentType === 'PARTIAL' && (
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={13} color="white" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 2: Payment Details ─── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ background: 'var(--color-forest-subtle)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '4px' }}>
                <p style={{ fontSize: '13px', color: 'var(--color-forest)', lineHeight: '1.5', fontWeight: '500' }}>
                  <Building2 size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Members will see these payment details when they want to contribute.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Bank Name</label>
                <input
                  className="form-input"
                  placeholder="e.g. Access Bank, GTBank, Zenith Bank"
                  value={form.bankName}
                  onChange={(e) => update('bankName', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Account Holder Name</label>
                <input
                  className="form-input"
                  placeholder="e.g. Amaka Okonkwo"
                  value={form.accountName}
                  onChange={(e) => update('accountName', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <CreditCard size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Account Number
                </label>
                <input
                  className="form-input"
                  placeholder="0123456789"
                  value={form.accountNumber}
                  onChange={(e) => update('accountNumber', e.target.value)}
                  maxLength={20}
                  inputMode="numeric"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Payment Instructions <span className="form-label-optional">(Optional)</span>
                </label>
                <textarea
                  className="form-input"
                  placeholder="e.g. Use your name as payment reference. Transfer exact amount only."
                  value={form.paymentNote}
                  onChange={(e) => update('paymentNote', e.target.value)}
                  rows={3}
                  maxLength={200}
                />
              </div>
            </div>
          )}

          {/* ─── Step 3: Settings ─── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: '12px' }}>Who can join?</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className={`option-card ${form.joinType === 'OPEN_LINK' ? 'selected' : ''}`} onClick={() => update('joinType', 'OPEN_LINK')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--color-forest-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Link2 size={18} color="var(--color-forest)" />
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', marginBottom: '2px' }}>Anyone with the link</div>
                          <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Share the invite link — anyone can join</div>
                        </div>
                      </div>
                      {form.joinType === 'OPEN_LINK' && (
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={13} color="white" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`option-card ${form.joinType === 'INVITE_ONLY' ? 'selected' : ''}`} onClick={() => update('joinType', 'INVITE_ONLY')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Lock size={18} color="var(--color-muted)" />
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', marginBottom: '2px' }}>Invite Only</div>
                          <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Admin adds members manually</div>
                        </div>
                      </div>
                      {form.joinType === 'INVITE_ONLY' && (
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={13} color="white" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="ai-card" style={{ display: 'flex', gap: '12px' }}>
                <Sparkles size={18} color="var(--color-amber)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div className="ai-label">AI Feature</div>
                  <p style={{ fontSize: '13px', color: 'var(--color-charcoal-mid)', lineHeight: '1.5' }}>
                    After you create the goal, Tally&apos;s AI will review your contribution plan and verify the numbers.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 4: Review ─── */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'var(--color-forest-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', border: '1px solid rgba(26, 107, 74, 0.15)' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '16px', color: 'var(--color-forest)' }}>
                  {form.title}
                </h3>
                {form.description && (
                  <p style={{ fontSize: '14px', color: 'var(--color-charcoal-mid)', marginBottom: '16px' }}>{form.description}</p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                  {[
                    { label: 'Your Name', value: form.adminName },
                    { label: 'Target Amount', value: `₦${Number(form.targetAmount).toLocaleString()}` },
                    { label: 'Deadline', value: new Date(form.deadline).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) },
                    { label: 'Participants', value: form.expectedParticipants },
                    { label: 'Per Person', value: equalAmount ? `₦${equalAmount.toLocaleString()}` : 'Flexible' },
                    { label: 'Contribution', value: form.contributionType === 'EQUAL' ? 'Equal' : 'Flexible' },
                    { label: 'Payments', value: form.paymentType === 'FULL' ? 'Full only' : 'Partial OK' },
                    { label: 'Join', value: form.joinType === 'OPEN_LINK' ? 'Anyone with link' : 'Invite only' },
                  ].map((item) => (
                    <div key={item.label}>
                      <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: '600', marginBottom: '2px' }}>{item.label}</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-charcoal)' }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {/* Payment Details Review */}
                {(form.bankName || form.accountNumber) && (
                  <div style={{ borderTop: '1px solid rgba(26,107,74,0.2)', paddingTop: '14px', marginTop: '4px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-forest)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>Payment Account</div>
                    <div style={{ fontSize: '14px', color: 'var(--color-charcoal-mid)', lineHeight: '1.7' }}>
                      {form.bankName && <div><strong>Bank:</strong> {form.bankName}</div>}
                      {form.accountName && <div><strong>Name:</strong> {form.accountName}</div>}
                      {form.accountNumber && <div><strong>Account:</strong> {form.accountNumber}</div>}
                    </div>
                  </div>
                )}
              </div>

              <div className="ai-card" style={{ display: 'flex', gap: '12px' }}>
                <Sparkles size={18} color="var(--color-amber)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div className="ai-label">AI Plan Check</div>
                  <p style={{ fontSize: '13px', color: 'var(--color-charcoal-mid)', lineHeight: '1.5' }}>
                    Tally AI will review your contribution plan and verify the numbers immediately after creation.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
          {step > 0 ? (
            <button className="btn btn-ghost" onClick={handleBack} type="button">
              <ArrowLeft size={16} /> Back
            </button>
          ) : (
            <a href="/" className="btn btn-ghost"><ArrowLeft size={16} /> Cancel</a>
          )}

          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" onClick={handleNext} type="button">
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={loading} type="button">
              {loading ? 'Creating...' : <><Sparkles size={16} /> Create Goal <ArrowRight size={16} /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
