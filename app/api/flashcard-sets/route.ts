import { NextRequest, NextResponse } from 'next/server';
import { FlashcardSetModel, FlashcardModel } from '@/lib/models';

// GET - Retrieve all flashcard sets
export async function GET() {
  try {
    const sets = FlashcardSetModel.findAll();

    // Get flashcards for each set
    const setsWithCards = sets.map(set => ({
      ...set,
      flashcards: FlashcardModel.findBySetId(set.id),
    }));

    return NextResponse.json({ success: true, sets: setsWithCards });
  } catch (error) {
    console.error('Error fetching flashcard sets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flashcard sets' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a flashcard set
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Set ID is required' },
        { status: 400 }
      );
    }

    FlashcardSetModel.delete(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting flashcard set:', error);
    return NextResponse.json(
      { error: 'Failed to delete flashcard set' },
      { status: 500 }
    );
  }
}
