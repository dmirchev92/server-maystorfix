// Simple test to see if the validation endpoint is being called
const express = require('express');
const app = express();

// Middleware to log all requests
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${timestamp} - ${req.method} ${req.url}`);
  next();
});

// Test endpoint to see if requests are coming through
app.get('/api/v1/chat/public/:spIdentifier/validate/:token', (req, res) => {
  const { spIdentifier, token } = req.params;
  console.log(`🔍 TOKEN VALIDATION REQUEST RECEIVED:`);
  console.log(`   SP Identifier: ${spIdentifier}`);
  console.log(`   Token: ${token}`);
  console.log(`   Time: ${new Date().toLocaleTimeString()}`);
  
  res.json({
    success: true,
    message: 'Test endpoint - validation request detected',
    data: { spIdentifier, token }
  });
});

const port = 3001; // Different port to avoid conflicts
app.listen(port, () => {
  console.log(`🔍 Request monitor running on port ${port}`);
  console.log('This will show if the frontend is making validation requests');
  console.log('Open chat URL and watch for requests here');
});
