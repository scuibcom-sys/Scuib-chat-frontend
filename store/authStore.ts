import type { AuthState, User } from "@/types/auths";
import {
  ApiError,
  extractApiErrorMessage,
  fetchCurrentUser,
  loginWithApi,
  logoutWithApi,
  normalizeUser,
  refreshAccessToken,
  registerWithApi,
  requestPasswordReset,
  resolveAuthTokens,
} from "@/utils/scuibApi";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      tokenType: "Bearer",
      isAuthenticated: false,
      hasSignedInBefore: false,
      isLoading: false,
      error: null,

      setUser: (user) =>
        set((state) => ({
          user,
          accessToken: user?.accessToken ?? state.accessToken,
          refreshToken: user?.refreshToken ?? state.refreshToken,
          tokenType: user?.tokenType ?? state.tokenType,
          isAuthenticated: !!(user || state.accessToken),
          hasSignedInBefore: state.hasSignedInBefore || !!user,
        })),
      setTokens: (accessToken, refreshToken = null, tokenType = "Bearer") =>
        set((state) => ({
          accessToken,
          refreshToken,
          tokenType,
          isAuthenticated: !!(state.user || accessToken),
          hasSignedInBefore: state.hasSignedInBefore || !!accessToken,
        })),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      markHasSignedInBefore: () => set({ hasSignedInBefore: true }),
      clearError: () => set({ error: null }),

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await loginWithApi(email, password);
          const tokens = resolveAuthTokens(response);
          let user =
            getResolvedUser({ payload: response, tokens, fallbackEmail: email }) ??
            null;

          if (tokens.accessToken) {
            try {
              user = (await fetchCurrentUser(tokens)) ?? user;
            } catch (error) {
              if (!(error instanceof ApiError && error.status === 404)) {
                throw error;
              }
            }
          }

          if (!user) {
            user = {
              id: email,
              email,
              name: email.split("@")[0],
              isAdmin: false,
              emailVerified: null,
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
              tokenType: tokens.tokenType,
            };
          }

          if (user.emailVerified === false) {
            set({
              user: null,
              accessToken: null,
              refreshToken: null,
              tokenType: "Bearer",
              isAuthenticated: false,
              isLoading: false,
              error: "Please verify your email before signing in.",
            });
            throw new Error("Email verification required");
          }

          set({
            user,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            tokenType: tokens.tokenType,
            isAuthenticated: !!(user || tokens.accessToken),
            hasSignedInBefore: true,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: extractApiErrorMessage(error, "Login failed"),
            isLoading: false,
          });
          throw error;
        }
      },

      signup: async (
        email: string,
        password: string,
        confirmPassword: string,
      ) => {
        set({ isLoading: true, error: null });
        try {
          await registerWithApi(email, password, confirmPassword);
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            tokenType: "Bearer",
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            error: extractApiErrorMessage(error, "Signup failed"),
            isLoading: false,
          });
          throw error;
        }
      },

      forgotPassword: async (email: string) => {
        set({ isLoading: true, error: null });
        try {
          await requestPasswordReset(email);
          set({ isLoading: false });
        } catch (error) {
          set({
            error:
              error instanceof ApiError && error.status === 404
                ? "Password reset is unavailable right now."
                : extractApiErrorMessage(error, "Failed to send reset email"),
            isLoading: false,
          });
          throw error;
        }
      },

      refreshSession: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          throw new Error("No refresh token available.");
        }

        set({ isLoading: true, error: null });

        try {
          const refreshedTokens = await refreshAccessToken(refreshToken);
          set((state) => ({
            accessToken: refreshedTokens.accessToken,
            refreshToken: refreshedTokens.refreshToken,
            tokenType: refreshedTokens.tokenType,
            user: state.user
              ? {
                  ...state.user,
                  accessToken: refreshedTokens.accessToken,
                  refreshToken: refreshedTokens.refreshToken,
                  tokenType: refreshedTokens.tokenType,
                }
              : state.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          }));
        } catch (error) {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            tokenType: "Bearer",
            isAuthenticated: false,
            isLoading: false,
            error: extractApiErrorMessage(error, "Failed to refresh session"),
          });
          throw error;
        }
      },

      refreshCurrentUser: async () => {
        const { accessToken, refreshToken, tokenType, user } = get();
        if (!accessToken) return;

        try {
          const refreshedUser = await fetchCurrentUser({
            accessToken,
            refreshToken,
            tokenType,
          }, (nextTokens) => {
            get().setTokens(
              nextTokens.accessToken,
              nextTokens.refreshToken,
              nextTokens.tokenType,
            );
          });

          if (!refreshedUser) return;

          set({
            user: {
              ...user,
              ...refreshedUser,
              accessToken,
              refreshToken,
              tokenType,
            },
            error: null,
            isAuthenticated: true,
          });
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            try {
              await get().refreshSession();
              return await get().refreshCurrentUser();
            } catch {
              set({
                user: null,
                accessToken: null,
                refreshToken: null,
                tokenType: "Bearer",
                isAuthenticated: false,
                error: "Your session has expired. Please sign in again.",
              });
            }
            return;
          }

          set({ error: extractApiErrorMessage(error, "Failed to refresh user") });
        }
      },

      logout: async () => {
        const { accessToken, refreshToken, tokenType } = get();

        try {
          if (accessToken || refreshToken) {
            await logoutWithApi(
              {
                accessToken,
                refreshToken,
                tokenType,
              },
              (nextTokens) => {
                get().setTokens(
                  nextTokens.accessToken,
                  nextTokens.refreshToken,
                  nextTokens.tokenType,
                );
              },
            );
          }
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 401)) {
            set({
              error: extractApiErrorMessage(error, "Failed to sign out cleanly."),
            });
          }
        } finally {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            tokenType: "Bearer",
            isAuthenticated: false,
            error: null,
          });
        }
      },
    }),
    {
      name: "auth-storage",
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        if (state.user || state.accessToken) {
          state.hasSignedInBefore = true;
        }
      },
      partialize: (state) => ({
        // Store minimal user info — avatarUrl can be a large Cloudinary
        // URL and is refetched on login anyway. Tokens inside the user
        // object are already stored separately below, so stripping them
        // here avoids doubling the storage footprint.
        user: state.user
          ? {
              id: state.user.id,
              email: state.user.email,
              name: state.user.name,
              username: state.user.username,
              role: state.user.role,
              isAdmin: state.user.isAdmin,
              emailVerified: state.user.emailVerified,
            }
          : null,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        tokenType: state.tokenType,
        isAuthenticated: state.isAuthenticated,
        hasSignedInBefore: state.hasSignedInBefore,
      }),
    },
  ),
);

function getResolvedUser({
  payload,
  tokens,
  fallbackEmail,
}: {
  payload: unknown;
  tokens: {
    accessToken: string | null;
    refreshToken: string | null;
    tokenType: "Bearer" | "Token";
  };
  fallbackEmail: string;
}): User | null {
  const email =
    typeof fallbackEmail === "string" && fallbackEmail.trim()
      ? fallbackEmail
      : undefined;

  return fetchResolvedUser(payload, tokens, email);
}

function fetchResolvedUser(
  payload: unknown,
  tokens: {
    accessToken: string | null;
    refreshToken: string | null;
    tokenType: "Bearer" | "Token";
  },
  fallbackEmail?: string,
) {
  return normalizeUser(payload, tokens, fallbackEmail);
}
