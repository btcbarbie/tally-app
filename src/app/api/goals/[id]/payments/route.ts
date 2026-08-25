import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Record a payment (admin confirms)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { memberId, amount, reference, adminToken } = await req.json()

    if (!memberId || !amount) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const goal = await prisma.goal.findUnique({ where: { id } })
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    if (adminToken && goal.adminToken !== adminToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const commitment = await prisma.commitment.findFirst({ where: { memberId, goalId: id } })
    if (!commitment) return NextResponse.json({ error: 'Commitment not found' }, { status: 404 })

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        memberId,
        goalId: id,
        amount: Number(amount),
        reference: reference || null,
        verificationStatus: 'CONFIRMED',
      },
    })

    // Update commitment
    const newPaid = commitment.paidAmount + Number(amount)
    const newOutstanding = Math.max(0, commitment.committedAmount - newPaid)
    const newStatus = newOutstanding === 0 ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'PENDING'

    await prisma.commitment.update({
      where: { id: commitment.id },
      data: {
        paidAmount: newPaid,
        outstandingAmount: newOutstanding,
        status: newStatus,
      },
    })

    // Check if goal target is reached
    const allPayments = await prisma.payment.findMany({
      where: { goalId: id, verificationStatus: 'CONFIRMED' },
    })
    const totalCollected = allPayments.reduce((s, p) => s + p.amount, 0)

    if (totalCollected >= goal.targetAmount && goal.status === 'ACTIVE') {
      await prisma.goal.update({ where: { id }, data: { status: 'TARGET_REACHED' } })
    }

    return NextResponse.json({ payment, commitment: { paidAmount: newPaid, outstandingAmount: newOutstanding, status: newStatus } }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 })
  }
}
