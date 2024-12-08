import WebSocket from 'ws';
import { NewsAggregator } from './aggregator/NewsAggregator';
import { NewsArticle } from './aggregator/sources/BaseSource';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface WebSocketMessage {
  type: string;
  data: any;
}

interface ClientState {
  ws: WebSocket;
  lastPing: number;
  isAlive: boolean;
}

export default class WebSocketService {
  private wss: WebSocket.Server | null = null;
  private aggregator: NewsAggregator | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5;
  private readonly pingIntervalMs: number = 30000; // 30 seconds
  private readonly clients: Map<WebSocket, ClientState> = new Map();

  constructor() {
    this.setupWebSocket();
    this.setupAggregator();
  }

  private setupWebSocket(): void {
    const port = parseInt(process.env.WS_PORT || '3006', 10);
    console.log(`Setting up WebSocket server on port ${port}...`);
    
    try {
      this.wss = new WebSocket.Server({ 
        port,
        perMessageDeflate: false,
        clientTracking: true
      });

      this.wss.on('listening', () => {
        console.log(`WebSocket server is listening on port ${port}`);
        this.reconnectAttempts = 0;
        this.startPingInterval();
      });

      this.wss.on('error', (error: Error) => {
        console.error('WebSocket server error:', error);
        if ((error as any).code === 'EADDRINUSE') {
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log(`Port is in use, retrying in 5 seconds... (Attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
            setTimeout(() => {
              if (this.wss) {
                this.wss.close();
                this.reconnectAttempts++;
                this.setupWebSocket();
              }
            }, 5000);
          } else {
            console.error('Max reconnection attempts reached. Please check if another instance is running.');
          }
        }
      });

      this.wss.on('connection', (ws: WebSocket) => {
        console.log('Client connected');
        
        const clientState: ClientState = {
          ws,
          lastPing: Date.now(),
          isAlive: true
        };
        this.clients.set(ws, clientState);

        // Send initial data
        if (this.aggregator?.getArticles) {
          const articles = this.aggregator.getArticles();
          this.sendToClient(ws, {
            type: 'initial',
            data: articles
          });
        }

        ws.on('pong', () => {
          const state = this.clients.get(ws);
          if (state) {
            state.isAlive = true;
            state.lastPing = Date.now();
          }
        });

        ws.on('message', (message: WebSocket.RawData) => {
          try {
            const data = JSON.parse(message.toString());
            console.log('Received message:', data);
            
            // Handle client messages here
            if (data.type === 'ping') {
              this.sendToClient(ws, { type: 'pong', data: null });
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        });

        ws.on('close', () => {
          console.log('Client disconnected');
          this.clients.delete(ws);
        });

        ws.on('error', (error: Error) => {
          console.error('WebSocket client error:', error);
          // Clean up the client
          this.clients.delete(ws);
          try {
            ws.terminate();
          } catch (e) {
            console.error('Error terminating client:', e);
          }
        });
      });
    } catch (error) {
      console.error('Error setting up WebSocket server:', error);
    }
  }

  private setupAggregator(): void {
    try {
      this.aggregator = new NewsAggregator();
      this.aggregator.initialize();
      
      this.aggregator.on('update', (articles: NewsArticle[]) => {
        this.broadcast({
          type: 'update',
          data: articles
        });
      });

      this.aggregator.on('error', (error: Error) => {
        console.error('News aggregator error:', error);
        this.broadcast({
          type: 'error',
          data: { message: 'News aggregation error occurred' }
        });
      });
    } catch (error) {
      console.error('Error setting up news aggregator:', error);
    }
  }

  private startPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      this.clients.forEach((state, ws) => {
        if (!state.isAlive) {
          console.log('Client unresponsive, terminating connection');
          this.clients.delete(ws);
          return ws.terminate();
        }

        state.isAlive = false;
        try {
          ws.ping();
        } catch (error) {
          console.error('Error sending ping:', error);
          this.clients.delete(ws);
          ws.terminate();
        }
      });
    }, this.pingIntervalMs);
  }

  private sendToClient(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending message to client:', error);
        const state = this.clients.get(ws);
        if (state) {
          this.clients.delete(ws);
          try {
            ws.terminate();
          } catch (e) {
            console.error('Error terminating client:', e);
          }
        }
      }
    }
  }

  private broadcast(message: WebSocketMessage): void {
    if (!this.wss) return;
    
    this.clients.forEach((state, ws) => {
      this.sendToClient(ws, message);
    });
  }

  public shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.clients.forEach((state, ws) => {
      try {
        ws.close();
      } catch (error) {
        console.error('Error closing client connection:', error);
      }
    });
    this.clients.clear();

    if (this.wss) {
      try {
        this.wss.close(() => {
          console.log('WebSocket server shut down');
        });
      } catch (error) {
        console.error('Error shutting down WebSocket server:', error);
      }
    }
  }
}
