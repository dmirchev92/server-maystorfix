import { SQLiteDatabase } from './SQLiteDatabase';
import { PostgreSQLDatabase } from './PostgreSQLDatabase';
export type DatabaseType = 'sqlite' | 'postgresql';
export declare class DatabaseFactory {
    private static instance;
    static getDatabase(): SQLiteDatabase | PostgreSQLDatabase;
    static getDatabaseType(): DatabaseType;
    static isPostgreSQL(): boolean;
    static isSQLite(): boolean;
    static close(): Promise<void>;
}
export default DatabaseFactory;
//# sourceMappingURL=DatabaseFactory.d.ts.map