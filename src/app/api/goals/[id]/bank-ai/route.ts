import { NextRequest, NextResponse } from 'next/server'
import { extractBankDetails } from '@/lib/ai'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { rawText, imageBase64, imageMimeType, adminToken } = body

    const goal = await prisma.goal.findUnique({ where: { id } })
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    if (adminToken && goal.adminToken !== adminToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const extraction = await extractBankDetails({ rawText, imageBase64, imageMimeType })
    return NextResponse.json({ extraction })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to extract bank details' }, { status: 500 })
  }
}
