'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, Target, Calendar, ArrowRight, AlertCircle, Copy, Check, Building2 } from 'lucide-react'

interface Goal {
  id: string
  title: string
  description?: string
  targetAmount: number
  deadline: string
  contributionType: string
  paymentType: string
  equalAmount?: number
  expectedParticipants: number
  status: string
  bankName?: string
  accountName?: string
  accountNumber?: string
  paymentNote?: string
}

function formatCurrency(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

export default function JoinPage() {
  const params = useParams()
  const router = useRouter()
  const shareToken = params.shareToken as string

  const [goal, setGoal] = useState<Goal | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [joined, setJoined] = useState(false)
  const [joinedGoalId, setJoinedGoalId] = useState('')
  const [joinedToken, setJoinedToken] = useState('')
  const [copiedAcct, setCopiedAcct] = useState(false)
  const [ownAdminToken, setOwnAdminToken] = useState<string | null>(null)
  const [showRecover, setShowRecover] = useState(false)
  const [recoverName, setRecoverName] = useState('')
  const [recovering, setRecovering] = useState(false)
  const [recoverError, setRecoverError] = useState('')

  useEffect(() => {
    const fetchGoal = async () => {
      try {
        const res = await fetch(`/api/join/${shareToken}`)
        const data = await res.json()
        if (res.ok) {
          setGoal(data.goal)
        } else {
          setFetchError(data.error || 'This invite link is not valid.')
        }
      } catch {
        setFetchError('Unable to load goal. Please check the link and try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchGoal()
  }, [shareToken])

  useEffect(() => {
    if (goal && typeof window !== 'undefined') {
      setOwnAdminToken(localStorage.getItem(`tally_admin_${goal.id}`))
    }
  }, [goal])

  const handleJoin = async () => {
    if (!name.trim()) { setError('Please enter your name'); return }
    if (goal?.contributionType === 'FLEXIBLE' && (!amount || Number(amount) <= 0)) {
      setError('Please enter your contribution amount')
      return
    }
    setJoining(true)
    setError('')
    try {
      const res = await fetch(`/api/goals/${goal!.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), committedAmount: Number(amount) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to join')

      if (typeof window !== 'undefined') {
        localStorage.setItem(`tally_member_${goal!.id}`, data.memberToken)
        localStorage.setItem(`tally_memberId_${goal!.id}`, data.member.id)
      }

      setJoinedGoalId(goal!.id)
      setJoinedToken(data.memberToken)
      setJoined(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to join')
      setJoining(false)
    }
  }

  const handleRecover = async () => {
    if (!recoverName.trim()) { setRecoverError('Enter the name you joined with'); return }
    setRecovering(true)
    setRecoverError('')
    try {
      const res = await fetch(`/api/goals/${goal!.id}/members?name=${encodeURIComponent(recoverName.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to recover access')

      if (typeof window !== 'undefined') {
        localStorage.setItem(`tally_member_${goal!.id}`, data.memberToken)
        localStorage.setItem(`tally_memberId_${goal!.id}`, data.memberId)
      }

      router.push(`/goals/${goal!.id}/member?memberToken=${data.memberToken}`)
    } catch (e: unknown) {
      setRecoverError(e instanceof Error ? e.message : 'Failed to recover access')
      setRecovering(false)
    }
  }

  const copyAccountNumber = () => {
    if (!goal?.accountNumber) return
    navigator.clipboard.writeText(goal.accountNumber)
    setCopiedAcct(true)
    setTimeout(() => setCopiedAcct(false), 2000)
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-muted)' }}>Loading invitation...</p>
      </div>
    )
  }

  /* ── Invalid link ── */
  if (fetchError || !goal) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="card animate-fade-in" style={{ padding: '36px 28px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
          <AlertCircle size={40} color="var(--color-warning)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>Invalid Invite Link</h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
            {fetchError || 'This link may have expired or is no longer valid.'}
          </p>
          <Link href="/" className="btn btn-primary">Go Home</Link>
        </div>
      </div>
    )
  }

  /* ── Closed/Achieved goal ── */
  if (goal.status === 'CLOSED' || goal.status === 'TARGET_REACHED') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="card animate-fade-in" style={{ padding: '36px 28px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>{goal.status === 'TARGET_REACHED' ? '🎉' : '🔒'}</div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>
            {goal.status === 'TARGET_REACHED' ? 'Goal Already Achieved!' : 'This Goal is Closed'}
          </h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '14px', marginBottom: '24px' }}>
            {goal.status === 'TARGET_REACHED' ? 'The group has already reached their target.' : 'This goal has been closed by the admin.'}
          </p>
          <Link href="/" className="btn btn-secondary">Go Home</Link>
        </div>
      </div>
    )
  }

  const contribution = goal.contributionType === 'EQUAL' && goal.equalAmount ? formatCurrency(goal.equalAmount) : null

  /* ── Already the admin of this goal ── */
  if (ownAdminToken) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="card animate-fade-in" style={{ padding: '36px 28px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>👑</div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>You created this goal</h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
            You&apos;re already the admin of &quot;{goal.title}&quot;, so there&apos;s no need to join as a member too. Share this invite link with other people instead.
          </p>
          <Link href={`/goals/${goal.id}?adminToken=${ownAdminToken}`} className="btn btn-primary">Go to Admin Dashboard</Link>
        </div>
      </div>
    )
  }

  /* ── Successfully Joined ── */
  if (joined) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <nav className="nav">
          <div className="container nav-inner">
            <a href="/" className="nav-brand">Tally<span>.</span></a>
          </div>
        </nav>
        <div style={{ padding: '32px 16px', maxWidth: '520px', margin: '0 auto' }}>
          {/* Success header */}
          <div className="card animate-fade-in" style={{ padding: '28px 24px', textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
            <h2 style={{ fontSize: '22px', fontWeight: '900', marginBottom: '8px' }}>You&apos;ve joined!</h2>
            <p style={{ color: 'var(--color-muted)', fontSize: '14px', marginBottom: '4px' }}>
              Welcome to <strong>{goal.title}</strong>, {name}.
            </p>
            {contribution && (
              <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--color-forest)' }}>
                Your commitment: {contribution}
              </p>
            )}
          </div>

          {/* Payment details — how to pay */}
          {(goal.bankName || goal.accountNumber || goal.accountName) ? (
            <div className="card" style={{ padding: '24px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={16} color="var(--color-forest)" /> How to Pay
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '16px' }}>
                Pay whenever you&apos;re ready — transfer to the account below and upload your receipt.
              </p>

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '800', fontSize: '16px', letterSpacing: '1px' }}>{goal.accountNumber}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(goal.accountNumber!)
                          setCopiedAcct(true)
                          setTimeout(() => setCopiedAcct(false), 2000)
                        }}
                        style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-forest)' }}
                      >
                        {copiedAcct ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                      </button>
                    </div>
                  </div>
                )}

                {contribution && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                    <span style={{ color: 'var(--color-muted)' }}>Amount to Send</span>
                    <span style={{ fontWeight: '800', color: 'var(--color-forest)', fontSize: '16px' }}>{contribution}</span>
                  </div>
                )}
              </div>

              {goal.paymentNote && (
                <div style={{ marginTop: '12px', padding: '10px 14px', background: '#fef9ec', borderRadius: '8px', fontSize: '13px', color: 'var(--color-charcoal-mid)', lineHeight: '1.5' }}>
                  📝 {goal.paymentNote}
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: '20px', marginBottom: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: 'var(--color-muted)' }}>
                The group admin has not shared bank details for this goal yet. Check your member dashboard for updates.
              </p>
            </div>
          )}

          {/* CTA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Link
              href={`/goals/${joinedGoalId}/member?memberToken=${joinedToken}`}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', textAlign: 'center', justifyContent: 'center' }}
            >
              View My Contribution <ArrowRight size={16} />
            </Link>
            <p style={{ fontSize: '12px', color: 'var(--color-muted)', textAlign: 'center' }}>
              You can upload your payment receipt anytime from your contribution page.
            </p>
          </div>
        </div>
      </div>
    )
  }

  /* ── Join Form ── */
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <nav className="nav">
        <div className="container nav-inner">
          <a href="/" className="nav-brand">Tally<span>.</span></a>
        </div>
      </nav>

      <div style={{ padding: '28px 16px 48px', maxWidth: '540px', margin: '0 auto' }}>
        {/* Invite Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'var(--color-forest-subtle)', color: 'var(--color-forest)',
            padding: '5px 14px', borderRadius: '100px', fontSize: '12px', fontWeight: '700',
            textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px',
          }}>
            You&apos;re Invited
          </div>
          <h1 style={{ fontSize: 'clamp(22px, 5vw, 32px)', fontWeight: '900', letterSpacing: '-0.5px', marginBottom: '8px' }}>
            {goal.title}
          </h1>
          {goal.description && (
            <p style={{ color: 'var(--color-muted)', fontSize: '14px', maxWidth: '420px', margin: '0 auto', lineHeight: '1.5' }}>
              {goal.description}
            </p>
          )}
        </div>

        {/* Goal Stats */}
        <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: contribution ? '16px' : '0' }}>
            {[
              { icon: <Target size={15} color="var(--color-forest)" />, label: 'Target', value: formatCurrency(goal.targetAmount) },
              { icon: <Users size={15} color="var(--color-forest)" />, label: 'Members', value: `${goal.expectedParticipants}` },
              { icon: <Calendar size={15} color="var(--color-forest)" />, label: 'Deadline', value: new Date(goal.deadline).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: '12px 6px', background: 'var(--color-surface-2)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '5px' }}>{s.icon}</div>
                <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--color-charcoal)', marginBottom: '2px' }}>{s.value}</div>
                <div style={{ fontSize: '10px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {contribution && (
            <div style={{ background: 'var(--color-forest-subtle)', borderRadius: '10px', padding: '14px 18px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: 'var(--color-forest)', fontWeight: '600', marginBottom: '2px' }}>
                Your contribution: <strong style={{ fontSize: '18px' }}>{contribution}</strong>
              </p>
              <p style={{ fontSize: '12px', color: 'var(--color-forest)', opacity: 0.8 }}>
                Pay whenever you&apos;re ready — no pressure to pay immediately
              </p>
            </div>
          )}

          {goal.paymentType === 'PARTIAL' && (
            <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--color-muted)', textAlign: 'center' }}>
              ✓ Partial payments accepted — pay in instalments before the deadline.
            </p>
          )}
        </div>

        {/* Join Form */}
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '4px' }}>Join this goal</h2>
          <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '18px' }}>
            Enter your name to commit. You don&apos;t need to pay right now — you&apos;ll get payment details after joining.
          </p>

          {error && (
            <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Your Name</label>
              <input
                className="form-input"
                placeholder="e.g. Amaka Okonkwo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                style={{ fontSize: '16px' }}
              />
            </div>

            {goal.contributionType === 'FLEXIBLE' && (
              <div className="form-group">
                <label className="form-label">Your Contribution Amount (₦)</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="e.g. 20000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="numeric"
                  style={{ fontSize: '16px' }}
                />
              </div>
            )}

            <button
              className="btn btn-primary btn-lg"
              onClick={handleJoin}
              disabled={joining}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {joining ? 'Joining...' : <>Join {contribution ? `& Commit ${contribution}` : 'Goal'} <ArrowRight size={16} /></>}
            </button>

            <p style={{ fontSize: '12px', color: 'var(--color-muted)', textAlign: 'center', lineHeight: '1.5' }}>
              Joining commits you to the goal. You can pay and upload your receipt at any time.
            </p>
          </div>
        </div>

        {/* Recover access */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          {!showRecover ? (
            <button
              onClick={() => setShowRecover(true)}
              style={{ background: 'none', border: 'none', color: 'var(--color-muted)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Already joined? Recover your access
            </button>
          ) : (
            <div className="card animate-fade-in" style={{ padding: '20px', textAlign: 'left' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>Recover Your Access</h3>
              <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '14px' }}>
                Enter the name you originally joined with to get back to your contribution page.
              </p>
              {recoverError && (
                <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' }}>
                  {recoverError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  className="form-input"
                  placeholder="Your name"
                  value={recoverName}
                  onChange={(e) => setRecoverName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRecover()}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-secondary" onClick={handleRecover} disabled={recovering}>
                  {recovering ? 'Looking...' : 'Find Me'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
