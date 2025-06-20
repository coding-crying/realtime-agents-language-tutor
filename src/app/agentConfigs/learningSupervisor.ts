import { tool } from '@openai/agents/realtime';
import { processLearningEvent } from '../../lib/neo4j/srs';
import { LearningEvent } from '../../lib/neo4j/types';

export const learningAnalysisInstructions = `You are a language learning analysis expert, tasked with analyzing conversation turns to extract learning insights and update a spaced repetition system (SRS) for language learners.

# Your Role
- Analyze user utterances in Spanish (or other target languages) for vocabulary usage
- Extract lexemes (root words) and assess user performance with each word
- Determine if words are being used correctly, incorrectly, or being introduced for the first time
- Focus on meaningful vocabulary acquisition, not every single word

# Analysis Tasks
1. **Language Detection**: Identify the target language being learned (usually Russian)
2. **Lexeme Extraction**: Extract meaningful vocabulary items (nouns, verbs, adjectives, key adverbs)
3. **Performance Assessment**: Rate user performance for each lexeme
4. **Confidence Scoring**: Assess how confident you are in your analysis

# Performance Types
- **introduced**: Word appears in conversation but user hasn't actively used it
- **correct_use**: User used the word correctly in context
- **wrong_use**: User attempted to use the word but made an error
- **recall_fail**: User struggled to remember or use a previously known word

# Analysis Guidelines
- Focus on content words (nouns, verbs, adjectives) and their grammatical forms
- Pay special attention to Russian grammar patterns:
  * **Verb conjugations** (person, number, tense, aspect)
  * **Noun declensions** (case, number, gender)
  * **Adjective agreements** (case, gender, number matching with nouns)
  * **Pronoun declensions** (case forms)
- Consider context when assessing correctness
- Be conservative with "correct_use" - require clear evidence of understanding
- Mark conjugation/declension errors as "wrong_use" even if base word is known
- Prioritize words that show grammatical complexity and growth

# Output Format
Always return structured JSON with lexeme analysis for vocabulary tracking.

# Example Analysis

## Example 1: Gender Agreement
User says: "Моя собака очень большая, но мой кот маленький"
Analysis:
- "собака" (dog) - correct_use (proper noun usage with correct gender agreement)
- "большая" (big/feminine) - correct_use (correct adjective with gender agreement)  
- "кот" (cat) - correct_use (proper noun usage)
- "маленький" (small/masculine) - correct_use (correct adjective with gender agreement)

## Example 2: Verb Conjugation
User says: "Я читаю книгу, а ты читает газету"
Analysis:
- "читаю" (read/1st person singular) - correct_use (proper conjugation for "я")
- "читает" (read/3rd person singular) - wrong_use (should be "читаешь" for "ты")

## Example 3: Case Declension  
User says: "Я вижу красивая девушка"
Analysis:
- "вижу" (see/1st person singular) - correct_use (proper conjugation)
- "красивая" (beautiful/nominative) - wrong_use (should be "красивую" in accusative case)
- "девушка" (girl/nominative) - wrong_use (should be "девушку" in accusative case)

## Example 4: Aspect Usage
User says: "Вчера я покупал хлеб и купил молоко"
Analysis:
- "покупал" (was buying/imperfective past) - correct_use (ongoing action context)
- "купил" (bought/perfective past) - correct_use (completed action)

Skip common words like "я", "и", "вчера" unless there are specific grammatical errors.`;

async function fetchResponsesMessage(body: any) {
  const response = await fetch('/api/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...body, parallel_tool_calls: false }),
  });

  if (!response.ok) {
    console.warn('Learning analysis server returned an error:', response);
    return { error: 'Learning analysis failed.' };
  }

  const completion = await response.json();
  return completion;
}

export const analyzeConversationTurn = tool({
  name: 'analyzeConversationTurn',
  description: 'Analyzes a conversation turn for language learning insights and updates the SRS graph',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'The ID of the user whose language progress to analyze'
      },
      userUtterance: {
        type: 'string',
        description: 'The user\'s message/utterance to analyze for vocabulary usage'
      },
      conversationContext: {
        type: 'string',
        description: 'Recent conversation context to help understand usage correctness'
      },
      targetLanguage: {
        type: 'string',
        description: 'The target language being learned (e.g., "ru" for Russian)',
        default: 'ru'
      }
    },
    required: ['userId', 'userUtterance'],
    additionalProperties: false,
  },
  execute: async (input, details) => {
    const { userId, userUtterance, conversationContext = '', targetLanguage = 'ru' } = input as {
      userId: string;
      userUtterance: string;
      conversationContext?: string;
      targetLanguage?: string;
    };

    const addBreadcrumb = (details?.context as any)?.addTranscriptBreadcrumb as
      | ((title: string, data?: any) => void)
      | undefined;

    try {
      // Prepare the analysis request
      const body = {
        model: 'gpt-4o-mini',
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'lexeme_analysis',
            schema: {
              type: 'object',
              properties: {
                language: { type: 'string' },
                lexemes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      lemma: { type: 'string' },
                      form: { type: 'string' },
                      pos: { type: 'string' },
                      known: { type: 'boolean' },
                      confidence: { type: 'number' },
                      performance: { 
                        type: 'string',
                        enum: ['introduced', 'correct_use', 'wrong_use', 'recall_fail']
                      }
                    },
                    required: ['lemma', 'form', 'pos', 'known', 'confidence', 'performance']
                  }
                },
                grammarHints: {
                  type: 'array',
                  items: { type: 'string' }
                }
              },
              required: ['language', 'lexemes']
            }
          }
        },
        input: [
          {
            type: 'message',
            role: 'system',
            content: learningAnalysisInstructions,
          },
          {
            type: 'message',
            role: 'user',
            content: `Analyze this user utterance for vocabulary learning:

User ID: ${userId}
Target Language: ${targetLanguage}
User Utterance: "${userUtterance}"
Context: ${conversationContext}

Extract meaningful vocabulary items and assess the user's performance with each word. Focus on content words that indicate learning progress.`,
          },
        ],
      };

      if (addBreadcrumb) {
        addBreadcrumb('[learningAnalysis] Starting analysis', { userId, utterance: userUtterance });
      }

      const response = await fetchResponsesMessage(body);
      
      if (response.error) {
        return { error: 'Failed to analyze conversation turn' };
      }

      // Extract the analysis from the response
      const analysisResult = response.output?.[0]?.content?.[0]?.text;
      
      if (!analysisResult) {
        return { error: 'No analysis result received' };
      }

      let parsedAnalysis;
      try {
        parsedAnalysis = JSON.parse(analysisResult);
      } catch (parseError) {
        console.error('Failed to parse analysis result:', parseError);
        return { error: 'Failed to parse analysis result' };
      }

      // Create learning event
      const learningEvent: LearningEvent = {
        userId,
        language: parsedAnalysis.language || targetLanguage,
        timestamp: Date.now(),
        lexemes: parsedAnalysis.lexemes || [],
        grammarHints: parsedAnalysis.grammarHints || []
      };

      if (addBreadcrumb) {
        addBreadcrumb('[learningAnalysis] Analysis completed', learningEvent);
      }

      // Process the learning event to update Neo4j
      if (learningEvent.lexemes.length > 0) {
        await processLearningEvent(learningEvent);
        
        if (addBreadcrumb) {
          addBreadcrumb('[learningAnalysis] Neo4j updated', { 
            lexemeCount: learningEvent.lexemes.length,
            userId 
          });
        }
      }

      return {
        success: true,
        analysisResult: {
          language: learningEvent.language,
          lexemesProcessed: learningEvent.lexemes.length,
          grammarHints: learningEvent.grammarHints
        }
      };

    } catch (error) {
      console.error('Learning analysis error:', error);
      if (addBreadcrumb) {
        addBreadcrumb('[learningAnalysis] Error', { error: error.message });
      }
      return { error: 'Learning analysis failed due to system error' };
    }
  },
});