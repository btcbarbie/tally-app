import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildGoalFinancialState, calcEqualContribution, calcProjectedTotal, calcDaysRemaining } from '@/lib/finance'
import { runPlanCheck } from '@/lib/ai'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const goal = await prisma.goal.findUnique({
      where: { id },
      include: {
        commitments: { include: { member: true } },
        payments: true,
        members: true,
      },
    })

    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    // Check for a cached plan check (avoid re-running if goal hasn't changed)
    const existingCheck = await prisma.aiInsight.findFirst({
      where: { goalId: id, type: 'PLAN_CHECK' },
      orderBy: { createdAt: 'desc' },
    })

    const fs = buildGoalFinancialState(goal)

    // Deterministic calculations first
    const equalAmount = goal.equalAmount ?? calcEqualContribution(goal.targetAmount, goal.expectedParticipants)
    const projectedTotal = goal.commitments.length > 0
      ? calcProjectedTotal(goal.commitments)
      : goal.expectedParticipants * equalAmount
    const shortfall = Math.max(0, goal.targetAmount - projectedTotal)
    const daysUntilDeadline = calcDaysRemaining(goal.deadline)
    const hasPaymentAccount = !!(goal.accountNumber || goal.bankName)
    const deadlineStr = new Date(goal.deadline).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })

    // If a cached result exists and goal hasn't changed in last hour, return it
    if (existingCheck) {
      const cacheAgeMs = Date.now() - new Date(existingCheck.createdAt).getTime()
      const oneHour = 60 * 60 * 1000
      if (cacheAgeMs < oneHour) {
        try {
          const cached = JSON.parse(existingCheck.content)
          return NextResponse.json({ planCheck: cached, calculations: { equalAmount, projectedTotal, shortfall, targetAmount: goal.targetAmount, participants: goal.expectedParticipants }, cached: true })
        } catch { /* fall through to regenerate */ }
      }
    }

    const result = await runPlanCheck({
      title: goal.title,
      description: goal.description,
      targetAmount: goal.targetAmount,
      participants: goal.expectedParticipants,
      contributionType: goal.contributionType,
      paymentType: goal.paymentType,
      equalAmount,
      projectedTotal,
      shortfall,
      daysUntilDeadline,
      deadline: deadlineStr,
      hasPaymentAccount,
    })

    // Save plan check insight
    await prisma.aiInsight.create({
      data: {
        goalId: id,
        type: 'PLAN_CHECK',
        content: JSON.stringify(result),
      },
    })

    return NextResponse.json({
      planCheck: result,
      calculations: {
        equalAmount,
        projectedTotal,
        shortfall,
        targetAmount: goal.targetAmount,
        participants: goal.expectedParticipants,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to run plan check' }, { status: 500 })
  }
}

