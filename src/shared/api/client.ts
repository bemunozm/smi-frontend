import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
  withCredentials: true,
});

// PROVISIONAL — inyecta el rol de dev para el guard stub del backend.
api.interceptors.request.use((config) => {
  const rol = useAuthStore.getState().rol;
  if (rol) config.headers['x-dev-role'] = rol;
  return config;
});
