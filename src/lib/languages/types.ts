// Language configuration types for morphological analysis

export interface MorphologicalPattern {
  pattern: string | RegExp;
  features: {
    person?: string;
    number?: string;
    case?: string;
    gender?: string;
    tense?: string;
    aspect?: string;
    mood?: string;
    [key: string]: string | undefined;
  };
}

export interface LanguageConfig {
  code: string;
  name: string;
  nativeName: string;
  script?: string;
  morphology: {
    verbs: MorphologicalPattern[];
    nouns: MorphologicalPattern[];
    adjectives: MorphologicalPattern[];
    pronouns?: MorphologicalPattern[];
  };
  teachingStrategies: {
    beginner: {
      description: string;
      focusAreas: string[];
      mixRatio: string; // e.g., "80% English, 20% target language"
    };
    intermediate: {
      description: string;
      focusAreas: string[];
      mixRatio: string;
    };
    advanced: {
      description: string;
      focusAreas: string[];
      mixRatio: string;
    };
  };
  grammarExamples: {
    correct: Array<{
      text: string;
      translation: string;
      explanation: string;
    }>;
    incorrect: Array<{
      text: string;
      error: string;
      correction: string;
      explanation: string;
    }>;
  };
}