import { FormulaText } from './FormulaText'

interface LessonContentProps {
  content: string
}

// 清理 Markdown 标记
function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, '') // 移除 **
    .replace(/\*/g, '') // 移除 *
    .replace(/__/g, '') // 移除 __
    .replace(/_/g, '') // 移除 _
    .replace(/`/g, '') // 移除 `
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 移除链接，保留文本
    .replace(/#{1,6}\s+/g, '') // 移除标题标记
    .trim()
}

export function LessonContent({ content }: LessonContentProps) {
  const lines = content.split('\n')
  const elements: JSX.Element[] = []

  lines.forEach((line, index) => {
    const cleaned = cleanMarkdown(line)
    const trimmed = cleaned.trim()
    
    // 一级标题（一、二、三等）
    if (/^[一二三四五六七八九十]+、/.test(trimmed)) {
      elements.push(
        <div key={index} className="lesson-title">
          <FormulaText>{trimmed}</FormulaText>
        </div>
      )
      return
    }

    // 二级标题（知识与技能、过程与方法等）
    if (/^(知识与技能|过程与方法|重点|难点|易错点提示|教学方法|讲授法|探究法)/.test(trimmed)) {
      elements.push(
        <div key={index} className="lesson-subtitle">
          <FormulaText>{trimmed}</FormulaText>
        </div>
      )
      return
    }

    // 数字列表项（1.、2.、3.等）
    if (/^\d+\./.test(trimmed)) {
      elements.push(
        <div key={index} className="lesson-numbered-item">
          <FormulaText>{trimmed}</FormulaText>
        </div>
      )
      return
    }

    // 圆点列表项（• 开头）
    if (/^[•·▪▫]\s/.test(trimmed)) {
      elements.push(
        <div key={index} className="lesson-list-item">
          <FormulaText>{trimmed.replace(/^[•·▪▫]\s/, '')}</FormulaText>
        </div>
      )
      return
    }

    // 时间分割线（--- 约X分钟 ---）
    if (/^---\s*约.*分钟\s*---/.test(trimmed)) {
      elements.push(
        <div key={index} className="lesson-time-divider">
          <FormulaText>{trimmed}</FormulaText>
        </div>
      )
      return
    }

    // 空行
    if (trimmed === '') {
      elements.push(<div key={index} className="lesson-empty-line" />)
      return
    }

    // 普通段落
    elements.push(
      <div key={index} className="lesson-paragraph">
        <FormulaText>{trimmed}</FormulaText>
      </div>
    )
  })

  return <div className="lesson-content">{elements}</div>
}

