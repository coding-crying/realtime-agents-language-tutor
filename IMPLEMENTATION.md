# Neo4j Language Learning Integration - Implementation Guide

## Overview

This implementation adds Neo4j-backed spaced repetition system (SRS) capabilities to the OpenAI Realtime Agents demo, creating an intelligent language learning tutor that tracks vocabulary progress and adapts instruction accordingly.

## Architecture

### Dual-Supervisor Pattern

The system uses two supervisor agents working together:

1. **Language Tutor Supervisor** (`src/app/agentConfigs/languageTutor/languageTutorSupervisor.ts`)
   - Handles conversation intelligence and tutoring decisions
   - Incorporates SRS data into natural conversation flow
   - Uses learning analytics to adapt instruction

2. **Learning Analysis Supervisor** (`src/app/agentConfigs/learningSupervisor.ts`)
   - Analyzes user utterances for vocabulary usage
   - Extracts lexemes and assesses performance
   - Updates Neo4j graph with learning progress

### Core Components

```
┌─────────────────────────┐
│ Language Tutor Agent    │ ← Real-time conversation
│ (gpt-4o-realtime-mini)  │
└─────────────┬───────────┘
              │
┌─────────────▼───────────┐
│ Language Tutor          │ ← Intelligent responses
│ Supervisor (gpt-4.1)    │   + SRS integration
└─────────────┬───────────┘
              │
┌─────────────▼───────────┐
│ Learning Analysis       │ ← Background NLP
│ Supervisor (gpt-4o-mini)│   + vocabulary tracking
└─────────────┬───────────┘
              │
┌─────────────▼───────────┐
│ Neo4j Graph Database    │ ← SRS storage
│ + Bull Queue System     │   + background processing
└─────────────────────────┘
```

## Database Schema

### Neo4j Graph Structure

```cypher
(:User {id})
(:Lexeme:ES {lemma, pos, language, createdAt})
(:LearningProgress {
    srsLevel,       // 1-5 (Leitner box level)
    lastSeen,       // timestamp
    successRate,    // 0.0-1.0
    nextReview,     // ISO date string
    totalEncounters,// total times seen
    correctUses,    // successful uses
    active,         // currently learning
    createdAt,
    updatedAt
})

// Relationships
(User)-[:HAS_PROGRESS]->(LearningProgress)-[:ABOUT]->(Lexeme)
```

### SRS Algorithm

Uses Leitner box system with exponential intervals:
- Level 1: 1 day
- Level 2: 2 days  
- Level 3: 4 days
- Level 4: 8 days
- Level 5: 16 days

Performance assessment affects level transitions:
- `correct_use`: Advance to next level (max 5)
- `wrong_use`/`recall_fail`: Reset to level 1
- `introduced`: Start at level 1

## File Structure

```
src/
├── lib/
│   ├── neo4j/
│   │   ├── driver.ts          # Neo4j connection management
│   │   ├── schema.ts          # Database initialization
│   │   ├── srs.ts             # SRS algorithm & graph operations
│   │   └── types.ts           # TypeScript interfaces
│   └── queue/
│       └── learningQueue.ts   # Background job processing
├── app/
│   ├── agentConfigs/
│   │   ├── learningSupervisor.ts         # Analysis supervisor
│   │   └── languageTutor/
│   │       ├── index.ts                  # Main tutor agent
│   │       └── languageTutorSupervisor.ts # Tutor supervisor
│   └── api/
│       ├── learning/
│       │   ├── progress/route.ts         # User progress API
│       │   ├── known-words/route.ts      # Known vocabulary API
│       │   └── review-due/route.ts       # SRS review API
│       ├── neo4j/
│       │   └── init/route.ts             # Database setup API
│       └── queue/
│           └── status/route.ts           # Queue monitoring API
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

New dependencies added:
- `neo4j-driver`: Neo4j database connectivity
- `bull`: Redis-based job queue
- `ioredis`: Redis client
- `@types/bull`: TypeScript types

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```env
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Neo4j Database Configuration  
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_neo4j_password_here

# Redis Configuration (for background processing queue)
REDIS_URL=redis://localhost:6379
```

### 3. Database Setup

Start Neo4j and Redis:
```bash
# Neo4j (using Docker)
docker run -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/password neo4j:latest

# Redis (using Docker)  
docker run -p 6379:6379 redis:latest
```

### 4. Initialize Database Schema

```bash
curl -X POST http://localhost:3000/api/neo4j/init \
  -H "Content-Type: application/json" \
  -d '{"action": "full"}'
```

### 5. Run Application

```bash
npm run dev
```

Navigate to http://localhost:3000 and select "languageTutor" from the scenario dropdown.

## API Endpoints

### Learning Analytics

- `GET /api/learning/progress?userId=demo-user&language=es`
  - Returns user's overall learning progress

- `GET /api/learning/known-words?userId=demo-user&language=es&minLevel=3`
  - Returns list of words user has mastered

- `GET /api/learning/review-due?userId=demo-user&language=es&limit=10`
  - Returns words due for SRS review

### Database Management

- `POST /api/neo4j/init` with body `{"action": "test|init|sample|full"}`
  - Test connection, initialize schema, create sample data, or do all

### Queue Monitoring

- `GET /api/queue/status`
  - Returns background job queue health status

## Usage Examples

### Basic Conversation Flow

1. **User starts conversation**: "Hola, ¿cómo estás?"

2. **Tutor responds with level assessment**: 
   - Calls `getKnownVocabulary` to check user's level
   - Responds appropriately: "¡Hola! Estoy bien, gracias. I can see you know some basic greetings!"

3. **Background analysis triggered**:
   - After 3-5 exchanges, `triggerLearningAnalysis` processes recent utterances
   - Updates Neo4j graph with vocabulary progress

4. **Adaptive instruction**:
   - Tutor uses `getReviewDueWords` to incorporate SRS words naturally
   - Adjusts difficulty based on user's demonstrated proficiency

### SRS Integration Example

```javascript
// User says: "Mi perro es grande"
// System extracts: ["perro", "grande", "ser"] 
// Updates progress for each word based on usage correctness
// Schedules next review dates using Leitner algorithm
```

## Testing

### Manual Testing

1. Start conversation with basic Spanish
2. Check learning progress: `GET /api/learning/progress?userId=demo-user`
3. View queue status: `GET /api/queue/status`
4. Monitor Neo4j browser at http://localhost:7474

### Automated Testing

Key test scenarios:
- SRS level progression with correct/incorrect usage
- User isolation (multiple users, same words)
- Queue processing and error handling
- API endpoint validation

## Performance Considerations

### Caching Strategy
- Known vocabulary cached in supervisor agent (60s TTL)
- Review words pre-fetched at conversation start
- Progress updates batched in background queue

### Scaling Considerations
- Redis queue allows horizontal scaling of background processing
- Neo4j read replicas for query performance
- User-partitioned data enables easy sharding

### Monitoring
- Queue health via `/api/queue/status`
- Neo4j metrics via browser interface
- Application logs for supervisor agent calls

## Customization

### Adding New Languages
1. Update lexeme labels in schema (e.g., `:Lexeme:FR`)
2. Modify language detection in learning supervisor
3. Add language-specific NLP processing

### Adjusting SRS Algorithm
Modify intervals in `src/lib/neo4j/srs.ts`:
```typescript
const daysToAdd = Math.pow(2, newLevel - 1); // Current: 1,2,4,8,16
// Custom: Math.pow(3, newLevel - 1);         // Alternative: 1,3,9,27,81
```

### Custom Performance Metrics
Add new performance types in `types.ts` and update analysis logic in learning supervisor.

## Troubleshooting

### Common Issues

1. **Neo4j Connection Failed**
   - Check NEO4J_URI, username, password in .env
   - Verify Neo4j is running: `docker ps`

2. **Queue Jobs Stuck**
   - Check Redis connection: `GET /api/queue/status`
   - Restart Redis if needed

3. **Learning Analysis Not Working**
   - Verify OpenAI API key and model access
   - Check supervisor agent logs in browser console

4. **Performance Issues**
   - Monitor Neo4j query performance in browser
   - Consider adding more indexes for large datasets

### Debug Mode

Enable detailed logging by adding to environment:
```env
NODE_ENV=development
```

This provides verbose output for:
- Neo4j query execution
- Queue job processing  
- Supervisor agent tool calls

## Next Steps

### Potential Enhancements

1. **Multi-language Support**: Extend beyond Spanish
2. **Grammar Tracking**: Add syntax and grammar rule progress
3. **Pronunciation Analysis**: Integrate speech assessment
4. **Progress Visualization**: Dashboard for learning analytics
5. **Recommendation Engine**: Suggest personalized learning paths
6. **Mobile App Integration**: API-first design enables mobile clients

### Production Deployment

1. **Database Clustering**: Neo4j Enterprise with read replicas
2. **Queue Scaling**: Redis Cluster for high availability
3. **Monitoring**: Prometheus + Grafana for observability
4. **Security**: Authentication, rate limiting, data encryption
5. **Backup Strategy**: Automated Neo4j backups and Redis persistence

This implementation provides a robust foundation for intelligent language learning with spaced repetition, ready for both development experimentation and production scaling.