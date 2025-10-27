// OpenAPI/Swagger Documentation Configuration
// Comprehensive API documentation with GDPR compliance information

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import config from './config';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ServiceText Pro API',
      version: config.app.version,
      description: `
        **ServiceText Pro Backend API**
        
        A comprehensive GDPR-compliant API for Bulgarian tradespeople communication platform.
        
        ## Features
        - 🛡️ **GDPR Compliant**: Full compliance with EU data protection regulations
        - 🇧🇬 **Bulgarian Market**: Specialized for Bulgarian business requirements
        - 🔐 **Secure**: Enterprise-grade security with JWT authentication
        - 📱 **Multi-Platform**: WhatsApp, Viber, Telegram integration
        - 🤖 **AI-Powered**: Bulgarian NLP for intelligent conversations
        - 📊 **Analytics**: Comprehensive business metrics and reporting
        
        ## GDPR Compliance
        All endpoints include GDPR metadata and respect user privacy rights:
        - Data processing basis is clearly indicated
        - Retention periods are specified
        - Privacy rights information is provided
        - Audit logging is implemented
        
        ## Authentication
        Most endpoints require JWT authentication. Include the token in the Authorization header:
        \`Authorization: Bearer <your-jwt-token>\`
        
        ## Rate Limiting
        API endpoints are rate-limited for security:
        - Authentication: 5 requests per 15 minutes
        - GDPR requests: 10 requests per hour
        - General API: 100 requests per 15 minutes
        
        ## Support
        - **DPO Contact**: ${config.gdpr.dpo.email}
        - **Privacy Policy**: ${config.gdpr.urls.privacyPolicy}
        - **Technical Support**: support@servicetextpro.bg
      `,
      contact: {
        name: 'ServiceText Pro Support',
        email: 'support@servicetextpro.bg',
        url: 'https://servicetextpro.bg'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.app.port}/api/v1`,
        description: 'Development server'
      },
      {
        url: 'https://api.servicetextpro.bg/api/v1',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from login endpoint'
        }
      },
      schemas: {
        // GDPR Schemas
        GDPRMetadata: {
          type: 'object',
          properties: {
            dataProcessingBasis: {
              type: 'string',
              enum: ['legitimate_interest', 'consent', 'contract', 'legal_obligation'],
              description: 'Legal basis for data processing under GDPR'
            },
            retentionPeriod: {
              type: 'string',
              description: 'How long the data will be retained'
            },
            rightsInformation: {
              type: 'string',
              description: 'Information about user rights under GDPR'
            }
          }
        },
        APIResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the request was successful'
            },
            data: {
              type: 'object',
              description: 'Response data'
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Error code'
                },
                message: {
                  type: 'string',
                  description: 'Error message'
                },
                details: {
                  type: 'object',
                  description: 'Additional error details'
                }
              }
            },
            metadata: {
              type: 'object',
              properties: {
                timestamp: {
                  type: 'string',
                  format: 'date-time'
                },
                requestId: {
                  type: 'string'
                },
                version: {
                  type: 'string'
                }
              }
            },
            gdpr: {
              $ref: '#/components/schemas/GDPRMetadata'
            }
          }
        },
        
        // User Schemas
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique user identifier'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            role: {
              type: 'string',
              enum: ['tradesperson', 'employee', 'admin'],
              description: 'User role in the system'
            },
            status: {
              type: 'string',
              enum: ['active', 'suspended', 'deleted', 'pending_verification'],
              description: 'User account status'
            },
            firstName: {
              type: 'string',
              description: 'User first name'
            },
            lastName: {
              type: 'string',
              description: 'User last name'
            },
            phoneNumber: {
              type: 'string',
              pattern: '^\\+359[0-9]{8,9}$',
              description: 'Bulgarian phone number'
            },
            businessId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated business ID'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            },
            dataRetentionUntil: {
              type: 'string',
              format: 'date-time',
              description: 'When user data will be automatically deleted'
            },
            isGdprCompliant: {
              type: 'boolean',
              description: 'Whether user account is GDPR compliant'
            }
          }
        },
        
        UserRegistration: {
          type: 'object',
          required: ['email', 'password', 'firstName', 'lastName', 'phoneNumber', 'role', 'gdprConsents'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            password: {
              type: 'string',
              minLength: 8,
              pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]',
              description: 'Password with uppercase, lowercase, number and special character'
            },
            firstName: {
              type: 'string',
              minLength: 1,
              maxLength: 50,
              pattern: '^[a-zA-ZА-Яа-я\\s]+$',
              description: 'First name (Bulgarian and Latin characters)'
            },
            lastName: {
              type: 'string',
              minLength: 1,
              maxLength: 50,
              pattern: '^[a-zA-ZА-Яа-я\\s]+$',
              description: 'Last name (Bulgarian and Latin characters)'
            },
            phoneNumber: {
              type: 'string',
              pattern: '^\\+359[0-9]{8,9}$',
              description: 'Bulgarian phone number (+359xxxxxxxxx)'
            },
            role: {
              type: 'string',
              enum: ['tradesperson', 'employee', 'admin']
            },
            businessId: {
              type: 'string',
              format: 'uuid',
              description: 'Business ID (optional for employees)'
            },
            gdprConsents: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['essential_service', 'analytics', 'marketing', 'third_party_integrations', 'data_sharing']
              },
              minItems: 1,
              description: 'Required GDPR consents'
            }
          }
        },
        
        AuthTokens: {
          type: 'object',
          properties: {
            accessToken: {
              type: 'string',
              description: 'JWT access token'
            },
            refreshToken: {
              type: 'string',
              description: 'JWT refresh token'
            },
            expiresIn: {
              type: 'integer',
              description: 'Token expiration time in seconds'
            },
            tokenType: {
              type: 'string',
              enum: ['Bearer']
            }
          }
        },
        
        // Bulgarian Business Schemas
        BulgarianBusiness: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            eik: {
              type: 'string',
              pattern: '^[0-9]{9}$|^[0-9]{13}$',
              description: 'Bulgarian ЕИК number (9 or 13 digits)'
            },
            ddsNumber: {
              type: 'string',
              pattern: '^BG[0-9]{9,10}$',
              description: 'Bulgarian ДДС number'
            },
            companyName: {
              type: 'string',
              description: 'Company name in Latin characters'
            },
            companyNameBg: {
              type: 'string',
              description: 'Company name in Bulgarian'
            },
            businessType: {
              type: 'string',
              enum: ['electrical', 'plumbing', 'hvac', 'general_contractor', 'other']
            },
            serviceAreas: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Sofia districts and other Bulgarian cities served'
            }
          }
        },
        
        // Conversation Schemas
        Conversation: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            businessId: {
              type: 'string',
              format: 'uuid'
            },
            customerPhoneNumber: {
              type: 'string',
              pattern: '^\\+359[0-9]{8,9}$'
            },
            platform: {
              type: 'string',
              enum: ['whatsapp', 'viber', 'telegram', 'sms', 'email']
            },
            state: {
              type: 'string',
              enum: ['initial_response', 'awaiting_description', 'analyzing', 'follow_up_questions', 'completed', 'closed']
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'emergency']
            },
            startedAt: {
              type: 'string',
              format: 'date-time'
            },
            lastMessageAt: {
              type: 'string',
              format: 'date-time'
            },
            gdprRetentionUntil: {
              type: 'string',
              format: 'date-time',
              description: 'When conversation data will be deleted'
            }
          }
        },
        
        // Analytics Schemas
        BusinessMetrics: {
          type: 'object',
          properties: {
            businessId: {
              type: 'string',
              format: 'uuid'
            },
            period: {
              type: 'object',
              properties: {
                start: {
                  type: 'string',
                  format: 'date-time'
                },
                end: {
                  type: 'string',
                  format: 'date-time'
                }
              }
            },
            missedCalls: {
              type: 'integer'
            },
            responsesSent: {
              type: 'integer'
            },
            conversationsStarted: {
              type: 'integer'
            },
            conversationsCompleted: {
              type: 'integer'
            },
            conversionRate: {
              type: 'number',
              description: 'Percentage of conversations that led to jobs'
            },
            averageResponseTime: {
              type: 'number',
              description: 'Average response time in minutes'
            }
          }
        },
        
        // Error Schemas
        ValidationError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR'
                },
                message: {
                  type: 'string',
                  example: 'Invalid input data'
                },
                details: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field: {
                        type: 'string'
                      },
                      message: {
                        type: 'string'
                      }
                    }
                  }
                }
              }
            },
            gdpr: {
              $ref: '#/components/schemas/GDPRMetadata'
            }
          }
        }
      },
      
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: false
                  },
                  error: {
                    type: 'object',
                    properties: {
                      code: {
                        type: 'string',
                        example: 'AUTHENTICATION_REQUIRED'
                      },
                      message: {
                        type: 'string',
                        example: 'Authentication required'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        
        RateLimitError: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: false
                  },
                  error: {
                    type: 'object',
                    properties: {
                      code: {
                        type: 'string',
                        example: 'RATE_LIMIT_EXCEEDED'
                      },
                      message: {
                        type: 'string',
                        example: 'Too many requests from this IP'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        
        GDPRComplianceError: {
          description: 'GDPR compliance issue',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: false
                  },
                  error: {
                    type: 'object',
                    properties: {
                      code: {
                        type: 'string',
                        example: 'GDPR_COMPLIANCE_ERROR'
                      },
                      message: {
                        type: 'string',
                        example: 'GDPR compliance requirements not met'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      
      parameters: {
        RequestId: {
          name: 'X-Request-ID',
          in: 'header',
          description: 'Optional request ID for tracing',
          schema: {
            type: 'string'
          }
        },
        
        GDPRConsent: {
          name: 'X-GDPR-Consent',
          in: 'header',
          description: 'GDPR consent status',
          schema: {
            type: 'string',
            enum: ['granted', 'withdrawn']
          }
        },
        
        DataProcessingBasis: {
          name: 'X-Data-Processing-Basis',
          in: 'header',
          description: 'Legal basis for data processing',
          schema: {
            type: 'string',
            enum: ['legitimate_interest', 'consent', 'contract', 'legal_obligation']
          }
        }
      }
    },
    
    security: [
      {
        bearerAuth: []
      }
    ],
    
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and session management'
      },
      {
        name: 'GDPR',
        description: 'Privacy rights and data protection'
      },
      {
        name: 'Users',
        description: 'User management operations'
      },
      {
        name: 'Business',
        description: 'Bulgarian business management'
      },
      {
        name: 'Conversations',
        description: 'AI-powered conversations'
      },
      {
        name: 'Analytics',
        description: 'Business metrics and reporting'
      },
      {
        name: 'System',
        description: 'System health and status'
      }
    ]
  },
  apis: [
    './src/controllers/*.ts',
    './src/routes/*.ts'
  ]
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  if (config.features.swagger) {
    // Swagger UI
    app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(specs, {
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info .title { color: #1976d2 }
        .swagger-ui .scheme-container { background: #f5f5f5; padding: 10px; border-radius: 4px; }
      `,
      customSiteTitle: 'ServiceText Pro API Documentation',
      customfavIcon: '/favicon.ico'
    }));

    // JSON spec
    app.get('/api/v1/docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(specs);
    });

    console.log(`📚 Swagger documentation available at: http://localhost:${config.app.port}/api/v1/docs`);
  }
}

export default specs;
