import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import './config/env.js';
import { env } from './config/env.js';
import { connectRedis } from './config/redis.js';
import authRoutes from './routes/auth.routes.js';
import weddingRoutes from './routes/wedding.routes.js';
import poolRoutes from './routes/pool.routes.js';
import contributionRoutes from './routes/contribution.routes.js';
import familyRoutes from './routes/family.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

const corsOrigins = env.CORS_ORIGIN.split(',').map((s) => s.trim());

app.use(helmet());
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);
app.use(express.json());

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Saukele API - Event Management System',
      version: '1.0.0',
      description: 'Wedding gift management system with family tree, escrow-based pool funding, and currency snapshot locking.',
    },
    servers: [{ url: `http://localhost:${env.PORT}`, description: 'Local dev' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: { type: 'array', items: { type: 'string' } },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            password: { type: 'string', format: 'password', example: 'Str0ng!Pass' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
            refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
          },
        },
        CreateWeddingRequest: {
          type: 'object',
          required: ['title', 'date'],
          properties: {
            title: { type: 'string', example: 'Айнұр & Бекзат тойы' },
            date: { type: 'string', format: 'date-time', example: '2025-07-15T12:00:00Z' },
            location: { type: 'string', example: 'Алматы, Қазақстан' },
          },
        },
        CreateWeddingResponse: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            coupleId: { type: 'integer', example: 2 },
            title: { type: 'string' },
            date: { type: 'string' },
            location: { type: 'string' },
            couple: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                fullName: { type: 'string' },
                email: { type: 'string' },
              },
            },
          },
        },
        CreatePoolRequest: {
          type: 'object',
          required: ['weddingId', 'name', 'targetKzt'],
          properties: {
            weddingId: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Kitchen Set' },
            description: { type: 'string', example: 'contribute to their new kitchen' },
            targetKzt: { type: 'integer', example: 500000 },
            familyOnly: { type: 'boolean', default: false },
          },
        },
        CreatePoolResponse: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            weddingId: { type: 'integer' },
            name: { type: 'string' },
            targetKzt: { type: 'integer' },
            remainingTarget: { type: 'integer' },
            status: { type: 'string' },
          },
        },
        CreateContributionRequest: {
          type: 'object',
          required: ['poolId', 'originalAmount', 'originalCurrency', 'idempotencyKey'],
          properties: {
            poolId: { type: 'integer', example: 1 },
            originalAmount: { type: 'number', example: 100 },
            originalCurrency: { type: 'string', example: 'USD' },
            idempotencyKey: { type: 'string', example: 'uniq-key-12345' },
          },
        },
        CreateContributionResponse: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            guestId: { type: 'integer' },
            poolId: { type: 'integer' },
            amountKzt: { type: 'integer' },
            originalAmount: { type: 'number' },
            originalCurrency: { type: 'string' },
            exchangeRate: { type: 'number' },
            lockedAt: { type: 'string', format: 'date-time' },
            status: { type: 'string' },
          },
        },
        FamilyTreeMember: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            memberId: { type: 'integer' },
            ancestorId: { type: 'integer', nullable: true },
            fullName: { type: 'string' },
            kinshipRank: { type: 'string' },
            distance: { type: 'integer' },
            giftObligation: { type: 'integer', nullable: true },
          },
        },
      },
    },
  },
  apis: ['./src/app.js', './src/routes/*.js'],
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Saukele API Docs',
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check endpoint
 *     responses:
 *       200:
 *         description: Service is healthy
 */

app.use('/auth', authRoutes);
app.use('/weddings', weddingRoutes);
app.use('/pools', poolRoutes);
app.use('/contributions', contributionRoutes);
app.use('/family', familyRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = env.PORT;

// Connect Redis then start server
connectRedis()
  .then(() => {
app.listen(PORT, () => {
  console.log(`[INFO] Server listening on port ${PORT}`);
  console.log(`[INFO] Swagger docs at http://localhost:${PORT}/api-docs`);
});
  })
  .catch((err) => {
    console.error('[FATAL] Failed to connect to Redis:', err);
    process.exit(1);
  });

export default app;

