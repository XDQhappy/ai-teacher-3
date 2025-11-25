import { useState } from 'react'
import type { OptionalInputsData } from '../config/prompt'

export const LESSON_TYPES = [
  { value: '', label: '不指定' },
  { value: '教学课', label: '教学课' },
  { value: '习题课', label: '习题课' },
  { value: '复习课', label: '复习课' },
  { value: '试卷讲评课', label: '试卷讲评课' },
  { value: '实验课', label: '实验课' },
] as const

interface OptionalInputsProps {
  data: OptionalInputsData
  onChange: (data: OptionalInputsData) => void
}

export function OptionalInputs({ data, onChange }: OptionalInputsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleChange = (field: keyof OptionalInputsData, value: string) => {
    onChange({
      ...data,
      [field]: value,
    })
  }

  const hasAnyContent = 
    data.teachingObjectives.trim() ||
    data.teachingFocus.trim() ||
    data.teachingDifficulties.trim() ||
    data.lessonType

  return (
    <div className="optional-inputs-container">
      <button
        type="button"
        className="optional-inputs-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
        <span>可选设置 {hasAnyContent && <span className="has-content-badge">已填写</span>}</span>
      </button>

      {isExpanded && (
        <div className="optional-inputs-content">
          <div className="optional-inputs-grid">
            <div className="optional-input-group">
              <label className="optional-input-label">
                教学目标
              </label>
              <textarea
                className="optional-input"
                placeholder="请输入教学目标..."
                value={data.teachingObjectives}
                onChange={(e) => handleChange('teachingObjectives', e.target.value)}
                rows={3}
              />
            </div>

            <div className="optional-input-group">
              <label className="optional-input-label">
                教学重点
              </label>
              <textarea
                className="optional-input"
                placeholder="请输入教学重点..."
                value={data.teachingFocus}
                onChange={(e) => handleChange('teachingFocus', e.target.value)}
                rows={3}
              />
            </div>

            <div className="optional-input-group">
              <label className="optional-input-label">
                教学难点
              </label>
              <textarea
                className="optional-input"
                placeholder="请输入教学难点..."
                value={data.teachingDifficulties}
                onChange={(e) => handleChange('teachingDifficulties', e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="lesson-type-selector">
            <label className="optional-input-label">
              课程类型
            </label>
            <div className="lesson-type-buttons">
              {LESSON_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  className={`lesson-type-button ${data.lessonType === type.value ? 'active' : ''}`}
                  onClick={() => handleChange('lessonType', type.value)}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

