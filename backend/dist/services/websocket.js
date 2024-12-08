"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const NewsAggregator_1 = require("./aggregator/NewsAggregator");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
class WebSocketService {
    constructor() {
        this.wss = null;
        this.aggregator = null;
        this.pingInterval = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.pingIntervalMs = 30000; // 30 seconds
        this.clients = new Map();
        this.setupWebSocket();
        this.setupAggregator();
    }
    setupWebSocket() {
        const port = parseInt(process.env.WS_PORT || '3006', 10);
        console.log(`Setting up WebSocket server on port ${port}...`);
        try {
            this.wss = new ws_1.default.Server({
                port,
                perMessageDeflate: false,
                clientTracking: true
            });
            this.wss.on('listening', () => {
                console.log(`WebSocket server is listening on port ${port}`);
                this.reconnectAttempts = 0;
                this.startPingInterval();
            });
            this.wss.on('error', (error) => {
                console.error('WebSocket server error:', error);
                if (error.code === 'EADDRINUSE') {
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        console.log(`Port is in use, retrying in 5 seconds... (Attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
                        setTimeout(() => {
                            if (this.wss) {
                                this.wss.close();
                                this.reconnectAttempts++;
                                this.setupWebSocket();
                            }
                        }, 5000);
                    }
                    else {
                        console.error('Max reconnection attempts reached. Please check if another instance is running.');
                    }
                }
            });
            this.wss.on('connection', (ws) => {
                var _a;
                console.log('Client connected');
                const clientState = {
                    ws,
                    lastPing: Date.now(),
                    isAlive: true
                };
                this.clients.set(ws, clientState);
                // Send initial data
                if ((_a = this.aggregator) === null || _a === void 0 ? void 0 : _a.getArticles) {
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
                ws.on('message', (message) => {
                    try {
                        const data = JSON.parse(message.toString());
                        console.log('Received message:', data);
                        // Handle client messages here
                        if (data.type === 'ping') {
                            this.sendToClient(ws, { type: 'pong', data: null });
                        }
                    }
                    catch (error) {
                        console.error('Error parsing message:', error);
                    }
                });
                ws.on('close', () => {
                    console.log('Client disconnected');
                    this.clients.delete(ws);
                });
                ws.on('error', (error) => {
                    console.error('WebSocket client error:', error);
                    // Clean up the client
                    this.clients.delete(ws);
                    try {
                        ws.terminate();
                    }
                    catch (e) {
                        console.error('Error terminating client:', e);
                    }
                });
            });
        }
        catch (error) {
            console.error('Error setting up WebSocket server:', error);
        }
    }
    setupAggregator() {
        try {
            this.aggregator = new NewsAggregator_1.NewsAggregator();
            this.aggregator.initialize();
            this.aggregator.on('update', (articles) => {
                this.broadcast({
                    type: 'update',
                    data: articles
                });
            });
            this.aggregator.on('error', (error) => {
                console.error('News aggregator error:', error);
                this.broadcast({
                    type: 'error',
                    data: { message: 'News aggregation error occurred' }
                });
            });
        }
        catch (error) {
            console.error('Error setting up news aggregator:', error);
        }
    }
    startPingInterval() {
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
                }
                catch (error) {
                    console.error('Error sending ping:', error);
                    this.clients.delete(ws);
                    ws.terminate();
                }
            });
        }, this.pingIntervalMs);
    }
    sendToClient(ws, message) {
        if (ws.readyState === ws_1.default.OPEN) {
            try {
                ws.send(JSON.stringify(message));
            }
            catch (error) {
                console.error('Error sending message to client:', error);
                const state = this.clients.get(ws);
                if (state) {
                    this.clients.delete(ws);
                    try {
                        ws.terminate();
                    }
                    catch (e) {
                        console.error('Error terminating client:', e);
                    }
                }
            }
        }
    }
    broadcast(message) {
        if (!this.wss)
            return;
        this.clients.forEach((state, ws) => {
            this.sendToClient(ws, message);
        });
    }
    shutdown() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        this.clients.forEach((state, ws) => {
            try {
                ws.close();
            }
            catch (error) {
                console.error('Error closing client connection:', error);
            }
        });
        this.clients.clear();
        if (this.wss) {
            try {
                this.wss.close(() => {
                    console.log('WebSocket server shut down');
                });
            }
            catch (error) {
                console.error('Error shutting down WebSocket server:', error);
            }
        }
    }
}
exports.default = WebSocketService;
