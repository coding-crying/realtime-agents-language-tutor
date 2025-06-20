// Cleanup script to remove old Form and FormProgress nodes
// Run this to clean up the database before testing the new simplified system
// Usage: node -r dotenv/config cleanup-old-nodes.js

const neo4j = require('neo4j-driver');

// Load environment variables from .env
require('dotenv').config();

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME,
    process.env.NEO4J_PASSWORD
  )
);

async function cleanupOldNodes() {
  const session = driver.session();
  
  try {
    console.log('Starting cleanup of old Form and FormProgress nodes...');
    
    // First, let's see what we have
    console.log('\nCurrent node counts:');
    try {
      const labels = await session.run('CALL db.labels() YIELD label');
      for (const labelRecord of labels.records) {
        const label = labelRecord.get('label');
        const countResult = await session.run(`MATCH (n:${label}) RETURN count(n) as count`);
        const count = countResult.records[0]?.get('count')?.toNumber() || 0;
        console.log(`  ${label}: ${count}`);
      }
    } catch (error) {
      console.log('Could not get current counts, proceeding with cleanup...');
    }
    
    // Remove all Form nodes and their relationships
    console.log('\nRemoving Form nodes...');
    const formResult = await session.run(`
      MATCH (f:Form)
      DETACH DELETE f
      RETURN count(f) as deletedForms
    `);
    console.log(`Deleted ${formResult.records[0]?.get('deletedForms')?.toNumber() || 0} Form nodes`);
    
    // Remove all FormProgress nodes and their relationships
    console.log('\nRemoving FormProgress nodes...');
    const formProgressResult = await session.run(`
      MATCH (fp:FormProgress)
      DETACH DELETE fp
      RETURN count(fp) as deletedFormProgress
    `);
    console.log(`Deleted ${formProgressResult.records[0]?.get('deletedFormProgress')?.toNumber() || 0} FormProgress nodes`);
    
    // Clean up any orphaned relationships
    console.log('\nCleaning up orphaned relationships...');
    const orphanResult = await session.run(`
      MATCH ()-[r:HAS_FORM]->()
      DELETE r
      RETURN count(r) as deletedHasFormRels
    `);
    console.log(`Deleted ${orphanResult.records[0]?.get('deletedHasFormRels')?.toNumber() || 0} HAS_FORM relationships`);
    
    // Also clean up any FORM_PROGRESS relationships that might exist
    const formProgressRelResult = await session.run(`
      MATCH ()-[r:HAS_FORM_PROGRESS]->()
      DELETE r
      RETURN count(r) as deletedFormProgressRels
    `);
    console.log(`Deleted ${formProgressRelResult.records[0]?.get('deletedFormProgressRels')?.toNumber() || 0} HAS_FORM_PROGRESS relationships`);
    
    // Show final counts
    console.log('\nFinal node counts:');
    try {
      const labels = await session.run('CALL db.labels() YIELD label');
      for (const labelRecord of labels.records) {
        const label = labelRecord.get('label');
        const countResult = await session.run(`MATCH (n:${label}) RETURN count(n) as count`);
        const count = countResult.records[0]?.get('count')?.toNumber() || 0;
        console.log(`  ${label}: ${count}`);
      }
    } catch (error) {
      console.log('Could not get final counts');
    }
    
    console.log('\nCleanup completed successfully!');
    console.log('The database now uses only the simplified architecture with embedded form statistics.');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await session.close();
  }
}

async function main() {
  try {
    await cleanupOldNodes();
  } catch (error) {
    console.error('Cleanup failed:', error);
  } finally {
    await driver.close();
  }
}

if (require.main === module) {
  main();
}