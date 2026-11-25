# AVEN MASTER ERP — PRODUCTION DATABASE BACKUP & RECOVERY GUIDE

**Release Date:** 25 November 2026  
**System:** AVEN Industrial Automation Master ERP  
**Authoritative Database:** Neon Serverless PostgreSQL  
**Policy:** Zero Overwrites — Never Treat Outdated JSON Files as Recovery Source

---

## 1. CORE BACKUP PRINCIPLES

> [!CAUTION]
> **CRITICAL RECOVERY RULE:**
> 1. **Never treat old local JSON files (`data/*.json`) as an authoritative recovery source for live production PostgreSQL.**
> 2. **Never execute destructive restore commands (`pg_restore --clean` or `DROP TABLE`) against the live production database.**
> 3. **Always restore database backups into an isolated staging branch first, verify records, and only then promote or swap connections.**

---

## 2. NEON SERVERLESS CLOUD BACKUP & POINT-IN-TIME RECOVERY

Neon PostgreSQL provides enterprise-grade, copy-on-write storage with automatic continuous write-ahead logging (WAL) and instant branching.

### 2.1 Point-in-Time Recovery (PITR) via Neon Console
1. Log in to the [Neon Console](https://console.neon.tech).
2. Select your Project (`aven-master-erp`).
3. Click **Branches** -> **New Branch**.
4. Select **Branch from Point in Time**.
5. Choose the exact timestamp (down to the minute) prior to the incident.
6. Click **Create Branch**.
7. Connect to this isolated branch, inspect the restored quotations, clients, and invoices, and verify record integrity before updating `DATABASE_URL`.

---

## 3. AUTOMATED PG_DUMP BACKUP SCRIPT

For local, scheduled (cron), or offline physical backups:

### 3.1 Creating a Safe Timestamped Backup
Run the standard PostgreSQL `pg_dump` utility with TLS encryption enabled:

```bash
# Windows PowerShell Backup Command:
$TIMESTAMP = (Get-Date -Format "yyyyMMdd_HHmmss")
pg_dump --dbname="$env:DATABASE_URL" --format=custom --file="backups/aven_erp_backup_$TIMESTAMP.dump"

# Linux / macOS Bash Backup Command:
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
pg_dump --dbname="$DATABASE_URL" --format=custom --file="backups/aven_erp_backup_${TIMESTAMP}.dump"
```

### 3.2 Scheduled Nightly Cron Backup (Linux VPS)
Add a crontab entry to take nightly backups at 02:00 AM:
```bash
0 2 * * * pg_dump --dbname="$DATABASE_URL" --format=custom --file="/var/backups/aven_erp/aven_erp_$(date +\%Y\%m\%d).dump"
```

---

## 4. SAFE STAGING RESTORE & VERIFICATION PROCEDURE

When restoring from a `.dump` file:

### Step 1: Create an Isolated Verification Database
Never restore directly into live production. Create a test/staging database:
```bash
# In Neon Console or psql:
CREATE DATABASE aven_erp_restore_staging;
```

### Step 2: Restore into the Staging Database
```bash
pg_restore --dbname="postgresql://.../aven_erp_restore_staging?sslmode=require" \
  --no-owner --role=neondb_owner backups/aven_erp_backup_YYYYMMDD_HHMMSS.dump
```

### Step 3: Verify Record Counts in Staging
```sql
SELECT 'quotes' AS table_name, COUNT(*) FROM quotes
UNION ALL
SELECT 'clients', COUNT(*) FROM clients
UNION ALL
SELECT 'vendors', COUNT(*) FROM vendors
UNION ALL
SELECT 'spec_profiles', COUNT(*) FROM spec_profiles
UNION ALL
SELECT 'users', COUNT(*) FROM users;
```

### Step 4: Promote Verified Staging
Once record integrity is verified, safely update the production connection string or perform targeted record recovery.

---

## 5. CLOUDINARY ASSET BACKUP PROCEDURE

In addition to database records, product drawings and uploaded design attachments stored in Cloudinary (`CLOUDINARY_FOLDER=new_erp`) must be backed up:

### 5.1 Cloudinary CLI Asset Backup
```bash
# Install Cloudinary CLI
npm install -g cloudinary-cli

# Export all assets in folder 'new_erp'
cld admin export-archive --prefix="new_erp/" --target="backups/cloudinary_new_erp_backup.zip"
```

### 5.2 Automated Asset Recovery
If an image is deleted, it can be restored directly from the Cloudinary Backup archive or from the Version History tab in the Cloudinary Media Library.
