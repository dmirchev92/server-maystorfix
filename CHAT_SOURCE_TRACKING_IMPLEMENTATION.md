# Chat Source Tracking Implementation

## Overview
Implemented a comprehensive chat source tracking system that tags conversations and cases based on their origin, with dashboard statistics for tracking SMS chat conversions.

## Database Changes

### Tables Modified
1. **marketplace_conversations**
   - Added column: `chat_source VARCHAR(50) DEFAULT 'direct'`
   - Index: `idx_conversations_chat_source`

2. **marketplace_service_cases**
   - Added column: `chat_source VARCHAR(50)`
   - Index: `idx_service_cases_chat_source`

## Chat Source Tags

### 1. **smschat** 
- **When**: Chat is opened from SMS token link
- **Location**: `/var/www/servicetextpro/backend/src/services/ChatTokenService.ts` (line 312)
- **Trigger**: When customer clicks SMS link like `https://maystorfix.com/u/[spIdentifier]/c/[token]`

### 2. **searchchat**
- **When**: Chat is opened from search page
- **Location**: `/var/www/servicetextpro/Marketplace/src/app/search/page.tsx` (line 279)
- **Trigger**: When customer clicks "Chat" button on service provider profile in search results

### 3. **direct**
- **When**: Default for all other chat sources
- **Examples**: Direct navigation, other entry points

## Backend Changes

### Modified Files

1. **`/backend/src/types/chat.types.ts`**
   - Added `chatSource?: string` to `CreateConversationRequest` interface

2. **`/backend/src/validators/chatSchemas.ts`**
   - Added `chatSource` to `createConversationSchema` validation

3. **`/backend/src/models/ChatRepository.ts`**
   - Updated `createConversation` to accept and store `chatSource`

4. **`/backend/src/services/ChatService.ts`**
   - Pass `chatSource` from request to repository

5. **`/backend/src/services/ChatTokenService.ts`**
   - Tag SMS token conversations with `'smschat'`

6. **`/backend/src/controllers/caseController.ts`**
   - Inherit `chat_source` from conversation when creating cases (lines 53-68)
   - Add `chat_source` to case INSERT statement (line 141)
   - New endpoint: `getCaseStatsByChatSource` (lines 1927-1983)

7. **`/backend/src/server.ts`**
   - Added route: `GET /api/v1/cases/stats/chat-source` (line 464)

## Frontend Changes

### Modified Files

1. **`/Marketplace/src/lib/api.ts`**
   - Added `chatSource` parameter to conversation creation methods
   - Pass `chatSource` in API payload (line 192)

2. **`/Marketplace/src/app/search/page.tsx`**
   - Tag search conversations with `'searchchat'` (line 279)

3. **`/Marketplace/src/app/create-case/page.tsx`**
   - Already updated in previous work (passes conversationId to backend)

## New API Endpoint

### GET `/api/v1/cases/stats/chat-source`

**Query Parameters:**
- `providerId` (optional) - Filter stats by specific provider

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": [
      {
        "chat_source": "smschat",
        "count": "15",
        "completed_count": "10",
        "pending_count": "5"
      },
      {
        "chat_source": "searchchat",
        "count": "8",
        "completed_count": "6",
        "pending_count": "2"
      },
      {
        "chat_source": "direct",
        "count": "12",
        "completed_count": "9",
        "pending_count": "3"
      }
    ],
    "totals": {
      "smschat": 15,
      "searchchat": 8,
      "direct": 12,
      "total": 35
    }
  }
}
```

## Usage Examples

### Get SMS Chat Statistics for All Providers
```bash
curl https://maystorfix.com/api/v1/cases/stats/chat-source
```

### Get SMS Chat Statistics for Specific Provider
```bash
curl https://maystorfix.com/api/v1/cases/stats/chat-source?providerId=USER_ID_HERE
```

## Dashboard Integration

To display SMS chat case counter in dashboard:

```typescript
// Example React component
const SMSChatStats = () => {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    fetch('/api/v1/cases/stats/chat-source?providerId=YOUR_ID')
      .then(res => res.json())
      .then(data => setStats(data.data.totals));
  }, []);
  
  return (
    <div>
      <h3>SMS Chat Cases: {stats?.smschat || 0}</h3>
      <h3>Search Chat Cases: {stats?.searchchat || 0}</h3>
      <h3>Direct Cases: {stats?.direct || 0}</h3>
      <h3>Total: {stats?.total || 0}</h3>
    </div>
  );
};
```

## Testing

### Test SMS Chat Flow
1. Send SMS with token link to customer
2. Customer clicks link → Opens chat
3. Customer creates case from chat
4. Check database: `SELECT chat_source FROM marketplace_service_cases WHERE id = 'CASE_ID'`
5. Should return: `smschat`

### Test Search Chat Flow
1. Go to https://maystorfix.com/search
2. Click "Chat" on any provider
3. Create case from chat
4. Check database: Should return `searchchat`

### Verify Statistics
```sql
-- Check conversation sources
SELECT chat_source, COUNT(*) 
FROM marketplace_conversations 
GROUP BY chat_source;

-- Check case sources
SELECT chat_source, COUNT(*) 
FROM marketplace_service_cases 
GROUP BY chat_source;
```

## Migration SQL

Already applied to database:
```sql
ALTER TABLE marketplace_conversations 
ADD COLUMN IF NOT EXISTS chat_source VARCHAR(50) DEFAULT 'direct';

ALTER TABLE marketplace_service_cases 
ADD COLUMN IF NOT EXISTS chat_source VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_conversations_chat_source 
ON marketplace_conversations(chat_source);

CREATE INDEX IF NOT EXISTS idx_service_cases_chat_source 
ON marketplace_service_cases(chat_source);
```

## Notes

- All existing conversations/cases will have `chat_source = 'direct'` by default
- New conversations automatically tagged based on entry point
- Cases inherit `chat_source` from their parent conversation
- Statistics endpoint supports filtering by provider for personalized dashboards
