const isProd = import.meta.env.PROD;

export const API_CONFIG = {
  dictionaryApi: isProd ? 'http://localhost:3006' : 'http://localhost:3006',
  sanskritApi: isProd ? 'http://localhost:3008' : 'http://localhost:3008',
  isProduction: isProd,
};

export const getDictionaryApiUrl = () => API_CONFIG.dictionaryApi;
export const getSanskritApiUrl = () => API_CONFIG.sanskritApi;
