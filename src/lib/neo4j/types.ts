export interface User {
  id: string;
  createdAt?: number;
}

export interface Language {
  code: string;
  name?: string;
}

export interface Lexeme {
  lemma: string;
  pos: string;
  language: string;
  createdAt?: number;
}

export interface FormStatistics {
  encounters: number;        // times this form was encountered
  correct: number;           // times used correctly
  successRate: number;       // correct/encounters
  commonErrors?: string[];   // frequent error patterns for this form
  morphFeatures?: {          // morphological features of this form
    person?: string;
    number?: string;
    case?: string;
    gender?: string;
    tense?: string;
    aspect?: string;
    mood?: string;
  };
  lastSeen?: number;         // timestamp of last encounter
}

export interface LearningProgress {
  userId: string;            // User ID for data integrity
  srsLevel: number;          // 1-5 (Leitner box level) - overall word mastery
  lastSeen: number;          // timestamp
  overallSuccessRate: number; // 0.0-1.0 - weighted average across all forms
  nextReview: string;        // ISO date string
  totalEncounters: number;   // total times encountered (sum across forms)
  correctUses: number;       // total correct uses (sum across forms)
  active: boolean;           // actively being learned
  formStats: Record<string, FormStatistics>; // form -> statistics mapping
  weakestForms?: string[];   // forms with lowest success rates
  createdAt?: number;
  updatedAt?: number;
}

export interface LearningEvent {
  userId: string;
  language: string;
  sessionId?: string;
  timestamp: number;
  lexemes: LexemeAnalysis[];
  grammarHints?: string[];
}

export interface LexemeAnalysis {
  lemma: string;
  form: string;
  pos: string;
  known: boolean;
  confidence: number;        // 0.0-1.0 (WSD/GPT certainty)
  performance: PerformanceType;
}

export type PerformanceType = 'introduced' | 'correct_use' | 'wrong_use' | 'recall_fail';

export interface ReviewItem {
  lemma: string;
  pos: string;
  srsLevel: number;
  successRate: number;
  nextReview: string;
  daysSinceLastSeen: number;
}

export interface UserProgressSummary {
  userId: string;
  language: string;
  totalWords: number;
  knownWords: number;
  reviewDue: number;
  averageSuccessRate: number;
  lastActivity?: number;
  // Form-specific insights from embedded statistics
  totalFormsTracked: number;   // total number of unique forms encountered
  formsWithIssues: number;     // forms with success rate < 0.7
  commonErrorPatterns: string[]; // frequent error types across all words
}