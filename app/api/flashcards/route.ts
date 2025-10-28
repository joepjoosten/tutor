import { NextRequest, NextResponse } from 'next/server';
import { FlashcardModel } from '@/lib/models';

// Create a new flashcard
export async function POST(request: NextRequest) {
  try {
    const { set_id, question, answer } = await request.json();

    if (!set_id || !question || !answer) {
      return NextResponse.json(
        { error: 'set_id, question, and answer are required' },
        { status: 400 }
      );
    }

    // Get existing flashcards to determine order_index
    const existingFlashcards = FlashcardModel.findBySetId(set_id);
    const order_index = existingFlashcards.length;

    const flashcard = FlashcardModel.create({
      set_id,
      question,
      answer,
      order_index,
    });

    return NextResponse.json(flashcard);
  } catch (error) {
    console.error('Error creating flashcard:', error);
    return NextResponse.json(
      { error: 'Failed to create flashcard' },
      { status: 500 }
    );
  }
}
