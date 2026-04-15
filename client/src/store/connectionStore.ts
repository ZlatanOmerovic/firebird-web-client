import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as api from '../lib/api';
import type { ConnectionConfig, DatabaseInfo } from '../lib/api';

interface ConnectionStore {
  config: ConnectionConfig | null;
  sessionId: string | null;
  connected: boolean;
  restoring: boolean;
  rawPassword: string | null;
  databases: DatabaseInfo[];
  currentDatabase: string | null;
  connect: (config: ConnectionConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  restore: () => Promise<void>;
  switchDatabase: (database: string) => Promise<void>;
  setDatabases: (databases: DatabaseInfo[]) => void;
}

export const useConnectionStore = create<ConnectionStore>()(
  persist(
    (set, get) => ({
      config: null,
      sessionId: null,
      connected: false,
      restoring: false,
      rawPassword: null,
      databases: [],
      currentDatabase: null,

      connect: async (config: ConnectionConfig) => {
        const result = await api.connect(config);
        api.setSessionId(result.sessionId);
        const { password: _, ...safeConfig } = config;
        set({
          config: { ...safeConfig, password: '' } as ConnectionConfig,
          sessionId: result.sessionId,
          connected: true,
          rawPassword: config.password,
          databases: result.databases ?? [],
          currentDatabase: config.database || null,
        });
      },

      disconnect: async () => {
        try {
          await api.disconnect();
        } catch {
          // Ignore disconnect errors
        }
        api.setSessionId(null);
        set({ sessionId: null, connected: false, rawPassword: null, databases: [], currentDatabase: null });
      },

      restore: async () => {
        const { sessionId } = get();
        if (!sessionId) return;

        set({ restoring: true });
        api.setSessionId(sessionId);
        try {
          // Verify session is still valid by calling an authenticated endpoint
          const dbResult = await api.getDatabases();
          set({
            connected: true,
            restoring: false,
            databases: dbResult.databases,
            currentDatabase: dbResult.currentDatabase,
          });
        } catch {
          // Session expired — clear it
          api.setSessionId(null);
          set({ sessionId: null, connected: false, restoring: false, databases: [], currentDatabase: null });
        }
      },

      switchDatabase: async (database: string) => {
        await api.selectDatabase(database);
        set({ currentDatabase: database });
      },

      setDatabases: (databases: DatabaseInfo[]) => set({ databases }),
    }),
    {
      name: 'firebird-connection',
      partialize: (state) => ({
        config: state.config,
        sessionId: state.sessionId,
      }),
    },
  ),
);
