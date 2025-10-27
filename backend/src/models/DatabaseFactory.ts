// Database Factory
// Automatically selects the correct database based on environment configuration

import { SQLiteDatabase } from './SQLiteDatabase';
import { PostgreSQLDatabase } from './PostgreSQLDatabase';
import logger from '../utils/logger';

export type DatabaseType = 'sqlite' | 'postgresql';

export class DatabaseFactory {
  private static instance: SQLiteDatabase | PostgreSQLDatabase | null = null;

  /**
   * Get database instance based on environment configuration
   */
  public static getDatabase(): SQLiteDatabase | PostgreSQLDatabase {
    if (this.instance) {
      return this.instance;
    }

    const dbType = (process.env.DB_TYPE || 'sqlite').toLowerCase() as DatabaseType;

    logger.info(`🔧 Initializing ${dbType.toUpperCase()} database...`);

    switch (dbType) {
      case 'postgresql':
        this.instance = new PostgreSQLDatabase();
        break;
      case 'sqlite':
      default:
        this.instance = new SQLiteDatabase();
        break;
    }

    return this.instance;
  }

  /**
   * Get current database type
   */
  public static getDatabaseType(): DatabaseType {
    return (process.env.DB_TYPE || 'sqlite').toLowerCase() as DatabaseType;
  }

  /**
   * Check if using PostgreSQL
   */
  public static isPostgreSQL(): boolean {
    return this.getDatabaseType() === 'postgresql';
  }

  /**
   * Check if using SQLite
   */
  public static isSQLite(): boolean {
    return this.getDatabaseType() === 'sqlite';
  }

  /**
   * Close database connection
   */
  public static async close(): Promise<void> {
    if (this.instance) {
      if (this.instance instanceof PostgreSQLDatabase) {
        await this.instance.close();
      }
      this.instance = null;
    }
  }
}

export default DatabaseFactory;
