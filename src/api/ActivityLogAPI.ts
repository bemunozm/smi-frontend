import { axiosInstance as api } from '../lib/axios';
import type { ApiResponse } from '../types/api';
import type { ActivityFeed } from '../types/activity-log';

/** El registro de actividad de un rango de días (`YYYY-MM-DD`, inclusive). */
export async function getActivityLog(from: string, to: string): Promise<ActivityFeed> {
  const res = await api.get<ApiResponse<ActivityFeed>>('/api/activity-log', { params: { from, to } });
  return res.data.data;
}
