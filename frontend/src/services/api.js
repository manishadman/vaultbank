import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
  headers: { 'X-Vault-Request': '1' },
});

let accessToken = null;
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;
    if (status === 401 && code === 'TOKEN_EXPIRED' && original && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      refreshPromise = refreshPromise || api.post('/auth/refresh').finally(() => {
        refreshPromise = null;
      });
      const refreshed = await refreshPromise;
      setAccessToken(refreshed.data.accessToken);
      original.headers.Authorization = `Bearer ${refreshed.data.accessToken}`;
      return api(original);
    }
    return Promise.reject(error);
  },
);

export function errorMessage(error, fallback = 'Something went wrong.') {
  return error?.response?.data?.error?.message || fallback;
}
