import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildGoalFinancialState } from '@/lib/finance'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const goal = await prisma.goal.findUnique({
      where: { id },
      include: {
        commitments: { include: { member: true } },
        payments: true,
        members: true,
        receipts: { include: { member: true }, orderBy: { createdAt: 'desc' } },
        insights: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })

    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    const financialState = buildGoalFinancialState(goal)

    return NextResponse.json({ goal, financialState })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch goal' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { status, extendedDeadline, adminToken, bankName, accountName, accountNumber, paymentNote } = body

    const goal = await prisma.goal.findUnique({ where: { id } })
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    if (adminToken && goal.adminToken !== adminToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    if (
      (bankName !== undefined && !String(bankName).trim()) ||
      (accountName !== undefined && !String(accountName).trim()) ||
      (accountNumber !== undefined && !String(accountNumber).trim())
    ) {
      return NextResponse.json({ error: 'Bank name, account name, and account number cannot be empty' }, { status: 400 })
    }

    const updated = await prisma.goal.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(extendedDeadline && { extendedDeadline: new Date(extendedDeadline), deadline: new Date(extendedDeadline), status: 'EXTENDED' }),
        ...(bankName !== undefined && { bankName: bankName ? String(bankName).trim() : null }),
        ...(accountName !== undefined && { accountName: accountName ? String(accountName).trim() : null }),
        ...(accountNumber !== undefined && { accountNumber: accountNumber ? String(accountNumber).trim() : null }),
        ...(paymentNote !== undefined && { paymentNote: paymentNote ? String(paymentNote).trim() : null }),
      },
    })

    return NextResponse.json({ goal: updated })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const searchParams = req.nextUrl.searchParams
    const adminTokenParam = searchParams.get('adminToken')

    const goal = await prisma.goal.findUnique({ where: { id } })
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    // Validate admin token if provided or enforce check
    if (adminTokenParam && goal.adminToken !== adminTokenParam) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await prisma.goal.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Goal deleted successfully' })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 })
  }
}
