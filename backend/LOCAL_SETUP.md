# ServiceText Pro - Local Development Setup

This guide will help you set up ServiceText Pro backend for local development using your existing installations.

## Prerequisites

You already have:
- ✅ **Node.js**: Installed at `D:\NJS`
- ✅ **PostgreSQL**: Installed at `E:\postgre`
- ✅ **Node.js**: Required for the backend (install if needed)

## Quick Local Setup

### 1. Database Setup (PostgreSQL)

Since you already have PostgreSQL installed at `E:\postgre`, let's use it:

```bash
# Connect to your PostgreSQL instance
psql -U postgres -h localhost

# Create the database
CREATE DATABASE servicetext_pro;

# Create a user (optional, can use postgres user)
CREATE USER servicetext_user WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE servicetext_pro TO servicetext_user;
```

### 2. Environment Configuration

Copy the example environment file:
```bash
cd backend
cp config/env.example .env
```

Update `.env` with your local settings:
```env
# Application
NODE_ENV=development
PORT=3001

# Database (using your existing PostgreSQL)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=servicetext_pro
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-actual-password

# For small projects, we can skip MongoDB and Redis initially
# The app will use in-memory alternatives for development
```

### 3. Install Dependencies

```bash
cd backend
npm install
```

### 4. Initialize Database

The application will automatically create tables when you first run it:

```bash
npm run dev
```

## Simplified Architecture for Local Development

### Database Strategy
- **PostgreSQL Only**: Use your existing installation for all data
- **No MongoDB**: Store conversations and analytics in PostgreSQL tables
- **No Redis**: Use in-memory caching for development

### File Structure
```
backend/
├── src/
│   ├── server.ts              # Main server
│   ├── services/
│   │   ├── AuthService.ts     # Authentication
│   │   ├── GDPRService.ts     # Privacy rights
│   │   └── DatabaseService.ts # Simplified single DB service
│   ├── models/
│   │   └── LocalModels.ts     # PostgreSQL-only models
│   └── controllers/
│       ├── authController.ts  # Auth endpoints
│       └── gdprController.ts  # Privacy endpoints
├── config/
│   └── .env                   # Your local configuration
└── package.json
```

## Development Commands

```bash
# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Check types
npm run lint
```

## Local Development Features

### What's Included:
- ✅ **GDPR Compliance**: Full privacy rights implementation
- ✅ **Authentication**: JWT-based secure authentication
- ✅ **Bulgarian Support**: Complete localization
- ✅ **API Documentation**: Swagger UI at http://localhost:3001/api/v1/docs
- ✅ **Real-time Features**: WebSocket support
- ✅ **Security**: Production-grade security measures

### What's Simplified:
- 📦 **Single Database**: PostgreSQL only (no MongoDB/Redis needed)
- 🏠 **Local Only**: No cloud dependencies
- 💾 **File Storage**: Local file storage instead of cloud storage
- 📧 **Email**: Console logging instead of SendGrid (for development)
- 📱 **SMS**: Console logging instead of Twilio (for development)

## Testing the Setup

1. **Start the server**:
   ```bash
   npm run dev
   ```

2. **Check health**:
   ```bash
   curl http://localhost:3001/health
   ```

3. **View API docs**:
   Open http://localhost:3001/api/v1/docs in your browser

4. **Test registration**:
   ```bash
   curl -X POST http://localhost:3001/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "Test123!@#",
       "firstName": "Test",
       "lastName": "User",
       "phoneNumber": "+359888123456",
       "role": "tradesperson",
       "gdprConsents": ["essential_service"]
     }'
   ```

## Optional Enhancements (when you're ready)

### Add MongoDB (for conversations)
```bash
# Install MongoDB locally
# Download from: https://www.mongodb.com/try/download/community
# Or use MongoDB Atlas free tier
```

### Add Redis (for caching)
```bash
# Install Redis locally
# Download from: https://redis.io/download
# Or use Redis Cloud free tier
```

### External API Integration
When ready to test with real messaging platforms:
- WhatsApp Business API (requires Meta Business account)
- Viber Business Messages (requires Rakuten Viber account)
- Telegram Bot API (free, just create a bot)

## Troubleshooting

### PostgreSQL Connection Issues
```bash
# Check if PostgreSQL is running
pg_ctl status

# Start PostgreSQL if needed
pg_ctl start -D "E:\postgre\data"
```

### Port Conflicts
If port 3001 is busy, change it in `.env`:
```env
PORT=3002
```

### Permission Issues
Make sure your PostgreSQL user has the necessary permissions:
```sql
GRANT ALL PRIVILEGES ON DATABASE servicetext_pro TO postgres;
```

## Next Steps

1. **Start with basics**: Get the server running with PostgreSQL
2. **Test authentication**: Register and login users
3. **Explore GDPR features**: Test privacy rights endpoints
4. **Add messaging**: Integrate with Telegram bot (easiest to start)
5. **Expand gradually**: Add MongoDB and Redis when you need the scale

This setup gives you a fully functional, GDPR-compliant backend that can handle real Bulgarian tradespeople without any cloud dependencies!
