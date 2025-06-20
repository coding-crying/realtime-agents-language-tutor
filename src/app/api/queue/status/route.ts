import { NextRequest, NextResponse } from 'next/server';
import { getQueueHealth } from '../../../../lib/queue/learningQueue';

export async function GET(req: NextRequest) {
  try {
    const health = await getQueueHealth();
    
    return NextResponse.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting queue status:', error);
    return NextResponse.json(
      { error: 'Failed to get queue status' },
      { status: 500 }
    );
  }
}