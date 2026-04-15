import { useState, useEffect } from 'react';
import { ping } from '../lib/api';

export function useServerHealth(intervalMs = 10000) {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        await ping();
        if (mounted) setOnline(true);
      } catch {
        if (mounted) setOnline(false);
      }
    };

    check();
    const id = setInterval(check, intervalMs);
    return () => { mounted = false; clearInterval(id); };
  }, [intervalMs]);

  return online;
}
