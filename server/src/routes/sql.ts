import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { queryAsync, getSession } from '../db.js';

const sqlSchema = z.object({
  query: z.string().min(1),
});

export async function sqlRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    if (!sessionId || !getSession(sessionId)) {
      return reply.status(401).send({ error: 'Invalid or missing session' });
    }
  });

  app.post('/api/sql', async (request, reply) => {
    try {
      const { query } = sqlSchema.parse(request.body);
      const sessionId = request.headers['x-session-id'] as string;
      const result = await queryAsync(sessionId, query);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Query failed';
      return reply.status(400).send({ error: message });
    }
  });
}
