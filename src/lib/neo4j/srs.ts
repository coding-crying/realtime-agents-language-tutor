import { getSession } from './driver';
import { LearningEvent, PerformanceType, ReviewItem, UserProgressSummary, FormStatistics } from './types';

// Simple morphological feature extraction for Russian
// TODO: Replace with proper morphological analyzer like pymystem3 or natasha
function extractMorphFeatures(lemma: string, form: string, pos: string): any {
  const features: any = {};
  
  if (pos === 'VERB') {
    // Basic verb conjugation patterns
    if (form.endsWith('ю') || form.endsWith('у')) {
      features.person = '1';
      features.number = 'sing';
      features.tense = 'pres';
    } else if (form.endsWith('ешь') || form.endsWith('ишь')) {
      features.person = '2';
      features.number = 'sing';
      features.tense = 'pres';
    } else if (form.endsWith('ет') || form.endsWith('ит')) {
      features.person = '3';
      features.number = 'sing';
      features.tense = 'pres';
    } else if (form.endsWith('ем') || form.endsWith('им')) {
      features.person = '1';
      features.number = 'plur';
      features.tense = 'pres';
    } else if (form.endsWith('ете') || form.endsWith('ите')) {
      features.person = '2';
      features.number = 'plur';
      features.tense = 'pres';
    } else if (form.endsWith('ют') || form.endsWith('ат') || form.endsWith('ят')) {
      features.person = '3';
      features.number = 'plur';
      features.tense = 'pres';
    } else if (form.endsWith('л') || form.endsWith('ла') || form.endsWith('ло') || form.endsWith('ли')) {
      features.tense = 'past';
      if (form.endsWith('л')) features.gender = 'masc';
      else if (form.endsWith('ла')) features.gender = 'fem';
      else if (form.endsWith('ло')) features.gender = 'neut';
      else if (form.endsWith('ли')) features.number = 'plur';
    }
  } else if (pos === 'NOUN') {
    // Basic noun declension patterns
    if (form.endsWith('ы') || form.endsWith('и')) {
      features.number = 'plur';
      features.case = 'nom'; // or gen sing for some patterns
    } else if (form.endsWith('ов') || form.endsWith('ев') || form.endsWith('ей')) {
      features.number = 'plur';
      features.case = 'gen';
    } else if (form.endsWith('ам') || form.endsWith('ям')) {
      features.number = 'plur';
      features.case = 'dat';
    } else if (form.endsWith('ами') || form.endsWith('ями')) {
      features.number = 'plur';
      features.case = 'ins';
    } else if (form.endsWith('ах') || form.endsWith('ях')) {
      features.number = 'plur';
      features.case = 'loc';
    } else if (form.endsWith('у') || form.endsWith('ю')) {
      features.number = 'sing';
      features.case = 'acc'; // or dat for some patterns
    } else if (form.endsWith('ом') || form.endsWith('ем')) {
      features.number = 'sing';
      features.case = 'ins';
    } else if (form.endsWith('е')) {
      features.number = 'sing';
      features.case = 'loc'; // or dat
    }
  } else if (pos === 'ADJ') {
    // Basic adjective agreement patterns
    if (form.endsWith('ая')) {
      features.gender = 'fem';
      features.number = 'sing';
      features.case = 'nom';
    } else if (form.endsWith('ое') || form.endsWith('ее')) {
      features.gender = 'neut';
      features.number = 'sing';
      features.case = 'nom';
    } else if (form.endsWith('ые') || form.endsWith('ие')) {
      features.number = 'plur';
      features.case = 'nom';
    } else if (form.endsWith('ую') || form.endsWith('юю')) {
      features.gender = 'fem';
      features.number = 'sing';
      features.case = 'acc';
    }
  }
  
  return features;
}

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
  form: string,
  morphFeatures?: any,
  errorContext?: string
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
    
    // Parse existing form statistics or create new
    let formStats: Record<string, FormStatistics> = {};
    let currentLevel = 1;

    if (existingProgress?.properties.formStats) {
      try {
        formStats = JSON.parse(existingProgress.properties.formStats);
      } catch (e) {
        console.warn('Failed to parse existing formStats, starting fresh');
      }
      currentLevel = existingProgress.properties.srsLevel || 1;
    }

    // Update statistics for the specific form
    if (!formStats[form]) {
      formStats[form] = {
        encounters: 0,
        correct: 0,
        successRate: 0,
        commonErrors: [],
        morphFeatures,
        lastSeen: Date.now()
      };
    }

    const formStat = formStats[form];
    formStat.encounters += 1;
    if (performance === 'correct_use') {
      formStat.correct += 1;
    } else if (errorContext && !formStat.commonErrors?.includes(errorContext)) {
      formStat.commonErrors = formStat.commonErrors || [];
      formStat.commonErrors.push(errorContext);
      // Keep only last 5 errors
      if (formStat.commonErrors.length > 5) {
        formStat.commonErrors = formStat.commonErrors.slice(-5);
      }
    }
    formStat.successRate = formStat.correct / formStat.encounters;
    formStat.lastSeen = Date.now();

    // Calculate overall word statistics
    const overallStats = calculateOverallStats(formStats);
    
    // Calculate new SRS level based on overall performance
    const { newLevel, daysToAdd } = calculateNextReview(currentLevel, performance);
    
    // Calculate next review date
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + daysToAdd);
    const nextReview = nextReviewDate.toISOString().split('T')[0];

    // Update or create progress with embedded form statistics
    await session.run(`
      MATCH (u:User {id: $userId})
      MATCH (l:Lexeme {lemma: $lemma, language: $language, pos: $pos})
      MERGE (u)-[:HAS_PROGRESS]->(p:LearningProgress)-[:ABOUT]->(l)
      ON CREATE SET p.createdAt = timestamp(), p.userId = $userId
      SET p.srsLevel = $srsLevel,
          p.lastSeen = timestamp(),
          p.overallSuccessRate = $overallSuccessRate,
          p.nextReview = $nextReview,
          p.totalEncounters = $totalEncounters,
          p.correctUses = $totalCorrect,
          p.formStats = $formStats,
          p.weakestForms = $weakestForms,
          p.active = true,
          p.updatedAt = timestamp(),
          p.userId = $userId
    `, {
      userId,
      lemma,
      language,
      pos,
      srsLevel: newLevel,
      overallSuccessRate: overallStats.overallSuccessRate,
      nextReview,
      totalEncounters: overallStats.totalEncounters,
      totalCorrect: overallStats.totalCorrect,
      formStats: JSON.stringify(formStats),
      weakestForms: overallStats.weakestForms
    });

  } finally {
    await session.close();
  }
}

// Helper function to calculate overall word statistics from form statistics
function calculateOverallStats(formStats: Record<string, FormStatistics>): {
  totalEncounters: number;
  totalCorrect: number;
  overallSuccessRate: number;
  weakestForms: string[];
} {
  let totalEncounters = 0;
  let totalCorrect = 0;
  const formPerformance: Array<{form: string, successRate: number}> = [];

  for (const [form, stats] of Object.entries(formStats)) {
    totalEncounters += stats.encounters;
    totalCorrect += stats.correct;
    formPerformance.push({ form, successRate: stats.successRate });
  }

  const overallSuccessRate = totalEncounters > 0 ? totalCorrect / totalEncounters : 0;
  
  // Find weakest forms (success rate < 0.7)
  const weakestForms = formPerformance
    .filter(fp => fp.successRate < 0.7 && fp.successRate > 0)
    .sort((a, b) => a.successRate - b.successRate)
    .slice(0, 3)
    .map(fp => fp.form);

  return { totalEncounters, totalCorrect, overallSuccessRate, weakestForms };
}

export async function processLearningEvent(event: LearningEvent): Promise<void> {
  console.log('Processing learning event:', {
    userId: event.userId,
    language: event.language,
    lexemeCount: event.lexemes.length
  });
  
  for (const lexeme of event.lexemes) {
    try {
      console.log('Processing lexeme:', lexeme.lemma, 'form:', lexeme.form, 'performance:', lexeme.performance);
      
      // Use the form if provided, otherwise use the lemma
      const formToTrack = lexeme.form || lexeme.lemma;
      
      // Extract morphological features if this is a conjugated/declined form
      let morphFeatures;
      let errorContext;
      
      if (lexeme.form && lexeme.form !== lexeme.lemma) {
        morphFeatures = extractMorphFeatures(lexeme.lemma, lexeme.form, lexeme.pos);
        
        // Generate error context from grammar hints if performance is poor
        if (lexeme.performance === 'wrong_use' && event.grammarHints?.length) {
          errorContext = event.grammarHints.find(hint => 
            hint.toLowerCase().includes('error') || 
            hint.toLowerCase().includes('wrong') ||
            hint.toLowerCase().includes('incorrect')
          ) || 'morphological error';
        }
      }
      
      // Update unified progress with embedded form statistics
      await updateUserProgress(
        event.userId,
        lexeme.lemma,
        event.language,
        lexeme.pos,
        lexeme.performance,
        formToTrack,
        morphFeatures,
        errorContext
      );
      
      console.log('Successfully processed word:', lexeme.lemma, 'form:', formToTrack);
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
      WHERE p.srsLevel >= $minLevel AND p.successRate > 0.7 AND p.active = true AND p.userId = $userId
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
      WHERE p.nextReview <= date() AND p.active = true AND p.userId = $userId
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
    // Get unified progress with embedded form statistics
    const result = await session.run(`
      MATCH (u:User {id: $userId})-[:HAS_PROGRESS]->(p:LearningProgress)-[:ABOUT]->(l:Lexeme {language: $language})
      WHERE p.active = true AND p.userId = $userId
      RETURN count(p) AS totalWords,
             count(CASE WHEN p.srsLevel >= 3 AND p.overallSuccessRate > 0.7 THEN 1 END) AS knownWords,
             count(CASE WHEN p.nextReview <= date() THEN 1 END) AS reviewDue,
             avg(p.overallSuccessRate) AS averageSuccessRate,
             max(p.lastSeen) AS lastActivity,
             collect(p.formStats) AS allFormStats,
             collect(p.weakestForms) AS allWeakestForms
    `, { userId, language });

    const record = result.records[0];
    
    // Analyze form statistics across all words
    let totalFormsTracked = 0;
    let formsWithIssues = 0;
    const allErrorPatterns: string[] = [];

    if (record?.get('allFormStats')) {
      const formStatsArray = record.get('allFormStats');
      
      for (const formStatsJson of formStatsArray) {
        if (formStatsJson) {
          try {
            const formStats = JSON.parse(formStatsJson);
            totalFormsTracked += Object.keys(formStats).length;
            
            for (const [form, stats] of Object.entries(formStats)) {
              const formStat = stats as FormStatistics;
              if (formStat.successRate < 0.7) {
                formsWithIssues++;
              }
              if (formStat.commonErrors) {
                allErrorPatterns.push(...formStat.commonErrors);
              }
            }
          } catch (e) {
            console.warn('Failed to parse formStats in getUserProgress');
          }
        }
      }
    }

    // Find most common error patterns
    const errorPatternCounts: Record<string, number> = {};
    allErrorPatterns.forEach(error => {
      errorPatternCounts[error] = (errorPatternCounts[error] || 0) + 1;
    });
    
    const commonErrorPatterns = Object.entries(errorPatternCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([pattern]) => pattern);
    
    return {
      userId,
      language,
      totalWords: record?.get('totalWords')?.toNumber() || 0,
      knownWords: record?.get('knownWords')?.toNumber() || 0,
      reviewDue: record?.get('reviewDue')?.toNumber() || 0,
      averageSuccessRate: record?.get('averageSuccessRate') || 0,
      lastActivity: record?.get('lastActivity')?.toNumber(),
      totalFormsTracked,
      formsWithIssues,
      commonErrorPatterns,
    };
  } finally {
    await session.close();
  }
}