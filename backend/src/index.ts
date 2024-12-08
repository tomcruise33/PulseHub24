import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import WebSocketService from './services/websocket';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const port = process.env.PORT || 3005;

// Enable CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3003',
  methods: ['GET', 'POST'],
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Initialize WebSocket service
let wsService: WebSocketService;
try {
  wsService = new WebSocketService();
} catch (error) {
  console.error('Failed to initialize WebSocket service:', error);
}

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
