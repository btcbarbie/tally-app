import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateReminder } from '@/lib/ai'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { language = 'english' } = await req.json().catch(() => ({}))

    const goal = await prisma.goal.findUnique({
      where: { id },
      include: {
        commitments: { include: { member: true } },
        payments: true,
      },
    })

    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    const pendingMembers = goal.commitments
      .filter((c) => c.status === 'PENDING')
      .map((c) => c.member.name)

    const partialMembers = goal.commitments
      .filter((c) => c.status === 'PARTIAL')
      .map((c) => c.member.name)

    const deadline = new Date(goal.deadline).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    const reminder = await generateReminder({
      goalTitle: goal.title,
      deadline,
      equalAmount: goal.equalAmount ?? undefined,
      pendingMembers,
      partialMembers,
      language,
    })

    await prisma.aiInsight.create({
      data: {
        goalId: id,
        type: 'REMINDER',
        content: reminder,
      },
    })

    return NextResponse.json({ reminder, pendingCount: pendingMembers.length, partialCount: partialMembers.length })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to generate reminder' }, { status: 500 })
  }
}
