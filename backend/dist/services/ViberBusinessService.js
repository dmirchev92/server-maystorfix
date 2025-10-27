"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViberBusinessService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../utils/config"));
const logger_1 = __importDefault(require("../utils/logger"));
class ViberBusinessService {
    constructor() {
        this.authToken = config_1.default.integrations.viber.authToken || '';
        this.webhookUrl = config_1.default.integrations.viber.webhookUrl || '';
        this.api = axios_1.default.create({
            baseURL: 'https://chatapi.viber.com/pa',
            headers: {
                'X-Viber-Auth-Token': this.authToken,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });
        this.setupInterceptors();
    }
    setupInterceptors() {
        this.api.interceptors.request.use((config) => {
            logger_1.default.info('Viber API request', { url: config.url, method: config.method });
            return config;
        }, (error) => {
            logger_1.default.error('Viber API request error', { error: error.message });
            return Promise.reject(error);
        });
        this.api.interceptors.response.use((response) => {
            logger_1.default.info('Viber API response', {
                status: response.status,
                url: response.config.url
            });
            return response;
        }, (error) => {
            logger_1.default.error('Viber API response error', {
                error: error.message,
                status: error.response?.status,
                data: error.response?.data
            });
            return Promise.reject(error);
        });
    }
    async sendTextMessage(receiver, text, trackingData) {
        try {
            const message = {
                receiver,
                type: 'text',
                text,
                tracking_data: trackingData,
            };
            const response = await this.api.post('/send_message', message);
            if (response.data.status === 0) {
                logger_1.default.info('Viber message sent successfully', {
                    receiver,
                    messageToken: response.data.message_token
                });
                return true;
            }
            else {
                logger_1.default.error('Viber message failed', {
                    receiver,
                    status: response.data.status,
                    statusMessage: response.data.status_message
                });
                return false;
            }
        }
        catch (error) {
            logger_1.default.error('Error sending Viber message', {
                receiver,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async sendPictureMessage(receiver, media, text, thumbnail) {
        try {
            const message = {
                receiver,
                type: 'picture',
                media,
                text,
                thumbnail,
            };
            const response = await this.api.post('/send_message', message);
            if (response.data.status === 0) {
                logger_1.default.info('Viber picture message sent successfully', {
                    receiver,
                    messageToken: response.data.message_token
                });
                return true;
            }
            else {
                logger_1.default.error('Viber picture message failed', {
                    receiver,
                    status: response.data.status,
                    statusMessage: response.data.status_message
                });
                return false;
            }
        }
        catch (error) {
            logger_1.default.error('Error sending Viber picture message', {
                receiver,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async sendContactMessage(receiver, contactName, contactPhone) {
        try {
            const message = {
                receiver,
                type: 'contact',
                contact: {
                    name: contactName,
                    phone_number: contactPhone,
                },
            };
            const response = await this.api.post('/send_message', message);
            if (response.data.status === 0) {
                logger_1.default.info('Viber contact message sent successfully', {
                    receiver,
                    messageToken: response.data.message_token
                });
                return true;
            }
            else {
                logger_1.default.error('Viber contact message failed', {
                    receiver,
                    status: response.data.status,
                    statusMessage: response.data.status_message
                });
                return false;
            }
        }
        catch (error) {
            logger_1.default.error('Error sending Viber contact message', {
                receiver,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async setWebhook(webhookUrl) {
        try {
            const response = await this.api.post('/set_webhook', {
                url: webhookUrl,
                event_types: [
                    'delivered',
                    'seen',
                    'failed',
                    'subscribed',
                    'unsubscribed',
                    'conversation_started'
                ],
                send_name: true,
                send_photo: true,
            });
            if (response.data.status === 0) {
                logger_1.default.info('Viber webhook set successfully', { webhookUrl });
                return true;
            }
            else {
                logger_1.default.error('Failed to set Viber webhook', {
                    webhookUrl,
                    status: response.data.status,
                    statusMessage: response.data.status_message
                });
                return false;
            }
        }
        catch (error) {
            logger_1.default.error('Error setting Viber webhook', {
                webhookUrl,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async getAccountInfo() {
        try {
            const response = await this.api.post('/get_account_info');
            if (response.data.status === 0) {
                logger_1.default.info('Viber account info retrieved', {
                    name: response.data.name,
                    uri: response.data.uri
                });
                return response.data;
            }
            else {
                logger_1.default.error('Failed to get Viber account info', {
                    status: response.data.status,
                    statusMessage: response.data.status_message
                });
                return null;
            }
        }
        catch (error) {
            logger_1.default.error('Error getting Viber account info', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    processWebhookEvent(event) {
        logger_1.default.info('Processing Viber webhook event', {
            event: event.event,
            userId: event.user.id,
            userName: event.user.name
        });
        switch (event.event) {
            case 'delivered':
                this.handleMessageDelivered(event);
                break;
            case 'seen':
                this.handleMessageSeen(event);
                break;
            case 'failed':
                this.handleMessageFailed(event);
                break;
            case 'subscribed':
                this.handleUserSubscribed(event);
                break;
            case 'unsubscribed':
                this.handleUserUnsubscribed(event);
                break;
            case 'conversation_started':
                this.handleConversationStarted(event);
                break;
            default:
                logger_1.default.warn('Unknown Viber webhook event', { event: event.event });
        }
    }
    handleMessageDelivered(event) {
        logger_1.default.info('Message delivered', {
            messageToken: event.message_token,
            userId: event.user.id
        });
    }
    handleMessageSeen(event) {
        logger_1.default.info('Message seen', {
            messageToken: event.message_token,
            userId: event.user.id
        });
    }
    handleMessageFailed(event) {
        logger_1.default.error('Message failed', {
            messageToken: event.message_token,
            userId: event.user.id
        });
    }
    handleUserSubscribed(event) {
        logger_1.default.info('User subscribed', {
            userId: event.user.id,
            userName: event.user.name
        });
    }
    handleUserUnsubscribed(event) {
        logger_1.default.info('User unsubscribed', {
            userId: event.user.id,
            userName: event.user.name
        });
    }
    handleConversationStarted(event) {
        logger_1.default.info('Conversation started', {
            userId: event.user.id,
            userName: event.user.name
        });
    }
    isConfigured() {
        return !!(this.authToken && this.webhookUrl);
    }
}
exports.ViberBusinessService = ViberBusinessService;
exports.default = ViberBusinessService;
//# sourceMappingURL=ViberBusinessService.js.map