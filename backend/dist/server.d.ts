import { Server as SocketIOServer } from 'socket.io';
declare class ServiceTextProServer {
    private app;
    private httpServer;
    private io;
    private static instance;
    constructor();
    private initializeMiddleware;
    private initializeRoutes;
    private initializeErrorHandling;
    private initializeGracefulShutdown;
    start(): void;
    private initializeWebSocket;
    private initializeTokenCleanup;
}
declare const server: ServiceTextProServer;
export declare function getIO(): SocketIOServer;
export default server;
//# sourceMappingURL=server.d.ts.map