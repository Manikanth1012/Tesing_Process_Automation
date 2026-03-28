const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const { authenticate } = require('./middleware/auth');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Routes
const featuresRouter = require('./routes/features');
const prerequisitesRouter = require('./routes/prerequisites');
const testPlansRouter = require('./routes/testPlans');
const testCasesRouter = require('./routes/testCases');
const testRunsRouter = require('./routes/testRuns');
const testExecutionsRouter = require('./routes/testExecutions');
const defectsRouter = require('./routes/defects');
const environmentsRouter = require('./routes/environments');
const reportsRouter = require('./routes/reports');
const agentsRouter = require('./routes/agents');
const rfRouter = require('./routes/rf');
const authRouter = require('./routes/auth');
const refTemplatesRouter = require('./routes/referenceTemplates');
const projectsRouter = require('./routes/projects');
const usersRouter = require('./routes/users');
const assistantRouter = require('./routes/assistant');
const skillsRouter    = require('./routes/skills');
const configRouter      = require('./routes/config');
const permissionsRouter = require('./routes/permissions');

const app = express();

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check (no auth)
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Auth (no auth middleware on auth routes)
app.use('/api/v1/auth', authRouter);

// Apply auth middleware to all other API routes
app.use('/api/v1', authenticate);

app.use('/api/v1/features', featuresRouter);
app.use('/api/v1/prerequisites', prerequisitesRouter);
app.use('/api/v1/test-plans', testPlansRouter);
app.use('/api/v1/test-cases', testCasesRouter);
app.use('/api/v1/test-runs', testRunsRouter);
app.use('/api/v1/test-executions', testExecutionsRouter);
app.use('/api/v1/defects', defectsRouter);
app.use('/api/v1/environments', environmentsRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/agents', agentsRouter);
app.use('/api/v1/rf', rfRouter);
app.use('/api/v1/ref-templates', refTemplatesRouter);
app.use('/api/v1/projects', projectsRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/assistant', assistantRouter);
app.use('/api/v1/skills', skillsRouter);
app.use('/api/v1/config', configRouter);
app.use('/api/v1/permissions', permissionsRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
