"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseFactory = void 0;
const SQLiteDatabase_1 = require("./SQLiteDatabase");
const PostgreSQLDatabase_1 = require("./PostgreSQLDatabase");
const logger_1 = __importDefault(require("../utils/logger"));
class DatabaseFactory {
    static getDatabase() {
        if (this.instance) {
            return this.instance;
        }
        const dbType = (process.env.DB_TYPE || 'sqlite').toLowerCase();
        logger_1.default.info(`🔧 Initializing ${dbType.toUpperCase()} database...`);
        switch (dbType) {
            case 'postgresql':
                this.instance = new PostgreSQLDatabase_1.PostgreSQLDatabase();
                break;
            case 'sqlite':
            default:
                this.instance = new SQLiteDatabase_1.SQLiteDatabase();
                break;
        }
        return this.instance;
    }
    static getDatabaseType() {
        return (process.env.DB_TYPE || 'sqlite').toLowerCase();
    }
    static isPostgreSQL() {
        return this.getDatabaseType() === 'postgresql';
    }
    static isSQLite() {
        return this.getDatabaseType() === 'sqlite';
    }
    static async close() {
        if (this.instance) {
            if (this.instance instanceof PostgreSQLDatabase_1.PostgreSQLDatabase) {
                await this.instance.close();
            }
            this.instance = null;
        }
    }
}
exports.DatabaseFactory = DatabaseFactory;
DatabaseFactory.instance = null;
exports.default = DatabaseFactory;
//# sourceMappingURL=DatabaseFactory.js.map