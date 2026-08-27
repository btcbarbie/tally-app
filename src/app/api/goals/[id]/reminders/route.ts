import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Admin-only: send a reminder to every member, or just members who haven't
// fully paid. Delivered as an in-app alert on the recipient's member dashboard
// (see member-status route) — not an email/SMS.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { adminToken, message, audience } = await req.json()

    if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })
    if (audience !== 'ALL' && audience !== 'UNPAID') {
      return NextResponse.json({ error: 'audience must be ALL or UNPAID' }, { status: 400 })
    }

    const goal = await prisma.goal.findUnique({ where: { id } })
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    if (goal.adminToken !== adminToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const reminder = await prisma.reminder.create({
      data: { goalId: id, message: message.trim(), audience },
    })

    const recipientCount = audience === 'ALL'
      ? await prisma.member.count({ where: { goalId: id } })
      : await prisma.member.count({ where: { goalId: id, commitment: { status: { not: 'PAID' } } } })

    return NextResponse.json({ reminder, recipientCount })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to send reminder' }, { status: 500 })
  }
}
