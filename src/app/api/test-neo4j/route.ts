import { NextRequest, NextResponse } from 'next/server';
import { processLearningEvent } from '../../../lib/neo4j/srs';
import { LearningEvent } from '../../../lib/neo4j/types';

export async function POST(req: NextRequest) {
  try {
    // Create a very simple test learning event with minimal data
    const testEvent: LearningEvent = {
      userId: 'test-user',
      language: 'ru',
      timestamp: Date.now(),
      lexemes: [
        {
          lemma: 'тест',
          form: 'тест',
          pos: 'NOUN',
          known: true,
          confidence: 1.0,
          performance: 'correct_use'
        }
      ],
      grammarHints: ['test hint']
    };

    console.log('Testing Neo4j with simple event:', testEvent);
    
    // Try to save it
    await processLearningEvent(testEvent);
    
    return NextResponse.json({
      success: true,
      message: 'Simple test event saved successfully',
      testEvent
    });

  } catch (error) {
    console.error('Simple Neo4j test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error
    }, { status: 500 });
  }
}