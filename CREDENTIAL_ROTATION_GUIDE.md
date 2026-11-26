# CREDENTIAL ROTATION GUIDE (CLOUDINARY & NEON POSTGRESQL)

**Date:** 26 November 2026  
**Status:** Preparation Checklist (DO NOT rotate live credentials without coordinated approval)

> [!WARNING]
> Because Cloudinary API credentials and an example Neon reference previously existed in source/docs/Git history, **treat previously exposed credentials as potentially compromised** and schedule a coordinated rotation after deploying Phase 1.

## 1. Cloudinary Credential Rotation Checklist
1. Log in to the **Cloudinary Console** -> **Settings** -> **Access Keys**.
2. Click **Generate New Access Key** (keep existing key active briefly during rollout).
3. Update `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in:
   - Vercel Project Settings -> Environment Variables (Production & Preview).
   - Local `D:\Project\AIA_ERP\.env.local`.
4. Redeploy Vercel (`vercel --prod` or push commit) so `app/api/upload/route.ts` picks up the new keys.
5. Test image upload in the ERP Dashboard.
6. Return to Cloudinary Console and **Revoke / Delete** the old API Key.

## 2. Neon PostgreSQL Credential Rotation Checklist
1. Log in to **Neon Console** -> Select Project -> **Roles & Databases**.
2. Reset the password for the `neondb_owner` role (or create a dedicated application role with least-privilege permissions).
3. Update `DATABASE_URL` in Vercel (Production & Preview branches separately) and local `.env.local` (ensure `?sslmode=require`).
4. Trigger a Vercel redeploy and immediately test Login, Quotes load, Save, and PDF Export.
5. Confirm old password connections are terminated in Neon Console.
