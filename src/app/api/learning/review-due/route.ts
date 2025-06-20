import { NextRequest, NextResponse } from 'next/server';
import { getReviewDue } from '../../../../lib/neo4j/srs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const language = searchParams.get('language') || 'ru';
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    const reviewWords = await getReviewDue(userId, language, limit);
    
    return NextResponse.json({
      success: true,
      data: {
        reviewWords,
        count: reviewWords.length,
        language
      }
    });

  } catch (error) {
    console.error('Error fetching review due words:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review due words' },
      { status: 500 }
    );
  }
}