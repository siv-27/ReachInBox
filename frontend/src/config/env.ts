/**
 * Centralized backend API base URL resolver using Vite environment variables.
 * Defaults to http://localhost:5000 in local development.
 */
export const getBackendUrl = (): string => {
  return import.meta.env.VITE_API_URL || 'http://localhost:5000';
};
