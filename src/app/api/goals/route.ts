import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

export async function GET() {
  try {
    const goals = await prisma.goal.findMany({
      include: {
        commitments: { include: { member: true } },
        payments: true,
        members: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ goals })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      title,
      description,
      targetAmount,
      deadline,
      expectedParticipants,
      contributionType,
      paymentType,
      joinType,
      bankName,
      accountName,
      accountNumber,
      paymentNote,
      adminName,
    } = body

    if (!title || !targetAmount || !deadline || !expectedParticipants || !contributionType || !paymentType || !joinType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!bankName?.trim() || !accountName?.trim() || !accountNumber?.trim()) {
      return NextResponse.json({ error: 'Payment account details are required' }, { status: 400 })
    }

    if (!adminName?.trim()) {
      return NextResponse.json({ error: 'Your name is required' }, { status: 400 })
    }

    const adminToken = randomUUID()
    const shareToken = randomUUID().slice(0, 12)

    const equalAmount =
      contributionType === 'EQUAL' ? Math.ceil(Number(targetAmount) / Number(expectedParticipants)) : null

    // The admin is automatically the group's first contributor — same
    // Member/Commitment tracking as anyone who joins, but they never get a
    // member token client-side, so they stay in admin view only.
    const ownContribution = equalAmount ?? Math.ceil(Number(targetAmount) / Number(expectedParticipants))

    const goal = await prisma.$transaction(async (tx) => {
      const created = await tx.goal.create({
        data: {
          title: String(title).trim(),
          description: description ? String(description).trim() : null,
          targetAmount: Number(targetAmount),
          deadline: new Date(deadline),
          contributionType,
          paymentType,
          joinType,
          status: 'ACTIVE',
          adminToken,
          shareToken,
          expectedParticipants: Number(expectedParticipants),
          equalAmount,
          bankName: bankName ? String(bankName).trim() : null,
          accountName: accountName ? String(accountName).trim() : null,
          accountNumber: accountNumber ? String(accountNumber).trim() : null,
          paymentNote: paymentNote ? String(paymentNote).trim() : null,
        },
      })

      const adminMember = await tx.member.create({
        data: {
          goalId: created.id,
          name: String(adminName).trim(),
          memberToken: randomUUID(),
        },
      })

      await tx.commitment.create({
        data: {
          memberId: adminMember.id,
          goalId: created.id,
          committedAmount: ownContribution,
          paidAmount: 0,
          outstandingAmount: ownContribution,
          status: 'PENDING',
        },
      })

      return created
    })

    return NextResponse.json({ goal, adminToken }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 })
  }
}
