import { startManagedLogin } from "../features/identity/identity-api";
const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/v1`;

export interface AuthUser {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt: string | null;
}

interface MeResponse {
  success: boolean;
  data?: {
    user: AuthUser;
  };
  message?: string;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      return null;
    }

    const data: MeResponse = await response.json();

    if (!data.success || !data.data?.user) {
      return null;
    }

    return data.data.user;
  } catch (error) {
    console.error("Failed to fetch current user:", error);
    return null;
  }
}

export function loginWithGoogle() {
  return startManagedLogin();
}

export function loginWithGitHub() {
  return startManagedLogin();
}