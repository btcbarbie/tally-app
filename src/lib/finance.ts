// Deterministic financial calculations — AI never computes these values

export function formatCurrency(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`
}

export function calcCompletionPercent(collected: number, target: number): number {
  if (target === 0) return 0
  return Math.min(100, Math.round((collected / target) * 100))
}

export function calcShortfall(target: number, collected: number): number {
  return Math.max(0, target - collected)
}

export function calcOutstanding(committed: number, paid: number): number {
  return Math.max(0, committed - paid)
}

export function calcEqualContribution(target: number, participants: number): number {
  if (participants === 0) return 0
  return Math.ceil(target / participants)
}

export function calcProjectedTotal(commitments: Array<{ committedAmount: number }>): number {
  return commitments.reduce((sum, c) => sum + c.committedAmount, 0)
}

export function calcTotalCollected(payments: Array<{ amount: number; verificationStatus: string }>): number {
  return payments
    .filter((p) => p.verificationStatus === 'CONFIRMED')
    .reduce((sum, p) => sum + p.amount, 0)
}

export function calcDaysRemaining(deadline: Date | string): number {
  const d = new Date(deadline)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function calcMomentum(
  payments: Array<{ date: Date | string; verificationStatus: string }>
): 'STRONG' | 'SLOWING' | 'STALLED' {
  const confirmed = payments.filter((p) => p.verificationStatus === 'CONFIRMED')
  const now = Date.now()
  const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

  const last3Days = confirmed.filter((p) => new Date(p.date).getTime() > threeDaysAgo).length
  const last7Days = confirmed.filter((p) => new Date(p.date).getTime() > sevenDaysAgo).length

  if (last3Days >= 2) return 'STRONG'
  if (last7Days >= 1) return 'SLOWING'
  return 'STALLED'
}

export function calcMilestone(percent: number): string | null {
  if (percent >= 100) return '100'
  if (percent >= 75) return '75'
  if (percent >= 50) return '50'
  if (percent >= 25) return '25'
  return null
}

export function getGoalRiskStatus(
  percent: number,
  daysRemaining: number,
  unpaidCount: number,
  totalCount: number
): 'ON_TRACK' | 'AT_RISK' | 'ACHIEVED' | 'CLOSED' | 'DEADLINE_REACHED' {
  if (percent >= 100) return 'ACHIEVED'
  if (daysRemaining <= 0) return 'DEADLINE_REACHED'
  const unpaidRatio = unpaidCount / Math.max(totalCount, 1)
  if (percent >= 75 || (daysRemaining > 5 && unpaidRatio < 0.4)) return 'ON_TRACK'
  return 'AT_RISK'
}

// Walks categories in priority order (index 0 = most essential) and marks each
// AFFORDABLE_NOW if the running total up to and including it fits within what's
// actually been collected — never left to the AI to guess.
export function computeCategoryNecessity(
  categories: Array<{ allocatedAmount: number }>,
  totalCollected: number
): Array<'AFFORDABLE_NOW' | 'NEEDED_NOT_YET_FUNDED'> {
  let runningTotal = 0
  return categories.map((c) => {
    runningTotal += c.allocatedAmount
    return runningTotal <= totalCollected ? 'AFFORDABLE_NOW' : 'NEEDED_NOT_YET_FUNDED'
  })
}

export function buildGoalFinancialState(goal: {
  targetAmount: number
  deadline: Date | string
  equalAmount?: number | null
  expectedParticipants: number
  contributionType: string
  status: string
  commitments: Array<{
    committedAmount: number
    paidAmount: number
    outstandingAmount: number
    status: string
    member: { name: string }
  }>
  payments: Array<{ amount: number; verificationStatus: string; date: Date | string }>
}) {
  const totalCommitted = goal.commitments.reduce((s, c) => s + c.committedAmount, 0)
  const totalCollected = calcTotalCollected(goal.payments)
  const totalOutstanding = goal.commitments.reduce((s, c) => s + c.outstandingAmount, 0)
  const shortfall = calcShortfall(goal.targetAmount, totalCollected)
  const percentFunded = calcCompletionPercent(totalCollected, goal.targetAmount)
  const paidCount = goal.commitments.filter((c) => c.status === 'PAID').length
  const partialCount = goal.commitments.filter((c) => c.status === 'PARTIAL').length
  const pendingCount = goal.commitments.filter((c) => c.status === 'PENDING').length
  const daysRemaining = calcDaysRemaining(goal.deadline)
  const momentum = calcMomentum(goal.payments)
  const milestone = calcMilestone(percentFunded)
  const projectedTotal = calcProjectedTotal(goal.commitments)
  const projectionShortfall = calcShortfall(goal.targetAmount, projectedTotal)
  const riskStatus = getGoalRiskStatus(percentFunded, daysRemaining, pendingCount, goal.commitments.length)

  return {
    targetAmount: goal.targetAmount,
    totalCommitted,
    totalCollected,
    totalOutstanding,
    shortfall,
    percentFunded,
    paidCount,
    partialCount,
    pendingCount,
    totalMembers: goal.commitments.length,
    daysRemaining,
    momentum,
    milestone,
    projectedTotal,
    projectionShortfall,
    riskStatus,
  }
}
