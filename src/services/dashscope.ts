import { GEMINI_API_KEYS, GEMINI_BASE_URL, GEMINI_MODEL } from '../config/gemini'

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type: string; text?: string }>
    }
  }>
}

interface DashScopeOptions {
  signal?: AbortSignal
}

interface StreamOptions extends DashScopeOptions {
  onDelta?: (delta: string) => void
}

const DEFAULT_MODEL = GEMINI_MODEL
const DEFAULT_BASE_URL = GEMINI_BASE_URL
const DEFAULT_TIMEOUT_MS = 20000
const DEFAULT_MAX_OUTPUT_TOKENS = 520931
const DEFAULT_TEMPERATURE = 0.6
const MAX_SAFE_OUTPUT_TOKENS = 16384 // 提高到 16K，支持长教案生成
const TIMEOUT_BACKOFF_STEP_MS = 20000
const TIMEOUT_MAX_ATTEMPTS = 3

function getApiKeys() {
  const envKeys: string[] = []

  const envKeyRaw =
    import.meta.env.VITE_DASHSCOPE_API_KEY ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    ''
  envKeyRaw
    .split(',')
    .map((key: string) => key.trim())
    .filter(Boolean)
    .forEach((key: string) => envKeys.push(key))

  const combined = [...envKeys, ...GEMINI_API_KEYS]
  return Array.from(new Set(combined))
}

function getRotatedKeyEntries() {
  const keys = getApiKeys()
  if (!keys.length) {
    return []
  }

  const ordered: Array<{ key: string; index: number }> = []
  for (let offset = 0; offset < keys.length; offset += 1) {
    const index = (getRotatedKeyEntries.nextIndex + offset) % keys.length
    ordered.push({ key: keys[index], index })
  }
  return ordered
}

getRotatedKeyEntries.nextIndex = 0

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

export async function callDashScope(prompt: string, options: DashScopeOptions = {}): Promise<string> {
  const model =
    import.meta.env.VITE_DASHSCOPE_MODEL ||
    import.meta.env.VITE_GEMINI_MODEL ||
    DEFAULT_MODEL
  const baseUrl =
    import.meta.env.VITE_DASHSCOPE_BASE_URL ||
    import.meta.env.VITE_GEMINI_BASE_URL ||
    DEFAULT_BASE_URL
  const configuredMaxTokens =
    Number(import.meta.env.VITE_DASHSCOPE_MAX_OUTPUT_TOKENS) ||
    Number(import.meta.env.VITE_GEMINI_MAX_OUTPUT_TOKENS) ||
    DEFAULT_MAX_OUTPUT_TOKENS
  const maxOutputTokens = Math.min(configuredMaxTokens, MAX_SAFE_OUTPUT_TOKENS)
  const temperature =
    Number(import.meta.env.VITE_DASHSCOPE_TEMPERATURE) ||
    Number(import.meta.env.VITE_GEMINI_TEMPERATURE) ||
    DEFAULT_TEMPERATURE
  const baseTimeoutMs =
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
  const errors: string[] = []

  for (const entry of keyEntries) {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    let attempt = 0

    while (true) {
      const timeoutMs = baseTimeoutMs + attempt * TIMEOUT_BACKOFF_STEP_MS

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

        getRotatedKeyEntries.nextIndex = (entry.index + 1) % getApiKeys().length
        return text
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw err
        }

        const reason = err instanceof Error ? err.message : '未知错误'

        const isTimeout =
          /timeout/i.test(reason) ||
          reason.includes('调用超时')

        if (isTimeout && attempt + 1 < TIMEOUT_MAX_ATTEMPTS) {
          attempt += 1
          continue
        }

        errors.push(`Key ****${entry.key.slice(-4)} 失败：${reason}`)
        break
      }
    }
  }

  throw new Error(`DashScope 调用失败：${errors.join(' | ')}`)
}

export async function streamDashScope(
  prompt: string,
  options: StreamOptions = {},
): Promise<string> {
  // 改为调用本地后端 API 代理
  const controller = options.signal as AbortController | undefined
  console.log('[streamDashScope] prompt:', prompt)
  const response = await fetch('/api/qwen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
    signal: controller?.signal,
  })
  console.log('[streamDashScope] response status:', response.status)
  if (!response.ok) {
    const message = await response.text()
    console.error('[streamDashScope] error response:', message)
    throw new Error(`模型调用失败: ${message}`)
  }
  const data = await response.json()
  console.log('[streamDashScope] response data:', data)
  const text = data.result || data.content || data.choices?.[0]?.message?.content || ''
  if (options.onDelta) {
    options.onDelta(text)
  }
  return text
}

export type { DashScopeOptions, StreamOptions }

