import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { attachAsync, createSession, getSession, getSessionConfig, updateSessionDb, deleteSession, detachAsync, queryAsync } from '../db.js';

const execAsync = promisify(exec);

interface DatabaseAlias {
  alias: string;
  path: string;
}

function parseConfContent(content: string): DatabaseAlias[] {
  const aliases: DatabaseAlias[] = [];
  let insideBlock = false;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed === '{' || trimmed.startsWith('{')) { insideBlock = true; continue; }
    if (trimmed === '}' || trimmed.startsWith('}')) { insideBlock = false; continue; }
    if (insideBlock) continue;
    const match = trimmed.match(/^(\S+)\s*=\s*(.+)$/);
    if (match) {
      const alias = match[1];
      const path = match[2].trim();
      if (alias === 'security.db') continue;
      aliases.push({ alias, path });
    }
  }
  return aliases;
}

async function parseDatabasesConf(host: string, port: number): Promise<DatabaseAlias[]> {
  const isLocal = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host);

  // 1. Try local bare metal paths first
  if (isLocal) {
    const localPaths = [
      // Linux
      '/opt/firebird/databases.conf',
      '/usr/local/firebird/databases.conf',
      '/etc/firebird/3.0/databases.conf',
      '/etc/firebird/4.0/databases.conf',
      '/etc/firebird/5.0/databases.conf',
      '/etc/firebird/databases.conf',
      // macOS (Homebrew)
      '/usr/local/etc/firebird/databases.conf',
      '/opt/homebrew/etc/firebird/databases.conf',
      // Windows (common)
      'C:\\Program Files\\Firebird\\Firebird_5_0\\databases.conf',
      'C:\\Program Files\\Firebird\\Firebird_4_0\\databases.conf',
      'C:\\Program Files\\Firebird\\Firebird_3_0\\databases.conf',
      'C:\\Program Files (x86)\\Firebird\\Firebird_3_0\\databases.conf',
    ];

    for (const p of localPaths) {
      try {
        if (existsSync(p)) {
          const content = await readFile(p, 'utf-8');
          if (content.trim()) return parseConfContent(content);
        }
      } catch { continue; }
    }
  }

  // 2. Try Docker containers
  try {
    const { stdout: containers } = await execAsync(
      `docker ps --format '{{.ID}} {{.Ports}}' 2>/dev/null`
    );

    let containerId: string | null = null;
    for (const line of containers.trim().split('\n')) {
      if (!line) continue;
      if (line.includes(`:${port}->`)) {
        containerId = line.split(' ')[0];
        break;
      }
    }

    if (containerId) {
      const dockerPaths = [
        '/firebird/etc/databases.conf',
        '/usr/local/firebird/databases.conf',
        '/opt/firebird/databases.conf',
        '/etc/firebird/databases.conf',
      ];

      for (const p of dockerPaths) {
        try {
          const { stdout } = await execAsync(`docker exec ${containerId} cat ${p} 2>/dev/null`);
          if (stdout.trim()) return parseConfContent(stdout);
        } catch { continue; }
      }
    }
  } catch {
    // Docker not available
  }

  return [];
}

interface DatabaseInfo {
  name: string;
  path: string;
  source: 'alias' | 'file';
}

async function discoverDatabases(host: string, port: number): Promise<DatabaseInfo[]> {
  const results: DatabaseInfo[] = [];
  const seen = new Set<string>();

  // 1. Aliases from databases.conf
  try {
    const aliases = await parseDatabasesConf(host, port);
    for (const a of aliases) {
      const name = a.alias.toLowerCase();
      if (!seen.has(name)) {
        seen.add(name);
        results.push({ name: a.alias, path: a.path, source: 'alias' });
      }
    }
  } catch { /* ignore */ }

  // 2. Filesystem scan for .fdb files
  const isLocal = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host);

  // Try Docker container first
  try {
    const { stdout: containers } = await execAsync(`docker ps --format '{{.ID}} {{.Ports}}' 2>/dev/null`);
    let containerId: string | null = null;
    for (const line of containers.trim().split('\n')) {
      if (!line) continue;
      if (line.includes(`:${port}->`)) { containerId = line.split(' ')[0]; break; }
    }
    if (containerId) {
      const scanPaths = ['/firebird/data', '/opt/firebird/data', '/var/lib/firebird/data', '/tmp'];
      for (const dir of scanPaths) {
        try {
          const { stdout } = await execAsync(`docker exec ${containerId} find ${dir} -maxdepth 2 -name '*.fdb' -o -name '*.FDB' 2>/dev/null`, { timeout: 5000 });
          for (const line of stdout.trim().split('\n')) {
            if (!line) continue;
            const name = line.split('/').pop()?.replace(/\.(fdb|FDB)$/, '') ?? '';
            if (name && !seen.has(name.toLowerCase())) {
              seen.add(name.toLowerCase());
              results.push({ name, path: line, source: 'file' });
            }
          }
        } catch { continue; }
      }
    }
  } catch { /* Docker not available */ }

  // Local filesystem scan
  if (isLocal) {
    const localDirs = ['/opt/firebird/data', '/var/lib/firebird/data', '/tmp', '/firebird/data'];
    for (const dir of localDirs) {
      try {
        if (!existsSync(dir)) continue;
        const { stdout } = await execAsync(`find ${dir} -maxdepth 2 \\( -name '*.fdb' -o -name '*.FDB' \\) 2>/dev/null`, { timeout: 5000 });
        for (const line of stdout.trim().split('\n')) {
          if (!line) continue;
          const name = line.split('/').pop()?.replace(/\.(fdb|FDB)$/, '') ?? '';
          if (name && !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            results.push({ name, path: line, source: 'file' });
          }
        }
      } catch { continue; }
    }
  }

  return results;
}

const connectSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive().default(3050),
  database: z.string().default(''),
  user: z.string().min(1),
  password: z.string(),
});

export async function connectionRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/connect', async (request, reply) => {
    try {
      const config = connectSchema.parse(request.body);
      const sessionId = crypto.randomUUID();

      if (!config.database) {
        // No-database mode: discover databases, create pending session
        const databases = await discoverDatabases(config.host, config.port);
        createSession(sessionId, null, config);
        return { sessionId, databases, noDatabase: true };
      }

      const db = await attachAsync(config);
      createSession(sessionId, db, config);
      const databases = await discoverDatabases(config.host, config.port).catch(() => []);
      return { sessionId, databases };
    } catch (err: unknown) {
      const message = (err instanceof Error && err.message) ? err.message.trim() : 'Connection failed — server may be unreachable';
      return reply.status(400).send({ error: message });
    }
  });

  app.delete('/api/disconnect', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    if (!sessionId) {
      return reply.status(400).send({ error: 'Missing x-session-id header' });
    }

    const session = getSession(sessionId);
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    try {
      if (session.db) await detachAsync(session.db);
    } catch {
      // Ignore detach errors — session is cleaned up regardless
    }
    deleteSession(sessionId);
    return { ok: true };
  });

  // List available databases
  app.get('/api/databases', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    if (!sessionId) return reply.status(401).send({ error: 'Missing session' });
    const config = getSessionConfig(sessionId);
    if (!config) return reply.status(401).send({ error: 'Invalid session' });

    try {
      const databases = await discoverDatabases(config.host, config.port);
      return { databases, currentDatabase: config.database || null };
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed to discover databases' });
    }
  });

  // Switch to a different database (or select initial database)
  app.post('/api/select-database', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    if (!sessionId) return reply.status(401).send({ error: 'Missing session' });
    const session = getSession(sessionId);
    if (!session) return reply.status(401).send({ error: 'Invalid session' });

    const { database } = request.body as { database: string };
    if (!database) return reply.status(400).send({ error: 'Database path is required' });

    try {
      // Attach to new database FIRST (before detaching old — avoids window with no DB)
      const newConfig = { ...session.config, database };
      const newDb = await attachAsync(newConfig);

      // Now detach old database
      const oldDb = session.db;
      updateSessionDb(sessionId, newDb, database);
      if (oldDb) {
        try { await detachAsync(oldDb); } catch { /* ignore old detach errors */ }
      }

      return { ok: true, database };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed to connect to database' });
    }
  });

  // Test connection without creating a session
  app.post('/api/test-connection', async (request, reply) => {
    try {
      const body = request.body as { host?: string; port?: number; database?: string; user?: string; password?: string };
      const config = {
        host: body.host ?? 'localhost',
        port: body.port ?? 3050,
        database: body.database ?? '',
        user: body.user ?? 'SYSDBA',
        password: body.password ?? '',
      };

      // If no database specified, try to get aliases without connecting
      if (!config.database) {
        const aliases = await parseDatabasesConf(config.host, config.port);
        if (aliases.length > 0) {
          return { ok: true, host: config.host, port: config.port, firebirdVersion: null, databasePath: null, currentUser: config.user, aliases };
        }
        // No aliases found — try connecting with a dummy database to get a real connection error
        try {
          const db = await attachAsync({ ...config, database: 'test' });
          await detachAsync(db);
          return reply.status(400).send({ ok: false, error: 'Connected to server but no databases found. Enter a database path or alias.' });
        } catch (connErr: unknown) {
          const msg = connErr instanceof Error ? connErr.message : 'Connection failed';
          // If it's an auth error or connection refused, show that
          if (msg.includes('password') || msg.includes('login') || msg.includes('auth')) {
            return reply.status(400).send({ ok: false, error: msg.trim() });
          }
          if (msg.includes('ECONNREFUSED') || msg.includes('connect')) {
            return reply.status(400).send({ ok: false, error: `Cannot connect to ${config.host}:${config.port} — server unreachable` });
          }
          // Otherwise server is reachable but no database — that's OK, just no aliases
          return reply.status(400).send({ ok: false, error: 'Server reachable but no databases found. Enter a database path or alias.' });
        }
      }

      const db = await attachAsync(config);

      // If we get here, connection works. Now grab server info + database list.
      const info: Record<string, unknown> = {};

      try {
        // Get Firebird version and basic info
        const infoResult = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
          db.query(`
            SELECT
              CURRENT_USER AS CUR_USER,
              CAST(RDB$GET_CONTEXT('SYSTEM', 'ENGINE_VERSION') AS VARCHAR(20)) AS FB_VERSION,
              CAST(RDB$GET_CONTEXT('SYSTEM', 'DB_NAME') AS VARCHAR(500)) AS DB_NAME
            FROM RDB$DATABASE
          `, [], (err, result) => {
            if (err) return reject(err);
            resolve((result ?? []) as Record<string, unknown>[]);
          });
        });
        const row = infoResult[0] ?? {};
        info.firebirdVersion = row['FB_VERSION'] ? String(row['FB_VERSION']).trim() : null;
        info.databasePath = row['DB_NAME'] ? String(row['DB_NAME']).trim() : config.database;
        info.currentUser = row['CUR_USER'] ? String(row['CUR_USER']).trim() : config.user;
      } catch {
        info.firebirdVersion = null;
        info.databasePath = config.database;
        info.currentUser = config.user;
      }

      // Try to list known databases from security db or aliases
      // Firebird stores aliases in databases.conf — not queryable via SQL.
      // But we can check if there are other databases referenced in system tables.
      await detachAsync(db);

      // Try to read databases.conf for aliases
      const dbAliases = await parseDatabasesConf(config.host, config.port);

      return {
        ok: true,
        host: config.host,
        port: config.port,
        ...info,
        aliases: dbAliases,
      };
    } catch (err: unknown) {
      const message = (err instanceof Error && err.message) ? err.message.trim() : 'Connection failed — server may be unreachable';
      return reply.status(400).send({ ok: false, error: message });
    }
  });

  app.get('/api/ping', async () => {
    return { ok: true, version: '0.0.1-beta' };
  });

  app.get('/api/server-info', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    if (!sessionId) return reply.status(400).send({ error: 'Missing session' });

    const session = getSession(sessionId);
    if (!session) return reply.status(401).send({ error: 'Invalid session' });

    try {
      const result = await queryAsync(sessionId, `
        SELECT
          CURRENT_USER AS CUR_USER,
          CAST(CURRENT_TIMESTAMP AS VARCHAR(50)) AS CUR_TS,
          CAST(CURRENT_CONNECTION AS INTEGER) AS CONN_ID,
          CAST(RDB$GET_CONTEXT('SYSTEM', 'ENGINE_VERSION') AS VARCHAR(20)) AS FB_VERSION,
          CAST(RDB$GET_CONTEXT('SYSTEM', 'DB_NAME') AS VARCHAR(500)) AS DB_PATH
        FROM RDB$DATABASE
      `);
      const row = result.rows[0] ?? {};
      return {
        databasePath: row['DB_PATH'] ? String(row['DB_PATH']).trim() : session.config.database,
        host: session.config.host,
        port: session.config.port,
        currentUser: row['CUR_USER'] ? String(row['CUR_USER']).trim() : session.config.user,
        protocol: 'TCP/IP',
        connectedAt: session.connectedAt,
        connectionId: row['CONN_ID'] ?? null,
        firebirdVersion: row['FB_VERSION'] ? String(row['FB_VERSION']).trim() : null,
      };
    } catch {
      return {
        databasePath: session.config.database,
        host: session.config.host,
        port: session.config.port,
        currentUser: session.config.user,
        protocol: 'TCP/IP',
        connectedAt: session.connectedAt,
        connectionId: null,
        firebirdVersion: null,
      };
    }
  });
}
