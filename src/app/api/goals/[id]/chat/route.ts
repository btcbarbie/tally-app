import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildGoalFinancialState } from '@/lib/finance'
import { answerFinancialQuestion } from '@/lib/ai'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { question, history = [], memberToken } = body

    if (!question?.trim()) return NextResponse.json({ error: 'Question required' }, { status: 400 })

    const goal = await prisma.goal.findUnique({
      where: { id },
      include: {
        commitments: { include: { member: true } },
        payments: true,
        members: true,
        receipts: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    // A member asking (identified by memberToken) only gets grounded on their own
    // contribution, not everyone else's — the member dashboard never shows other
    // members' individual amounts, so the AI shouldn't either.
    let callingMemberId: string | null = null
    if (memberToken) {
      const callingMember = goal.members.find((m) => m.memberToken === memberToken)
      if (!callingMember) return NextResponse.json({ error: 'Invalid member session' }, { status: 403 })
      callingMemberId = callingMember.id
    }

    const fs = buildGoalFinancialState(goal)

    // Pending receipts awaiting admin confirmation
    const pendingReceiptsCount = goal.receipts.filter(
      r => r.status === 'PENDING_REVIEW' || r.status === 'LIKELY_MATCH' || r.status === 'NEEDS_REVIEW'
    ).length

    // Full contributor breakdown for grounded answers (admin) — or just the
    // caller's own row when a member is asking, to avoid naming other members.
    const contributors = goal.commitments
      .filter((c) => !callingMemberId || c.memberId === callingMemberId)
      .map((c) => {
        const memberReceipts = goal.receipts.filter(r => r.memberId === c.memberId)
        const hasSubmittedReceipt = memberReceipts.some(
          r => r.status === 'PENDING_REVIEW' || r.status === 'LIKELY_MATCH' || r.status === 'NEEDS_REVIEW'
        )
        return {
          name: callingMemberId ? 'You' : c.member.name,
          status: hasSubmittedReceipt && c.status === 'PENDING' ? 'PAYMENT_SUBMITTED' : c.status,
          paidAmount: c.paidAmount,
          committedAmount: c.committedAmount,
          outstandingAmount: c.outstandingAmount,
        }
      })

    const answer = await answerFinancialQuestion({
      question,
      financialState: {
        // fs already includes targetAmount, deadline etc. Add extras on top
        pendingReceiptsAwaitingAdmin: pendingReceiptsCount,
        contributionType: goal.contributionType,
        paymentType: goal.paymentType,
        title: goal.title,
        askerRole: callingMemberId ? 'member (only their own contribution is shown, not other members\')' : 'admin',
        ...fs,
      },
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
    console.error('Chat route error:', e)
    // Return a proper error response — never crash the page
    return NextResponse.json(
      { answer: "Tally AI couldn't process that question right now. Please try again in a moment.", error: true },
      { status: 200 } // 200 so client still renders the message in the chat
    )
  }
}

