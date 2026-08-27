import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractReceiptData } from '@/lib/ai'

export const config = {
  api: { bodyParser: false },
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const memberId = formData.get('memberId') as string
    const goalId = formData.get('goalId') as string
    const textDesc = formData.get('textDescription') as string | null

    if (!memberId || !goalId) {
      return NextResponse.json({ error: 'memberId and goalId required' }, { status: 400 })
    }

    const goal = await prisma.goal.findUnique({ where: { id: goalId } })
    const commitment = await prisma.commitment.findFirst({ where: { memberId, goalId } })

    if (!goal || !commitment) {
      return NextResponse.json({ error: 'Goal or commitment not found' }, { status: 404 })
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    // Get existing refs for duplicate check
    const existingPayments = await prisma.payment.findMany({
      where: { goalId },
      select: { reference: true },
    })
    const existingRefs = existingPayments.map((p) => p.reference).filter(Boolean) as string[]

    let imageBase64: string | undefined
    let mimeType: string | undefined
    let fileName: string | undefined

    if (file && file.size > 0) {
      const buffer = await file.arrayBuffer()
      imageBase64 = Buffer.from(buffer).toString('base64')
      mimeType = file.type || 'image/jpeg'
      fileName = file.name
    }

    const extraction = await extractReceiptData({
      imageBase64,
      mimeType,
      textDescription: textDesc ?? undefined,
      memberName: member.name,
      expectedAmount: commitment.committedAmount,
      goalTitle: goal.title,
      existingRefs,
    })

    // Create a pending payment record
    // A confident "this isn't a receipt at all" verdict skips human review
    // entirely — no payment record, no pending-admin queue entry, just an
    // immediate rejection telling the member to upload the real thing.
    const isNotAReceipt = extraction.status === 'NOT_A_RECEIPT'

    let paymentId: string | undefined
    if (!isNotAReceipt && extraction.extractedAmount && extraction.extractedAmount > 0) {
      const payment = await prisma.payment.create({
        data: {
          memberId,
          goalId,
          amount: extraction.extractedAmount,
          reference: extraction.extractedRef ?? null,
          verificationStatus: 'PENDING_REVIEW',
        },
      })
      paymentId = payment.id
    }

    // Create receipt record
    const receipt = await prisma.receipt.create({
      data: {
        paymentId: paymentId ?? null,
        memberId,
        goalId,
        fileData: imageBase64 ? `data:${mimeType};base64,${imageBase64}` : null,
        fileName: fileName ?? null,
        extractedAmount: extraction.extractedAmount ?? null,
        extractedPayer: extraction.extractedPayer ?? null,
        extractedRecipient: extraction.extractedRecipient ?? null,
        extractedRef: extraction.extractedRef ?? null,
        extractedDate: extraction.extractedDate ?? null,
        confidence: extraction.confidence,
        flags: JSON.stringify(extraction.flags),
        aiRawResponse: extraction.summary,
        status: isNotAReceipt ? 'REJECTED' : extraction.status,
      },
    })

    return NextResponse.json({
      receipt,
      extraction,
      expectedAmount: commitment.committedAmount,
      memberName: member.name,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to process receipt' }, { status: 500 })
  }
}

// Confirm or reject a receipt
export async function PATCH(req: NextRequest) {
  try {
    const { receiptId, action, adminToken, paymentId } = await req.json()

    if (!receiptId || !action) return NextResponse.json({ error: 'receiptId and action required' }, { status: 400 })

    const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } })
    if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })

    const goal = await prisma.goal.findUnique({ where: { id: receipt.goalId } })
    if (goal?.adminToken !== adminToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const newStatus = action === 'confirm' ? 'CONFIRMED' : 'REJECTED'

    await prisma.receipt.update({ where: { id: receiptId }, data: { status: newStatus } })

    if (action === 'confirm' && paymentId) {
      await prisma.payment.update({ where: { id: paymentId }, data: { verificationStatus: 'CONFIRMED' } })

      // Update commitment
      const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
      if (payment) {
        const commitment = await prisma.commitment.findFirst({ where: { memberId: payment.memberId, goalId: payment.goalId } })
        if (commitment) {
          const newPaid = commitment.paidAmount + payment.amount
          const newOutstanding = Math.max(0, commitment.committedAmount - newPaid)
          const newStatus = newOutstanding === 0 ? 'PAID' : 'PARTIAL'
          await prisma.commitment.update({
            where: { id: commitment.id },
            data: { paidAmount: newPaid, outstandingAmount: newOutstanding, status: newStatus },
          })
        }
      }
    }

    return NextResponse.json({ success: true, status: newStatus })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 })
  }
}
