import { useState, useRef } from 'react'
import { callDashScope } from '../services/dashscope'

interface FileUploadProps {
  onFileUploaded?: (file: File, content: string) => void
  onAnalysisComplete?: (summary: string) => void
  onTopicDetected?: (topic: string) => void
}

export function FileUpload({ onFileUploaded, onAnalysisComplete, onTopicDetected }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [analysisProgress, setAnalysisProgress] = useState<string>('')
  const [fileSummary, setFileSummary] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)


  const acceptedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt']

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  const handleFile = async (file: File) => {
    // 检查文件类型
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!acceptedExtensions.includes(fileExtension)) {
      alert('不支持的文件格式，请上传 PDF、Word、PPT 或 TXT 文件')
      return
    }

    setUploadedFile(file)
    setIsAnalyzing(true)
    setAnalysisProgress('正在读取文件...')

    try {
      // 模拟文件读取和分析过程
      let content = ''

      if (file.type === 'text/plain' || fileExtension === '.txt') {
        // 读取文本文件
        content = await file.text()
        setAnalysisProgress('正在分析文本内容...')
      } else {
        // 对于 PDF、Word、PPT，这里只是模拟
        // 实际项目中需要使用相应的库来解析
        setAnalysisProgress('正在解析文档格式...')
        await new Promise((resolve) => setTimeout(resolve, 1000))
        setAnalysisProgress('正在提取文本内容...')
        await new Promise((resolve) => setTimeout(resolve, 1000))
        content = `[${file.name}] 文件已上传，内容解析中...\n文件大小: ${(file.size / 1024).toFixed(2)} KB\n文件类型: ${file.type || fileExtension}`
      }

      setAnalysisProgress('分析完成！')
      await new Promise((resolve) => setTimeout(resolve, 500))

      setIsAnalyzing(false)
      setAnalysisProgress('')

      // 调用 API 生成文件总结
      setIsGeneratingSummary(true)
      try {
        const filePreview = content.length > 1000 ? content.substring(0, 1000) + '...' : content
        const summaryPrompt = `请分析以下文件内容，生成一份简洁的总结概括，包括：
1. 文件主要内容概述
2. 关键信息点
3. 可能对教案生成有帮助的信息

文件名称：${file.name}
文件大小：${(file.size / 1024).toFixed(2)} KB
文件内容预览：
${filePreview}

请用简洁明了的语言生成总结，控制在200字以内。`

        const summary = await callDashScope(summaryPrompt)
        setFileSummary(summary)

        // 从总结中提取课题信息
        if (onTopicDetected) {
          try {
            const topicPrompt = `根据以下文件总结，识别并提取课题信息（包括学科、年级、教材版本等），格式如"初中七年级数学上册"或"初二语文下册"等。如果无法确定，请返回"未识别"。

文件总结：
${summary}

请只返回课题信息，不要其他内容。`
            
            const detectedTopic = await callDashScope(topicPrompt)
            const cleanedTopic = detectedTopic.trim().replace(/^课题[：:]\s*/, '').replace(/[""]/g, '')
            
            if (cleanedTopic && cleanedTopic !== '未识别' && cleanedTopic.length < 50) {
              onTopicDetected(cleanedTopic)
            }
          } catch (error) {
            console.error('课题识别失败:', error)
          }
        }

        if (onFileUploaded) {
          onFileUploaded(file, content)
        }
        if (onAnalysisComplete) {
          onAnalysisComplete(summary)
        }
      } catch (error) {
        console.error('生成总结失败:', error)
        setFileSummary('总结生成失败，但文件已成功上传。')
      } finally {
        setIsGeneratingSummary(false)
      }
    } catch (error) {
      console.error('文件处理错误:', error)
      alert('文件处理失败，请重试')
      setIsAnalyzing(false)
      setAnalysisProgress('')
      setUploadedFile(null)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemove = () => {
    setUploadedFile(null)
    setAnalysisProgress('')
    setFileSummary('')
    setIsGeneratingSummary(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="file-upload-container">
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedExtensions.join(',')}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {!uploadedFile ? (
        <div
          className={`file-upload-area ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <div className="file-upload-icon">📄</div>
          <p className="file-upload-text">
            <strong>上传辅助材料</strong>
          </p>
          <p className="file-upload-hint">支持 PDF / Word / PPT / TXT</p>
          <p className="file-upload-hint-small">点击或拖拽文件到此处</p>
        </div>
      ) : (
        <div className="file-upload-result">
          <div className="file-info">
            <span className="file-icon">📎</span>
            <div className="file-details">
              <p className="file-name">{uploadedFile.name}</p>
              <p className="file-size">{(uploadedFile.size / 1024).toFixed(2)} KB</p>
            </div>
            <button className="file-remove" onClick={handleRemove} type="button">
              ✕
            </button>
          </div>
          {(isAnalyzing || isGeneratingSummary) && (
            <div className="analysis-progress active">
              <div className="progress-bar">
                <div className="progress-fill" key={isAnalyzing ? 'analyzing' : 'summary'} />
              </div>
              <p className="progress-text">
                {isAnalyzing ? analysisProgress : '正在生成文件总结...'}
              </p>
            </div>
          )}
          {fileSummary && !isGeneratingSummary && (
            <div className="file-summary">
              <h4 className="file-summary-title">文件总结</h4>
              <p className="file-summary-content">{fileSummary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

