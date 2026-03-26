/**
 * SSE Service — singleton event emitter for server-sent events.
 * Maintains a Map of channelId -> Set<res> so multiple clients
 * can subscribe to the same agent run or RF execution channel.
 */

const channels = new Map(); // channelId -> Set of response objects

function addClient(channelId, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');

  if (!channels.has(channelId)) channels.set(channelId, new Set());
  channels.get(channelId).add(res);

  // Heartbeat every 20s to keep connection alive
  const heartbeat = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(heartbeat);
      removeClient(channelId, res);
      return;
    }
    res.write(': heartbeat\n\n');
  }, 20000);

  res.on('close', () => {
    clearInterval(heartbeat);
    removeClient(channelId, res);
  });
}

function removeClient(channelId, res) {
  const clients = channels.get(channelId);
  if (clients) {
    clients.delete(res);
    if (clients.size === 0) channels.delete(channelId);
  }
}

function sendToChannel(channelId, eventType, data) {
  const clients = channels.get(channelId);
  if (!clients || clients.size === 0) return;

  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    if (!res.writableEnded) {
      res.write(payload);
    }
  }
}

function closeChannel(channelId) {
  const clients = channels.get(channelId);
  if (clients) {
    for (const res of clients) {
      if (!res.writableEnded) res.end();
    }
    channels.delete(channelId);
  }
}

module.exports = { addClient, removeClient, sendToChannel, closeChannel };
