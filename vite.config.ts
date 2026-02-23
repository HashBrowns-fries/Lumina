import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      build: {
        chunkSizeWarningLimit: 800,
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
            floating: path.resolve(__dirname, 'floating.html'),
          },
          output: {
            manualChunks: {
              // React core
              'vendor-react': ['react', 'react-dom', 'react/jsx-runtime'],
              // UI icons
              'vendor-lucide': ['lucide-react'],
              // Tauri API
              'vendor-tauri': ['@tauri-apps/api', '@tauri-apps/api/core', '@tauri-apps/api/event', '@tauri-apps/api/window'],
            },
          },
        },
      },
      define: {
        // API keys from .env file
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'process.env.DEEPSEEK_API_KEY': JSON.stringify(env.DEEPSEEK_API_KEY || ''),
        'process.env.ALIYUN_API_KEY': JSON.stringify(env.ALIYUN_API_KEY || ''),
        'process.env.QWEN_API_KEY': JSON.stringify(env.QWEN_API_KEY || ''),
        'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY || ''),
        'process.env.OLLAMA_API_KEY': JSON.stringify(env.OLLAMA_API_KEY || ''),
        'process.env.OLLAMA_BASE_URL': JSON.stringify(env.OLLAMA_BASE_URL || 'http://localhost:11434'),
        // Default provider and model
        'process.env.DEFAULT_AI_PROVIDER': JSON.stringify(env.DEFAULT_AI_PROVIDER || 'gemini'),
        'process.env.DEFAULT_AI_MODEL': JSON.stringify(env.DEFAULT_AI_MODEL || 'gemini-2.0-flash'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
