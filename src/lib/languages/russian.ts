import { LanguageConfig } from './types';

export const russianConfig: LanguageConfig = {
  code: 'ru',
  name: 'Russian',
  nativeName: 'Русский',
  script: 'Cyrillic',
  morphology: {
    verbs: [
      // Present tense patterns
      { pattern: /ю$|у$/, features: { person: '1', number: 'sing', tense: 'pres' } },
      { pattern: /ешь$|ишь$/, features: { person: '2', number: 'sing', tense: 'pres' } },
      { pattern: /ет$|ит$/, features: { person: '3', number: 'sing', tense: 'pres' } },
      { pattern: /ем$|им$/, features: { person: '1', number: 'plur', tense: 'pres' } },
      { pattern: /ете$|ите$/, features: { person: '2', number: 'plur', tense: 'pres' } },
      { pattern: /ют$|ат$|ят$/, features: { person: '3', number: 'plur', tense: 'pres' } },
      
      // Past tense patterns
      { pattern: /л$/, features: { tense: 'past', gender: 'masc' } },
      { pattern: /ла$/, features: { tense: 'past', gender: 'fem' } },
      { pattern: /ло$/, features: { tense: 'past', gender: 'neut' } },
      { pattern: /ли$/, features: { tense: 'past', number: 'plur' } },
    ],
    nouns: [
      // Plural patterns
      { pattern: /ы$|и$/, features: { number: 'plur', case: 'nom' } },
      { pattern: /ов$|ев$|ей$/, features: { number: 'plur', case: 'gen' } },
      { pattern: /ам$|ям$/, features: { number: 'plur', case: 'dat' } },
      { pattern: /ами$|ями$/, features: { number: 'plur', case: 'ins' } },
      { pattern: /ах$|ях$/, features: { number: 'plur', case: 'loc' } },
      
      // Singular patterns
      { pattern: /у$|ю$/, features: { number: 'sing', case: 'acc' } },
      { pattern: /ом$|ем$/, features: { number: 'sing', case: 'ins' } },
      { pattern: /е$/, features: { number: 'sing', case: 'loc' } },
    ],
    adjectives: [
      // Feminine forms
      { pattern: /ая$/, features: { gender: 'fem', number: 'sing', case: 'nom' } },
      { pattern: /ую$|юю$/, features: { gender: 'fem', number: 'sing', case: 'acc' } },
      
      // Neuter forms
      { pattern: /ое$|ее$/, features: { gender: 'neut', number: 'sing', case: 'nom' } },
      
      // Plural forms
      { pattern: /ые$|ие$/, features: { number: 'plur', case: 'nom' } },
    ],
  },
  teachingStrategies: {
    beginner: {
      description: "Use mostly English with key Russian phrases",
      focusAreas: [
        "Basic vocabulary with Cyrillic and romanization",
        "High-frequency words and basic Cyrillic letters",
        "Simple greetings and everyday phrases",
        "Numbers and basic expressions"
      ],
      mixRatio: "80% English, 20% Russian"
    },
    intermediate: {
      description: "Increase Russian usage gradually",
      focusAreas: [
        "Verb conjugations (present, past, future)",
        "Basic noun cases (nominative, accusative, genitive)",
        "Adjective-noun agreement",
        "Simple verb aspects (perfective vs imperfective)"
      ],
      mixRatio: "50% English, 50% Russian"
    },
    advanced: {
      description: "Primarily Russian conversation",
      focusAreas: [
        "All six cases with their functions",
        "Complex verb aspects and motion verbs",
        "Participles and gerunds",
        "Subjunctive mood and conditionals",
        "Literary and formal register"
      ],
      mixRatio: "20% English, 80% Russian"
    }
  },
  grammarExamples: {
    correct: [
      {
        text: "Моя собака очень большая, но мой кот маленький",
        translation: "My dog is very big, but my cat is small",
        explanation: "Correct gender agreement between adjectives and nouns"
      },
      {
        text: "Я читаю книгу",
        translation: "I am reading a book",
        explanation: "Correct 1st person singular present tense and accusative case"
      }
    ],
    incorrect: [
      {
        text: "Я читаю книга",
        error: "Wrong case for direct object",
        correction: "Я читаю книгу",
        explanation: "Direct objects of transitive verbs take accusative case"
      },
      {
        text: "Ты читает газету",
        error: "Wrong verb conjugation",
        correction: "Ты читаешь газету",
        explanation: "2nd person singular should use 'читаешь' not 'читает'"
      }
    ]
  }
};