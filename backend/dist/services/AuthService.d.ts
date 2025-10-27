import { User, UserRole, AuthTokens, ConsentType } from '../types';
export interface LoginCredentials {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
}
export interface RegisterData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    serviceCategory?: string;
    companyName?: string;
    neighborhood?: string;
    role: UserRole;
    businessId?: string;
    gdprConsents: ConsentType[];
    ipAddress?: string;
    userAgent?: string;
}
export interface PasswordResetRequest {
    email: string;
    ipAddress?: string;
}
export interface PasswordReset {
    token: string;
    newPassword: string;
    ipAddress?: string;
}
export declare class AuthService {
    private readonly jwtSecret;
    private readonly jwtRefreshSecret;
    private readonly jwtExpiresIn;
    private readonly jwtRefreshExpiresIn;
    private readonly bcryptRounds;
    private readonly database;
    private readonly securityService;
    constructor();
    register(userData: RegisterData): Promise<{
        user: User;
        tokens: AuthTokens;
    }>;
    login(credentials: LoginCredentials): Promise<{
        user: User;
        tokens: AuthTokens;
    }>;
    refreshTokens(refreshToken: string): Promise<AuthTokens>;
    requestPasswordReset(request: PasswordResetRequest): Promise<void>;
    resetPassword(resetData: PasswordReset): Promise<void>;
    updateGDPRConsents(userId: string, consents: Array<{
        consentType: ConsentType;
        granted: boolean;
    }>, ipAddress?: string): Promise<void>;
    private generateTokens;
    private validateGDPRConsents;
    private calculateDataRetentionDate;
    sanitizeUser(user: User): User;
    private parseExpirationTime;
    private maskEmail;
    private maskIP;
    private findUserByEmail;
    findUserById(id: string): Promise<User | null>;
    private saveUser;
    private updateUser;
    private savePasswordResetToken;
    private validatePasswordResetToken;
    private invalidatePasswordResetToken;
    private sendPasswordResetEmail;
}
//# sourceMappingURL=AuthService.d.ts.map