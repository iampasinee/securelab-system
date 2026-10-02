/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SECURELAB_DATA_SOURCE?: 'mock' | 'api';
  readonly VITE_SECURELAB_API_URL?: string;
}
