import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

// Add a member to a goal
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { name, committedAmount } = await req.json()

    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const goal = await prisma.goal.findUnique({ where: { id } })
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    // Check if name already exists
    const existing = await prisma.member.findFirst({ where: { goalId: id, name: name.trim() } })
    if (existing) return NextResponse.json({ error: 'A member with this name already exists' }, { status: 400 })

    const amount = goal.contributionType === 'EQUAL'
      ? (goal.equalAmount ?? 0)
      : Number(committedAmount ?? 0)

    if (amount <= 0) return NextResponse.json({ error: 'Invalid committed amount' }, { status: 400 })

    const memberToken = randomUUID()

    const member = await prisma.member.create({
      data: {
        goalId: id,
        name: name.trim(),
        memberToken,
      },
    })

    await prisma.commitment.create({
      data: {
        memberId: member.id,
        goalId: id,
        committedAmount: amount,
        paidAmount: 0,
        outstandingAmount: amount,
        status: 'PENDING',
      },
    })

    return NextResponse.json({ member, memberToken }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
  }
}

// Leave group (delete member participation)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const searchParams = req.nextUrl.searchParams
    const memberToken = searchParams.get('memberToken')
    const memberId = searchParams.get('memberId')

    if (!memberToken && !memberId) {
      return NextResponse.json({ error: 'memberToken or memberId required' }, { status: 400 })
    }

    const member = await prisma.member.findFirst({
      where: {
        goalId: id,
        ...(memberToken ? { memberToken } : { id: memberId! }),
      },
    })

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    await prisma.member.delete({
      where: { id: member.id },
    })

    return NextResponse.json({ success: true, message: 'Left group successfully' })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to leave group' }, { status: 500 })
  }
}
