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

export interface Form {
  form: string;              // e.g., "читаю", "дома", "красивая"
  lemma: string;             // base form this derives from
  language: string;          // e.g., "ru"
  pos: string;               // part of speech
  feats?: string;            // Universal Dependencies format: "Person=1|Number=Sing|Tense=Pres"
  person?: string;           // for verbs: "1", "2", "3"
  number?: string;           // "sing", "plur"
  case?: string;             // for nouns/adjectives: "nom", "acc", "gen", etc.
  gender?: string;           // for nouns/adjectives: "masc", "fem", "neut"
  tense?: string;            // for verbs: "pres", "past", "fut"
  aspect?: string;           // for verbs: "perf", "imperf"
  mood?: string;             // for verbs: "ind", "imp", "subj"
  createdAt?: number;
}

export interface FormProgress {
  userId: string;            // User ID for data integrity
  srsLevel: number;          // 1-5 (Leitner box level) for this specific form
  lastSeen: number;          // timestamp
  successRate: number;       // 0.0-1.0
  nextReview: string;        // ISO date string
  totalEncounters: number;   // total times encountered
  correctUses: number;       // number of correct uses
  active: boolean;           // actively being learned
  createdAt?: number;
  updatedAt?: number;
}

export interface LearningProgress {
  userId: string;            // User ID for data integrity
  srsLevel: number;          // 1-5 (Leitner box level)
  lastSeen: number;          // timestamp
  successRate: number;       // 0.0-1.0
  nextReview: string;        // ISO date string
  totalEncounters: number;   // total times encountered
  correctUses: number;       // number of correct uses
  active: boolean;           // actively being learned
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
  // Form-level statistics
  totalForms: number;
  knownForms: number;
  formReviewDue: number;
}