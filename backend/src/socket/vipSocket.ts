/**
 * VIP Socket.IO Handler
 * Handles real-time VIP auction events: bid updates, buyouts, auction status
 */

import { Server, Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

// Store for tracking which users are watching which auctions
const auctionWatchers: Map<string, Set<string>> = new Map(); // auctionKey -> Set of userIds

export class VipSocketHandler {
  private io: Server;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Initialize VIP socket namespace
   */
  initialize() {
    const vipNamespace = this.io.of('/vip');

    vipNamespace.use(this.authenticateSocket.bind(this));

    vipNamespace.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`✅ VIP socket connected: ${socket.id} (User: ${socket.userId})`);

      this.handleConnection(socket);
      this.handleAuctionWatch(socket);
      this.handleDisconnect(socket);
    });

    console.log('🏆 VIP Socket handler initialized');
  }

  /**
   * Authenticate socket connection
   */
  private authenticateSocket(socket: AuthenticatedSocket, next: (err?: Error) => void) {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = verify(token as string, process.env.JWT_SECRET || 'fallback-secret') as any;
      socket.userId = decoded.id || decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  }

  /**
   * Handle new connection
   */
  private handleConnection(socket: AuthenticatedSocket) {
    if (!socket.userId) return;

    // Track socket for this user
    if (!this.userSockets.has(socket.userId)) {
      this.userSockets.set(socket.userId, new Set());
    }
    this.userSockets.get(socket.userId)!.add(socket.id);

    // Join user's personal room for targeted notifications
    socket.join(`user:${socket.userId}`);
  }

  /**
   * Handle auction watching (subscribe to updates for specific auctions)
   */
  private handleAuctionWatch(socket: AuthenticatedSocket) {
    // Watch a specific auction
    socket.on('watch:auction', (data: { vipType: string; categoryId: string; city?: string }) => {
      const auctionKey = this.getAuctionKey(data.vipType, data.categoryId, data.city);
      socket.join(`auction:${auctionKey}`);
      
      // Track watcher
      if (!auctionWatchers.has(auctionKey)) {
        auctionWatchers.set(auctionKey, new Set());
      }
      auctionWatchers.get(auctionKey)!.add(socket.userId!);
      
      console.log(`👁️ User ${socket.userId} watching auction ${auctionKey}`);
    });

    // Unwatch auction
    socket.on('unwatch:auction', (data: { vipType: string; categoryId: string; city?: string }) => {
      const auctionKey = this.getAuctionKey(data.vipType, data.categoryId, data.city);
      socket.leave(`auction:${auctionKey}`);
      
      auctionWatchers.get(auctionKey)?.delete(socket.userId!);
    });

    // Watch all auctions (for VIP page)
    socket.on('watch:all-auctions', () => {
      socket.join('vip:all-auctions');
      console.log(`👁️ User ${socket.userId} watching all auctions`);
    });

    socket.on('unwatch:all-auctions', () => {
      socket.leave('vip:all-auctions');
    });
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(socket: AuthenticatedSocket) {
    socket.on('disconnect', () => {
      console.log(`❌ VIP socket disconnected: ${socket.id}`);

      if (socket.userId) {
        this.userSockets.get(socket.userId)?.delete(socket.id);
        if (this.userSockets.get(socket.userId)?.size === 0) {
          this.userSockets.delete(socket.userId);
        }

        // Clean up auction watchers
        for (const [auctionKey, watchers] of auctionWatchers) {
          watchers.delete(socket.userId);
          if (watchers.size === 0) {
            auctionWatchers.delete(auctionKey);
          }
        }
      }
    });
  }

  /**
   * Generate auction key for room naming
   */
  private getAuctionKey(vipType: string, categoryId: string, city?: string): string {
    return `${vipType}:${categoryId}:${city || 'GLOBAL'}`;
  }

  /**
   * Emit bid update to all watchers of an auction
   */
  emitBidUpdate(vipType: string, categoryId: string, city: string | null, data: {
    bidderId: string;
    bidderName?: string;
    newBidAmount: number;
    rank: number;
    totalBids: number;
  }) {
    const auctionKey = this.getAuctionKey(vipType, categoryId, city || undefined);
    const vipNamespace = this.io.of('/vip');

    // Emit to specific auction watchers
    vipNamespace.to(`auction:${auctionKey}`).emit('bid:update', {
      vipType,
      categoryId,
      city,
      ...data,
      timestamp: new Date().toISOString()
    });

    // Also emit to all-auctions watchers
    vipNamespace.to('vip:all-auctions').emit('auction:update', {
      vipType,
      categoryId,
      city,
      type: 'bid',
      ...data,
      timestamp: new Date().toISOString()
    });

    console.log(`📢 VIP bid update emitted for ${auctionKey}`);
  }

  /**
   * Emit buyout notification
   */
  emitBuyout(vipType: string, categoryId: string, city: string | null, data: {
    buyerId: string;
    buyerName?: string;
    slotsRemaining: number;
  }) {
    const auctionKey = this.getAuctionKey(vipType, categoryId, city || undefined);
    const vipNamespace = this.io.of('/vip');

    vipNamespace.to(`auction:${auctionKey}`).emit('buyout:complete', {
      vipType,
      categoryId,
      city,
      ...data,
      timestamp: new Date().toISOString()
    });

    vipNamespace.to('vip:all-auctions').emit('auction:update', {
      vipType,
      categoryId,
      city,
      type: 'buyout',
      ...data,
      timestamp: new Date().toISOString()
    });

    console.log(`📢 VIP buyout emitted for ${auctionKey}`);
  }

  /**
   * Notify a user they've been outbid
   */
  emitOutbid(userId: string, data: {
    vipType: string;
    categoryId: string;
    categoryLabel: string;
    newHighestBid: number;
    yourBid: number;
    newRank: number;
  }) {
    const vipNamespace = this.io.of('/vip');
    vipNamespace.to(`user:${userId}`).emit('outbid', {
      ...data,
      timestamp: new Date().toISOString()
    });

    console.log(`📢 Outbid notification sent to user ${userId}`);
  }

  /**
   * Emit auction status change (open/closed)
   */
  emitAuctionStatus(isOpen: boolean, nextAuction?: { startsAt: string; endsAt: string }) {
    const vipNamespace = this.io.of('/vip');
    vipNamespace.emit('auction:status', {
      isOpen,
      nextAuction,
      timestamp: new Date().toISOString()
    });

    console.log(`📢 Auction status changed: ${isOpen ? 'OPEN' : 'CLOSED'}`);
  }
}

// Singleton instance
let vipSocketHandler: VipSocketHandler | null = null;

export const initializeVipSocket = (io: Server): VipSocketHandler => {
  vipSocketHandler = new VipSocketHandler(io);
  vipSocketHandler.initialize();
  return vipSocketHandler;
};

export const getVipSocketHandler = (): VipSocketHandler | null => {
  return vipSocketHandler;
};
