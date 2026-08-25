import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildGoalFinancialState } from '@/lib/finance'
import { generateFinancialInsight } from '@/lib/ai'

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

    const insight = await generateFinancialInsight({
      title: goal.title,
      ...fs,
    })

    // Save insight
    await prisma.aiInsight.create({
      data: {
        goalId: id,
        type: 'FINANCIAL_INSIGHT',
        content: JSON.stringify(insight),
      },
    })

    return NextResponse.json({ insight, financialState: fs })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to generate insight' }, { status: 500 })
  }
}
