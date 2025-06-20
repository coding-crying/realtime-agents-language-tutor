import { getSession } from './driver';
import { LearningEvent, PerformanceType, ReviewItem, UserProgressSummary, Form, FormProgress } from './types';

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
      ON CREATE SET p.createdAt = timestamp(), p.userId = $userId
      SET p.srsLevel = $srsLevel,
          p.lastSeen = timestamp(),
          p.successRate = $successRate,
          p.nextReview = $nextReview,
          p.totalEncounters = $totalEncounters,
          p.correctUses = $correctUses,
          p.active = true,
          p.updatedAt = timestamp(),
          p.userId = $userId
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

// Form-related functions
export async function ensureForm(form: string, lemma: string, language: string, pos: string, morphFeatures?: any): Promise<void> {
  const session = getSession();
  
  try {
    // Build morphological feature properties
    const featsString = morphFeatures ? Object.entries(morphFeatures)
      .map(([key, value]) => `${key}=${value}`)
      .join('|') : undefined;

    // Build dynamic SET clause for morphological features
    const setProperties = ['f.createdAt = timestamp()'];
    const params: any = { form, lemma, language, pos };
    
    if (featsString) {
      setProperties.push('f.feats = $feats');
      params.feats = featsString;
    }
    
    if (morphFeatures?.person) {
      setProperties.push('f.person = $person');
      params.person = morphFeatures.person;
    }
    
    if (morphFeatures?.number) {
      setProperties.push('f.number = $number');
      params.number = morphFeatures.number;
    }
    
    if (morphFeatures?.case) {
      setProperties.push('f.case = $case');
      params.case = morphFeatures.case;
    }
    
    if (morphFeatures?.gender) {
      setProperties.push('f.gender = $gender');
      params.gender = morphFeatures.gender;
    }
    
    if (morphFeatures?.tense) {
      setProperties.push('f.tense = $tense');
      params.tense = morphFeatures.tense;
    }
    
    if (morphFeatures?.aspect) {
      setProperties.push('f.aspect = $aspect');
      params.aspect = morphFeatures.aspect;
    }
    
    if (morphFeatures?.mood) {
      setProperties.push('f.mood = $mood');
      params.mood = morphFeatures.mood;
    }

    await session.run(`
      MERGE (f:Form {form: $form, lemma: $lemma, language: $language, pos: $pos})
      ON CREATE SET ${setProperties.join(', ')}
    `, params);

    // Link form to its lexeme
    await session.run(`
      MATCH (f:Form {form: $form, lemma: $lemma, language: $language, pos: $pos})
      MATCH (l:Lexeme {lemma: $lemma, language: $language, pos: $pos})
      MERGE (f)-[:OF_LEXEME]->(l)
    `, { form, lemma, language, pos });

  } finally {
    await session.close();
  }
}

export async function updateFormProgress(
  userId: string,
  form: string,
  lemma: string,
  language: string,
  pos: string,
  performance: PerformanceType,
  morphFeatures?: any
): Promise<void> {
  const session = getSession();
  
  try {
    // Ensure user, lexeme, and form exist
    await ensureUser(userId);
    await ensureLexeme(lemma, language, pos);
    await ensureForm(form, lemma, language, pos, morphFeatures);

    // Get current form progress
    const result = await session.run(`
      MATCH (u:User {id: $userId})
      MATCH (f:Form {form: $form, lemma: $lemma, language: $language, pos: $pos})
      OPTIONAL MATCH (u)-[:HAS_FORM_PROGRESS]->(fp:FormProgress)-[:ABOUT_FORM]->(f)
      RETURN fp
    `, { userId, form, lemma, language, pos });

    const existingProgress = result.records[0]?.get('fp');
    
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
    const nextReview = nextReviewDate.toISOString().split('T')[0];

    // Update or create form progress
    await session.run(`
      MATCH (u:User {id: $userId})
      MATCH (f:Form {form: $form, lemma: $lemma, language: $language, pos: $pos})
      MERGE (u)-[:HAS_FORM_PROGRESS]->(fp:FormProgress)-[:ABOUT_FORM]->(f)
      ON CREATE SET fp.createdAt = timestamp(), fp.userId = $userId
      SET fp.srsLevel = $srsLevel,
          fp.lastSeen = timestamp(),
          fp.successRate = $successRate,
          fp.nextReview = $nextReview,
          fp.totalEncounters = $totalEncounters,
          fp.correctUses = $correctUses,
          fp.active = true,
          fp.updatedAt = timestamp(),
          fp.userId = $userId
    `, {
      userId,
      form,
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
      console.log('Processing lexeme:', lexeme.lemma, 'form:', lexeme.form, 'performance:', lexeme.performance);
      
      // Update lexeme-level progress (general word knowledge)
      await updateUserProgress(
        event.userId,
        lexeme.lemma,
        event.language,
        lexeme.pos,
        lexeme.performance,
        lexeme.confidence
      );
      console.log('Successfully processed lexeme:', lexeme.lemma);

      // Update form-level progress (specific conjugation/declension knowledge)
      // Only track forms that are different from the lemma (conjugated/declined forms)
      if (lexeme.form && lexeme.form !== lexeme.lemma) {
        // For now, we'll extract basic morphological features from context
        // TODO: Integrate with a Russian morphological analyzer
        const morphFeatures = extractMorphFeatures(lexeme.lemma, lexeme.form, lexeme.pos);
        
        await updateFormProgress(
          event.userId,
          lexeme.form,
          lexeme.lemma,
          event.language,
          lexeme.pos,
          lexeme.performance,
          morphFeatures
        );
        console.log('Successfully processed form:', lexeme.form, 'of', lexeme.lemma);
      }
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
    // Get lexeme-level progress
    const lexemeResult = await session.run(`
      MATCH (u:User {id: $userId})-[:HAS_PROGRESS]->(p:LearningProgress)-[:ABOUT]->(l:Lexeme {language: $language})
      WHERE p.active = true AND p.userId = $userId
      RETURN count(p) AS totalWords,
             count(CASE WHEN p.srsLevel >= 3 AND p.successRate > 0.7 THEN 1 END) AS knownWords,
             count(CASE WHEN p.nextReview <= date() THEN 1 END) AS reviewDue,
             avg(p.successRate) AS averageSuccessRate,
             max(p.lastSeen) AS lastActivity
    `, { userId, language });

    // Get form-level progress
    const formResult = await session.run(`
      MATCH (u:User {id: $userId})-[:HAS_FORM_PROGRESS]->(fp:FormProgress)-[:ABOUT_FORM]->(f:Form {language: $language})
      WHERE fp.active = true AND fp.userId = $userId
      RETURN count(fp) AS totalForms,
             count(CASE WHEN fp.srsLevel >= 3 AND fp.successRate > 0.7 THEN 1 END) AS knownForms,
             count(CASE WHEN fp.nextReview <= date() THEN 1 END) AS formReviewDue
    `, { userId, language });

    const lexemeRecord = lexemeResult.records[0];
    const formRecord = formResult.records[0];
    
    return {
      userId,
      language,
      totalWords: lexemeRecord?.get('totalWords')?.toNumber() || 0,
      knownWords: lexemeRecord?.get('knownWords')?.toNumber() || 0,
      reviewDue: lexemeRecord?.get('reviewDue')?.toNumber() || 0,
      averageSuccessRate: lexemeRecord?.get('averageSuccessRate') || 0,
      lastActivity: lexemeRecord?.get('lastActivity')?.toNumber(),
      totalForms: formRecord?.get('totalForms')?.toNumber() || 0,
      knownForms: formRecord?.get('knownForms')?.toNumber() || 0,
      formReviewDue: formRecord?.get('formReviewDue')?.toNumber() || 0,
    };
  } finally {
    await session.close();
  }
}