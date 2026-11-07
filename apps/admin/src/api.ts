import { createApiClient } from "@online-store/api-client";

const ACCESS_KEY = "admin_access_token";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function setAccessToken(token: string | null) {
  if (token) localStorage.setItem(ACCESS_KEY, token);
  else localStorage.removeItem(ACCESS_KEY);
}

export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3001",
  getAccessToken,
  onUnauthorized: () => {
    setAccessToken(null);
  },
});
