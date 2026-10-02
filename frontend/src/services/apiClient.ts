import { apiBaseUrl, dataSource } from './dataSource';
import type { ApiFile, ApiPage } from '../types/api';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

type TokenResponse = { accessToken: string; expiresIn: number };

const errorFromResponse = async (response: Response): Promise<ApiError> => {
  const body = await response.json().catch(() => null);
  const detail = body?.detail;
  if (Array.isArray(detail)) return new ApiError(response.status, 'validation', 'ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจรูปแบบและค่าที่กรอก');
  return new ApiError(response.status, detail?.code || 'request_failed', detail?.message || 'ไม่สามารถติดต่อระบบได้ กรุณาลองอีกครั้ง');
};

export class ApiClient {
  private accessToken: string | null = null;
  private expiresAt = 0;
  private refreshPromise: Promise<void> | null = null;
  private channel: BroadcastChannel | null = null;
  private pendingKeys = new Map<string, string>();
  private principal: string | null = null;
  onSignedOut: (() => void) | null = null;
  onSessionChanged: (() => void) | null = null;

  constructor() {
    if (dataSource === 'api' && typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('securelab-api-auth');
      this.channel.onmessage = (event) => {
        if (event.data?.type === 'token') this.setToken(event.data.value, false);
        if (event.data?.type === 'logout') this.clear(false);
      };
    }
  }

  private setToken(value: TokenResponse, broadcast = true) {
    // The subject only invalidates caches; authorization always comes from /auth/me.
    let subject: string | null = null;
    try { subject = JSON.parse(atob(value.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub; } catch { /* Server validates the token. */ }
    const changed = this.principal !== null && subject !== this.principal;
    if (changed) this.clear(false);
    this.principal = subject;
    this.accessToken = value.accessToken;
    this.expiresAt = Date.now() + value.expiresIn * 1000;
    if (broadcast) this.channel?.postMessage({ type: 'token', value });
    if (changed) this.onSessionChanged?.();
  }

  clear(broadcast = true) {
    this.accessToken = null;
    this.expiresAt = 0;
    this.principal = null;
    this.pendingKeys.clear();
    if (broadcast) this.channel?.postMessage({ type: 'logout' });
    this.onSignedOut?.();
  }

  async login(email: string, password: string) {
    const response = await fetch(`${apiBaseUrl}/auth/login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!response.ok) throw await errorFromResponse(response);
    this.setToken(await response.json());
  }

  async refresh() {
    if (this.refreshPromise) return this.refreshPromise;
    const refresh = async () => {
      if (this.accessToken && this.expiresAt > Date.now() + 30_000) return;
      const response = await fetch(`${apiBaseUrl}/auth/refresh`, { method: 'POST', credentials: 'include', headers: { 'X-SecureLab-CSRF': '1' } });
      if (!response.ok) {
        this.clear();
        throw await errorFromResponse(response);
      }
      this.setToken(await response.json());
    };
    this.refreshPromise = (typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('securelab-api-refresh', refresh)
      : refresh()).finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  async request<T>(path: string, options: { method?: string; body?: unknown; idempotent?: boolean; public?: boolean } = {}): Promise<T> {
    if (!options.public && (!this.accessToken || this.expiresAt <= Date.now() + 30_000)) await this.refresh();
    const headers: Record<string, string> = {};
    if (!options.public && this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const operation = `${options.method || 'GET'} ${path} ${JSON.stringify(options.body)}`;
    if (options.idempotent) {
      const key = this.pendingKeys.get(operation) || crypto.randomUUID();
      this.pendingKeys.set(operation, key);
      headers['Idempotency-Key'] = key;
    }
    const settings = { method: options.method || 'GET', credentials: 'include' as const, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) };
    let response = await fetch(apiBaseUrl + path, settings);
    if (response.status === 401 && !options.public) {
      this.expiresAt = 0;
      await this.refresh();
      headers.Authorization = `Bearer ${this.accessToken}`;
      response = await fetch(apiBaseUrl + path, settings);
    }
    if (response.status < 500) this.pendingKeys.delete(operation);
    if (!response.ok) throw await errorFromResponse(response);
    if (response.status === 204) return undefined as T;
    return response.json();
  }

  async all<T>(path: string): Promise<T[]> {
    const result: T[] = [];
    let page = 1;
    while (true) {
      const response = await this.request<ApiPage<T>>(`${path}${path.includes('?') ? '&' : '?'}page=${page}&pageSize=100`);
      result.push(...response.items);
      if (result.length >= response.total || !response.items.length) return result;
      page += 1;
    }
  }

  async logout() {
    try {
      const response = await fetch(`${apiBaseUrl}/auth/logout`, { method: 'POST', credentials: 'include', headers: { 'X-SecureLab-CSRF': '1' } });
      if (!response.ok) throw await errorFromResponse(response);
    } finally {
      this.clear();
    }
  }

  async download(path: string, filename: string) {
    await this.refresh();
    const send = () => fetch(apiBaseUrl + path, { credentials: 'include', headers: { Authorization: `Bearer ${this.accessToken}` } });
    let response = await send();
    if (response.status === 401) { this.expiresAt = 0; await this.refresh(); response = await send(); }
    if (!response.ok) throw await errorFromResponse(response);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async upload(uploadId: string, blob: Blob, onProgress: (progress: number) => void): Promise<ApiFile> {
    await this.refresh();
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('PUT', `${apiBaseUrl}/submission-files/${uploadId}/content`);
      request.withCredentials = true;
      request.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);
      request.setRequestHeader('Content-Type', 'application/octet-stream');
      request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
      request.onerror = () => reject(new ApiError(0, 'network_error', 'การเชื่อมต่อขัดข้อง สามารถลองอัปโหลดไฟล์เดิมใหม่ได้'));
      request.onload = () => {
        let body;
        try { body = JSON.parse(request.responseText); } catch { body = null; }
        if (request.status >= 200 && request.status < 300) resolve(body as ApiFile);
        else reject(new ApiError(request.status, body?.detail?.code || 'upload_failed', body?.detail?.message || 'อัปโหลดไม่สำเร็จ'));
      };
      request.send(blob);
    });
  }
}

export const api = new ApiClient();
