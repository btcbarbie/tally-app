import { NextResponse } from 'next/server'
import { createDemoGoals } from '@/lib/demoData'

// Creates a fresh, private copy of the two demo goals for whichever browser
// calls this — so every visitor gets their own isolated demo instead of
// sharing (and being able to break) one global set. Called once per browser
// by MyGoalsList on first visit.
export async function POST() {
  try {
    const result = await createDemoGoals()
    return NextResponse.json(result, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to create demo goals' }, { status: 500 })
  }
}
