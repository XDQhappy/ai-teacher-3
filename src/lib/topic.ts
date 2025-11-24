interface TopicResult {
  topic: string
  confidence: number
  source: 'keyword' | 'summary'
}

const TOPIC_KEYWORDS: Array<{ label: string; keywords: string[] }> = [
  {
    label: '编程与技术',
    keywords: ['代码', '编程', 'bug', '函数', '前端', '后端', 'React', 'TypeScript', 'JavaScript', '接口'],
  },
  {
    label: '产品与设计',
    keywords: ['产品', '设计', '交互', '用户体验', '需求', '原型', '流程'],
  },
  {
    label: '学习与考试',
    keywords: ['学习', '考试', '作业', '题目', '课堂', '知识点', '复习'],
  },
  {
    label: '商业与管理',
    keywords: ['商业', '市场', '运营', '策略', '管理', '团队', '成本', '盈利'],
  },
]

const DEFAULT_TOPIC = '综合问答'

function summarizeTopic(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return DEFAULT_TOPIC
  const maxLength = 18
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength)}…`
}

export function detectTopic(text: string): TopicResult {
  if (!text.trim()) {
    return {
      topic: DEFAULT_TOPIC,
      confidence: 0,
      source: 'summary',
    }
  }

  const normalized = text.toLowerCase()

  for (const entry of TOPIC_KEYWORDS) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return {
        topic: entry.label,
        confidence: 0.8,
        source: 'keyword',
      }
    }
  }

  return {
    topic: summarizeTopic(text),
    confidence: 0.5,
    source: 'summary',
  }
}

export type { TopicResult }

