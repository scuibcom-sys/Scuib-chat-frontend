// types/auth.ts
export interface User {
  id: string;
  email: string;
  name?: string;
  username?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  isAdmin?: boolean;
  emailVerified?: boolean | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenType?: "Bearer" | "Token";
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenType: "Bearer" | "Token";
  isAuthenticated: boolean;
  hasSignedInBefore: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setTokens: (
    accessToken: string | null,
    refreshToken?: string | null,
    tokenType?: "Bearer" | "Token",
  ) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    confirmPassword: string,
  ) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  logout: () => Promise<void>;
  markHasSignedInBefore: () => void;
  clearError: () => void;
}

export interface FormField {
  name: string;
  label: string;
  type: "email" | "password" | "text";
  placeholder: string;
  icon?: React.ReactNode;
  validation?: {
    required?: boolean;
    minLength?: number;
    pattern?: RegExp;
    match?: string;
  };
}
