import { NextResponse } from 'next/server';
import { LLMInteractionModel } from '@/lib/models';

export async function GET() {
  try {
    const recentInstructions = LLMInteractionModel.getRecentCustomInstructions(3);
    return NextResponse.json({ instructions: recentInstructions });
  } catch (error) {
    console.error('Failed to fetch recent instructions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent instructions' },
      { status: 500 }
    );
  }
}
