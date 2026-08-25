import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildGoalFinancialState, calcEqualContribution, calcProjectedTotal } from '@/lib/finance'
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

    const fs = buildGoalFinancialState(goal)

    // Deterministic calculations
    const equalAmount = goal.equalAmount ?? calcEqualContribution(goal.targetAmount, goal.expectedParticipants)
    const projectedTotal = calcProjectedTotal(goal.commitments.length > 0 
      ? goal.commitments 
      : Array(goal.expectedParticipants).fill({ committedAmount: equalAmount })
    )
    const shortfall = Math.max(0, goal.targetAmount - (goal.commitments.length > 0 ? projectedTotal : goal.expectedParticipants * equalAmount))

    const result = await runPlanCheck({
      title: goal.title,
      targetAmount: goal.targetAmount,
      participants: goal.expectedParticipants,
      contributionType: goal.contributionType,
      equalAmount,
      projectedTotal: goal.commitments.length > 0 ? projectedTotal : goal.expectedParticipants * equalAmount,
      shortfall,
    })

    // Save plan check insight
    await prisma.aiInsight.create({
      data: {
        goalId: id,
        type: 'PLAN_CHECK',
        content: JSON.stringify({ ...result, equalAmount, projectedTotal, shortfall }),
      },
    })

    return NextResponse.json({
      planCheck: result,
      calculations: {
        equalAmount,
        projectedTotal: goal.commitments.length > 0 ? projectedTotal : goal.expectedParticipants * equalAmount,
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
