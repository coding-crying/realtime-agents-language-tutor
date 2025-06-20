import { NextRequest, NextResponse } from 'next/server';
import { processLearningEvent } from '../../../../lib/neo4j/srs';
import { LearningEvent } from '../../../../lib/neo4j/types';

export async function POST(req: NextRequest) {
  try {
    const learningEvent: LearningEvent = await req.json();
    
    console.log('Server: Processing learning event:', {
      userId: learningEvent.userId,
      language: learningEvent.language,
      lexemeCount: learningEvent.lexemes.length
    });

    // Process the learning event to update Neo4j
    await processLearningEvent(learningEvent);
    
    console.log('Server: Learning event processed successfully');

    return NextResponse.json({
      success: true,
      message: 'Learning event processed successfully',
      lexemesProcessed: learningEvent.lexemes.length
    });

  } catch (error) {
    console.error('Server: Learning event processing failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process learning event',
      details: error.message
    }, { status: 500 });
  }
}