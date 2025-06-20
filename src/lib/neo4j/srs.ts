import { getSession } from './driver';
import { LearningEvent, PerformanceType, ReviewItem, UserProgressSummary } from './types';

// SRS interval calculation (Leitner box system)
export function calculateNextReview(srsLevel: number, performance: PerformanceType): { newLevel: number; daysToAdd: number } {
  let newLevel = srsLevel;
  let daysToAdd = 1;

  switch (performance) {
    case 'introduced':
      newLevel = 1;
      daysToAdd = 1;
      break;
    case 'correct_use':
      newLevel = Math.min(srsLevel + 1, 5);
      daysToAdd = Math.pow(2, newLevel - 1); // 1, 2, 4, 8, 16 days
      break;
    case 'wrong_use':
    case 'recall_fail':
      newLevel = 1;
      daysToAdd = 1;
      break;
  }

  return { newLevel, daysToAdd };
}

export async function ensureUser(userId: string): Promise<void> {
  const session = getSession();
  
  try {
    await session.run(`
      MERGE (u:User {id: $userId})
      ON CREATE SET u.createdAt = timestamp()
    `, { userId });
  } finally {
    await session.close();
  }
}

export async function ensureLexeme(lemma: string, language: string, pos: string): Promise<void> {
  const session = getSession();
  
  try {
    await session.run(`
      MERGE (l:Lexeme {lemma: $lemma, language: $language, pos: $pos})
      ON CREATE SET l.createdAt = timestamp()
    `, { lemma, language, pos });
  } finally {
    await session.close();
  }
}

export async function updateUserProgress(
  userId: string, 
  lemma: string, 
  language: string, 
  pos: string,
  performance: PerformanceType,
  _confidence: number = 1.0
): Promise<void> {
  const session = getSession();
  
  try {
    // First ensure user and lexeme exist
    await ensureUser(userId);
    await ensureLexeme(lemma, language, pos);

    // Get current progress or create new
    const result = await session.run(`
      MATCH (u:User {id: $userId})
      MATCH (l:Lexeme {lemma: $lemma, language: $language, pos: $pos})
      OPTIONAL MATCH (u)-[:HAS_PROGRESS]->(p:LearningProgress)-[:ABOUT]->(l)
      RETURN p
    `, { userId, lemma, language, pos });

    const existingProgress = result.records[0]?.get('p');
    
    let currentLevel = 1;
    let totalEncounters = 0;
    let correctUses = 0;

    if (existingProgress) {
      currentLevel = existingProgress.properties.srsLevel || 1;
      totalEncounters = existingProgress.properties.totalEncounters || 0;
      correctUses = existingProgress.properties.correctUses || 0;
    }

    // Calculate new stats
    const { newLevel, daysToAdd } = calculateNextReview(currentLevel, performance);
    const newTotalEncounters = totalEncounters + 1;
    const newCorrectUses = correctUses + (performance === 'correct_use' ? 1 : 0);
    const successRate = newTotalEncounters > 0 ? newCorrectUses / newTotalEncounters : 0;
    
    // Calculate next review date
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + daysToAdd);
    const nextReview = nextReviewDate.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Update or create progress
    await session.run(`
      MATCH (u:User {id: $userId})
      MATCH (l:Lexeme {lemma: $lemma, language: $language, pos: $pos})
      MERGE (u)-[:HAS_PROGRESS]->(p:LearningProgress)-[:ABOUT]->(l)
      ON CREATE SET p.createdAt = timestamp()
      SET p.srsLevel = $srsLevel,
          p.lastSeen = timestamp(),
          p.successRate = $successRate,
          p.nextReview = $nextReview,
          p.totalEncounters = $totalEncounters,
          p.correctUses = $correctUses,
          p.active = true,
          p.updatedAt = timestamp()
    `, {
      userId,
      lemma,
      language,
      pos,
      srsLevel: newLevel,
      successRate,
      nextReview,
      totalEncounters: newTotalEncounters,
      correctUses: newCorrectUses
    });

  } finally {
    await session.close();
  }
}

export async function processLearningEvent(event: LearningEvent): Promise<void> {
  console.log('Processing learning event:', {
    userId: event.userId,
    language: event.language,
    lexemeCount: event.lexemes.length
  });
  
  for (const lexeme of event.lexemes) {
    try {
      console.log('Processing lexeme:', lexeme.lemma, lexeme.performance);
      await updateUserProgress(
        event.userId,
        lexeme.lemma,
        event.language,
        lexeme.pos,
        lexeme.performance,
        lexeme.confidence
      );
      console.log('Successfully processed lexeme:', lexeme.lemma);
    } catch (error) {
      console.error('Error processing lexeme:', lexeme.lemma, error);
      throw error; // Re-throw to surface the specific error
    }
  }
}

export async function getKnownWords(userId: string, language: string, minLevel: number = 3): Promise<string[]> {
  const session = getSession();
  
  try {
    const result = await session.run(`
      MATCH (u:User {id: $userId})-[:HAS_PROGRESS]->(p:LearningProgress)-[:ABOUT]->(l:Lexeme {language: $language})
      WHERE p.srsLevel >= $minLevel AND p.successRate > 0.7 AND p.active = true
      RETURN collect(l.lemma) AS knownWords
    `, { userId, language, minLevel });

    return result.records[0]?.get('knownWords') || [];
  } finally {
    await session.close();
  }
}

export async function getReviewDue(userId: string, language: string, limit: number = 10): Promise<ReviewItem[]> {
  const session = getSession();
  
  try {
    const result = await session.run(`
      MATCH (u:User {id: $userId})-[:HAS_PROGRESS]->(p:LearningProgress)-[:ABOUT]->(l:Lexeme {language: $language})
      WHERE p.nextReview <= date() AND p.active = true
      RETURN l.lemma AS lemma, 
             l.pos AS pos,
             p.srsLevel AS srsLevel,
             p.successRate AS successRate,
             p.nextReview AS nextReview,
             duration.between(date(p.nextReview), date()).days AS daysSinceLastSeen
      ORDER BY p.nextReview ASC, p.srsLevel ASC
      LIMIT $limit
    `, { userId, language, limit });

    return result.records.map(record => ({
      lemma: record.get('lemma'),
      pos: record.get('pos'),
      srsLevel: record.get('srsLevel'),
      successRate: record.get('successRate'),
      nextReview: record.get('nextReview'),
      daysSinceLastSeen: record.get('daysSinceLastSeen') || 0
    }));
  } finally {
    await session.close();
  }
}

export async function getUserProgress(userId: string, language: string): Promise<UserProgressSummary> {
  const session = getSession();
  
  try {
    const result = await session.run(`
      MATCH (u:User {id: $userId})-[:HAS_PROGRESS]->(p:LearningProgress)-[:ABOUT]->(l:Lexeme {language: $language})
      WHERE p.active = true
      RETURN count(p) AS totalWords,
             count(CASE WHEN p.srsLevel >= 3 AND p.successRate > 0.7 THEN 1 END) AS knownWords,
             count(CASE WHEN p.nextReview <= date() THEN 1 END) AS reviewDue,
             avg(p.successRate) AS averageSuccessRate,
             max(p.lastSeen) AS lastActivity
    `, { userId, language });

    const record = result.records[0];
    
    return {
      userId,
      language,
      totalWords: record.get('totalWords').toNumber(),
      knownWords: record.get('knownWords').toNumber(),
      reviewDue: record.get('reviewDue').toNumber(),
      averageSuccessRate: record.get('averageSuccessRate') || 0,
      lastActivity: record.get('lastActivity')
    };
  } finally {
    await session.close();
  }
}