import { axiosInstance as api } from '../lib/axios';
import type { ApiResponse } from '../types/api';

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<ApiResponse<{ url: string }>>('/api/uploads', form);
  return res.data.data.url;
}

// Convierte una ruta del backend (/uploads/x.jpg) en URL absoluta servible por <img>.
export function assetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  const base = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(/\/api\/?$/, '');
  return `${base}${path}`;
}
