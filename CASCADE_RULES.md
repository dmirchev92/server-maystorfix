# Cascade Rules for ServiceTextPro

## Project Structure

- **Server**: Linux server at `maystorfix.com`
- **Local Dev Machine**: Windows at `D:\newtry1\ServiceTextPro_FRESH`
- **Database**: PostgreSQL (`servicetext_pro`) - User: `servicetextpro`, Password: `C58acfd5c!`

---

## CRITICAL RULES

### 1. Database
- **ONLY PostgreSQL** - Never use SQLite, MongoDB, or Redis
- **Before creating tables**: Query MCP to check if table exists
  ```sql
  SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%keyword%';
  ```
- **Before modifying tables**: Check column structure via MCP first

### 2. API Development
- **Before creating endpoints**: Check `backend/src/server.ts` for existing routes
- **Check controllers**: `backend/src/controllers/` for existing functionality
- **Reference**: `API_REGISTRY.md` for documented endpoints

### 3. After Code Changes
- **Backend changes**: Run `npm run build` in `/var/www/servicetextpro/backend`
- **Restart services**: Run `pm2 restart all`
- **Mobile app changes**: Provide SCP commands for user to sync to local machine

### 4. Mobile App Versioning
When making meaningful app changes, update BOTH files:
- `mobile-app/android/app/build.gradle` → Increment `versionCode` and `versionName`
- `backend/config/app-version.json` → Update `latestVersion` to match

### 5. Mobile App File Sync
After editing mobile app files, provide SCP commands in this format:
```bash
scp root@maystorfix.com:/var/www/servicetextpro/mobile-app/[path] D:\newtry1\ServiceTextPro_FRESH\mobile-app\[path]
```

### 6. Git Workflow
- **DO NOT** commit or push to GitHub until user explicitly confirms testing is complete
- Wait for user to say "push to GitHub" before any git commands

---

## File Locations

| Component | Server Path | Local Path |
|-----------|-------------|------------|
| Backend | `/var/www/servicetextpro/backend` | `D:\newtry1\ServiceTextPro_FRESH\backend` |
| Mobile App | `/var/www/servicetextpro/mobile-app` | `D:\newtry1\ServiceTextPro_FRESH\mobile-app` |
| Web Frontend | `/var/www/servicetextpro/Marketplace` | `D:\newtry1\ServiceTextPro_FRESH\Marketplace` |

---

## Quick Reference

```bash
# Build backend
cd /var/www/servicetextpro/backend && npm run build

# Restart services
pm2 restart all

# Check database (use MCP tool, not CLI)
# Use mcp0_query tool with SQL queries
```
