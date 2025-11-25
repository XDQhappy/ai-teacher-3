import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import './App.css'
import { composePrompt } from './lib/prompt'
import { streamDashScope } from './services/dashscope'
import type { ChatMessage } from './types/chat'
import { FormulaText } from './components/FormulaText'
import { LessonContent } from './components/LessonContent'
import { FileUpload } from './components/FileUpload'
import { OptionalInputs } from './components/OptionalInputs'
import type { OptionalInputsData } from './config/prompt'
import { exportLessonToWord } from './utils/exportToWord'
import { exportLessonToPPT } from './utils/exportToPPT'

const MODULE_OVERVIEW =
  '本模块旨在解决通用 AI 模型生成教案"千篇一律"、不符合校本教学特色的核心痛点。我们将构建一个深度融合贵校优秀教案资源的 AI 系统，分阶段实现从"能用"到"好用"再到"专属"的进化。最终目标是让系统生成的每一份教案，都蕴含贵校的教学智慧和育人理念，成为教师备课的得力 AI 助手。'

const PRESET_LESSONS = [
  {
    label: '语文 · 经典教案再创作',
    prompt: '参考学校语文优秀教案范式，为初二《木兰诗》生成符合校本风格的导学案。',
  },
  {
    label: '数学 · 研究性课题',
    prompt: '基于王老师的一次函数精品教案，输出一份"探究式"课堂方案，突出校本提问方式。',
  },
  {
    label: '英语 · 跨学科融合',
    prompt: '结合学校英语校本课程资料，设计以校园文化为主题的阅读课教案。',
  },
  {
    label: '物理 · 实验经验沉淀',
    prompt: '利用学校浮力实验案例库，生成强调安全与记录规范的实验课教案。',
  },
  {
    label: '化学 · 概念建构',
    prompt: '参考学校化学优秀教案，为初三"酸碱盐"单元生成符合校本特色的教学设计。',
  },
  {
    label: '生物 · 探究式学习',
    prompt: '基于学校生物实验教案，设计"细胞结构"主题的探究式课堂方案。',
  },
  {
    label: '历史 · 史料分析',
    prompt: '结合学校历史教案范式，为"中国古代史"生成注重史料分析的教案。',
  },
  {
    label: '地理 · 实践应用',
    prompt: '参考学校地理教案，设计"中国地理"主题的实践应用型教案。',
  },
]


const DEV_ROADMAP = [
  {
    title: '阶段一 · 模型微调与风格定制',
    points: [
      '微调数据集构建：对贵校精选教案（手写稿/电子文档）进行数字化、清洗与格式统一，沉淀高质量语料。',
      '模型微调：让模型学习教师语言习惯、逻辑偏好与教学理念，在内容与“腔调”上都保持校本气质。',
    ],
  },
  {
    title: '阶段二 · 校本知识库与 RAG',
    points: [
      '知识库搭建：将教案切分为语义片段并向量化，构建可随时检索的“学校教学经验库”。',
      '检索增强生成：输入新课题时先检索相关片段，再与教师指令组合成“超级 Prompt”，生成个性化教案。',
    ],
  },
  {
    title: '阶段三 · 功能深化与智能迭代',
    points: [
      '引入学情数据以提供差异化教学建议，或叠加教案质量评估模型，持续迭代“校本专属”体验。',
    ],
  },
]

const HERO_POINTS = ['深度融合校本知识库', '动态超级 Prompt 构建', '教师友好的教案工作台']

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTopic, setCurrentTopic] = useState<string>('')
  const [optionalInputs, setOptionalInputs] = useState<OptionalInputsData>({
    teachingObjectives: '',
    teachingFocus: '',
    teachingDifficulties: '',
    lessonType: '',
  })
  const abortControllerRef = useRef<AbortController | null>(null)
  const generatingMessageTimestampRef = useRef<number | null>(null)
  
  // 获取最后一个已完成的教案内容
  const getLastCompletedLesson = () => {
    const assistantMessages = messages.filter(
      (msg) => msg.role === 'assistant' && msg.content.trim()
    )
    if (assistantMessages.length === 0) return null
    
    const lastMessage = assistantMessages[assistantMessages.length - 1]
    const isGenerating = generatingMessageTimestampRef.current === lastMessage.timestamp && isLoading
    
    return isGenerating ? null : lastMessage
  }
  
  const lastLesson = getLastCompletedLesson()

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsLoading(false)
      // 清除生成状态，这样已生成的内容可以显示下载按钮
      generatingMessageTimestampRef.current = null
      // 不删除消息，保留已生成的内容，只是停止继续生成
    }
  }

  const handleSend = async () => {
    // 如果正在生成，点击按钮则取消
    if (isLoading) {
      handleCancel()
      return
    }

    const trimmed = input.trim()
    if (!trimmed) return

    setInput('')
    setError(null)

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmed,
      topic: currentTopic || undefined,
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    let placeholder: ChatMessage | null = null

    try {
      const finalPrompt = composePrompt(trimmed, optionalInputs)
      placeholder = {
        role: 'assistant',
        content: '',
        topic: currentTopic || undefined,
        timestamp: Date.now() + 1,
      }

      setMessages((prev) => [...prev, placeholder as ChatMessage])
      generatingMessageTimestampRef.current = placeholder.timestamp

      let accumulated = ''

      await streamDashScope(finalPrompt, {
        signal: controller.signal,
        onDelta: (delta) => {
          // 检查是否已取消
          if (controller.signal.aborted || abortControllerRef.current !== controller) {
            // 即使已取消，也要保存当前已累积的内容（最后一次保存）
            if (accumulated) {
              setMessages((prev) =>
                prev.map((msg) =>
                  placeholder && msg.timestamp === placeholder.timestamp
                    ? { ...msg, content: accumulated }
                    : msg,
                ),
              )
            }
            return
          }
          accumulated += delta
          setMessages((prev) =>
            prev.map((msg) =>
              placeholder && msg.timestamp === placeholder.timestamp
                ? { ...msg, content: accumulated }
                : msg,
            ),
          )
        },
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // 取消时保留已生成的内容，只删除完全空的消息
        if (placeholder) {
          const placeholderTimestamp = placeholder.timestamp
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.timestamp === placeholderTimestamp) {
                // 如果消息有内容，保留；如果完全为空，删除
                if (msg.content.trim()) {
                  return msg // 保留已有内容
                }
                return null // 标记为删除
              }
              return msg
            }).filter((msg): msg is ChatMessage => msg !== null)
          )
        }
        return
      }
      const message = err instanceof Error ? err.message : '未知错误，请稍后重试'
      setError(message)
      if (placeholder) {
        const placeholderTimestamp = placeholder.timestamp
        setMessages((prev) =>
          prev.map((msg) =>
            msg.timestamp === placeholderTimestamp
              ? { ...msg, content: `生成失败：${message}` }
              : msg,
          ),
        )
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
      setIsLoading(false)
      generatingMessageTimestampRef.current = null
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (!isLoading) {
        handleSend()
      }
    }
  }

  const handlePresetInsert = (preset: string) => {
    setInput(preset)
  }

  const handleDownloadLesson = async (content: string, topic?: string) => {
    try {
      // 生成文件名：如果有课题则使用课题，否则使用默认名称
      const filename = topic || '教案'
      await exportLessonToWord(content, filename)
    } catch (error) {
      console.error('下载教案失败:', error)
      setError('下载教案失败，请稍后重试')
    }
  }

  const handleExportPPT = async (content: string, topic?: string) => {
    try {
      const filename = topic || '教案'
      await exportLessonToPPT(content, filename)
    } catch (error) {
      console.error('导出PPT失败:', error)
      setError('导出PPT失败，请稍后重试')
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-text">
          <span className="badge">校本 AI 教案 · 开发阶段</span>
          <h1>基于学校专有知识库的个性化教案生成系统</h1>
          <p className="subtitle">{MODULE_OVERVIEW}</p>
          <ul className="hero-highlights">
            {HERO_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
        <div className="topic-card">
          <p>当前识别课题</p>
          <strong className={!currentTopic ? 'placeholder' : ''}>
            {currentTopic || '待识别'}
          </strong>
        </div>
      </header>

      <section className="panel-grid-two">
        <article className="panel roadmap-panel">
          <div className="panel-header">
            <div>
              <h2>技术开发路线</h2>
              <p>分阶段实现"能用、好用、专属"</p>
            </div>
          </div>
          <div className="roadmap">
            {DEV_ROADMAP.map((stage) => (
              <div key={stage.title} className="roadmap-item">
                <h3>{stage.title}</h3>
                <ul>
                  {stage.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>

        <article className="panel examples-panel">
          <div className="panel-header">
            <div>
              <h2>典型教案示例</h2>
              <p>点击示例快速填充输入框</p>
            </div>
          </div>
          <div className="chip-section">
            <div className="chip-grid">
              {PRESET_LESSONS.map((preset) => (
                <button
                  key={preset.label}
                  className="chip"
                  type="button"
                  onClick={() => handlePresetInsert(preset.prompt)}
                  disabled={isLoading}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div className="file-upload-section">
            <FileUpload
              onTopicDetected={(topic) => {
                setCurrentTopic(topic)
              }}
            />
          </div>
        </article>
      </section>

      <section className="panel chat-panel">
        <div className="panel-header">
      <div>
            <h2>教案对话区</h2>
            <p>Enter 发送 · Shift + Enter 换行</p>
          </div>
        </div>
        <div className="chat-window">
          {messages.length === 0 && (
            <div className="placeholder">
              <p>欢迎连云港市新海实验中学的同仁莅临交流指导，共促教育高质量发展！</p>
            </div>
          )}
          {messages.map((message) => {
            return (
              <article key={message.timestamp} className={`bubble ${message.role}`}>
                <header>
                  <span>{message.role === 'user' ? '教师' : 'DeePrompt'}</span>
                </header>
              <div className="message-content">
                {message.role === 'assistant' ? (
                  <LessonContent content={message.content} />
                ) : (
                  message.content.split('\n').map((line, idx, arr) => (
                    <div key={idx}>
                      <FormulaText>{line}</FormulaText>
                      {idx < arr.length - 1 && <br />}
                    </div>
                  ))
                )}
              </div>
            </article>
            )
          })}
      </div>
        {error && <div className="error">{error}</div>}
        <div className="composer-wrapper">
          <OptionalInputs data={optionalInputs} onChange={setOptionalInputs} />
          <div className="composer">
            <div className="composer-main">
              <textarea
                value={input}
                placeholder="请输入你的教案需求，例如：初一上册勾股定理教学课教学设计"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!isLoading && !input.trim()}
                className="generate-button"
              >
                {isLoading ? '停止生成' : '生成教案'}
              </button>
            </div>
            <div className="export-buttons-column">
              <button
                className="export-button export-button-word"
                onClick={() => lastLesson && handleDownloadLesson(lastLesson.content, lastLesson.topic)}
                title="下载教案为 Word 文档"
                type="button"
                disabled={!lastLesson}
              >
                📥 Word
              </button>
              <button
                className="export-button export-button-ppt"
                onClick={() => lastLesson && handleExportPPT(lastLesson.content, lastLesson.topic)}
                title="导出教案为 PPT 演示文稿"
                type="button"
                disabled={!lastLesson}
              >
                📊 PPT
              </button>
            </div>
          </div>
        </div>
      </section>
      </div>
  )
}

export default App
