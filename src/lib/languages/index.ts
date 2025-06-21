import { LanguageConfig, MorphologicalPattern } from './types';
import { russianConfig } from './russian';
import { spanishConfig } from './spanish';

// Registry of all supported languages
export const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  ru: russianConfig,
  es: spanishConfig,
};

// Default language
export const DEFAULT_LANGUAGE = 'ru';

/**
 * Get language configuration by code
 */
export function getLanguageConfig(languageCode: string): LanguageConfig {
  const config = SUPPORTED_LANGUAGES[languageCode];
  if (!config) {
    console.warn(`Language ${languageCode} not supported, falling back to ${DEFAULT_LANGUAGE}`);
    return SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];
  }
  return config;
}

/**
 * Extract morphological features for a given language
 */
export function extractMorphFeatures(
  lemma: string, 
  form: string, 
  pos: string, 
  languageCode: string
): any {
  const config = getLanguageConfig(languageCode);
  const features: any = {};
  
  // Get patterns for the part of speech
  let patterns: MorphologicalPattern[] = [];
  switch (pos.toLowerCase()) {
    case 'verb':
      patterns = config.morphology.verbs;
      break;
    case 'noun':
      patterns = config.morphology.nouns;
      break;
    case 'adj':
    case 'adjective':
      patterns = config.morphology.adjectives;
      break;
    case 'pron':
    case 'pronoun':
      patterns = config.morphology.pronouns || [];
      break;
    default:
      return features;
  }
  
  // Apply patterns to extract features
  for (const pattern of patterns) {
    let matches = false;
    
    if (pattern.pattern instanceof RegExp) {
      matches = pattern.pattern.test(form);
    } else {
      matches = form.endsWith(pattern.pattern);
    }
    
    if (matches) {
      Object.assign(features, pattern.features);
      // Return on first match to avoid conflicts
      // In a more sophisticated system, you'd handle pattern precedence
      break;
    }
  }
  
  return features;
}

/**
 * Get list of all supported language codes
 */
export function getSupportedLanguageCodes(): string[] {
  return Object.keys(SUPPORTED_LANGUAGES);
}

/**
 * Get list of all supported languages with metadata
 */
export function getSupportedLanguages(): Array<{code: string, name: string, nativeName: string}> {
  return Object.values(SUPPORTED_LANGUAGES).map(config => ({
    code: config.code,
    name: config.name,
    nativeName: config.nativeName
  }));
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(languageCode: string): boolean {
  return languageCode in SUPPORTED_LANGUAGES;
}