# Tally 🎯

**AI-powered collaborative financial planning for groups, communities, and organizations.**

Tally makes it easy to create shared money goals — weddings, trips, retreats, projects — and track contributions from every member in real time.

---

## Features

- 🎯 **Create Shared Goals** — Set a target amount, deadline, and contribution structure
- 👥 **Group Management** — Admin creates the goal, members join via link or invite
- 💳 **Payment Tracking** — Track who has paid, who's pending, and how much is outstanding
- 🤖 **AI Receipt Verification** — Members upload payment receipts; AI extracts and verifies the details
- 📊 **Live Financial State** — Real-time progress, risk status, milestones, and forecasts
- 🔔 **Smart Reminders** — AI-generated nudges for members who haven't paid
- 💬 **AI Chat** — Ask questions about the goal's financial health

## Role-Based Access

| Role | How You Get It | What You Can Do |
|------|---------------|-----------------|
| **Admin** | You created the goal | Full dashboard, member management, payment confirmation, delete goal |
| **Member** | Joined via share link | View your contribution, upload receipts, leave group |

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: SQLite via Prisma + better-sqlite3
- **AI**: Google Gemini (receipt OCR, insights, chat)
- **Styling**: Vanilla CSS with custom design system

## Getting Started

```bash
npm install
npx prisma db push
npx tsx prisma/seed.ts   # seeds 2 demo goals (1 admin, 1 member)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create a `.env.local` file:

```env
GEMINI_API_KEY=your_gemini_api_key
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Home — goal grid
│   ├── GoalCard.tsx          # Card with admin/member actions
│   ├── DemoSessionBootstrap  # Seeds demo tokens into localStorage
│   ├── goals/
│   │   ├── create/           # Multi-step goal creation wizard
│   │   └── [id]/             # Admin dashboard + member view
│   └── api/
│       └── goals/            # REST API (CRUD, members, payments, AI)
├── lib/
│   ├── prisma.ts             # DB client
│   └── finance.ts            # Financial state calculator
prisma/
├── schema.prisma             # Database schema
└── seed.ts                   # Demo data seeder
```

---

Built with ❤️ using Next.js + Prisma + Gemini AI
