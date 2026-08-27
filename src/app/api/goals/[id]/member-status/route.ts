import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildGoalFinancialState } from '@/lib/finance'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const memberToken = req.nextUrl.searchParams.get('memberToken')

    if (!memberToken) return NextResponse.json({ error: 'memberToken required' }, { status: 400 })

    const member = await prisma.member.findUnique({
      where: { memberToken },
      include: {
        commitment: true,
        payments: { orderBy: { createdAt: 'desc' } },
        receipts: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    })

    if (!member || member.goalId !== id) {
      return NextResponse.json({ error: 'Member not found for this goal' }, { status: 404 })
    }

    const goal = await prisma.goal.findUnique({
      where: { id },
      include: {
        commitments: { include: { member: true } },
        payments: true,
        members: true,
      },
    })

    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    const financialState = buildGoalFinancialState(goal)

    return NextResponse.json({
      goal: {
        id: goal.id,
        title: goal.title,
        description: goal.description,
        targetAmount: goal.targetAmount,
        deadline: goal.deadline,
        status: goal.status,
        equalAmount: goal.equalAmount,
        contributionType: goal.contributionType,
        paymentType: goal.paymentType,
        // Payment destination — must be included so members know where to send money
        bankName: goal.bankName ?? null,
        accountName: goal.accountName ?? null,
        accountNumber: goal.accountNumber ?? null,
        paymentNote: goal.paymentNote ?? null,
      },
      financialState: {
        percentFunded: financialState.percentFunded,
        totalCollected: financialState.totalCollected,
        totalMembers: financialState.totalMembers,
        paidCount: financialState.paidCount,
        daysRemaining: financialState.daysRemaining,
        milestone: financialState.milestone,
        riskStatus: financialState.riskStatus,
        shortfall: financialState.shortfall,
      },
      member: {
        id: member.id,
        name: member.name,
        commitment: member.commitment,
        payments: member.payments,
        receipts: member.receipts,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch member status' }, { status: 500 })
  }
}
