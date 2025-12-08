/**
 * Shared types for platform clients
 */

export interface PlatformConfig {
  baseUrl: string;
  apiVersion: string;
  clientId?: string;
  clientSecret?: string;
}

export interface PublishPostOptions {
  caption: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  workspaceId: string;
  externalAccountId: string;
}

export interface PublishPostResult {
  success: boolean;
  platformPostId?: string;
  postUrl?: string;
  error?: string;
  retryable?: boolean;
}

export interface PostMetrics {
  impressions?: number;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  reach?: number;
  engagement?: number;
  metadata?: Record<string, any>;
}

export interface AccountHealth {
  healthy: boolean;
  accountId?: string;
  accountName?: string;
  error?: string;
}

export interface HTTPRequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  accessToken: string;
  body?: any;
  params?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface HTTPResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  retryAfter?: number; // seconds
}

