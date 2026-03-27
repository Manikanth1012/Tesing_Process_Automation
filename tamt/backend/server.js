require('dotenv').config();
const app = require('./src/app');
const { reindexAll } = require('./src/services/vectorService');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`TAMT Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`API Base: http://localhost:${PORT}/api/v1`);

  // Background: index all existing platform data for RAG on first start
  reindexAll().catch(err => console.warn('[VectorService] Startup index warning:', err.message));
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
