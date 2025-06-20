import { getSession } from './driver';

export async function initializeSchema(): Promise<void> {
  const session = getSession();

  try {
    // Create constraints
    await session.run(`
      CREATE CONSTRAINT user_id_unique IF NOT EXISTS
      FOR (u:User) REQUIRE u.id IS UNIQUE
    `);

    await session.run(`
      CREATE CONSTRAINT lexeme_compound_unique IF NOT EXISTS  
      FOR (l:Lexeme) REQUIRE (l.lemma, l.language, l.pos) IS UNIQUE
    `);


    // Create indexes for performance
    await session.run(`
      CREATE INDEX user_id_index IF NOT EXISTS
      FOR (u:User) ON (u.id)
    `);

    await session.run(`
      CREATE INDEX lexeme_lookup_index IF NOT EXISTS
      FOR (l:Lexeme) ON (l.language, l.lemma)
    `);

    await session.run(`
      CREATE INDEX progress_review_index IF NOT EXISTS
      FOR (p:LearningProgress) ON (p.nextReview)
    `);

    await session.run(`
      CREATE INDEX progress_active_index IF NOT EXISTS
      FOR (p:LearningProgress) ON (p.active)
    `);

    await session.run(`
      CREATE INDEX progress_srs_index IF NOT EXISTS
      FOR (p:LearningProgress) ON (p.srsLevel)
    `);

    await session.run(`
      CREATE INDEX progress_user_index IF NOT EXISTS
      FOR (p:LearningProgress) ON (p.userId)
    `);


    console.log('Neo4j schema initialized successfully');
  } catch (error) {
    console.error('Error initializing Neo4j schema:', error);
    throw error;
  } finally {
    await session.close();
  }
}

export async function clearDatabase(): Promise<void> {
  const session = getSession();
  
  try {
    // WARNING: This deletes all data! Use only for development/testing
    await session.run('MATCH (n) DETACH DELETE n');
    console.log('Database cleared');
  } catch (error) {
    console.error('Error clearing database:', error);
    throw error;
  } finally {
    await session.close();
  }
}

export async function createSampleData(): Promise<void> {
  const session = getSession();

  try {
    // Create sample user
    await session.run(`
      MERGE (u:User {id: 'user123'})
      ON CREATE SET u.createdAt = timestamp()
    `);

    // Create sample language
    await session.run(`
      MERGE (lang:Language {code: 'ru'})
      ON CREATE SET lang.name = 'Russian'
    `);

    // Create sample lexemes (includes base forms and important conjugations)
    const lexemes = [
      // Nouns
      { lemma: 'собака', pos: 'NOUN' },
      { lemma: 'кот', pos: 'NOUN' },
      { lemma: 'книга', pos: 'NOUN' },
      { lemma: 'дом', pos: 'NOUN' },
      // Verbs (infinitive forms)
      { lemma: 'быть', pos: 'VERB' },
      { lemma: 'идти', pos: 'VERB' },
      { lemma: 'читать', pos: 'VERB' },
      { lemma: 'говорить', pos: 'VERB' },
      { lemma: 'видеть', pos: 'VERB' },
      // Adjectives
      { lemma: 'большой', pos: 'ADJ' },
      { lemma: 'маленький', pos: 'ADJ' },
      { lemma: 'красивый', pos: 'ADJ' },
      { lemma: 'хороший', pos: 'ADJ' },
      // Interjections
      { lemma: 'привет', pos: 'INTJ' },
      { lemma: 'спасибо', pos: 'INTJ' },
      { lemma: 'пожалуйста', pos: 'INTJ' }
    ];

    for (const lex of lexemes) {
      await session.run(`
        MERGE (l:Lexeme:RU {lemma: $lemma, pos: $pos, language: 'ru'})
        ON CREATE SET l.createdAt = timestamp()
      `, lex);
    }

    console.log('Sample data created');
  } catch (error) {
    console.error('Error creating sample data:', error);
    throw error;
  } finally {
    await session.close();
  }
}