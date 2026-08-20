export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'user' | 'admin';
  plan: 'free' | 'pro' | 'studio';
  planStatus: 'active' | 'past_due' | 'canceled';
  monthlyLimit: number;
  usedGenerations: number;
  quotaResetDate: string;
  createdAt: string;
}

export interface UserQuota {
  used: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
  planName: string;
}

export interface GeneratedScript {
  id: string;
  userId?: string;
  title: string;
  prompt: string;
  code: string;
  explanation?: string;
  scriptType: 'Server Script' | 'LocalScript' | 'ModuleScript';
  targetInstance: string;
  lineCount: number;
  tags: string[];
  isFavorite?: boolean;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsedAt?: string;
}

export type AuthMode = 'login' | 'register' | 'forgot_password';
