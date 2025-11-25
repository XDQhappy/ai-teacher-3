interface FormulaTextProps {
  children: string
}

export function FormulaText({ children }: FormulaTextProps) {
  // 暂时直接返回文本，公式用特殊样式标记
  // 等 katex 安装后再启用公式渲染
  const parts = children.split(/(\$[^$]+\$)/g)
  
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('$') && part.endsWith('$')) {
          // 公式部分：去掉 $ 符号，用特殊样式显示
          const formula = part.slice(1, -1)
          return (
            <span
              key={index}
              style={{
                fontFamily: 'monospace',
                backgroundColor: '#f0f0f0',
                padding: '2px 4px',
                borderRadius: '3px',
                fontSize: '0.9em',
              }}
              title={`公式: ${formula}`}
            >
              {formula}
            </span>
          )
        }
        return <span key={index}>{part}</span>
      })}
    </>
  )
}

