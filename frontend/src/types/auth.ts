export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}
