require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const https = require('https');
const axios = require('axios');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"]
    }
  }
})); 
app.use(cors()); 
app.use(morgan('combined')); 
app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'public'))); 

// AI Foundry Client
const callAIFoundry = async (messages) => {
  const endpoint = process.env.AZURE_AIFOUNDRY_ENDPOINTURL;
  const apiKey = process.env.AZURE_AIFOUNDRY_ENDPOINTKEY;

  if (!endpoint || !apiKey) {
    throw new Error('AI Foundry endpoint or key not configured');
  }

  const payload = {
    messages,
    max_tokens: 1000,
    temperature: 0.7,
    stream: true
  };

  const headers = {
    'Content-Type': 'application/json',
    'api-key': apiKey
  };

  return axios.post(endpoint, payload, {
    headers,
    responseType: 'stream'
  });
};

// API Routes
// POST /api/chat - Chat with Azure OpenAI
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Prepare messages for AI Foundry
    const messages = [
      { role: 'system', content: 'You are a helpful AI assistant.' },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    // Set up SSE for streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Stream the chat completions
    const response = await callAIFoundry(messages);
    
    let completeResponse = '';
    
    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.substring(6));
            const delta = data.choices?.[0]?.delta?.content || '';
            completeResponse += delta;
            
            // Send each chunk to the client
            res.write(`data: ${JSON.stringify({ delta, text: completeResponse })}\n\n`);
          } catch (e) {
            console.error('Error parsing chunk:', e);
          }
        } else if (line === 'data: [DONE]') {
          res.write('data: [DONE]\n\n');
        }
      }
    });
    
    response.data.on('end', () => {
      res.end();
    });
    
    response.data.on('error', (err) => {
      console.error('Stream error:', err);
      res.write(`data: ${JSON.stringify({ error: 'Stream error occurred' })}\n\n`);
      res.end();
    });
    
  } catch (error) {
    console.error('Error in chat API:', error);
    
    // If headers already sent, we need to end the stream with an error
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: 'An error occurred during chat processing' })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: 'An error occurred during chat processing' });
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Password verification endpoint
app.post('/api/verify-password', (req, res) => {
  const { password } = req.body;
  const correctPassword = process.env.PASSWORD;

  if (!correctPassword) {
    return res.status(500).json({ error: 'Password not configured on server' });
  }

  if (password === correctPassword) {
    return res.status(200).json({ success: true });
  } else {
    return res.status(401).json({ success: false, error: 'Invalid password' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`AI Foundry Endpoint: ${process.env.AZURE_AIFOUNDRY_ENDPOINTURL ? 'Configured' : 'Not Configured'}`);
  console.log(`AI Foundry API Key: ${process.env.AZURE_AIFOUNDRY_ENDPOINTKEY ? 'Configured' : 'Not Configured'}`);
}); 