"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatRepository = void 0;
class ChatRepository {
    constructor(pool) {
        this.pool = pool;
    }
    mapConversationRow(row) {
        const providerFullName = row.provider_first_name && row.provider_last_name
            ? `${row.provider_first_name} ${row.provider_last_name}`.trim()
            : row.provider_first_name || row.provider_last_name || undefined;
        return {
            id: row.id,
            providerId: row.provider_id,
            customerId: row.customer_id,
            customerName: row.customer_name,
            customerEmail: row.customer_email,
            customerPhone: row.customer_phone,
            status: row.status,
            lastMessageAt: row.last_message_at.toISOString(),
            createdAt: row.created_at.toISOString(),
            providerName: providerFullName,
            providerBusinessName: row.provider_business_name,
            providerServiceCategory: row.provider_service_category
        };
    }
    mapMessageRow(row) {
        return {
            id: row.id,
            conversationId: row.conversation_id,
            senderUserId: row.sender_user_id,
            senderType: row.sender_type,
            senderName: row.sender_name,
            type: row.message_type,
            body: row.message,
            messageType: row.message_type,
            sentAt: row.sent_at.toISOString(),
            editedAt: row.edited_at?.toISOString(),
            deletedAt: row.deleted_at?.toISOString(),
            isRead: row.is_read
        };
    }
    mapParticipantRow(row) {
        return {
            conversationId: row.conversation_id,
            userId: row.user_id,
            role: row.role,
            joinedAt: row.joined_at.toISOString(),
            lastReadMessageId: row.last_read_message_id,
            settings: row.settings || {}
        };
    }
    mapReceiptRow(row) {
        return {
            messageId: row.message_id,
            recipientUserId: row.recipient_user_id,
            status: row.status,
            at: row.at.toISOString()
        };
    }
    mapAttachmentRow(row) {
        return {
            id: row.id,
            messageId: row.message_id,
            url: row.url,
            mimeType: row.mime_type,
            size: row.size,
            width: row.width,
            height: row.height,
            thumbUrl: row.thumb_url,
            createdAt: row.created_at.toISOString()
        };
    }
    async getConversations(userId, userRole, query = {}) {
        const { cursor, limit = 20, status = 'active' } = query;
        let sql = `
      SELECT 
        mc.*,
        u.first_name as provider_first_name,
        u.last_name as provider_last_name,
        spp.business_name as provider_business_name,
        spp.service_category as provider_service_category
      FROM marketplace_conversations mc
      LEFT JOIN users u ON mc.provider_id = u.id
      LEFT JOIN service_provider_profiles spp ON mc.provider_id = spp.user_id
      WHERE mc.status = $1
        AND (
          ${userRole === 'provider' ? 'mc.provider_id = $2' : 'mc.customer_id = $2'}
        )
    `;
        const params = [status, userId];
        if (cursor) {
            sql += ` AND mc.last_message_at < (
        SELECT last_message_at FROM marketplace_conversations WHERE id = $3
      )`;
            params.push(cursor);
        }
        sql += ` ORDER BY mc.last_message_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);
        const result = await this.pool.query(sql, params);
        return result.rows.map(row => this.mapConversationRow(row));
    }
    async getConversation(conversationId) {
        const result = await this.pool.query(`SELECT 
        mc.*,
        u.first_name as provider_first_name,
        u.last_name as provider_last_name,
        spp.business_name as provider_business_name,
        spp.service_category as provider_service_category
      FROM marketplace_conversations mc
      LEFT JOIN users u ON mc.provider_id = u.id
      LEFT JOIN service_provider_profiles spp ON mc.provider_id = spp.user_id
      WHERE mc.id = $1`, [conversationId]);
        return result.rows[0] ? this.mapConversationRow(result.rows[0]) : null;
    }
    async findConversationBetween(customerId, providerId) {
        const result = await this.pool.query(`SELECT 
        mc.*,
        u.first_name as provider_first_name,
        u.last_name as provider_last_name,
        spp.business_name as provider_business_name,
        spp.service_category as provider_service_category
      FROM marketplace_conversations mc
      LEFT JOIN users u ON mc.provider_id = u.id
      LEFT JOIN service_provider_profiles spp ON mc.provider_id = spp.user_id
      WHERE mc.customer_id = $1 AND mc.provider_id = $2 AND mc.status = 'active'
      ORDER BY mc.created_at DESC
      LIMIT 1`, [customerId, providerId]);
        return result.rows[0] ? this.mapConversationRow(result.rows[0]) : null;
    }
    async createConversation(data) {
        const result = await this.pool.query(`INSERT INTO marketplace_conversations 
       (id, provider_id, customer_id, customer_name, customer_email, customer_phone, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       RETURNING *`, [
            data.id,
            data.providerId,
            data.customerId || null,
            data.customerName,
            data.customerEmail,
            data.customerPhone || null
        ]);
        return this.mapConversationRow(result.rows[0]);
    }
    async updateConversationLastMessage(conversationId) {
        await this.pool.query(`UPDATE marketplace_conversations 
       SET last_message_at = CURRENT_TIMESTAMP 
       WHERE id = $1`, [conversationId]);
    }
    async getMessages(conversationId, query = {}) {
        const { before, limit = 50 } = query;
        let sql = `
      SELECT * FROM marketplace_chat_messages
      WHERE conversation_id = $1
        AND deleted_at IS NULL
    `;
        const params = [conversationId];
        if (before) {
            sql += ` AND sent_at < (
        SELECT sent_at FROM marketplace_chat_messages WHERE id = $2
      )`;
            params.push(before);
        }
        sql += ` ORDER BY sent_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);
        const result = await this.pool.query(sql, params);
        return result.rows.reverse().map(row => this.mapMessageRow(row));
    }
    async getMessage(messageId) {
        const result = await this.pool.query('SELECT * FROM marketplace_chat_messages WHERE id = $1', [messageId]);
        return result.rows[0] ? this.mapMessageRow(result.rows[0]) : null;
    }
    async createMessage(data) {
        const result = await this.pool.query(`INSERT INTO marketplace_chat_messages 
       (id, conversation_id, sender_user_id, sender_type, sender_name, message, message_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`, [
            data.id,
            data.conversationId,
            data.senderUserId || null,
            data.senderType,
            data.senderName,
            data.body,
            data.type
        ]);
        return this.mapMessageRow(result.rows[0]);
    }
    async updateMessage(messageId, body) {
        const result = await this.pool.query(`UPDATE marketplace_chat_messages 
       SET message = $1, edited_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`, [body, messageId]);
        return result.rows[0] ? this.mapMessageRow(result.rows[0]) : null;
    }
    async deleteMessage(messageId) {
        await this.pool.query(`UPDATE marketplace_chat_messages 
       SET deleted_at = CURRENT_TIMESTAMP 
       WHERE id = $1`, [messageId]);
    }
    async getUnreadCount(conversationId, userId, userRole) {
        const otherRole = userRole === 'customer' ? 'provider' : 'customer';
        const result = await this.pool.query(`SELECT COUNT(*) as count 
       FROM marketplace_chat_messages 
       WHERE conversation_id = $1 
         AND sender_type = $2 
         AND is_read = false
         AND deleted_at IS NULL`, [conversationId, otherRole]);
        return parseInt(result.rows[0].count, 10);
    }
    async markMessagesAsRead(conversationId, userId, userRole) {
        const otherRole = userRole === 'customer' ? 'provider' : 'customer';
        await this.pool.query(`UPDATE marketplace_chat_messages 
       SET is_read = true 
       WHERE conversation_id = $1 
         AND sender_type = $2 
         AND is_read = false`, [conversationId, otherRole]);
    }
    async getParticipants(conversationId) {
        const result = await this.pool.query('SELECT * FROM marketplace_chat_participants WHERE conversation_id = $1', [conversationId]);
        return result.rows.map(row => this.mapParticipantRow(row));
    }
    async addParticipant(data) {
        const result = await this.pool.query(`INSERT INTO marketplace_chat_participants 
       (conversation_id, user_id, role)
       VALUES ($1, $2, $3)
       RETURNING *`, [data.conversationId, data.userId, data.role]);
        return this.mapParticipantRow(result.rows[0]);
    }
    async updateLastRead(conversationId, userId, messageId) {
        await this.pool.query(`UPDATE marketplace_chat_participants 
       SET last_read_message_id = $1 
       WHERE conversation_id = $2 AND user_id = $3`, [messageId, conversationId, userId]);
    }
    async createReceipt(data) {
        const result = await this.pool.query(`INSERT INTO marketplace_chat_receipts 
       (message_id, recipient_user_id, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (message_id, recipient_user_id) 
       DO UPDATE SET status = $3, at = CURRENT_TIMESTAMP
       RETURNING *`, [data.messageId, data.recipientUserId, data.status]);
        return this.mapReceiptRow(result.rows[0]);
    }
    async getReceipts(messageId) {
        const result = await this.pool.query('SELECT * FROM marketplace_chat_receipts WHERE message_id = $1', [messageId]);
        return result.rows.map(row => this.mapReceiptRow(row));
    }
    async createAttachment(data) {
        const result = await this.pool.query(`INSERT INTO marketplace_chat_attachments 
       (id, message_id, url, mime_type, size, width, height, thumb_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`, [
            data.id,
            data.messageId,
            data.url,
            data.mimeType,
            data.size,
            data.width || null,
            data.height || null,
            data.thumbUrl || null
        ]);
        return this.mapAttachmentRow(result.rows[0]);
    }
    async getAttachments(messageId) {
        const result = await this.pool.query('SELECT * FROM marketplace_chat_attachments WHERE message_id = $1', [messageId]);
        return result.rows.map(row => this.mapAttachmentRow(row));
    }
    async isUserInConversation(conversationId, userId) {
        const result = await this.pool.query(`SELECT 1 FROM marketplace_conversations 
       WHERE id = $1 AND (provider_id = $2 OR customer_id = $2)
       LIMIT 1`, [conversationId, userId]);
        return result.rows.length > 0;
    }
}
exports.ChatRepository = ChatRepository;
//# sourceMappingURL=ChatRepository.js.map