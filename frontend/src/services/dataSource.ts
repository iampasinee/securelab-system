const environment: Partial<ImportMetaEnv> = import.meta.env ?? {};

export const dataSource = environment.VITE_SECURELAB_DATA_SOURCE === 'api' ? 'api' : 'mock';
export const apiBaseUrl = (environment.VITE_SECURELAB_API_URL || '/api/v1').replace(/\/$/, '');
