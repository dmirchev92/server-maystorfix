// Viber Business API Service
// Handles Viber Business messaging integration

import axios, { AxiosInstance } from 'axios';
import config from '../utils/config';
import logger from '../utils/logger';

interface ViberMessage {
  receiver: string;
  type: 'text' | 'picture' | 'video' | 'file' | 'contact' | 'location' | 'url' | 'sticker';
  text?: string;
  media?: string;
  thumbnail?: string;
  file_name?: string;
  file_size?: number;
  contact?: {
    name: string;
    phone_number: string;
  };
  location?: {
    lat: number;
    lon: number;
  };
  url?: string;
  sticker_id?: number;
  tracking_data?: string;
  min_api_version?: number;
}

interface ViberWebhookEvent {
  event: 'delivered' | 'seen' | 'failed' | 'subscribed' | 'unsubscribed' | 'conversation_started';
  timestamp: number;
  message_token: number;
  user: {
    id: string;
    name: string;
    avatar?: string;
    country?: string;
    language?: string;
    api_version?: number;
  };
  message?: {
    type: string;
    text?: string;
    media?: string;
    location?: {
      lat: number;
      lon: number;
    };
    contact?: {
      name: string;
      phone_number: string;
    };
  };
  subscribed?: boolean;
  chat_hostname?: string;
}

export class ViberBusinessService {
  private api: AxiosInstance;
  private authToken: string;
  private webhookUrl: string;

  constructor() {
    this.authToken = config.integrations.viber.authToken || '';
    this.webhookUrl = config.integrations.viber.webhookUrl || '';
    
    this.api = axios.create({
      baseURL: 'https://chatapi.viber.com/pa',
      headers: {
        'X-Viber-Auth-Token': this.authToken,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.api.interceptors.request.use(
      (config) => {
        logger.info('Viber API request', { url: config.url, method: config.method });
        return config;
      },
      (error) => {
        logger.error('Viber API request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.api.interceptors.response.use(
      (response) => {
        logger.info('Viber API response', { 
          status: response.status, 
          url: response.config.url 
        });
        return response;
      },
      (error) => {
        logger.error('Viber API response error', { 
          error: error.message,
          status: error.response?.status,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Send a text message via Viber Business
   */
  public async sendTextMessage(receiver: string, text: string, trackingData?: string): Promise<boolean> {
    try {
      const message: ViberMessage = {
        receiver,
        type: 'text',
        text,
        tracking_data: trackingData,
      };

      const response = await this.api.post('/send_message', message);
      
      if (response.data.status === 0) {
        logger.info('Viber message sent successfully', { 
          receiver, 
          messageToken: response.data.message_token 
        });
        return true;
      } else {
        logger.error('Viber message failed', { 
          receiver, 
          status: response.data.status,
          statusMessage: response.data.status_message 
        });
        return false;
      }
    } catch (error) {
      logger.error('Error sending Viber message', { 
        receiver, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Send a picture message via Viber Business
   */
  public async sendPictureMessage(
    receiver: string, 
    media: string, 
    text?: string, 
    thumbnail?: string
  ): Promise<boolean> {
    try {
      const message: ViberMessage = {
        receiver,
        type: 'picture',
        media,
        text,
        thumbnail,
      };

      const response = await this.api.post('/send_message', message);
      
      if (response.data.status === 0) {
        logger.info('Viber picture message sent successfully', { 
          receiver, 
          messageToken: response.data.message_token 
        });
        return true;
      } else {
        logger.error('Viber picture message failed', { 
          receiver, 
          status: response.data.status,
          statusMessage: response.data.status_message 
        });
        return false;
      }
    } catch (error) {
      logger.error('Error sending Viber picture message', { 
        receiver, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Send a contact message via Viber Business
   */
  public async sendContactMessage(
    receiver: string, 
    contactName: string, 
    contactPhone: string
  ): Promise<boolean> {
    try {
      const message: ViberMessage = {
        receiver,
        type: 'contact',
        contact: {
          name: contactName,
          phone_number: contactPhone,
        },
      };

      const response = await this.api.post('/send_message', message);
      
      if (response.data.status === 0) {
        logger.info('Viber contact message sent successfully', { 
          receiver, 
          messageToken: response.data.message_token 
        });
        return true;
      } else {
        logger.error('Viber contact message failed', { 
          receiver, 
          status: response.data.status,
          statusMessage: response.data.status_message 
        });
        return false;
      }
    } catch (error) {
      logger.error('Error sending Viber contact message', { 
        receiver, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Set webhook URL for receiving Viber events
   */
  public async setWebhook(webhookUrl: string): Promise<boolean> {
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
        logger.info('Viber webhook set successfully', { webhookUrl });
        return true;
      } else {
        logger.error('Failed to set Viber webhook', { 
          webhookUrl,
          status: response.data.status,
          statusMessage: response.data.status_message 
        });
        return false;
      }
    } catch (error) {
      logger.error('Error setting Viber webhook', { 
        webhookUrl, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Get account info
   */
  public async getAccountInfo(): Promise<any> {
    try {
      const response = await this.api.post('/get_account_info');
      
      if (response.data.status === 0) {
        logger.info('Viber account info retrieved', { 
          name: response.data.name,
          uri: response.data.uri 
        });
        return response.data;
      } else {
        logger.error('Failed to get Viber account info', { 
          status: response.data.status,
          statusMessage: response.data.status_message 
        });
        return null;
      }
    } catch (error) {
      logger.error('Error getting Viber account info', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Process incoming webhook event
   */
  public processWebhookEvent(event: ViberWebhookEvent): void {
    logger.info('Processing Viber webhook event', { 
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
        logger.warn('Unknown Viber webhook event', { event: event.event });
    }
  }

  private handleMessageDelivered(event: ViberWebhookEvent): void {
    // Update message status in database
    logger.info('Message delivered', { 
      messageToken: event.message_token,
      userId: event.user.id 
    });
  }

  private handleMessageSeen(event: ViberWebhookEvent): void {
    // Update message status in database
    logger.info('Message seen', { 
      messageToken: event.message_token,
      userId: event.user.id 
    });
  }

  private handleMessageFailed(event: ViberWebhookEvent): void {
    // Handle failed message delivery
    logger.error('Message failed', { 
      messageToken: event.message_token,
      userId: event.user.id 
    });
  }

  private handleUserSubscribed(event: ViberWebhookEvent): void {
    // Handle new user subscription
    logger.info('User subscribed', { 
      userId: event.user.id,
      userName: event.user.name 
    });
  }

  private handleUserUnsubscribed(event: ViberWebhookEvent): void {
    // Handle user unsubscription
    logger.info('User unsubscribed', { 
      userId: event.user.id,
      userName: event.user.name 
    });
  }

  private handleConversationStarted(event: ViberWebhookEvent): void {
    // Handle conversation start
    logger.info('Conversation started', { 
      userId: event.user.id,
      userName: event.user.name 
    });
  }

  /**
   * Check if Viber Business is properly configured
   */
  public isConfigured(): boolean {
    return !!(this.authToken && this.webhookUrl);
  }
}

export default ViberBusinessService;

