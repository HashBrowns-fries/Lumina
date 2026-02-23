# Lumina API Configuration

## Setup Instructions

1. **Copy the example file**
   ```bash
   cp .env.example .env
   ```

2. **Fill in your API keys**
   
   Edit `.env` and add your API keys:

   ```env
   # Google Gemini API (Recommended)
   GEMINI_API_KEY=your_gemini_key_here
   
   # DeepSeek API
   DEEPSEEK_API_KEY=your_deepseek_key_here
   
   # Alibaba Cloud (Qwen) API
   ALIYUN_API_KEY=your_aliyun_key_here
   ```

3. **Restart the application**
   ```bash
   npm run dev
   ```

## Getting API Keys

### Google Gemini (Recommended)
- **Free tier available**
- Get your key: https://makersuite.google.com/app/apikey
- Documentation: https://ai.google.dev/

### DeepSeek
- **Cost-effective Chinese model**
- Get your key: https://platform.deepseek.com/
- Good for Chinese/English translation

### Alibaba Cloud (Qwen)
- **Powerful multilingual model**
- Get your key: https://dashscope.console.aliyun.com/
- Part of Alibaba Cloud

### OpenAI
- **GPT models**
- Get your key: https://platform.openai.com/api-keys
- Requires credit card

### Ollama (Local - Free)
- **Run models locally**
- Download: https://ollama.ai/
- No API key needed
- Set `OLLAMA_BASE_URL=http://localhost:11434`

## Configuration Options

### Default AI Provider
```env
DEFAULT_AI_PROVIDER=gemini  # Options: gemini, deepseek, aliyun, qwen, openai, ollama
DEFAULT_AI_MODEL=gemini-2.0-flash  # Model name
```

### Custom Base URLs
```env
# For Ollama
OLLAMA_BASE_URL=http://localhost:11434

# For custom OpenAI-compatible endpoints
OPENAI_BASE_URL=https://your-custom-api.com/v1
```

## Security Notes

- ⚠️ **Never commit `.env` to version control**
- ✅ `.env` is already in `.gitignore`
- ✅ Use `.env.example` as a template
- ✅ Keep your API keys secret

## Troubleshooting

### AI not working?
1. Check if API key is set correctly
2. Verify internet connection
3. Check API provider status page
4. Try a different provider

### Ollama not connecting?
1. Make sure Ollama is running: `ollama serve`
2. Pull a model: `ollama pull llama2`
3. Check URL: `http://localhost:11434`

### Rate limit errors?
- Free tiers have limits
- Consider upgrading your plan
- Or switch to a different provider

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `GEMINI_API_KEY` | Google Gemini API key | For Gemini | - |
| `DEEPSEEK_API_KEY` | DeepSeek API key | For DeepSeek | - |
| `ALIYUN_API_KEY` | Alibaba Cloud API key | For Qwen | - |
| `QWEN_API_KEY` | Qwen API key (alias) | For Qwen | - |
| `OPENAI_API_KEY` | OpenAI API key | For OpenAI | - |
| `OLLAMA_API_KEY` | Ollama API key | No (local) | - |
| `OLLAMA_BASE_URL` | Ollama server URL | For Ollama | `http://localhost:11434` |
| `DEFAULT_AI_PROVIDER` | Default AI provider | No | `gemini` |
| `DEFAULT_AI_MODEL` | Default model name | No | `gemini-2.0-flash` |

---

For more help, see: https://github.com/HashBrowns-fries/Lumina
