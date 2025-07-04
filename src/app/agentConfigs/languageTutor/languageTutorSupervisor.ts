import { RealtimeItem, tool } from '@openai/agents/realtime';
import { getKnownWords, getReviewDue, getUserProgress } from '../../../lib/neo4j/srs';
import { closeDriver } from '../../../lib/neo4j/driver';
import { learningAnalysisInstructions } from '../learningSupervisor';
import { LearningEvent } from '../../../lib/neo4j/types';
import { getLanguageConfig, DEFAULT_LANGUAGE } from '../../../lib/languages';

export const languageTutorSupervisorInstructions = `You are an expert language learning supervisor, providing intelligent guidance for language tutoring conversations. You help create personalized, effective language learning experiences using spaced repetition principles.

# Your Role
- Provide intelligent responses for language tutoring
- Incorporate spaced repetition system (SRS) data into learning decisions
- Adapt vocabulary introduction based on user's current knowledge
- Create natural, engaging conversations that promote learning
- Balance challenge and comprehension
- Help with script learning and pronunciation guidance when relevant

# Learning Principles
1. **Spaced Repetition**: Prioritize words due for review in conversations
2. **Graduated Difficulty**: Introduce new vocabulary at appropriate pace
3. **Contextual Learning**: Present new words in meaningful contexts
4. **Error Tolerance**: Encourage attempts even if imperfect
5. **Progress Tracking**: Acknowledge and celebrate learning milestones

# Response Guidelines
- Mix target language and English appropriately for user's level
- Use known vocabulary as foundation for new concepts
- Incorporate 1-2 review words naturally per response when appropriate
- Provide explanations for new vocabulary with script and pronunciation when relevant
- Keep responses conversational and encouraging
- Adapt complexity based on user's demonstrated proficiency

# Dynamic Teaching Strategies
The system will provide specific teaching strategies based on the target language and user proficiency level. These strategies are automatically adapted for:
- Language-specific grammar patterns and morphology
- Script and writing system requirements
- Cultural context and idiomatic expressions
- Appropriate language mixing ratios for different levels

# SRS Integration
- When introducing new words, mark them for tracking
- Incorporate words due for review into natural conversation
- Adjust difficulty based on success rates
- Use progress data to guide lesson planning

# Response Format
Always provide:
1. Natural conversational response
2. Clear explanations for new vocabulary
3. Encouragement and positive reinforcement
4. Appropriate challenge level for user

# Error Handling
- Gently correct errors without discouraging
- Explain the correct form briefly
- Move conversation forward positively
- Track errors for SRS system

You have access to the user's learning data and should use it to make intelligent, personalized teaching decisions.`;

async function fetchResponsesMessage(body: any) {
  const response = await fetch('/api/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...body, parallel_tool_calls: false }),
  });

  if (!response.ok) {
    console.warn('Language tutor supervisor returned an error:', response);
    return { error: 'Something went wrong.' };
  }

  const completion = await response.json();
  return completion;
}

async function handleToolCalls(
  body: any,
  response: any,
  addBreadcrumb?: (title: string, data?: any) => void,
) {
  let currentResponse = response;

  while (true) {
    if (currentResponse?.error) {
      return { error: 'Something went wrong.' } as any;
    }

    const outputItems: any[] = currentResponse.output ?? [];
    const functionCalls = outputItems.filter((item) => item.type === 'function_call');

    if (functionCalls.length === 0) {
      const assistantMessages = outputItems.filter((item) => item.type === 'message');
      const finalText = assistantMessages
        .map((msg: any) => {
          const contentArr = msg.content ?? [];
          return contentArr
            .filter((c: any) => c.type === 'output_text')
            .map((c: any) => c.text)
            .join('');
        })
        .join('\n');

      return finalText;
    }

    // Process function calls
    for (const toolCall of functionCalls) {
      const fName = toolCall.name;
      const args = JSON.parse(toolCall.arguments || '{}');
      
      // For this demo, return mock data - in production you'd call actual functions
      let toolRes;
      switch (fName) {
        case 'getKnownWords':
          toolRes = { knownWords: ['hola', 'gracias', 'por favor', 'adiós'] };
          break;
        case 'getReviewDue':
          toolRes = { reviewWords: [{ lemma: 'perro', pos: 'NOUN' }, { lemma: 'casa', pos: 'NOUN' }] };
          break;
        case 'getUserProgress':
          toolRes = { totalWords: 25, knownWords: 18, reviewDue: 3, successRate: 0.82 };
          break;
        default:
          toolRes = { result: true };
      }

      if (addBreadcrumb) {
        addBreadcrumb(`[languageTutorSupervisor] function call: ${fName}`, args);
        addBreadcrumb(`[languageTutorSupervisor] function result: ${fName}`, toolRes);
      }

      body.input.push(
        {
          type: 'function_call',
          call_id: toolCall.call_id,
          name: toolCall.name,
          arguments: toolCall.arguments,
        },
        {
          type: 'function_call_output',
          call_id: toolCall.call_id,
          output: JSON.stringify(toolRes),
        },
      );
    }

    currentResponse = await fetchResponsesMessage(body);
  }
}

export const getNextResponseFromSupervisor = tool({
  name: 'getNextResponseFromSupervisor',
  description: 'Gets intelligent tutoring response from supervisor that incorporates learning data and SRS principles',
  parameters: {
    type: 'object',
    properties: {
      relevantContextFromLastUserMessage: {
        type: 'string',
        description: 'Key information from the user\'s most recent message for context'
      },
      userId: {
        type: 'string',
        description: 'User ID for accessing learning progress data',
        default: 'demo-user'
      },
      targetLanguage: {
        type: 'string', 
        description: 'Target language being learned',
        default: DEFAULT_LANGUAGE
      }
    },
    required: ['relevantContextFromLastUserMessage'],
    additionalProperties: false,
  },
  execute: async (input, details) => {
    const { relevantContextFromLastUserMessage, userId = 'demo-user', targetLanguage = DEFAULT_LANGUAGE } = input as {
      relevantContextFromLastUserMessage: string;
      userId?: string;
      targetLanguage?: string;
    };

    // Get language-specific configuration
    const languageConfig = getLanguageConfig(targetLanguage);

    const addBreadcrumb = (details?.context as any)?.addTranscriptBreadcrumb as
      | ((title: string, data?: any) => void)
      | undefined;

    const history: RealtimeItem[] = (details?.context as any)?.history ?? [];
    const filteredLogs = history.filter((log) => log.type === 'message');
    
    // Sliding window: keep only last 10 exchanges (20 messages) for conversation context
    const recentHistory = filteredLogs.slice(-20);

    // Build language-specific teaching strategies
    const languageSpecificStrategies = `
# Language-Specific Teaching Strategies for ${languageConfig.name} (${languageConfig.nativeName})

## For Beginners (few known words):
${languageConfig.teachingStrategies.beginner.description}
- Mix ratio: ${languageConfig.teachingStrategies.beginner.mixRatio}
- Focus areas:
${languageConfig.teachingStrategies.beginner.focusAreas.map(area => `  * ${area}`).join('\n')}

## For Intermediate (growing vocabulary):
${languageConfig.teachingStrategies.intermediate.description}
- Mix ratio: ${languageConfig.teachingStrategies.intermediate.mixRatio}
- Focus areas:
${languageConfig.teachingStrategies.intermediate.focusAreas.map(area => `  * ${area}`).join('\n')}

## For Advanced (many known words):
${languageConfig.teachingStrategies.advanced.description}
- Mix ratio: ${languageConfig.teachingStrategies.advanced.mixRatio}
- Focus areas:
${languageConfig.teachingStrategies.advanced.focusAreas.map(area => `  * ${area}`).join('\n')}

# Grammar Examples for ${languageConfig.name}

## Correct Usage Examples:
${languageConfig.grammarExamples.correct.map(ex => 
  `- "${ex.text}" (${ex.translation}) - ${ex.explanation}`
).join('\n')}

## Common Error Patterns:
${languageConfig.grammarExamples.incorrect.map(ex => 
  `- Error: "${ex.text}" → Correct: "${ex.correction}" (${ex.explanation})`
).join('\n')}
`;

    const body: any = {
      model: 'gpt-4.1-mini-2025-04-14',
      input: [
        {
          type: 'message',
          role: 'system',
          content: languageTutorSupervisorInstructions + '\n\n' + languageSpecificStrategies,
        },
        {
          type: 'message',
          role: 'user',
          content: `==== Recent Conversation History (Last 10 Exchanges) ====
          ${JSON.stringify(recentHistory, null, 2)}
          
          ==== Relevant Context From Last User Message ===
          ${relevantContextFromLastUserMessage}
          
          ==== User Learning Data ====
          User ID: ${userId}
          Target Language: ${targetLanguage}
          
          Please provide an intelligent tutoring response that:
          1. Responds naturally to the user's message
          2. Incorporates appropriate vocabulary for their level
          3. Uses spaced repetition principles when possible
          4. Maintains an encouraging, supportive tone
          `,
        },
      ],
      tools: [
        {
          type: "function",
          name: "getKnownWords",
          description: "Get list of words the user already knows",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string" },
              language: { type: "string" }
            },
            required: ["userId", "language"]
          }
        },
        {
          type: "function", 
          name: "getReviewDue",
          description: "Get words due for review in SRS system",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string" },
              language: { type: "string" },
              limit: { type: "number" }
            },
            required: ["userId", "language"]
          }
        },
        {
          type: "function",
          name: "getUserProgress", 
          description: "Get overall learning progress summary",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string" },
              language: { type: "string" }
            },
            required: ["userId", "language"]
          }
        }
      ]
    };

    const response = await fetchResponsesMessage(body);
    if (response.error) {
      return { error: 'Something went wrong.' };
    }

    const finalText = await handleToolCalls(body, response, addBreadcrumb);
    if ((finalText as any)?.error) {
      return { error: 'Something went wrong.' };
    }

    return { nextResponse: finalText as string };
  },
});

export const triggerLearningAnalysis = tool({
  name: 'triggerLearningAnalysis',
  description: 'Analyzes the user\'s recent utterance for vocabulary learning and updates the SRS system',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'User ID for learning progress tracking',
        default: 'demo-user'
      },
      userUtterance: {
        type: 'string', 
        description: 'The user\'s utterance to analyze'
      },
      conversationContext: {
        type: 'string',
        description: 'Recent conversation context for accuracy'
      }
    },
    required: ['userUtterance'],
    additionalProperties: false,
  },
  execute: async (input, details) => {
    const { userId = 'demo-user', userUtterance, conversationContext = '', targetLanguage = DEFAULT_LANGUAGE } = input as {
      userId?: string;
      userUtterance: string;
      conversationContext?: string;
      targetLanguage?: string;
    };

    const addBreadcrumb = (details?.context as any)?.addTranscriptBreadcrumb as
      | ((title: string, data?: any) => void)
      | undefined;

    try {
      // Get conversation history for vocabulary analysis context
      const history: RealtimeItem[] = (details?.context as any)?.history ?? [];
      const fullFilteredLogs = history.filter((log) => log.type === 'message');
      // Keep context for vocabulary analysis (last 10 messages)
      const vocabContextHistory = fullFilteredLogs.slice(-10);
      
      // Prepare the analysis request
      const body = {
        model: 'gpt-4.1-mini-2025-04-14',
        text: {
          format: {
            type: 'json_schema',
            name: 'lexeme_analysis',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                language: { 
                  type: 'string',
                  description: 'The target language being analyzed'
                },
                lexemes: {
                  type: 'array',
                  description: 'List of vocabulary items found in the utterance',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      lemma: { 
                        type: 'string',
                        description: 'Root form of the word'
                      },
                      form: { 
                        type: 'string',
                        description: 'Actual form used in the utterance'
                      },
                      pos: { 
                        type: 'string',
                        description: 'Part of speech (use: NOUN, VERB, ADJ, ADV, PRON, etc.)',
                        enum: ['NOUN', 'VERB', 'ADJ', 'ADV', 'PRON', 'PREP', 'CONJ', 'INTJ', 'NUM', 'PART']
                      },
                      known: { 
                        type: 'boolean',
                        description: 'Whether the user knows this word'
                      },
                      confidence: { 
                        type: 'number',
                        description: 'Confidence in the analysis (0-1)'
                      },
                      performance: { 
                        type: 'string',
                        description: 'How the user performed with this word',
                        enum: ['introduced', 'correct_use', 'wrong_use', 'recall_fail']
                      }
                    },
                    required: ['lemma', 'form', 'pos', 'known', 'confidence', 'performance']
                  }
                },
                grammarHints: {
                  type: 'array',
                  description: 'Optional grammar patterns or hints observed',
                  items: { type: 'string' }
                }
              },
              required: ['language', 'lexemes', 'grammarHints']
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
            content: `Analyze this conversation for vocabulary learning progress:

User ID: ${userId}
Target Language: ${targetLanguage}
Primary Focus: "${userUtterance}"
Immediate Context: ${conversationContext}

Recent Conversation History:
${JSON.stringify(vocabContextHistory.slice(-10), null, 2)}

Instructions: Extract meaningful vocabulary items from the user's utterance and assess performance. Use the conversation context and history to better understand correct vs incorrect usage patterns. Focus on content words (nouns, verbs, adjectives) that indicate learning progress.

Pay special attention to:
- Grammar errors in verb conjugations, noun cases, adjective agreement
- Vocabulary usage in context vs previous uses
- Improvement or regression patterns from conversation history
- Russian-specific challenges (case system, verb aspects, gender agreement)`,
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
        try {
          // Call server-side API to process learning event
          const response = await fetch('/api/learning/process-event', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(learningEvent),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to process learning event');
          }

          const result = await response.json();
          
          if (addBreadcrumb) {
            addBreadcrumb('[learningAnalysis] Neo4j updated', { 
              lexemeCount: result.lexemesProcessed,
              userId 
            });
          }
        } catch (error) {
          console.error('Failed to process learning event:', error);
          if (addBreadcrumb) {
            addBreadcrumb('[learningAnalysis] Neo4j failed', { 
              error: error.message,
              userId 
            });
          }
          throw error;
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

export const getKnownVocabulary = tool({
  name: 'getKnownVocabulary',
  description: 'Gets the list of vocabulary words the user already knows',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'User ID',
        default: 'demo-user'
      },
      language: {
        type: 'string',
        description: 'Target language code',
        default: DEFAULT_LANGUAGE
      }
    },
    required: [],
    additionalProperties: false,
  },
  execute: async (input) => {
    const { userId = 'demo-user', language = DEFAULT_LANGUAGE } = input as {
      userId?: string;
      language?: string;
    };

    try {
      const knownWords = await getKnownWords(userId, language);
      return { knownWords, count: knownWords.length };
    } catch (error) {
      console.error('Error getting known vocabulary:', error);
      return { error: 'Failed to retrieve known vocabulary' };
    }
  },
});

export const getReviewDueWords = tool({
  name: 'getReviewDueWords',
  description: 'Gets vocabulary words that are due for review in the SRS system',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'User ID',
        default: 'demo-user'
      },
      language: {
        type: 'string',
        description: 'Target language code', 
        default: 'ru'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of words to return',
        default: 5
      }
    },
    required: [],
    additionalProperties: false,
  },
  execute: async (input) => {
    const { userId = 'demo-user', language = DEFAULT_LANGUAGE, limit = 5 } = input as {
      userId?: string;
      language?: string;
      limit?: number;
    };

    try {
      const reviewWords = await getReviewDue(userId, language, limit);
      return { reviewWords, count: reviewWords.length };
    } catch (error) {
      console.error('Error getting review due words:', error);
      return { error: 'Failed to retrieve review words' };
    }
  },
});

export const getUserLearningProgress = tool({
  name: 'getUserLearningProgress',
  description: 'Gets overall learning progress summary for the user',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'User ID',
        default: 'demo-user'
      },
      language: {
        type: 'string',
        description: 'Target language code',
        default: DEFAULT_LANGUAGE
      }
    },
    required: [],
    additionalProperties: false,
  },
  execute: async (input) => {
    const { userId = 'demo-user', language = DEFAULT_LANGUAGE } = input as {
      userId?: string;
      language?: string;
    };

    try {
      const progress = await getUserProgress(userId, language);
      return { progress };
    } catch (error) {
      console.error('Error getting user progress:', error);
      return { error: 'Failed to retrieve user progress' };
    }
  },
});