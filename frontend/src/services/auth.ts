import axios, { AxiosInstance } from 'axios';
import {
  ApiResponse,
  AuthResponse,
  User,
  LoginRequest,
  RegisterRequest,
  ChangePasswordRequest,
} from '@/types';

// Clés de stockage local
const ACCESS_TOKEN_KEY = 'btp_access_token';
const REFRESH_TOKEN_KEY = 'btp_refresh_token';
const USER_KEY = 'btp_user';

/**
 * Service d'authentification
 * Gère les tokens, la connexion et la déconnexion
 */
class AuthService {
  private client: AxiosInstance;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: '/api/auth',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // ============================================
  // Gestion des tokens
  // ============================================

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  getStoredUser(): User | null {
    const userJson = localStorage.getItem(USER_KEY);
    if (userJson) {
      try {
        return JSON.parse(userJson);
      } catch {
        return null;
      }
    }
    return null;
  }

  setStoredUser(user: User): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  // ============================================
  // API d'authentification
  // ============================================

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const { data } = await this.client.post<ApiResponse<AuthResponse>>('/login', credentials);
    
    if (data.success && data.data) {
      const { accessToken, refreshToken, user } = data.data;
      this.setTokens(accessToken, refreshToken);
      this.setStoredUser(user);
      return data.data;
    }
    
    throw new Error(data.error?.message || 'Erreur de connexion');
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const { data } = await this.client.post<ApiResponse<AuthResponse>>('/register', userData);
    
    if (data.success && data.data) {
      const { accessToken, refreshToken, user } = data.data;
      this.setTokens(accessToken, refreshToken);
      this.setStoredUser(user);
      return data.data;
    }
    
    throw new Error(data.error?.message || 'Erreur lors de l\'inscription');
  }

  async refreshTokens(): Promise<string> {
    // Éviter les appels concurrents de refresh
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('Pas de refresh token disponible');
    }

    this.refreshPromise = this.client
      .post<ApiResponse<AuthResponse>>('/refresh', { refreshToken })
      .then(({ data }) => {
        if (data.success && data.data) {
          const { accessToken, refreshToken: newRefreshToken, user } = data.data;
          this.setTokens(accessToken, newRefreshToken);
          this.setStoredUser(user);
          return accessToken;
        }
        throw new Error('Erreur lors du rafraîchissement du token');
      })
      .catch((error) => {
        this.clearTokens();
        throw error;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  async logout(): Promise<void> {
    const refreshToken = this.getRefreshToken();
    
    try {
      if (refreshToken) {
        await this.client.post('/logout', { refreshToken });
      }
    } catch {
      // Ignorer les erreurs de logout
    } finally {
      this.clearTokens();
    }
  }

  async logoutAll(): Promise<void> {
    const accessToken = this.getAccessToken();
    
    try {
      await this.client.post('/logout-all', {}, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } finally {
      this.clearTokens();
    }
  }

  async forgotPassword(email: string): Promise<{ message: string; resetToken?: string }> {
    const { data } = await this.client.post<ApiResponse<{ message: string; resetToken?: string }>>(
      '/forgot-password',
      { email }
    );
    
    if (data.success && data.data) {
      return data.data;
    }
    
    throw new Error(data.error?.message || 'Erreur lors de la demande');
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const { data } = await this.client.post<ApiResponse<{ message: string }>>(
      '/reset-password',
      { token, password }
    );
    
    if (!data.success) {
      throw new Error(data.error?.message || 'Erreur lors de la réinitialisation');
    }
  }

  async changePassword(passwords: ChangePasswordRequest): Promise<void> {
    const accessToken = this.getAccessToken();
    
    const { data } = await this.client.post<ApiResponse<{ message: string }>>(
      '/change-password',
      passwords,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (!data.success) {
      throw new Error(data.error?.message || 'Erreur lors du changement de mot de passe');
    }
  }

  async getProfile(): Promise<User> {
    const accessToken = this.getAccessToken();
    
    const { data } = await this.client.get<ApiResponse<User>>('/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (data.success && data.data) {
      this.setStoredUser(data.data);
      return data.data;
    }
    
    throw new Error(data.error?.message || 'Erreur lors de la récupération du profil');
  }

  async updateProfile(updates: Partial<Pick<User, 'firstName' | 'lastName' | 'email'>>): Promise<User> {
    const accessToken = this.getAccessToken();
    
    const { data } = await this.client.patch<ApiResponse<User>>('/me', updates, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (data.success && data.data) {
      this.setStoredUser(data.data);
      return data.data;
    }
    
    throw new Error(data.error?.message || 'Erreur lors de la mise à jour du profil');
  }
}

export const authService = new AuthService();
export default authService;
