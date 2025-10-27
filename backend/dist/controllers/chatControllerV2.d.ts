import { Request, Response, NextFunction } from 'express';
import { ChatService } from '../services/ChatService';
export declare class ChatController {
    private chatService;
    constructor(chatService: ChatService);
    getConversations: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    createConversation: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getConversation: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getMessages: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    sendMessage: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    editMessage: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    deleteMessage: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    markAsRead: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    updateReceipt: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getReceipts: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
export declare const chatErrorHandler: (err: any, req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=chatControllerV2.d.ts.map