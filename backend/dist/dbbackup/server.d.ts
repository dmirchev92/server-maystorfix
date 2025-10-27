declare class ServiceTextProServer {
    private app;
    private httpServer;
    private io;
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
export default server;
//# sourceMappingURL=server.d.ts.map