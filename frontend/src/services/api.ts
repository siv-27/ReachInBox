import axios from 'axios';
import { getBackendUrl } from '../config/env';

const api = axios.create({
  baseURL: getBackendUrl(),
  withCredentials: true,
});

export default api;
