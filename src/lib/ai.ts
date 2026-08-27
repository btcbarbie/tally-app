import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5'

// ─── Plan Check ───────────────────────────────────────────────────────────────
export async function runPlanCheck(params: {
  title: string
  description?: string | null
  targetAmount: number
  participants: number
  contributionType: string
  paymentType: string
  equalAmount?: number
  projectedTotal: number
  shortfall: number
  daysUntilDeadline: number
  deadline: string
  hasPaymentAccount: boolean
}): Promise<{
  summary: string
  contributionAnalysis: string
  planHealth: string
  deadlineAnalysis: string
  risks: string[]
  recommendations: string[]
  overallScore: 'STRONG' | 'MODERATE' | 'AT_RISK'
  // Legacy fields for backward compat
  message: string
  suggestion?: string
  suggestedAmount?: number
}> {
  const {
    title, description, targetAmount, participants, contributionType, paymentType,
    equalAmount, projectedTotal, shortfall, daysUntilDeadline, deadline, hasPaymentAccount
  } = params

  const suggestedEqualAmount = participants > 0 ? Math.ceil(targetAmount / participants) : 0

  const prompt = `You are a financial planning assistant for Tally, a collaborative group savings platform.

A group admin has set up a shared financial goal. The application has already run deterministic calculations — use ONLY these numbers, do NOT recalculate:

GOAL CONFIGURATION:
- Title: "${title}"
${description ? `- Description: "${description}"` : ''}
- Target amount: ₦${targetAmount.toLocaleString()}
- Number of expected participants: ${participants}
- Contribution type: ${contributionType} (${contributionType === 'EQUAL' ? `₦${(equalAmount ?? suggestedEqualAmount).toLocaleString()} per person` : 'Each person chooses their own amount'})
- Payment type: ${paymentType} (${paymentType === 'FULL' ? 'Full payment required' : 'Partial payments allowed'})
- Deadline: ${deadline} (${daysUntilDeadline} days from now)
- Projected total from commitments: ₦${projectedTotal.toLocaleString()}
- Shortfall vs target: ₦${shortfall.toLocaleString()}
- Payment account configured: ${hasPaymentAccount ? 'Yes' : 'No — members won\'t know where to pay!'}

Write a structured plan assessment with EXACTLY these JSON fields. Be concise, specific, and use actual numbers:

{
  "summary": "1-2 sentences: what this group is trying to achieve and how.",
  "contributionAnalysis": "1-2 sentences: breakdown of the contribution math — e.g. 10 contributors × ₦50,000 = ₦500,000.",
  "planHealth": "1-2 sentences: whether the current structure can realistically hit the target.",
  "deadlineAnalysis": "1-2 sentences: urgency assessment — is there enough time given the deadline and amount needed?",
  "risks": ["Risk 1", "Risk 2"],
  "recommendations": ["Specific recommendation 1", "Specific recommendation 2"],
  "overallScore": "STRONG" | "MODERATE" | "AT_RISK",
  "message": "One plain-language summary sentence for display (no markdown).",
  "suggestion": "One-line suggestion if shortfall > 0, or omit if plan is perfect.",
  "suggestedAmount": ${suggestedEqualAmount}
}

Rules:
- risks array: only include real risks based on the data (max 4). If no payment account, always include it as a risk.
- recommendations array: concrete, actionable (max 4). Never vague.
- overallScore: STRONG if shortfall=0 and days>7, MODERATE if manageable, AT_RISK if shortfall>20% of target or days<5.
- Do NOT include "suggestion" or "suggestedAmount" if shortfall === 0.
- Do NOT invent facts not in the data provided.`

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return { summary: text, contributionAnalysis: '', planHealth: '', deadlineAnalysis: '', risks: [], recommendations: [], overallScore: 'MODERATE', message: text }
  } catch (e) {
    console.error('Plan check AI error:', e)
    // Deterministic fallback
    const score: 'STRONG' | 'MODERATE' | 'AT_RISK' = shortfall === 0 && daysUntilDeadline > 7 ? 'STRONG' : shortfall > targetAmount * 0.2 || daysUntilDeadline < 5 ? 'AT_RISK' : 'MODERATE'
    const msg = shortfall === 0
      ? `Your contribution plan matches the ₦${targetAmount.toLocaleString()} target exactly with ${participants} contributors at ₦${(equalAmount ?? suggestedEqualAmount).toLocaleString()} each.`
      : `Your current plan is ₦${shortfall.toLocaleString()} short. Consider raising individual contributions to ₦${suggestedEqualAmount.toLocaleString()} per person.`
    return {
      summary: `${participants} contributors working toward ₦${targetAmount.toLocaleString()} by ${deadline}.`,
      contributionAnalysis: `${participants} × ₦${(equalAmount ?? suggestedEqualAmount).toLocaleString()} = ₦${projectedTotal.toLocaleString()} projected.`,
      planHealth: shortfall === 0 ? 'Plan is fully funded if all contributors complete their commitments.' : `₦${shortfall.toLocaleString()} shortfall detected.`,
      deadlineAnalysis: daysUntilDeadline <= 0 ? 'Deadline has passed.' : `${daysUntilDeadline} days remaining to collect funds.`,
      risks: shortfall > 0 ? [`₦${shortfall.toLocaleString()} shortfall between projected contributions and target`] : [],
      recommendations: shortfall > 0 ? [`Increase each contribution to ₦${suggestedEqualAmount.toLocaleString()} to meet the target`] : ['Send an early reminder to all contributors'],
      overallScore: score,
      message: msg,
      ...(shortfall > 0 && { suggestion: `Raise each contribution to ₦${suggestedEqualAmount.toLocaleString()} to close the gap.`, suggestedAmount: suggestedEqualAmount }),
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
  budgetCategories?: Array<{ name: string; allocatedAmount: number; necessity: string; reasoning?: string | null }>
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}): Promise<string> {
  const { question, financialState, goalTitle, contributors, budgetCategories, history = [] } = params

  const systemPrompt = `You are an AI financial assistant for Tally, helping a group manage shared financial goals.

You have access to exact financial data provided below — do NOT invent or recalculate any numbers. Use only the data given.
Always cite specific figures when answering financial questions. Keep answers concise (2-4 sentences max).

Current goal: "${goalTitle}"
Financial state: ${JSON.stringify(financialState, null, 2)}
Contributors: ${JSON.stringify(contributors, null, 2)}
${budgetCategories && budgetCategories.length > 0 ? `Budget categories (in priority order — earlier ones get funded first from money already collected; "necessity" was computed deterministically from the real collected total, never guessed): ${JSON.stringify(budgetCategories, null, 2)}

When asked "can we afford X" or about spending/budget categories, answer using this budget breakdown — a category marked AFFORDABLE_NOW is fully covered by money already collected; NEEDED_NOT_YET_FUNDED means the group needs to collect more before that category can be paid for.` : ''}`

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

// ─── Budget Category Suggestion ────────────────────────────────────────────────
// AI proposes WHAT the money should go toward and in what priority order — it
// never decides what's actually affordable. That's computed deterministically
// in the API route from the real totalCollected figure, same principle as the
// rest of this app's financial math (see finance.ts).
export async function suggestBudgetCategories(params: {
  title: string
  description?: string | null
  targetAmount: number
}): Promise<{
  categories: Array<{ name: string; allocatedAmount: number; reasoning: string }>
}> {
  const { title, description, targetAmount } = params

  const prompt = `You are a budgeting assistant for Tally, a collaborative group finance platform.

A group has a shared goal. Based on its title and description, infer what the money will actually need to be spent on, and propose a sensible spending category breakdown.

GOAL:
- Title: "${title}"
${description ? `- Description: "${description}"` : '- No description provided'}
- Total target amount: ₦${targetAmount.toLocaleString()}

Propose 3-6 spending categories that this specific goal would realistically need, ordered from MOST essential/urgent first to least essential last (this order matters — it will be used to decide what gets funded first as money comes in).

Respond with EXACTLY this JSON shape:
{
  "categories": [
    { "name": "Category name", "allocatedAmount": 000000, "reasoning": "One sentence on why this is needed and why it's at this priority." }
  ]
}

Rules:
- The allocatedAmount values must sum to exactly ₦${targetAmount.toLocaleString()}.
- Category names and amounts must be specific to THIS goal's title/description — do not use generic placeholders.
- Order matters: index 0 is the most essential/urgent category, funded first.
- Do not invent facts about the group not implied by the title/description.`

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    throw new Error('No JSON in AI response')
  } catch (e) {
    console.error('Budget suggestion AI error:', e)
    // Deterministic fallback — one catch-all category for the full target
    return {
      categories: [
        { name: 'General Expenses', allocatedAmount: targetAmount, reasoning: 'AI suggestion unavailable — add specific categories manually.' },
      ],
    }
  }
}
