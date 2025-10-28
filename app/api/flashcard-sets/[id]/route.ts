import { NextRequest, NextResponse } from 'next/server';
import { FlashcardSetModel } from '@/lib/models';

// Update a flashcard set
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, flip_mode } = body;

    // Build update data object with only provided fields
    const updateData: { title?: string; description?: string; flip_mode?: number } = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (flip_mode !== undefined) updateData.flip_mode = flip_mode;

    // At least one field must be provided
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'At least one field (title, description, or flip_mode) must be provided' },
        { status: 400 }
      );
    }

    const flashcardSet = FlashcardSetModel.update(parseInt(id), updateData);

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
