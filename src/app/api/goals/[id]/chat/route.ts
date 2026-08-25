import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildGoalFinancialState } from '@/lib/finance'
import { answerFinancialQuestion } from '@/lib/ai'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { question, history = [] } = await req.json()

    if (!question?.trim()) return NextResponse.json({ error: 'Question required' }, { status: 400 })

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

    const contributors = goal.commitments.map((c) => ({
      name: c.member.name,
      status: c.status,
      paidAmount: c.paidAmount,
      committedAmount: c.committedAmount,
      outstandingAmount: c.outstandingAmount,
    }))

    const answer = await answerFinancialQuestion({
      question,
      financialState: { ...fs, title: goal.title, targetAmount: goal.targetAmount, deadline: goal.deadline, status: goal.status },
      goalTitle: goal.title,
      contributors,
      history,
    })

    // Save chat exchange
    await prisma.aiInsight.create({
      data: {
        goalId: id,
        type: 'CHAT',
        prompt: question,
        content: answer,
      },
    })

    return NextResponse.json({ answer })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to process question' }, { status: 500 })
  }
}
