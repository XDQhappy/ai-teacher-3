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
  const model =
    import.meta.env.VITE_DASHSCOPE_MODEL ||
    import.meta.env.VITE_GEMINI_MODEL ||
    DEFAULT_MODEL
  const baseUrl =
    import.meta.env.VITE_DASHSCOPE_BASE_URL ||
    import.meta.env.VITE_GEMINI_BASE_URL ||
    DEFAULT_BASE_URL
  const temperature =
    Number(import.meta.env.VITE_DASHSCOPE_TEMPERATURE) ||
    Number(import.meta.env.VITE_GEMINI_TEMPERATURE) ||
    DEFAULT_TEMPERATURE
  const configuredMaxTokens =
    Number(import.meta.env.VITE_DASHSCOPE_MAX_OUTPUT_TOKENS) ||
    Number(import.meta.env.VITE_GEMINI_MAX_OUTPUT_TOKENS) ||
    DEFAULT_MAX_OUTPUT_TOKENS
  const maxOutputTokens = Math.min(configuredMaxTokens, MAX_SAFE_OUTPUT_TOKENS)

  const keyEntries = getRotatedKeyEntries()

  if (!keyEntries.length) {
    throw new Error('未配置 DashScope API Key，请在 src/config/gemini.ts 或 .env 中填写密钥')
  }

  if (options.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  
  // 调试日志：显示实际使用的配置
  console.log('[DashScope Stream] 请求配置:', {
    model,
    max_tokens: maxOutputTokens,
    temperature,
    promptLength: prompt.length,
  })
  
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
    stream: true,
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
        Number(import.meta.env.VITE_DASHSCOPE_TIMEOUT_MS) ||
          Number(import.meta.env.VITE_GEMINI_TIMEOUT_MS) ||
          DEFAULT_TIMEOUT_MS,
        options.signal,
      )

      if (!response.ok) {
        const message = await response.text()
        throw new Error(`状态 ${response.status}: ${message}`)
      }

      if (!response.body) {
        throw new Error('DashScope 响应体为空，无法进行流式解析')
      }

      const decoder = new TextDecoder('utf-8')
      const reader = response.body.getReader()
      let buffer = ''
      let fullText = ''
      let detectedFinishReason: string | null = null

      const flushBuffer = (line: string) => {
        const content = line.trim()
        if (!content || content === '') return false
        if (!content.startsWith('data:')) return false
        const payload = content.slice(5).trim()
        if (!payload || payload === '[DONE]') {
          return payload === '[DONE]'
        }
        try {
          const data = JSON.parse(payload) as any
          
          // 检查是否达到 token 限制
          const finishReason = data.choices?.[0]?.finish_reason || data.output?.choices?.[0]?.finish_reason
          if (finishReason) {
            detectedFinishReason = finishReason
            if (finishReason === 'length') {
              console.warn('[DashScope] ⚠️ 检测到输出因达到 max_tokens 限制而截断！')
              console.warn('[DashScope] 当前 max_tokens:', maxOutputTokens, '，建议增加到 16384 或更高')
            }
          }
          
          // 兼容 OpenAI 格式和 DashScope 格式
          const delta = data.choices?.[0]?.delta?.content || 
                       data.choices?.[0]?.message?.content ||
                       data.output?.choices?.[0]?.message?.content ||
                       data.output?.text ||
                       ''
          let textDelta = ''
          if (typeof delta === 'string') {
            textDelta = delta
          } else if (Array.isArray(delta)) {
            textDelta = delta.map((part: any) => part.text || part).filter(Boolean).join('')
          }
          if (textDelta) {
            // 检查是否已取消，如果已取消则不更新内容
            if (options.signal?.aborted) {
              return true // 返回 true 表示应该停止
            }
            fullText += textDelta
            options.onDelta?.(textDelta)
          }
        } catch (err) {
          // 忽略解析错误，继续处理下一行
          console.warn('解析 DashScope 流式片段失败', err, '原始内容:', payload)
        }
        return false
      }

      let lastActivityTime = Date.now()
      const ACTIVITY_TIMEOUT_MS = 180000 // 180秒（3分钟）无活动则超时，支持长教案生成

      // 修改flushBuffer以更新活动时间
      const originalFlushBuffer = flushBuffer
      const flushBufferWithActivity = (line: string) => {
        // 在处理前检查是否已取消
        if (options.signal?.aborted) {
          return true
        }
        const result = originalFlushBuffer(line)
        // 如果有内容输出，更新活动时间
        if (fullText.length > 0) {
          lastActivityTime = Date.now()
        }
        return result
      }

      while (true) {
        // 检查是否已取消
        if (options.signal?.aborted) {
          reader.cancel().catch(() => {})
          throw new DOMException('Aborted', 'AbortError')
        }

        // 检查活动超时
        if (Date.now() - lastActivityTime > ACTIVITY_TIMEOUT_MS) {
          console.warn('流式输出超时，尝试完成当前内容')
          break
        }

        const { value, done } = await reader.read()
        if (done) break

        lastActivityTime = Date.now()
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const isDone = flushBufferWithActivity(line)
          if (isDone) {
            reader.cancel().catch(() => {})
            break
          }
        }
      }

      if (buffer.trim() && !options.signal?.aborted) {
        flushBufferWithActivity(buffer)
      }

      // 检查是否因为 token 限制而截断
      if (detectedFinishReason === 'length') {
        console.error('[DashScope] ❌ 输出因达到 max_tokens 限制而截断！')
        console.error('[DashScope] 当前配置: max_tokens =', maxOutputTokens, '(来自 env:', configuredMaxTokens, ')')
        console.error('[DashScope] 💡 解决方案: 在 env.local 中设置 VITE_DASHSCOPE_MAX_OUTPUT_TOKENS=16384 或更高')
      }

      // 如果流式输出为空，降级到非流式调用
      if (!fullText) {
        console.warn('DashScope 流式输出为空，降级到非流式调用')
        const fallbackText = await callDashScope(prompt, { signal: options.signal })
        if (fallbackText) {
          // 一次性触发 onDelta 回调
          options.onDelta?.(fallbackText)
          getRotatedKeyEntries.nextIndex = (entry.index + 1) % getApiKeys().length
          return fallbackText
        }
        throw new Error('DashScope 流式输出内容为空，且非流式调用也失败')
      }

      console.log('[DashScope Stream] 完成，输出长度:', fullText.length, '字符')
      getRotatedKeyEntries.nextIndex = (entry.index + 1) % getApiKeys().length
      return fullText
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

export type { DashScopeOptions, StreamOptions }

