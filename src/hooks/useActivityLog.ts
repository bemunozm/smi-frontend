import { useQuery } from '@tanstack/react-query';

import { getActivityLog } from '../api/ActivityLogAPI';
import { ACTIVITY_LOG_KEY } from '../lib/query-keys';

/** El registro de actividad del rango `[from, to]` (`YYYY-MM-DD`), ya
 * agregado y ordenado por el backend. */
export function useActivityLog(from: string, to: string) {
  return useQuery({ queryKey: [...ACTIVITY_LOG_KEY, from, to], queryFn: () => getActivityLog(from, to) });
}
