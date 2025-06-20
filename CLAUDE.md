# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js application demonstrating advanced voice agents using the OpenAI Realtime API and Agents SDK. The project has been extended with a **Language Tutor** agent that provides intelligent Russian language learning through spaced repetition system (SRS) backed by Neo4j graph database.

## Core Architecture

### Agent Configuration System
- **Primary Agent**: `languageTutor` (Russian language tutor) - located in `src/app/agentConfigs/languageTutor/`
- **Dual Supervisor Pattern**: 
  - Language Tutor Supervisor (`languageTutorSupervisor.ts`) - handles conversation intelligence and tutoring decisions
  - Learning Analysis Supervisor (`learningSupervisor.ts`) - analyzes vocabulary usage and updates SRS data
- **Example Agents**: `chatSupervisor`, `customerServiceRetail`, `simpleHandoff` (for reference only)

### Language Learning Stack
- **Neo4j Graph Database**: Stores vocabulary progress with SRS intervals using Leitner box system
- **Spaced Repetition System**: Tracks user vocabulary through 5 SRS levels with exponential intervals (1, 2, 4, 8, 16 days)
- **Background Processing**: Bull/Redis queue system for asynchronous learning event processing
- **Vocabulary Tracking**: Lexemes with performance metrics (introduced, correct_use, wrong_use, recall_fail)

### Database Schema (Neo4j)
```
(:User)-[:HAS_PROGRESS]->(:LearningProgress)-[:ABOUT]->(:Lexeme:RU)
```
- Users have learning progress relationships to Russian lexemes
- Progress includes SRS level, success rate, next review date
- Supports user isolation and multi-language expansion

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Start production server
npm start
```

## Environment Setup

Required environment variables in `.env`:
```bash
OPENAI_API_KEY=your_openai_api_key
NEO4J_URI=neo4j://127.0.0.1:7687  # or AuraDB URI
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password
NEO4J_DATABASE=neo4j
REDIS_URL=redis://localhost:6379
```

## Database Management

### Neo4j Operations
```bash
# Test connection
curl -X POST http://localhost:3000/api/neo4j/init -H "Content-Type: application/json" -d '{"action": "test"}'

# Initialize schema and sample data
curl -X POST http://localhost:3000/api/neo4j/init -H "Content-Type: application/json" -d '{"action": "full"}'

# Test learning system
curl -X POST http://localhost:3000/api/test-neo4j
```

### Learning Analytics APIs
- `GET /api/learning/progress?userId=demo-user&language=ru` - User progress summary
- `GET /api/learning/known-words?userId=demo-user&language=ru&minLevel=3` - Known vocabulary
- `GET /api/learning/review-due?userId=demo-user&language=ru` - Words due for review
- `GET /api/queue/status` - Background queue health

## Key Implementation Details

### Language Tutor Agent (`src/app/agentConfigs/languageTutor/`)
- **Realtime Agent**: Uses `gpt-4o-realtime-mini` for natural conversation
- **Supervisor Integration**: Leverages `gpt-4.1` for complex decisions and SRS data
- **Russian Focus**: Specifically configured for Russian language learning with Cyrillic script support
- **Tools**: Vocabulary management, learning analysis, progress tracking

### SRS System (`src/lib/neo4j/srs.ts`)
- **Leitner Box Algorithm**: 5-level system with exponential intervals
- **Performance Types**: introduced, correct_use, wrong_use, recall_fail
- **Progress Tracking**: Success rates, encounter counts, next review scheduling
- **User Isolation**: Each user has independent vocabulary progress

### Background Processing (`src/lib/queue/learningQueue.ts`)
- **Bull Queue**: Redis-backed job processing for learning analysis
- **Async Processing**: Vocabulary analysis happens after conversation turns
- **Error Handling**: Retry logic with exponential backoff
- **Job Types**: Turn analysis, vocabulary extraction, progress updates

## Testing Language Learning System

1. **Start Prerequisites**: Ensure Neo4j and Redis are running locally
2. **Initialize Database**: Run full schema initialization
3. **Select Language Tutor**: Use scenario dropdown in UI
4. **Test Conversation**: Speak Russian phrases to trigger vocabulary tracking
5. **Monitor Progress**: Check learning APIs for vocabulary updates

## Development Rules

### Git Commits
- **Never include AI attribution in commit messages** - keep commits clean and professional
- Use standard commit message format: brief description of changes
- Focus on what was changed, not who/what made the change

## Common Issues

- **Neo4j Connection**: Ensure local Neo4j instance is running with correct credentials
- **Queue Timeout**: Redis must be running for background processing
- **Progress API Errors**: New users may have empty progress until first learning events

## File Structure Notes

- Agent configs are in `src/app/agentConfigs/` - only `languageTutor` is actively used
- Neo4j integration is in `src/lib/neo4j/` - driver, schema, SRS logic, types
- Queue system is in `src/lib/queue/` - Bull/Redis configuration
- Learning APIs are in `src/app/api/learning/` - progress, vocabulary, reviews