import { Request, Response, NextFunction } from 'express';
export declare const startConversation: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const sendMessage: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getAllMessages: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getMessages: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getConversation: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getProviderConversations: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const updateConversation: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const markAsRead: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getUserConversations: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getUnifiedMessages: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getUserPublicId: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=chatController.d.ts.map