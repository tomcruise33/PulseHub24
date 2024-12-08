const setupWebSocket = (wss) => {
  wss.on('connection', (ws) => {
    console.log('New client connected');

    // Send initial data
    ws.send(JSON.stringify({ type: 'connection', message: 'Connected to PulseHub24' }));

    // Handle incoming messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        handleWebSocketMessage(ws, data);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });
};

const handleWebSocketMessage = (ws, data) => {
  switch (data.type) {
    case 'subscribe':
      // Handle subscription to specific news topics or regions
      break;
    case 'unsubscribe':
      // Handle unsubscription
      break;
    default:
      console.log('Unknown message type:', data.type);
  }
};

const broadcastNews = (wss, news) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'news',
        data: news
      }));
    }
  });
};

module.exports = {
  setupWebSocket,
  broadcastNews
};
