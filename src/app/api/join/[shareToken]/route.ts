import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ shareToken: string }> }) {
  try {
    const { shareToken } = await params
    const goal = await prisma.goal.findUnique({
      where: { shareToken },
      select: {
        id: true,
        title: true,
        description: true,
        targetAmount: true,
        deadline: true,
        contributionType: true,
        paymentType: true,
        joinType: true,
        equalAmount: true,
        expectedParticipants: true,
        status: true,
      },
    })

    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    if (goal.joinType === 'INVITE_ONLY') return NextResponse.json({ error: 'This goal is invite-only' }, { status: 403 })

    return NextResponse.json({ goal })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch goal' }, { status: 500 })
  }
}
