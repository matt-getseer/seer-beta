# PostgreSQL Setup and Maintenance Guide

This guide will help you set up and maintain a reliable PostgreSQL database for your Seer application in production.

## 1. PostgreSQL Installation

### For Ubuntu/Debian:

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

### For Windows:

1. Download PostgreSQL installer from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run the installer and follow the setup wizard
3. During installation, set a strong password for the postgres user

## 2. Database Configuration

### Create a Database and User

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create a database
CREATE DATABASE seer;

# Create a user with a strong password
CREATE USER seeruser WITH ENCRYPTED PASSWORD 'strong-password-here';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE seer TO seeruser;

# Exit PostgreSQL
\q
```

### Configure Connection Parameters

Update your `.env` file with a properly configured connection string:

```
DATABASE_URL="postgresql://seeruser:strong-password-here@localhost:5432/seer?schema=public&connection_limit=10&pool_timeout=30&connect_timeout=10"
```

Key parameters:
- `connection_limit`: Maximum connections per Prisma client (10-20 recommended)
- `pool_timeout`: How long to wait for a connection from the pool (in seconds)
- `connect_timeout`: How long to wait when connecting (in seconds)

## 3. PostgreSQL Performance Tuning

Edit the PostgreSQL configuration file:

### For Ubuntu/Debian:
```bash
sudo nano /etc/postgresql/13/main/postgresql.conf
```

### For Windows:
The configuration file is in the PostgreSQL data directory:
```
C:\Program Files\PostgreSQL\13\data\postgresql.conf
```

### Recommended Settings

```
# Connection Settings
max_connections = 200               # Increase for production use
superuser_reserved_connections = 3

# Resource Usage
shared_buffers = 1GB                # 25% of RAM for dedicated DB servers
work_mem = 32MB                     # Adjust based on concurrent connections
maintenance_work_mem = 256MB        # For maintenance operations

# Write-Ahead Log
wal_buffers = 16MB

# Connection Timeout Settings
tcp_keepalives_idle = 60            # Seconds before sending keepalive
tcp_keepalives_interval = 10        # Seconds between keepalives
tcp_keepalives_count = 6            # Failed keepalives before closing

# Query Timeouts
statement_timeout = 30000           # Max time for query execution (ms)
idle_in_transaction_session_timeout = 60000  # Max idle time in transaction (ms)

# Logging (for troubleshooting)
log_min_duration_statement = 1000   # Log queries taking > 1 second
```

After making changes, restart PostgreSQL:

```bash
# Ubuntu/Debian
sudo systemctl restart postgresql

# Windows (from Command Prompt as Administrator)
net stop postgresql
net start postgresql
```

## 4. Maintenance Tasks

### Regular Backups

```bash
# Create a backup
pg_dump -U seeruser -d seer -F c -f seer_backup_$(date +%Y%m%d).dump

# Restore from backup
pg_restore -U seeruser -d seer -c seer_backup_20231201.dump
```

### Database Vacuuming

```bash
# Connect to the database
psql -U seeruser -d seer

# Run vacuum
VACUUM ANALYZE;
```

### Monitor Connections

```sql
SELECT count(*) FROM pg_stat_activity;
```

### Check Slow Queries

```sql
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

## 5. Troubleshooting

### Connection Issues

If you're experiencing connection failures:

1. Check if PostgreSQL is running:
   ```bash
   # Ubuntu/Debian
   sudo systemctl status postgresql
   
   # Windows
   sc query postgresql
   ```

2. Verify connection settings:
   ```bash
   # Run the database health check script
   npx ts-node src/utils/check-db-health.ts
   ```

3. Check PostgreSQL logs:
   ```bash
   # Ubuntu/Debian
   sudo tail -f /var/log/postgresql/postgresql-13-main.log
   
   # Windows
   Check Event Viewer > Windows Logs > Application
   ```

4. Test connection with psql:
   ```bash
   psql -U seeruser -h localhost -d seer
   ```

### Common Issues

1. **Too many connections**: Increase `max_connections` in postgresql.conf or reduce `connection_limit` in your connection string.

2. **Slow queries**: Check for missing indexes or poorly optimized queries.

3. **Timeout errors**: Adjust timeout settings in the connection string and postgresql.conf.

4. **Out of memory**: Reduce memory-related parameters or upgrade your server resources.

## 6. Health Checking

Run our database health check script regularly:

```bash
cd backend
npx ts-node src/utils/check-db-health.ts
```

This will provide information about your database connection status, version, and connection counts.

## 7. Cloud Database Options

For production use, consider using a managed PostgreSQL service:

- **AWS RDS**: Amazon's managed PostgreSQL
- **Azure Database for PostgreSQL**: Microsoft's managed PostgreSQL
- **Google Cloud SQL**: Google's managed PostgreSQL
- **Digital Ocean Managed Databases**: Simple PostgreSQL hosting
- **Supabase**: PostgreSQL with additional features
- **Neon**: Serverless PostgreSQL with automatic scaling

These services handle many maintenance tasks automatically and typically provide better reliability than self-hosted solutions. 