import Bull from 'bull';
import Redis from 'ioredis';
import { processLearningEvent } from '../neo4j/srs';
import { LearningEvent } from '../neo4j/types';

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Create Bull queue for learning analysis
export const learningQueue = new Bull('learning analysis', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50,      // Keep last 50 failed jobs
    attempts: 3,           // Retry failed jobs 3 times
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Job types
export interface AnalyzeTurnJob {
  userId: string;
  userUtterance: string;
  conversationContext?: string;
  targetLanguage?: string;
  sessionId?: string;
  timestamp: number;
}

export interface UpdateProgressJob {
  learningEvent: LearningEvent;
}

// Job processors
learningQueue.process('analyze-turn', async (job) => {
  const { userId, userUtterance, conversationContext, targetLanguage } = job.data as AnalyzeTurnJob;
  
  console.log(`Processing learning analysis for user ${userId}`);
  
  try {
    // This would typically call the learning analysis supervisor
    // For now, we'll simulate with a simple analysis
    const mockLearningEvent: LearningEvent = {
      userId,
      language: targetLanguage || 'es',
      timestamp: Date.now(),
      lexemes: [
        // Mock analysis - in production this would come from NLP analysis
        {
          lemma: 'hola',
          form: 'hola',
          pos: 'INTJ',
          known: true,
          confidence: 0.95,
          performance: 'correct_use'
        }
      ]
    };

    await processLearningEvent(mockLearningEvent);
    
    return { success: true, lexemesProcessed: mockLearningEvent.lexemes.length };
  } catch (error) {
    console.error('Learning analysis job failed:', error);
    throw error;
  }
});

learningQueue.process('update-progress', async (job) => {
  const { learningEvent } = job.data as UpdateProgressJob;
  
  console.log(`Updating progress for user ${learningEvent.userId}`);
  
  try {
    await processLearningEvent(learningEvent);
    return { success: true, lexemesProcessed: learningEvent.lexemes.length };
  } catch (error) {
    console.error('Progress update job failed:', error);
    throw error;
  }
});

// Queue management functions
export async function addLearningAnalysisJob(data: AnalyzeTurnJob): Promise<void> {
  await learningQueue.add('analyze-turn', data, {
    delay: 1000, // Process after 1 second delay
    priority: 5, // Medium priority
  });
}

export async function addProgressUpdateJob(data: UpdateProgressJob): Promise<void> {
  await learningQueue.add('update-progress', data, {
    priority: 10, // High priority
  });
}

// Queue monitoring
learningQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

learningQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

learningQueue.on('stalled', (job) => {
  console.warn(`Job ${job.id} stalled`);
});

// Health check
export async function getQueueHealth() {
  const waiting = await learningQueue.getWaiting();
  const active = await learningQueue.getActive();
  const completed = await learningQueue.getCompleted();
  const failed = await learningQueue.getFailed();

  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
    redis: redis.status,
  };
}

// Graceful shutdown
export async function shutdownQueue(): Promise<void> {
  await learningQueue.close();
  await redis.quit();
}