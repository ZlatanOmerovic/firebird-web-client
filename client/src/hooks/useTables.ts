import { useQuery } from '@tanstack/react-query';
import { getTables } from '../lib/api';
import { useConnectionStore } from '../store/connectionStore';

export function useTables() {
  const connected = useConnectionStore((s) => s.connected);

  return useQuery({
    queryKey: ['tables'],
    queryFn: getTables,
    enabled: connected,
  });
}
