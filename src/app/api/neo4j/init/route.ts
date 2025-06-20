import { NextRequest, NextResponse } from 'next/server';
import { initializeSchema, createSampleData } from '../../../../lib/neo4j/schema';
import { testConnection } from '../../../../lib/neo4j/driver';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'test':
        const isConnected = await testConnection();
        return NextResponse.json({
          success: isConnected,
          message: isConnected ? 'Neo4j connection successful' : 'Neo4j connection failed'
        });

      case 'init':
        await initializeSchema();
        return NextResponse.json({
          success: true,
          message: 'Neo4j schema initialized successfully'
        });

      case 'sample':
        await createSampleData();
        return NextResponse.json({
          success: true,
          message: 'Sample data created successfully'
        });

      case 'full':
        await initializeSchema();
        await createSampleData();
        return NextResponse.json({
          success: true,
          message: 'Neo4j initialized with schema and sample data'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: test, init, sample, or full' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Neo4j initialization error:', error);
    return NextResponse.json(
      { error: 'Neo4j operation failed', details: error.message },
      { status: 500 }
    );
  }
}