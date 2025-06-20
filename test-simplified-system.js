// Test script for the simplified form statistics system
// Run this when the dev server is running: node test-simplified-system.js

const testLearningEvent = {
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

console.log('Test learning event:');
console.log(JSON.stringify(testLearningEvent, null, 2));

console.log('\nExpected result after processing:');
console.log(`
LearningProgress for "читать":
- srsLevel: calculated based on overall performance
- overallSuccessRate: 1/2 = 0.5 (1 correct, 1 wrong)
- formStats: {
    "читаю": {encounters: 1, correct: 1, successRate: 1.0},
    "читаешь": {encounters: 1, correct: 0, successRate: 0.0, commonErrors: ["verb form error"]}
  }
- weakestForms: ["читаешь"]

LearningProgress for "книга":
- srsLevel: higher (good performance)
- overallSuccessRate: 1.0
- formStats: {
    "книгу": {encounters: 1, correct: 1, successRate: 1.0, morphFeatures: {case: "acc", number: "sing"}}
  }
`);

console.log('\nTo test: POST this to /api/learning/process-event when server is running');