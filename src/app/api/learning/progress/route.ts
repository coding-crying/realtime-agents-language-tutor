import { NextRequest, NextResponse } from 'next/server';
import { getUserProgress } from '../../../../lib/neo4j/srs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const language = searchParams.get('language') || 'es';

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    const progress = await getUserProgress(userId, language);
    
    return NextResponse.json({
      success: true,
      data: progress
    });

  } catch (error) {
    console.error('Error fetching user progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user progress' },
      { status: 500 }
    );
  }
}