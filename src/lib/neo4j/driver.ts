import neo4j, { Driver, Session } from 'neo4j-driver';

let driver: Driver | null = null;

export function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const username = process.env.NEO4J_USERNAME || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'password';
    
    driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
      maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 2 * 60 * 1000, // 120 seconds
      disableLosslessIntegers: true
    });
  }
  
  return driver;
}

export function getSession(): Session {
  const database = process.env.NEO4J_DATABASE || 'neo4j';
  return getDriver().session({ database });
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

// Health check function
export async function testConnection(): Promise<boolean> {
  const session = getSession();
  try {
    const result = await session.run('RETURN 1 as test');
    return result.records.length === 1 && result.records[0].get('test') === 1;
  } catch (error) {
    console.error('Neo4j connection test failed:', error);
    return false;
  } finally {
    await session.close();
  }
}