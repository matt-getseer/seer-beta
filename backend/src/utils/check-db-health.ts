import dotenv from 'dotenv';
import { checkDatabaseHealth, printDatabaseGuidelines } from './db-setup';

// Load environment variables
dotenv.config();

async function main() {
  console.log('\n=== DATABASE HEALTH CHECK ===\n');
  
  // Print connection URL (with password redacted for security)
  const dbUrl = process.env.DATABASE_URL || 'Not configured';
  console.log('DATABASE_URL:', dbUrl.replace(/\/\/([^:]+):([^@]+)@/, '//USER:PASSWORD@'));
  
  // Check database health
  const healthResults = await checkDatabaseHealth();
  
  console.log('\n--- HEALTH CHECK RESULTS ---');
  console.log(`Connection status: ${healthResults.connection ? '✓ Connected' : '✗ Failed'}`);
  console.log(`PostgreSQL version: ${healthResults.version || 'Unknown'}`);
  console.log(`Current connections: ${healthResults.connectionCount !== null ? healthResults.connectionCount : 'Unknown'}`);
  console.log(`Max connections: ${healthResults.maxConnections !== null ? healthResults.maxConnections : 'Unknown'}`);
  
  if (healthResults.errors.length > 0) {
    console.log('\n--- ERRORS ---');
    healthResults.errors.forEach((error: string, i: number) => {
      console.log(`${i+1}. ${error}`);
    });
  }
  
  // Print guidelines for improving database reliability 
  console.log('\n');
  printDatabaseGuidelines();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error running database health check:', error);
    process.exit(1);
  }); 