# Cascade's Operational Rules

These rules must be followed strictly during the development of the ServiceText Pro project.

1.  **Database Schema Validation**:
    *   **Rule**: Before creating any new table, I MUST use the Postgres MCP to check if a table with that name or similar purpose already exists.
    *   *Action*: Run `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';` or specific checks before `CREATE TABLE`.

2.  **API Duplication Check**:
    *   **Rule**: Before creating a new API endpoint, I MUST check the existing API registry (to be documented in `API_REGISTRY.md`) to ensure I am not duplicating functionality.
    *   *Action*: Review `backend/src/controllers` and `backend/src/server.ts`.

3.  **Database Technology Constraint**:
    *   **Rule**: I must ONLY use PostgreSQL for all database needs.
    *   *Action*: Do not introduce Redis, MongoDB, or SQLite. Migrate any SQLite legacy code to PostgreSQL.
