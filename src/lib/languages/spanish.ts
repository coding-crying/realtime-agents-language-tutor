import { LanguageConfig } from './types';

export const spanishConfig: LanguageConfig = {
  code: 'es',
  name: 'Spanish',
  nativeName: 'Español',
  script: 'Latin',
  morphology: {
    verbs: [
      // Present tense -ar verbs
      { pattern: /o$/, features: { person: '1', number: 'sing', tense: 'pres' } },
      { pattern: /as$/, features: { person: '2', number: 'sing', tense: 'pres' } },
      { pattern: /a$/, features: { person: '3', number: 'sing', tense: 'pres' } },
      { pattern: /amos$/, features: { person: '1', number: 'plur', tense: 'pres' } },
      { pattern: /áis$/, features: { person: '2', number: 'plur', tense: 'pres' } },
      { pattern: /an$/, features: { person: '3', number: 'plur', tense: 'pres' } },
      
      // Present tense -er/-ir verbs
      { pattern: /es$/, features: { person: '2', number: 'sing', tense: 'pres' } },
      { pattern: /e$/, features: { person: '3', number: 'sing', tense: 'pres' } },
      { pattern: /emos$|imos$/, features: { person: '1', number: 'plur', tense: 'pres' } },
      { pattern: /éis$|ís$/, features: { person: '2', number: 'plur', tense: 'pres' } },
      { pattern: /en$/, features: { person: '3', number: 'plur', tense: 'pres' } },
      
      // Past tense patterns
      { pattern: /é$/, features: { person: '1', number: 'sing', tense: 'pret' } },
      { pattern: /aste$/, features: { person: '2', number: 'sing', tense: 'pret' } },
      { pattern: /ó$/, features: { person: '3', number: 'sing', tense: 'pret' } },
    ],
    nouns: [
      // Plural patterns
      { pattern: /s$/, features: { number: 'plur' } },
      { pattern: /es$/, features: { number: 'plur' } },
      
      // Gender patterns
      { pattern: /a$/, features: { gender: 'fem', number: 'sing' } },
      { pattern: /o$/, features: { gender: 'masc', number: 'sing' } },
    ],
    adjectives: [
      // Gender and number agreement
      { pattern: /a$/, features: { gender: 'fem', number: 'sing' } },
      { pattern: /o$/, features: { gender: 'masc', number: 'sing' } },
      { pattern: /as$/, features: { gender: 'fem', number: 'plur' } },
      { pattern: /os$/, features: { gender: 'masc', number: 'plur' } },
    ],
  },
  teachingStrategies: {
    beginner: {
      description: "Use mostly English with key Spanish phrases",
      focusAreas: [
        "Basic vocabulary with pronunciation guides",
        "High-frequency words and cognates",
        "Simple greetings and everyday phrases",
        "Basic pronunciation and accent marks"
      ],
      mixRatio: "80% English, 20% Spanish"
    },
    intermediate: {
      description: "Increase Spanish usage gradually",
      focusAreas: [
        "Verb conjugations (present, preterite, imperfect)",
        "Noun-adjective agreement",
        "Ser vs estar usage",
        "Basic subjunctive mood"
      ],
      mixRatio: "50% English, 50% Spanish"
    },
    advanced: {
      description: "Primarily Spanish conversation",
      focusAreas: [
        "Complex verb tenses and moods",
        "Subjunctive in various contexts",
        "Idiomatic expressions",
        "Regional variations and formal register"
      ],
      mixRatio: "20% English, 80% Spanish"
    }
  },
  grammarExamples: {
    correct: [
      {
        text: "La casa blanca es muy grande",
        translation: "The white house is very big",
        explanation: "Correct noun-adjective agreement in gender and number"
      },
      {
        text: "Yo hablo español todos los días",
        translation: "I speak Spanish every day",
        explanation: "Correct 1st person singular present tense"
      }
    ],
    incorrect: [
      {
        text: "El casa blanco",
        error: "Wrong gender agreement",
        correction: "La casa blanca",
        explanation: "Casa is feminine, so articles and adjectives must agree"
      },
      {
        text: "Yo hablas español",
        error: "Wrong verb conjugation",
        correction: "Yo hablo español",
        explanation: "1st person singular should use 'hablo' not 'hablas'"
      }
    ]
  }
};