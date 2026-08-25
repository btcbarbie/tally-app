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
    } = body

    if (!title || !targetAmount || !deadline || !expectedParticipants || !contributionType || !paymentType || !joinType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const adminToken = randomUUID()
    const shareToken = randomUUID().slice(0, 12)

    const equalAmount =
      contributionType === 'EQUAL' ? Math.ceil(Number(targetAmount) / Number(expectedParticipants)) : null

    const goal = await prisma.goal.create({
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

    return NextResponse.json({ goal, adminToken }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 })
  }
}
