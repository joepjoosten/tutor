import { NextRequest, NextResponse } from 'next/server';
import { FlashcardSetModel } from '@/lib/models';

// Update a flashcard set
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { title, description } = await request.json();

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    const flashcardSet = FlashcardSetModel.update(parseInt(id), { title, description });

    if (!flashcardSet) {
      return NextResponse.json(
        { error: 'Flashcard set not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(flashcardSet);
  } catch (error) {
    console.error('Error updating flashcard set:', error);
    return NextResponse.json(
      { error: 'Failed to update flashcard set' },
      { status: 500 }
    );
  }
}
