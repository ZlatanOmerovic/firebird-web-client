import { useConnectionStore } from '../store/connectionStore';

export function useConnection() {
  return useConnectionStore();
}
