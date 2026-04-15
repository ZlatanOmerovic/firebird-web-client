import Fastify from 'fastify';
import cors from '@fastify/cors';
import { connectionRoutes } from './routes/connection.js';
import { schemaRoutes } from './routes/schema.js';
import { dataRoutes } from './routes/data.js';
import { sqlRoutes } from './routes/sql.js';
import { exportRoutes } from './routes/export.js';

const app = Fastify({ logger: true });

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const CORS_ORIGIN = process.env['CORS_ORIGIN'] ?? 'http://localhost:5173';

await app.register(cors, { origin: CORS_ORIGIN });

await app.register(connectionRoutes);
await app.register(schemaRoutes);
await app.register(dataRoutes);
await app.register(sqlRoutes);
await app.register(exportRoutes);

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
