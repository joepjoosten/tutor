import { NextRequest, NextResponse } from 'next/server';
import { StudyProgressModel } from '@/lib/models';

// Get study progress for a set
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const setId = searchParams.get('setId');

    if (!setId) {
      return NextResponse.json(
        { error: 'setId is required' },
        { status: 400 }
      );
    }

    const progress = StudyProgressModel.findBySetId(parseInt(setId));
    return NextResponse.json({ progress });
  } catch (error) {
    console.error('Error fetching study progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch study progress' },
      { status: 500 }
    );
  }
}

// Mark a card as don't know / know
export async function POST(request: NextRequest) {
  try {
    const { setId, flashcardId, dontKnow } = await request.json();

    if (!setId || !flashcardId || dontKnow === undefined) {
      return NextResponse.json(
        { error: 'setId, flashcardId, and dontKnow are required' },
        { status: 400 }
      );
    }

    const progress = StudyProgressModel.markDontKnow(setId, flashcardId, dontKnow);
    return NextResponse.json({ progress });
  } catch (error) {
    console.error('Error updating study progress:', error);
    return NextResponse.json(
      { error: 'Failed to update study progress' },
      { status: 500 }
    );
  }
}

// Reset progress for a set
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const setId = searchParams.get('setId');

    if (!setId) {
      return NextResponse.json(
        { error: 'setId is required' },
        { status: 400 }
      );
    }

    StudyProgressModel.resetProgress(parseInt(setId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error resetting study progress:', error);
    return NextResponse.json(
      { error: 'Failed to reset study progress' },
      { status: 500 }
    );
  }
}
