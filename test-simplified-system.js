// Test script for the generalized morphological system
// Run this when the dev server is running: node test-simplified-system.js

// Test with Russian
const testRussianEvent = {
  userId: "demo-user",
  language: "ru", 
  timestamp: Date.now(),
  lexemes: [
    {
      lemma: "читать",
      form: "читаю", 
      pos: "VERB",
      known: true,
      confidence: 0.9,
      performance: "correct_use"
    },
    {
      lemma: "читать",
      form: "читаешь",
      pos: "VERB", 
      known: true,
      confidence: 0.8,
      performance: "wrong_use"
    },
    {
      lemma: "книга",
      form: "книгу",
      pos: "NOUN",
      known: true,
      confidence: 0.9, 
      performance: "correct_use"
    }
  ],
  grammarHints: [
    "Correct 1st person singular present tense verb 'читаю'",
    "Incorrect 2nd person form - should be 'читаешь' not 'читает'", 
    "Correct accusative case for direct object 'книгу'"
  ]
};

// Test with Spanish
const testSpanishEvent = {
  userId: "demo-user",
  language: "es",
  timestamp: Date.now(),
  lexemes: [
    {
      lemma: "hablar",
      form: "hablo",
      pos: "VERB",
      known: true,
      confidence: 0.9,
      performance: "correct_use"
    },
    {
      lemma: "casa",
      form: "casa",
      pos: "NOUN",
      known: true,
      confidence: 0.8,
      performance: "correct_use"
    },
    {
      lemma: "grande",
      form: "grande",
      pos: "ADJ",
      known: true,
      confidence: 0.9,
      performance: "correct_use"
    }
  ],
  grammarHints: [
    "Correct 1st person singular present tense 'hablo'",
    "Proper noun usage with feminine gender",
    "Adjective correctly used"
  ]
};

console.log('=== RUSSIAN TEST EVENT ===');
console.log(JSON.stringify(testRussianEvent, null, 2));

console.log('\n=== SPANISH TEST EVENT ===');
console.log(JSON.stringify(testSpanishEvent, null, 2));

console.log('\n=== EXPECTED RESULTS ===');

console.log('\nRussian - LearningProgress for "читать":');
console.log(`
- srsLevel: calculated based on overall performance
- overallSuccessRate: 1/2 = 0.5 (1 correct, 1 wrong)
- formStats: {
    "читаю": {encounters: 1, correct: 1, successRate: 1.0, morphFeatures: {person: "1", number: "sing", tense: "pres"}},
    "читаешь": {encounters: 1, correct: 0, successRate: 0.0, commonErrors: ["verb form error"]}
  }
- weakestForms: ["читаешь"]
`);

console.log('\nSpanish - LearningProgress for "hablar":');
console.log(`
- srsLevel: higher (good performance)
- overallSuccessRate: 1.0
- formStats: {
    "hablo": {encounters: 1, correct: 1, successRate: 1.0, morphFeatures: {person: "1", number: "sing", tense: "pres"}}
  }
`);

console.log('\n=== TESTING INSTRUCTIONS ===');
console.log('1. Start the dev server: npm run dev');
console.log('2. POST Russian event to: /api/learning/process-event');
console.log('3. POST Spanish event to: /api/learning/process-event');
console.log('4. Check progress: GET /api/learning/progress?userId=demo-user&language=ru');
console.log('5. Check progress: GET /api/learning/progress?userId=demo-user&language=es');