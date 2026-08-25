import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5'

// ─── Plan Check ───────────────────────────────────────────────────────────────
export async function runPlanCheck(params: {
  title: string
  targetAmount: number
  participants: number
  contributionType: string
  equalAmount?: number
  projectedTotal: number
  shortfall: number
}): Promise<{ message: string; suggestion?: string; suggestedAmount?: number }> {
  const { title, targetAmount, participants, contributionType, equalAmount, projectedTotal, shortfall } = params

  const prompt = `You are a financial planning assistant for a collaborative savings platform called Tally.

A group admin has just created a shared financial goal. Below are the exact numbers (pre-calculated by the application — do NOT recalculate):

Goal: "${title}"
Target amount: ₦${targetAmount.toLocaleString()}
Number of participants: ${participants}
Contribution type: ${contributionType}
${contributionType === 'EQUAL' ? `Equal contribution per person: ₦${equalAmount?.toLocaleString() ?? 0}` : ''}
Projected total (sum of commitments): ₦${projectedTotal.toLocaleString()}
Shortfall (target - projected): ₦${shortfall.toLocaleString()}

Based on these numbers, write a short, plain-language financial plan check (2-3 sentences max). 
- If shortfall is 0, confirm the plan is perfectly matched.
- If there is a shortfall, explain the gap and suggest what the equal contribution should be (calculated as: targetAmount / participants = ₦${Math.ceil(targetAmount / participants).toLocaleString()}).
- Be friendly, clear, and encouraging.
- Do not use markdown headers or bullet points. Just natural sentences.

Then respond with a JSON object like this:
{
  "message": "Your plain language explanation here",
  "suggestion": "Optional: one-sentence suggested fix if there is a shortfall",
  "suggestedAmount": 25000
}

Only include "suggestion" and "suggestedAmount" if there is a shortfall > 0.`

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return { message: text }
  } catch (e) {
    console.error('Plan check AI error:', e)
    return {
      message:
        shortfall === 0
          ? `Your contribution plan matches the ₦${targetAmount.toLocaleString()} target exactly. The group is set up for success.`
          : `Your current plan is ₦${shortfall.toLocaleString()} below the target. Consider increasing contributions to ₦${Math.ceil(targetAmount / participants).toLocaleString()} per person.`,
    }
  }
}

// ─── Financial Insight ────────────────────────────────────────────────────────
export async function generateFinancialInsight(financialState: {
  title: string
  targetAmount: number
  totalCollected: number
  totalOutstanding: number
  shortfall: number
  percentFunded: number
  paidCount: number
  pendingCount: number
  partialCount: number
  totalMembers: number
  daysRemaining: number
  momentum: string
  riskStatus: string
}): Promise<{ insight: string; recommendedAction: string }> {
  const prompt = `You are a financial advisor for Tally, a collaborative financial planning platform.

Analyze the following shared goal financial state (these numbers are exact — do NOT change them):

Goal: "${financialState.title}"
Target: ₦${financialState.targetAmount.toLocaleString()}
Collected: ₦${financialState.totalCollected.toLocaleString()} (${financialState.percentFunded}% of target)
Outstanding: ₦${financialState.totalOutstanding.toLocaleString()}
Shortfall to target: ₦${financialState.shortfall.toLocaleString()}
Members: ${financialState.paidCount} fully paid, ${financialState.partialCount} partial, ${financialState.pendingCount} pending (${financialState.totalMembers} total)
Days remaining: ${financialState.daysRemaining}
Group momentum: ${financialState.momentum}
Risk status: ${financialState.riskStatus}

Write:
1. A 2-sentence financial insight about the group's current status.
2. One recommended action for the admin.

Respond as JSON:
{
  "insight": "2-sentence financial insight",
  "recommendedAction": "One specific recommended action"
}`

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
  } catch (e) {
    console.error('Insight AI error:', e)
  }

  // Fallback
  const isOnTrack = financialState.riskStatus === 'ON_TRACK' || financialState.riskStatus === 'ACHIEVED'
  return {
    insight: isOnTrack
      ? `Your group has collected ₦${financialState.totalCollected.toLocaleString()} — ${financialState.percentFunded}% of the ₦${financialState.targetAmount.toLocaleString()} target. ${financialState.paidCount} out of ${financialState.totalMembers} contributors have fully paid.`
      : `Your group is currently ₦${financialState.shortfall.toLocaleString()} below target with ${financialState.daysRemaining} days remaining. ${financialState.pendingCount} contributor${financialState.pendingCount !== 1 ? 's' : ''} still need to complete their commitment.`,
    recommendedAction:
      financialState.pendingCount > 0
        ? `Send a reminder to the ${financialState.pendingCount} outstanding contributor${financialState.pendingCount !== 1 ? 's' : ''}.`
        : 'Continue monitoring contributions as you approach the deadline.',
  }
}

// ─── Receipt Extraction ───────────────────────────────────────────────────────
export async function extractReceiptData(params: {
  imageBase64?: string
  mimeType?: string
  textDescription?: string
  memberName: string
  expectedAmount: number
  goalTitle: string
  existingRefs?: string[]
}): Promise<{
  extractedAmount?: number
  extractedPayer?: string
  extractedRecipient?: string
  extractedRef?: string
  extractedDate?: string
  confidence: number
  flags: string[]
  status: string
  summary: string
}> {
  const { imageBase64, mimeType, textDescription, memberName, expectedAmount, goalTitle, existingRefs } = params

  const systemPrompt = `You are a payment receipt verification assistant for Tally, a collaborative financial platform. Extract structured payment information from receipts and check for issues.`

  const userPrompt = `Extract and verify a payment receipt for the following context:

Group goal: "${goalTitle}"
Expected contributor: ${memberName}
Expected payment amount: ₦${expectedAmount.toLocaleString()}
${existingRefs && existingRefs.length > 0 ? `Previously submitted references: ${existingRefs.join(', ')}` : ''}

${textDescription ? `Receipt description/text: ${textDescription}` : 'Please analyze the uploaded receipt image.'}

Extract the following and respond as JSON:
{
  "extractedAmount": 20000,
  "extractedPayer": "Name on the transaction",
  "extractedRecipient": "Recipient name or account",
  "extractedRef": "Transaction reference number",
  "extractedDate": "Date as YYYY-MM-DD",
  "confidence": 0.85,
  "flags": [],
  "status": "LIKELY_MATCH",
  "summary": "Brief reconciliation summary"
}

Status options: "LIKELY_MATCH" | "NEEDS_REVIEW" | "POSSIBLE_DUPLICATE" | "AMOUNT_MISMATCH" | "INSUFFICIENT_EVIDENCE"
Flags can include: "amount_mismatch", "possible_duplicate", "date_outside_window", "payer_name_mismatch", "missing_reference"
Confidence is 0 to 1.
Only mark POSSIBLE_DUPLICATE if the reference matches an existing one.
Only mark AMOUNT_MISMATCH if the extracted amount differs from the expected amount.`

  try {
    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content:
          imageBase64 && mimeType
            ? [
                {
                  type: 'image' as const,
                  source: {
                    type: 'base64' as const,
                    media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                    data: imageBase64,
                  },
                },
                { type: 'text' as const, text: userPrompt },
              ]
            : userPrompt,
      },
    ]

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      // Check for duplicate
      if (parsed.extractedRef && existingRefs?.includes(parsed.extractedRef)) {
        parsed.flags = [...(parsed.flags || []), 'possible_duplicate']
        parsed.status = 'POSSIBLE_DUPLICATE'
      }
      return parsed
    }
  } catch (e) {
    console.error('Receipt extraction AI error:', e)
  }

  return {
    confidence: 0,
    flags: ['extraction_failed'],
    status: 'NEEDS_REVIEW',
    summary: 'Unable to automatically extract receipt details. Please review manually.',
  }
}

// ─── Financial Q&A ────────────────────────────────────────────────────────────
export async function answerFinancialQuestion(params: {
  question: string
  financialState: Record<string, unknown>
  goalTitle: string
  contributors: Array<{ name: string; status: string; paidAmount: number; committedAmount: number; outstandingAmount: number }>
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}): Promise<string> {
  const { question, financialState, goalTitle, contributors, history = [] } = params

  const systemPrompt = `You are an AI financial assistant for Tally, helping a group manage shared financial goals.
  
You have access to exact financial data provided below — do NOT invent or recalculate any numbers. Use only the data given.
Always cite specific figures when answering financial questions. Keep answers concise (2-4 sentences max).

Current goal: "${goalTitle}"
Financial state: ${JSON.stringify(financialState, null, 2)}
Contributors: ${JSON.stringify(contributors, null, 2)}`

  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content }) as Anthropic.MessageParam),
    { role: 'user', content: question },
  ]

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: systemPrompt,
      messages,
    })
    return response.content[0].type === 'text' ? response.content[0].text : 'I was unable to process that question.'
  } catch (e) {
    console.error('Q&A AI error:', e)
    return 'I\'m having trouble connecting right now. Please try again in a moment.'
  }
}

// ─── Reminder Generation ──────────────────────────────────────────────────────
export async function generateReminder(params: {
  goalTitle: string
  deadline: string
  equalAmount?: number
  pendingMembers: string[]
  partialMembers: string[]
  language?: 'english' | 'pidgin'
}): Promise<string> {
  const { goalTitle, deadline, equalAmount, pendingMembers, partialMembers, language = 'english' } = params

  const prompt = `Generate a warm, polite payment reminder message for a group contribution on Tally.

Goal: "${goalTitle}"
Deadline: ${deadline}
${equalAmount ? `Contribution amount: ₦${equalAmount.toLocaleString()}` : ''}
Members who haven't paid: ${pendingMembers.length > 0 ? pendingMembers.join(', ') : 'None'}
Members with partial payments: ${partialMembers.length > 0 ? partialMembers.join(', ') : 'None'}
Language: ${language}

Write a short, friendly reminder message (3-5 sentences). 
- Be warm and encouraging, not demanding or shaming.
- Focus on the shared goal, not individual failure.
- Include the deadline naturally.
- Do NOT call out specific people in the message — it will be sent to the whole group.
- End with something encouraging.
${language === 'pidgin' ? '- Write in Nigerian Pidgin English.' : ''}

Just write the message text, no quotes, no markdown.`

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })
    return response.content[0].type === 'text' ? response.content[0].text : ''
  } catch (e) {
    console.error('Reminder AI error:', e)
    return `Hi everyone 👋 Just a friendly reminder about our contribution toward "${goalTitle}". If you haven't completed your commitment yet, please try to do so before ${deadline}. We're almost there — let's finish strong together! 💪`
  }
}

// ─── Bank Details AI Parsing ──────────────────────────────────────────────────
export async function extractBankDetails(params: {
  rawText?: string
  imageBase64?: string
  imageMimeType?: string
}): Promise<{
  bankName: string | null
  accountName: string | null
  accountNumber: string | null
  paymentNote: string | null
  confidence: number
  summary: string
}> {
  const { rawText, imageBase64, imageMimeType = 'image/jpeg' } = params

  const promptText = `You are an AI financial parsing assistant for Tally.
Extract Nigerian bank payment account details from the provided text or image.

Analyze the input and extract:
1. "bankName": Name of the bank (e.g. GTBank, Zenith Bank, Access Bank, Kuda, Moniepoint, OPay, First Bank, UBA).
2. "accountName": The account holder's full name.
3. "accountNumber": The 10-digit NUBAN account number (digits only, e.g. "0123456789").
4. "paymentNote": Any specific transfer notes, reference guidelines, or instructions (or null).

Input Text: "${rawText ?? ''}"

Respond STRICTLY in valid JSON format:
{
  "bankName": "GTBank",
  "accountName": "Musa Aliyu",
  "accountNumber": "0123456789",
  "paymentNote": "Use your name as reference",
  "confidence": 0.95,
  "summary": "Extracted GTBank 0123456789 under Musa Aliyu"
}`

  try {
    const contentPayload: Anthropic.MessageParam['content'] = []

    if (imageBase64) {
      contentPayload.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: imageMimeType as any,
          data: imageBase64,
        },
      })
    }

    contentPayload.push({ type: 'text', text: promptText })

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: contentPayload }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('Bank details AI extraction error:', e)
  }

  // Fallback regex parsing if API key or network is unreachable
  const fullInput = rawText ?? ''
  const acctMatch = fullInput.match(/\b\d{10}\b/)
  const bankMatch = fullInput.match(/\b(GTBank|GT Bank|Zenith|Access|Kuda|Moniepoint|OPay|First Bank|UBA|Fidelity|Stanbic|Sterling|Wema|Union)\b/i)

  return {
    bankName: bankMatch ? bankMatch[0] : null,
    accountName: null,
    accountNumber: acctMatch ? acctMatch[0] : null,
    paymentNote: null,
    confidence: acctMatch ? 0.7 : 0.3,
    summary: acctMatch ? `Extracted account number ${acctMatch[0]}` : 'Could not parse bank details automatically.',
  }
}
