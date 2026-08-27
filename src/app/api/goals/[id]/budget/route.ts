import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calcTotalCollected, computeCategoryNecessity } from '@/lib/finance'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const goal = await prisma.goal.findUnique({
      where: { id },
      include: {
        payments: true,
        budgetCategories: {
          orderBy: { priority: 'asc' },
          include: { expenses: { orderBy: { date: 'desc' } } },
        },
      },
    })

    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    const totalCollected = calcTotalCollected(goal.payments)
    const necessity = computeCategoryNecessity(goal.budgetCategories, totalCollected)

    const categories = goal.budgetCategories.map((c, i) => {
      const spent = c.expenses.reduce((sum, e) => sum + e.amount, 0)
      return { ...c, necessity: necessity[i], spent }
    })

    return NextResponse.json({ categories, totalCollected })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 })
  }
}

// Admin-only: replace the goal's budget categories with an admin-reviewed set
// (accepted or edited from an AI suggestion, or entered manually). Array order
// is preserved as priority — index 0 is funded first.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { adminToken, categories } = await req.json()

    if (!Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json({ error: 'At least one category is required' }, { status: 400 })
    }
    for (const c of categories) {
      if (!c.name?.trim() || !(Number(c.allocatedAmount) > 0)) {
        return NextResponse.json({ error: 'Each category needs a name and a positive allocated amount' }, { status: 400 })
      }
    }

    const goal = await prisma.goal.findUnique({ where: { id } })
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    if (goal.adminToken !== adminToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const totalAllocated = categories.reduce((sum, c) => sum + Number(c.allocatedAmount), 0)
    if (totalAllocated > goal.targetAmount) {
      return NextResponse.json(
        { error: `Budget categories total ₦${totalAllocated.toLocaleString()}, which is more than the goal's target of ₦${goal.targetAmount.toLocaleString()}` },
        { status: 400 }
      )
    }

    await prisma.$transaction([
      prisma.budgetCategory.deleteMany({ where: { goalId: id } }),
      prisma.budgetCategory.createMany({
        data: categories.map((c, i) => ({
          goalId: id,
          name: String(c.name).trim(),
          allocatedAmount: Number(c.allocatedAmount),
          priority: i,
          aiReasoning: c.reasoning ? String(c.reasoning).trim() : null,
        })),
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to save budget' }, { status: 500 })
  }
}
