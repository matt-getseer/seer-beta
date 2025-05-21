import { prisma } from './prisma';

/**
 * Verify database connection and perform initial checks
 */
export async function verifyDatabaseConnection(): Promise<boolean> {
  try {
    // Test connection with simple query
    await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✓ Database connection successful');
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    return false;
  }
}

/**
 * Perform database health check
 */
export async function checkDatabaseHealth(): Promise<Record<string, any>> {
  const results: Record<string, any> = {
    connection: false,
    version: null,
    connectionCount: null,
    maxConnections: null,
    errors: []
  };
  
  try {
    // Test connection
    await prisma.$queryRaw`SELECT 1 as test`;
    results.connection = true;
    
    try {
      // Get PostgreSQL version
      const versionResult = await prisma.$queryRaw<{version: string}[]>`SELECT version()`;
      results.version = versionResult[0]?.version || 'Unknown';
    } catch (error) {
      results.errors.push('Failed to retrieve PostgreSQL version');
    }
    
    try {
      // Current connection count
      const connectionResult = await prisma.$queryRaw<{count: string}[]>`
        SELECT count(*) as count FROM pg_stat_activity
      `;
      results.connectionCount = parseInt(connectionResult[0]?.count || '0');
    } catch (error) {
      results.errors.push('Failed to retrieve connection count');
    }
    
    try {
      // Max connections setting
      const maxConnectionResult = await prisma.$queryRaw<{setting: string}[]>`
        SHOW max_connections
      `;
      results.maxConnections = parseInt(maxConnectionResult[0]?.setting || '0');
    } catch (error) {
      results.errors.push('Failed to retrieve max connections setting');
    }
    
  } catch (error: any) {
    results.errors.push(`Database connection failed: ${error.message || 'Unknown error'}`);
  }
  
  return results;
}

/**
 * Print database connection guidelines
 */
export function printDatabaseGuidelines(): void {
  console.log(`
DATABASE CONNECTION GUIDELINES
==============================

To ensure reliable PostgreSQL connections:

1. Connection URL Format:
   DATABASE_URL="postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE?schema=public&connection_limit=10&pool_timeout=30"

2. Recommended Parameters:
   - connection_limit: Limits max concurrent connections per client (10-20 is recommended)
   - pool_timeout: Timeout for getting connection from pool (in seconds)
   - connect_timeout: Connection timeout (in seconds)
   - idle_in_transaction_session_timeout: Max time for idle transactions (in milliseconds)

3. PostgreSQL Configuration (/etc/postgresql/MAJOR_VERSION/main/postgresql.conf):
   - max_connections = 100-200 (higher for production)
   - tcp_keepalives_idle = 60
   - tcp_keepalives_interval = 10
   - tcp_keepalives_count = 6
   - statement_timeout = 30000 (milliseconds)
   - idle_in_transaction_session_timeout = 60000 (milliseconds)
   
4. Check database settings via:
   npx ts-node src/utils/check-db-health.ts
  `);
} 