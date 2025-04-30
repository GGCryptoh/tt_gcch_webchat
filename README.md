# Azure OpenAI Web Chat for GCC High

A web-based chat application running on Node.js that connects to an Azure OpenAI endpoint in GCC High. The application provides a simple, Microsoft Teams-like interface for sending user prompts to Azure AI Foundry, receiving responses, and displaying them in real-time with streaming capabilities.

## Features

- Clean, Teams-like chat interface
- Password protection for accessing the chat interface
- Streaming responses from Azure AI Foundry
- Real-time message display
- Loading indicators during response generation
- Conversation history tracking
- Responsive design

## Prerequisites

- Node.js 22 LTS or higher
- An Azure AI Foundry endpoint in GCC High with API key

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd tt_gcch_webchat
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with your Azure AI Foundry credentials:

```
AZURE_AIFOUNDRY_ENDPOINTKEY=your_endpoint_key
AZURE_AIFOUNDRY_ENDPOINTURL=your_endpoint_url
```

4. Create a `.env.local` file with the password to access the chat:

```
PASSWORD=your_secure_password
```

## Running the Application

### Development Mode

To run the application in development mode with auto-restart on file changes:

```bash
npm run dev
```

### Production Mode

To run the application in production mode:

```bash
npm start
```

The application will be available at `http://localhost:3000` (or the port specified in your environment variables).

## Deployment to Azure Web App

This application is designed to be easily deployed to an Azure Web App in GCC High:

1. Create an Azure Web App with Node.js 22 LTS
2. Configure the application settings to include your environment variables:
   - `AZURE_AIFOUNDRY_ENDPOINTKEY`
   - `AZURE_AIFOUNDRY_ENDPOINTURL`
   - `PASSWORD` (the password required to access the chat interface)
3. Deploy the code using your preferred method (Git, GitHub Actions, Azure DevOps)

## API Endpoints

- `POST /api/chat`: Send a message to the AI Foundry service
  - Request body: `{ "message": "Your message", "conversationHistory": [] }`
  - Response: Server-sent events with streaming response chunks

- `POST /api/verify-password`: Verify the password to access the chat
  - Request body: `{ "password": "your_password" }`
  - Response: `{ "success": true }` or `{ "success": false, "error": "Invalid password" }`

- `GET /api/health`: Health check endpoint
  - Response: `{ "status": "ok" }`

## Security Considerations

- The application uses Helmet for setting secure HTTP headers
- CORS is enabled with default settings
- Password protection prevents unauthorized access to the chat interface
- The password is stored in the server's environment variables
- Session persistence uses sessionStorage (cleared when browser is closed)

## License

MIT 