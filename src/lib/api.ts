import axios from "axios";

export const API_BASE =
  (import.meta.env?.VITE_API_URL as string | undefined) ??
  (import.meta.env?.DEV ? "/api" : "http://localhost:4000/api");

export const TOKEN_KEY = "bytematrix-token";

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // A blocked storage API just means the session lasts until reload.
  }
};

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Every API call except login must carry the session token.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    // A rejected token means the stored session is stale; drop it so the app
    // falls back to the login screen instead of looping on 401s.
    if ((status === 401 || status === 403) && getToken()) {
      setToken(null);
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);
