import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Create custom axios instance
export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to track token refreshing process
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};
// Request Interceptor: Attach bearer tokens and log payload
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`[Axios Request] ${config.method?.toUpperCase()} ${config.url}`, config.data);
    return config;
  },
  (error) => {
    console.error('[Axios Request Error]', error);
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle 401 Unauthorized errors (Silent Refresh) and log response/errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    console.error(`[Axios Response Error] ${error.config?.method?.toUpperCase()} ${error.config?.url} - Status ${error.response?.status}`, error.response?.data || error.message);
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    // Check if error is 401 and not already retried
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (originalRequest.url === '/auth/refresh' || originalRequest.url === '/auth/login') {
        // If the refresh token request itself fails, force logout
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.dispatchEvent(new Event('auth-logout'));
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request while token is refreshing
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const storedRefreshToken = localStorage.getItem('refreshToken');
      if (!storedRefreshToken) {
        isRefreshing = false;
        window.dispatchEvent(new Event('auth-logout'));
        return Promise.reject(error);
      }

      try {
        // Call refresh endpoint
        const response = await axios.post('/api/v1/auth/refresh', {
          refreshToken: storedRefreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        
        processQueue(null, accessToken);
        isRefreshing = false;

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        
        // Clear tokens and notify application to redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.dispatchEvent(new Event('auth-logout'));
        
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
