import { GEMINI_API_KEYS, GEMINI_BASE_URL, GEMINI_MODEL } from '../config/gemini'

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type: string; text?: string }>
    }
  }>
}

interface GeminiOptions {
  signal?: AbortSignal
}

const DEFAULT_MODEL = GEMINI_MODEL
const DEFAULT_BASE_URL = GEMINI_BASE_URL
const DEFAULT_TIMEOUT_MS = 20000
const DEFAULT_MAX_OUTPUT_TOKENS = 768
const DEFAULT_TEMPERATURE = 0.6

const configKeys = GEMINI_API_KEYS.map((key) => key.trim()).filter(Boolean)
const envKey =
  import.meta.env.VITE_DASHSCOPE_API_KEY?.trim() ||
  import.meta.env.VITE_GEMINI_API_KEY?.trim()
const combinedKeys = envKey ? [envKey, ...configKeys] : configKeys
const UNIQUE_API_KEYS = Array.from(new Set(combinedKeys))

let nextKeyIndex = 0

function getRotatedKeyEntries() {
  if (!UNIQUE_API_KEYS.length) {
    return []
  }

  const ordered: Array<{ key: string; index: number }> = []
  for (let offset = 0; offset < UNIQUE_API_KEYS.length; offset += 1) {
    const index = (nextKeyIndex + offset) % UNIQUE_API_KEYS.length
    ordered.push({ key: UNIQUE_API_KEYS[index], index })
  }
  return ordered
}

function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  cancelSignal?: AbortSignal,
) {
  if (cancelSignal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'))
  }

  return new Promise<Response>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup()
      reject(new Error('调用超时'))
    }, timeoutMs)

    const abortHandler = () => {
      cleanup()
      reject(new DOMException('Aborted', 'AbortError'))
    }

    const cleanup = () => {
      clearTimeout(timeoutId)
      if (cancelSignal) {
        cancelSignal.removeEventListener('abort', abortHandler)
      }
    }

    cancelSignal?.addEventListener('abort', abortHandler, { once: true })

    fetch(url, options)
      .then((response) => {
        cleanup()
        resolve(response)
      })
      .catch((error) => {
        cleanup()
        reject(error)
      })
  })
}

export async function callGemini(prompt: string, options: GeminiOptions = {}): Promise<string> {
  const model =
    import.meta.env.VITE_DASHSCOPE_MODEL ||
    import.meta.env.VITE_GEMINI_MODEL ||
    DEFAULT_MODEL
  const baseUrl =
    import.meta.env.VITE_DASHSCOPE_BASE_URL ||
    import.meta.env.VITE_GEMINI_BASE_URL ||
    DEFAULT_BASE_URL
  const maxOutputTokens =
    Number(import.meta.env.VITE_DASHSCOPE_MAX_OUTPUT_TOKENS) ||
    Number(import.meta.env.VITE_GEMINI_MAX_OUTPUT_TOKENS) ||
    DEFAULT_MAX_OUTPUT_TOKENS
  const temperature =
    Number(import.meta.env.VITE_DASHSCOPE_TEMPERATURE) ||
    Number(import.meta.env.VITE_GEMINI_TEMPERATURE) ||
    DEFAULT_TEMPERATURE
  const timeoutMs =
    Number(import.meta.env.VITE_DASHSCOPE_TIMEOUT_MS) ||
    Number(import.meta.env.VITE_GEMINI_TIMEOUT_MS) ||
    DEFAULT_TIMEOUT_MS

  const keyEntries = getRotatedKeyEntries()

  if (!keyEntries.length) {
    throw new Error('未配置 DashScope API Key，请在 src/config/gemini.ts 或 .env 中填写密钥')
  }

  if (options.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const requestBody = JSON.stringify({
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature,
    max_tokens: maxOutputTokens,
  })

  const errors: string[] = []

  for (const entry of keyEntries) {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${entry.key}`,
          },
          body: requestBody,
        },
        timeoutMs,
        options.signal,
      )

      if (!response.ok) {
        const message = await response.text()
        throw new Error(`状态 ${response.status}: ${message}`)
      }

      if (options.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      const data = (await response.json()) as OpenAIChatResponse
      const textCandidate = data.choices?.[0]?.message?.content

      let text: string | undefined
      if (typeof textCandidate === 'string') {
        text = textCandidate
      } else if (Array.isArray(textCandidate)) {
        text = textCandidate.map((part) => part.text).filter(Boolean).join('\n')
      }

      if (!text) {
        throw new Error('响应内容为空')
      }

      nextKeyIndex = (entry.index + 1) % UNIQUE_API_KEYS.length
      return text
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err
      }
      const reason = err instanceof Error ? err.message : '未知错误'
      errors.push(`Key ****${entry.key.slice(-4)} 失败：${reason}`)
    }
  }

  throw new Error(`DashScope 调用失败：${errors.join(' | ')}`)
}

export type { GeminiOptions }

