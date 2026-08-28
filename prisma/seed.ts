// Tally - Seed Data for MVP Demo
// Two goals: 1 as admin, 1 as member

import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import path from 'path'

const dbUrl = process.env.DATABASE_URL || `file:${path.join(process.cwd(), 'dev.db')}`
const adapter = new PrismaBetterSqlite3({ url: dbUrl })
const prisma = new PrismaClient({ adapter })

// These tokens are used in the browser's localStorage to identify the current user's role.
// DEMO_ADMIN_TOKEN  → stored as tally_admin_{goalId}  → shows "Delete Goal" button
// DEMO_MEMBER_TOKEN → stored as tally_member_{goalId} → shows "Leave Group" button + member view link
export const DEMO_ADMIN_TOKEN = 'demo-admin-token-tolu-wedding-2026'
export const DEMO_MEMBER_TOKEN = 'demo-member-token-church-retreat-2026'
export const DEMO_MEMBER_ID = 'member-church-you'

async function main() {
  console.log('Seeding Tally MVP demo data (2 goals)...')

  // ─────────────────────────────────────────────────────────
  // GOAL 1: Tolu's Wedding Gift — YOU ARE ADMIN
  // Equal contributions, FULL payment, active
  // ─────────────────────────────────────────────────────────
  const wedding = await prisma.goal.create({
    data: {
      id: 'goal-wedding-tolu',
      title: "Tolu's Wedding Gift",
      description: "Group gift for Tolu and Chidi's wedding on September 15th. Let's make their day unforgettable! 💍",
      targetAmount: 500000,
      deadline: new Date('2026-09-15T23:59:59Z'),
      contributionType: 'EQUAL',
      paymentType: 'FULL',
      joinType: 'OPEN_LINK',
      status: 'ACTIVE',
      adminToken: DEMO_ADMIN_TOKEN,
      shareToken: 'share-wedding-tolu',
      expectedParticipants: 25,
      equalAmount: 20000,
      bankName: 'Access Bank',
      accountName: 'Adaeze Okonkwo',
      accountNumber: '0123456789',
      paymentNote: 'Use your name as payment reference. Transfer exact amount only.',
    },
  })

  const weddingMembers = [
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
  ]

  for (let i = 0; i < weddingMembers.length; i++) {
    const m = weddingMembers[i]
    const member = await prisma.member.create({
      data: {
        id: `member-wedding-${i + 1}`,
        goalId: wedding.id,
        name: m.name,
        memberToken: `member-tok-wedding-${i + 1}`,
      },
    })
    await prisma.commitment.create({
      data: {
        id: `commit-wedding-${i + 1}`,
        memberId: member.id,
        goalId: wedding.id,
        committedAmount: 20000,
        paidAmount: m.paid,
        outstandingAmount: 20000 - m.paid,
        status: m.status,
      },
    })
    if (m.paid > 0) {
      const daysAgo = Math.floor(Math.random() * 14) + 1
      const payDate = new Date()
      payDate.setDate(payDate.getDate() - daysAgo)
      await prisma.payment.create({
        data: {
          id: `pay-wedding-${i + 1}`,
          memberId: member.id,
          goalId: wedding.id,
          amount: m.paid,
          date: payDate,
          reference: `TXN${100000 + i * 7}`,
          verificationStatus: 'CONFIRMED',
        },
      })
    }
  }

  // ─────────────────────────────────────────────────────────
  // GOAL 2: Church Youth Retreat — YOU ARE A MEMBER
  // Equal contributions, PARTIAL payments allowed
  // ─────────────────────────────────────────────────────────
  const church = await prisma.goal.create({
    data: {
      id: 'goal-church-retreat',
      title: 'Church Youth Retreat',
      description: "Annual youth retreat to Ibadan — transport, accommodation, and feeding for 3 days. Theme: 'Rooted & Grounded' 🙏",
      targetAmount: 300000,
      deadline: new Date('2026-09-20T23:59:59Z'),
      contributionType: 'EQUAL',
      paymentType: 'PARTIAL',
      joinType: 'INVITE_ONLY',
      status: 'ACTIVE',
      adminToken: 'admin-tok-church-retreat-internal',
      shareToken: 'share-church-retreat',
      expectedParticipants: 20,
      equalAmount: 15000,
      bankName: 'GTBank',
      accountName: 'Pastor Taiwo Adesola',
      accountNumber: '9876543210',
      paymentNote: 'Transfer to the church account. Use your name as reference.',
    },
  })

  // Create "you" as a member with the demo member token
  const youMember = await prisma.member.create({
    data: {
      id: DEMO_MEMBER_ID,
      goalId: church.id,
      name: 'You (Demo Member)',
      memberToken: DEMO_MEMBER_TOKEN,
    },
  })
  await prisma.commitment.create({
    data: {
      id: 'commit-church-you',
      memberId: youMember.id,
      goalId: church.id,
      committedAmount: 15000,
      paidAmount: 7500,
      outstandingAmount: 7500,
      status: 'PARTIAL',
    },
  })
  await prisma.payment.create({
    data: {
      id: 'pay-church-you',
      memberId: youMember.id,
      goalId: church.id,
      amount: 7500,
      date: new Date(),
      reference: 'CHR-DEMO-001',
      verificationStatus: 'CONFIRMED',
    },
  })

  const otherChurchMembers = [
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
  ]

  for (let i = 0; i < otherChurchMembers.length; i++) {
    const m = otherChurchMembers[i]
    const member = await prisma.member.create({
      data: {
        id: `member-church-${i + 1}`,
        goalId: church.id,
        name: m.name,
        memberToken: `member-tok-church-${i + 1}`,
      },
    })
    await prisma.commitment.create({
      data: {
        id: `commit-church-${i + 1}`,
        memberId: member.id,
        goalId: church.id,
        committedAmount: 15000,
        paidAmount: m.paid,
        outstandingAmount: 15000 - m.paid,
        status: m.status,
      },
    })
    if (m.paid > 0) {
      const daysAgo = Math.floor(Math.random() * 10) + 1
      const payDate = new Date()
      payDate.setDate(payDate.getDate() - daysAgo)
      await prisma.payment.create({
        data: {
          id: `pay-church-${i + 1}-1`,
          memberId: member.id,
          goalId: church.id,
          amount: m.partial ? Math.floor(m.paid / 2) : m.paid,
          date: payDate,
          reference: `CHR${200000 + i * 11}`,
          verificationStatus: 'CONFIRMED',
        },
      })
      if (m.partial && m.paid > 0) {
        const payDate2 = new Date()
        payDate2.setDate(payDate2.getDate() - 2)
        await prisma.payment.create({
          data: {
            id: `pay-church-${i + 1}-2`,
            memberId: member.id,
            goalId: church.id,
            amount: m.paid - Math.floor(m.paid / 2),
            date: payDate2,
            reference: `CHR${200000 + i * 11 + 500}`,
            verificationStatus: 'CONFIRMED',
          },
        })
      }
    }
  }

  console.log('✅ Seed complete!')
  console.log('')
  console.log('=== DEMO CREDENTIALS (auto-loaded by app) ===')
  console.log(`Goal 1 - "Tolu's Wedding Gift"  → ID: ${wedding.id}`)
  console.log(`  Admin Token: ${DEMO_ADMIN_TOKEN}`)
  console.log(`  → Stored as: tally_admin_${wedding.id}`)
  console.log('')
  console.log(`Goal 2 - "Church Youth Retreat" → ID: ${church.id}`)
  console.log(`  Member Token: ${DEMO_MEMBER_TOKEN}`)
  console.log(`  → Stored as: tally_member_${church.id}`)
  console.log('==============================================')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
