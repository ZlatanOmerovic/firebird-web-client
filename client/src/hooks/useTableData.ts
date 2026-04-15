import { useQuery } from '@tanstack/react-query';
import { getTableRows, getTableSchema } from '../lib/api';

export function useTableData(
  tableName: string | null,
  page: number = 1,
  pageSize: number = 50,
  orderBy?: string,
  orderDir: 'asc' | 'desc' = 'asc',
) {
  const rows = useQuery({
    queryKey: ['rows', tableName, page, pageSize, orderBy, orderDir],
    queryFn: () => getTableRows(tableName!, page, pageSize, orderBy, orderDir),
    enabled: !!tableName,
  });

  const schema = useQuery({
    queryKey: ['schema', tableName],
    queryFn: () => getTableSchema(tableName!),
    enabled: !!tableName,
  });

  return { rows, schema };
}
