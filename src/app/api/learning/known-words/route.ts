import { NextRequest, NextResponse } from 'next/server';
import { getKnownWords } from '../../../../lib/neo4j/srs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const language = searchParams.get('language') || 'es';
    const minLevel = parseInt(searchParams.get('minLevel') || '3');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    const knownWords = await getKnownWords(userId, language, minLevel);
    
    return NextResponse.json({
      success: true,
      data: {
        knownWords,
        count: knownWords.length,
        minLevel,
        language
      }
    });

  } catch (error) {
    console.error('Error fetching known words:', error);
    return NextResponse.json(
      { error: 'Failed to fetch known words' },
      { status: 500 }
    );
  }
}