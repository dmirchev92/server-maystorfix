import { Server } from 'socket.io';
import { ChatService } from '../services/ChatService';
export declare class ChatSocketHandler {
    private io;
    private chatService;
    private userSockets;
    private typingUsers;
    constructor(io: Server, chatService: ChatService);
    initialize(): void;
    private authenticateSocket;
    private handleConnection;
    private handleTyping;
    private handlePresence;
    private handleMessages;
    private handleReceipts;
    private handleDisconnection;
    private broadcastPresence;
    emitConversationUpdate(conversationId: string, senderId: string, message: any): Promise<void>;
    sendToUser(userId: string, event: string, data: any): void;
    sendToConversation(conversationId: string, event: string, data: any): void;
}
//# sourceMappingURL=chatSocket.d.ts.map