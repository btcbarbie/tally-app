import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calcTotalCollected, computeCategoryNecessity } from '@/lib/finance'
import { suggestBudgetCategories } from '@/lib/ai'

// Admin-only: ask AI to propose a category breakdown for this goal. Returns the
// proposal for review — nothing is saved until the admin accepts it via POST /budget.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { adminToken } = await req.json()

    const goal = await prisma.goal.findUnique({
      where: { id },
      include: { payments: true },
    })

    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    if (goal.adminToken !== adminToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const totalCollected = calcTotalCollected(goal.payments)

    const { categories } = await suggestBudgetCategories({
      title: goal.title,
      description: goal.description,
      targetAmount: goal.targetAmount,
    })

    const necessity = computeCategoryNecessity(categories, totalCollected)
    const proposal = categories.map((c, i) => ({ ...c, necessity: necessity[i] }))

    return NextResponse.json({ categories: proposal, totalCollected })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to suggest budget categories' }, { status: 500 })
  }
}
