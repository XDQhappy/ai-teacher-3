import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import { saveAs } from 'file-saver'

/**
 * 将教案内容转换为 Word 文档并下载
 * @param content 教案内容（纯文本）
 * @param filename 文件名（不含扩展名）
 */
export async function exportLessonToWord(content: string, filename: string = '教案') {
  // 解析内容，按行处理（保留空行以保持格式）
  const lines = content.split('\n')

  const children: Paragraph[] = []

  // 添加标题
  children.push(
    new Paragraph({
      text: filename,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  )

  // 处理内容
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      // 空行，保留以维持格式
      children.push(new Paragraph({ text: '', spacing: { after: 100 } }))
      continue
    }

    // 判断是否为标题（一级标题：一、二、三等）
    if (/^[一二三四五六七八九十]+[、.]/.test(trimmed)) {
      children.push(
        new Paragraph({
          text: trimmed,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 200 },
        }),
      )
      continue
    }

    // 判断是否为二级标题（(一)、(二)等）
    if (/^[（(][一二三四五六七八九十]+[）)]/.test(trimmed)) {
      children.push(
        new Paragraph({
          text: trimmed,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 150, after: 150 },
        }),
      )
      continue
    }

    // 判断是否为时间分割线（--- 约X分钟 ---）
    if (/^---\s*约\s*\d+\s*分钟\s*---/.test(trimmed)) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 100 },
          children: [
            new TextRun({
              text: trimmed,
              italics: true,
              color: '666666',
            }),
          ],
        }),
      )
      continue
    }

    // 判断是否为列表项（1. 2. 3. 等）
    if (/^\d+[、.]/.test(trimmed)) {
      children.push(
        new Paragraph({
          text: trimmed,
          spacing: { before: 100, after: 100 },
          indent: { left: 400 },
        }),
      )
      continue
    }

    // 判断是否为动作标记 [动作：...]
    if (/^\[动作：/.test(trimmed)) {
      children.push(
        new Paragraph({
          spacing: { before: 50, after: 50 },
          indent: { left: 400 },
          children: [
            new TextRun({
              text: trimmed,
              color: '0066CC',
              italics: true,
            }),
          ],
        }),
      )
      continue
    }

    // 判断是否为设计意图标记 • 【设计意图】
    if (/^[•·]\s*【设计意图】/.test(trimmed)) {
      children.push(
        new Paragraph({
          spacing: { before: 100, after: 100 },
          indent: { left: 400 },
          children: [
            new TextRun({
              text: trimmed,
              bold: true,
              color: '0066CC',
            }),
          ],
        }),
      )
      continue
    }

    // 普通段落
    // 处理公式（$...$）
    const parts = trimmed.split(/(\$[^$]+\$)/g)
    const textRuns: TextRun[] = []

    for (const part of parts) {
      if (part.startsWith('$') && part.endsWith('$')) {
        // 公式部分
        const formula = part.slice(1, -1)
        textRuns.push(
          new TextRun({
            text: formula,
            font: 'Courier New',
            color: '333333',
          }),
        )
      } else if (part.trim()) {
        // 普通文本
        textRuns.push(new TextRun(part))
      }
    }

    if (textRuns.length > 0) {
      children.push(
        new Paragraph({
          children: textRuns,
          spacing: { before: 100, after: 100 },
        }),
      )
    } else {
      children.push(
        new Paragraph({
          text: trimmed,
          spacing: { before: 100, after: 100 },
        }),
      )
    }
  }

  // 创建文档
  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })

  // 生成并下载
  const blob = await Packer.toBlob(doc)
  const fileName = `${filename}_${new Date().toISOString().split('T')[0]}.docx`
  saveAs(blob, fileName)
}

