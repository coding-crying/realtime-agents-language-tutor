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
  form: string;
  feats?: string;
}

export interface LearningProgress {
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
}