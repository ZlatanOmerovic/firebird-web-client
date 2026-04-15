import { useMutation } from '@tanstack/react-query';
import { executeSql } from '../lib/api';

export function useSql() {
  return useMutation({
    mutationFn: (query: string) => executeSql(query),
  });
}
