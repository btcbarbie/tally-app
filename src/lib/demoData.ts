import { randomUUID } from 'crypto'
import { prisma } from './prisma'

// Static demo content — the same two example groups every visitor sees
// ("Tolu's Wedding Gift" as admin, "Church Youth Retreat" as member), but
// createDemoGoals() below creates a brand-new, independent copy of both
// with fresh IDs and tokens every time it's called. Each browser gets its
// own private set of demo goals, so one visitor deleting or editing "their"
// demo never affects anyone else's.

const WEDDING_MEMBERS = [
  { name: 'Ada Okonkwo', paid: 20000, status: 'PAID' },
  { name: 'Emeka Nwosu', paid: 20000, status: 'PAID' },
  { name: 'Ngozi Eze', paid: 20000, status: 'PAID' },
  { name: 'Kunle Adeyemi', paid: 20000, status: 'PAID' },
  { name: 'Funmi Balogun', paid: 20000, status: 'PAID' },
  { name: 'Chukwuma Obi', paid: 20000, status: 'PAID' },
  { name: 'Yetunde Afolabi', paid: 20000, status: 'PAID' },
  { name: 'Seun Olawale', paid: 20000, status: 'PAID' },
  { name: 'Amara Ikenna', paid: 20000, status: 'PAID' },
  { name: 'Bode Fadahunsi', paid: 20000, status: 'PAID' },
  { name: 'Titi Adeleke', paid: 20000, status: 'PAID' },
  { name: 'Olu Babatunde', paid: 20000, status: 'PAID' },
  { name: 'Chisom Nnadi', paid: 20000, status: 'PAID' },
  { name: 'Remi Adesanya', paid: 20000, status: 'PAID' },
  { name: 'Kemi Ogundipe', paid: 20000, status: 'PAID' },
  { name: 'Ifeanyi Okafor', paid: 20000, status: 'PAID' },
  { name: 'Damilola Osei', paid: 20000, status: 'PAID' },
  { name: 'Musa Aliyu', paid: 0, status: 'PENDING' },
  { name: 'Fatima Suleiman', paid: 0, status: 'PENDING' },
  { name: 'Chidi Eze', paid: 0, status: 'PENDING' },
  { name: 'Adaeze Uche', paid: 0, status: 'PENDING' },
  { name: 'Gbenga Adekunle', paid: 0, status: 'PENDING' },
  { name: 'Nkechi Okoro', paid: 0, status: 'PENDING' },
  { name: 'Taiwo Olatunji', paid: 0, status: 'PENDING' },
  { name: 'Ify Chukwu', paid: 0, status: 'PENDING' },
] as const

const CHURCH_MEMBERS = [
  { name: 'Pastor Taiwo', paid: 15000, status: 'PAID', partial: false },
  { name: 'Blessing Okonkwo', paid: 15000, status: 'PAID', partial: false },
  { name: 'Emmanuel Nwachukwu', paid: 15000, status: 'PAID', partial: false },
  { name: 'Grace Adesola', paid: 15000, status: 'PAID', partial: false },
  { name: 'Joshua Adeyemi', paid: 15000, status: 'PAID', partial: false },
  { name: 'Mercy Eze', paid: 15000, status: 'PAID', partial: false },
  { name: 'Daniel Obi', paid: 15000, status: 'PAID', partial: false },
  { name: 'Ruth Balogun', paid: 15000, status: 'PAID', partial: false },
  { name: 'Samuel Fadahunsi', paid: 15000, status: 'PAID', partial: false },
  { name: 'Rebecca Olawale', paid: 15000, status: 'PAID', partial: false },
  { name: 'Philip Ikenna', paid: 7500, status: 'PARTIAL', partial: true },
  { name: 'Esther Babatunde', paid: 5000, status: 'PARTIAL', partial: true },
  { name: 'John Nnadi', paid: 10000, status: 'PARTIAL', partial: true },
  { name: 'Mary Adesanya', paid: 0, status: 'PENDING', partial: false },
  { name: 'Peter Ogundipe', paid: 0, status: 'PENDING', partial: false },
  { name: 'Faith Okafor', paid: 0, status: 'PENDING', partial: false },
  { name: 'Hope Osei', paid: 0, status: 'PENDING', partial: false },
  { name: 'Joy Aliyu', paid: 0, status: 'PENDING', partial: false },
  { name: 'Peace Suleiman', paid: 0, status: 'PENDING', partial: false },
] as const

const DAY_MS = 24 * 60 * 60 * 1000
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY_MS)
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS)

export interface DemoResult {
  adminGoalId: string
  adminToken: string
  memberGoalId: string
  memberToken: string
}

export async function createDemoGoals(): Promise<DemoResult> {
  return prisma.$transaction(async (tx) => {
    // ── Goal 1: Tolu's Wedding Gift — visitor is admin ──
    const adminToken = randomUUID()
    const wedding = await tx.goal.create({
      data: {
        title: "Tolu's Wedding Gift",
        description: "Group gift for Tolu and Chidi's wedding. Let's make their day unforgettable! 💍",
        targetAmount: 500000,
        deadline: daysFromNow(19),
        contributionType: 'EQUAL',
        paymentType: 'FULL',
        joinType: 'OPEN_LINK',
        status: 'ACTIVE',
        adminToken,
        shareToken: randomUUID().slice(0, 12),
        expectedParticipants: 25,
        equalAmount: 20000,
        bankName: 'Access Bank',
        accountName: 'Adaeze Okonkwo',
        accountNumber: '0123456789',
        paymentNote: 'Use your name as payment reference. Transfer exact amount only.',
      },
    })

    for (const m of WEDDING_MEMBERS) {
      const member = await tx.member.create({
        data: { goalId: wedding.id, name: m.name, memberToken: randomUUID() },
      })
      await tx.commitment.create({
        data: {
          memberId: member.id,
          goalId: wedding.id,
          committedAmount: 20000,
          paidAmount: m.paid,
          outstandingAmount: 20000 - m.paid,
          status: m.status,
        },
      })
      if (m.paid > 0) {
        await tx.payment.create({
          data: {
            memberId: member.id,
            goalId: wedding.id,
            amount: m.paid,
            date: daysAgo(Math.floor(Math.random() * 14) + 1),
            reference: `TXN${100000 + Math.floor(Math.random() * 899999)}`,
            verificationStatus: 'CONFIRMED',
          },
        })
      }
    }

    // ── Goal 2: Church Youth Retreat — visitor is a member ──
    const memberToken = randomUUID()
    const church = await tx.goal.create({
      data: {
        title: 'Church Youth Retreat',
        description: "Annual youth retreat to Ibadan — transport, accommodation, and feeding for 3 days. Theme: 'Rooted & Grounded' 🙏",
        targetAmount: 300000,
        deadline: daysFromNow(24),
        contributionType: 'EQUAL',
        paymentType: 'PARTIAL',
        joinType: 'INVITE_ONLY',
        status: 'ACTIVE',
        adminToken: randomUUID(),
        shareToken: randomUUID().slice(0, 12),
        expectedParticipants: 20,
        equalAmount: 15000,
        bankName: 'GTBank',
        accountName: 'Pastor Taiwo Adesola',
        accountNumber: '9876543210',
        paymentNote: 'Transfer to the church account. Use your name as reference.',
      },
    })

    const youMember = await tx.member.create({
      data: { goalId: church.id, name: 'You (Demo Member)', memberToken },
    })
    await tx.commitment.create({
      data: {
        memberId: youMember.id,
        goalId: church.id,
        committedAmount: 15000,
        paidAmount: 7500,
        outstandingAmount: 7500,
        status: 'PARTIAL',
      },
    })
    await tx.payment.create({
      data: {
        memberId: youMember.id,
        goalId: church.id,
        amount: 7500,
        date: new Date(),
        reference: 'CHR-DEMO-001',
        verificationStatus: 'CONFIRMED',
      },
    })

    for (const m of CHURCH_MEMBERS) {
      const member = await tx.member.create({
        data: { goalId: church.id, name: m.name, memberToken: randomUUID() },
      })
      await tx.commitment.create({
        data: {
          memberId: member.id,
          goalId: church.id,
          committedAmount: 15000,
          paidAmount: m.paid,
          outstandingAmount: 15000 - m.paid,
          status: m.status,
        },
      })
      if (m.paid > 0) {
        const firstAmount = m.partial ? Math.floor(m.paid / 2) : m.paid
        await tx.payment.create({
          data: {
            memberId: member.id,
            goalId: church.id,
            amount: firstAmount,
            date: daysAgo(Math.floor(Math.random() * 10) + 1),
            reference: `CHR${200000 + Math.floor(Math.random() * 899999)}`,
            verificationStatus: 'CONFIRMED',
          },
        })
        if (m.partial) {
          await tx.payment.create({
            data: {
              memberId: member.id,
              goalId: church.id,
              amount: m.paid - firstAmount,
              date: daysAgo(2),
              reference: `CHR${200000 + Math.floor(Math.random() * 899999)}`,
              verificationStatus: 'CONFIRMED',
            },
          })
        }
      }
    }

    return { adminGoalId: wedding.id, adminToken, memberGoalId: church.id, memberToken }
  })
}
