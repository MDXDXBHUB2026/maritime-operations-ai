import { ApiClient } from './apiClient';
import { AuthSessionStore, type CurrentUser, type RoleName } from './authSession';

interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_at: string;
  user: CurrentUser;
}

export interface ManagedUser {
  user_id: string;
  username: string;
  display_name: string;
  role: RoleName;
  role_label: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export const ROLE_OPTIONS: { value: RoleName; label: string }[] = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'operator', label: 'Duty Officer' },
  { value: 'chief_engineer', label: 'Chief Engineer' },
  { value: 'master', label: 'Master' },
  { value: 'technical_superintendent', label: 'Technical Superintendent' },
  { value: 'marine_superintendent', label: 'Marine Superintendent' },
  { value: 'hse_manager', label: 'HSE Manager' },
  { value: 'admin', label: 'Administrator' },
];

export const AuthService = {
  login: async (username: string, password: string): Promise<CurrentUser> => {
    const res = await ApiClient.post<LoginResponse>('/auth/login', { username, password });
    AuthSessionStore.set({ token: res.access_token, expiresAt: res.expires_at, user: res.user });
    return res.user;
  },
  logout: async (): Promise<void> => {
    try {
      await ApiClient.post<void>('/auth/logout');
    } finally {
      AuthSessionStore.clear();
    }
  },
  refreshMe: async (): Promise<CurrentUser> => {
    const me = await ApiClient.get<CurrentUser>('/auth/me');
    AuthSessionStore.updateUser(me);
    return me;
  },
  listUsers: () => ApiClient.get<ManagedUser[]>('/users'),
  createUser: (data: {
    username: string;
    display_name: string;
    role: RoleName;
    password: string;
  }) => ApiClient.post<ManagedUser>('/users', data),
  updateUser: (
    userId: string,
    data: Partial<{ display_name: string; role: RoleName; is_active: boolean; password: string }>
  ) => ApiClient.patch<ManagedUser>(`/users/${encodeURIComponent(userId)}`, data),
};
