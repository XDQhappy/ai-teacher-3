import PptxGenJS from 'pptxgenjs'

interface SlideContent {
  title: string
  items: Array<{
    text: string
    isList: boolean
    level: number
    type: 'title' | 'content' | 'divider' | 'action' | 'intent'
  }>
}

/**
 * PPT生成实现原理说明：
 * 
 * 1. 使用库：pptxgenjs（纯JavaScript库，在浏览器端运行）
 * 2. 不需要API：所有PPT生成都在用户浏览器中完成，不调用任何后端API
 * 3. 工作流程：
 *    - 解析教案文本内容
 *    - 使用pptxgenjs创建PPT对象
 *    - 添加幻灯片、文本、形状、样式等
 *    - 生成二进制文件（.pptx格式）
 *    - 使用浏览器下载功能保存文件
 * 
 * 4. 优点：
 *    - 完全离线工作，不需要网络
 *    - 数据不离开用户设备，隐私安全
 *    - 生成速度快
 *    - 不需要服务器成本
 * 
 * 5. 限制：
 *    - 无法插入真实图片（需要base64编码或URL）
 *    - 样式受pptxgenjs库限制
 *    - 复杂动画和效果支持有限
 */

/**
 * 将教案内容转换为 PPT 演示文稿并下载
 * @param content 教案内容（纯文本）
 * @param filename 文件名（不含扩展名）
 */
export async function exportLessonToPPT(content: string, filename: string = '教案') {
  const pptx = new PptxGenJS()

  // 设置演示文稿属性
  pptx.author = 'DeePrompt 教案助手'
  pptx.company = '连云港市新海实验中学'
  pptx.title = filename
  pptx.layout = 'LAYOUT_WIDE' // 16:9 宽屏布局

  // 精美的主题配色方案
  const theme = {
    primary: '1e3a8a', // 深蓝色
    primaryLight: '3b82f6', // 亮蓝色
    secondary: '7c3aed', // 紫色
    accent: '06b6d4', // 青色
    text: '1e293b', // 深灰文字
    textLight: '64748b', // 浅灰文字
    background: 'ffffff', // 白色背景
    backgroundLight: 'f8fafc', // 浅灰背景
    border: 'e2e8f0', // 边框色
    success: '10b981', // 成功色（绿色）
    warning: 'f59e0b', // 警告色（橙色）
  }

  // 解析教案内容
  const slides = parseLessonContent(content)

  // 创建精美的封面页
  createTitleSlide(pptx, filename, theme)

  // 为每个章节创建内容幻灯片
  slides.forEach((slide, index) => {
    createContentSlides(pptx, slide, theme, index)
  })

  // 下载文件
  const fileName = `${filename}_${new Date().toISOString().split('T')[0]}.pptx`
  await pptx.writeFile({ fileName })
}

/**
 * 创建精美的封面页 - 修复尺寸，占满整页
 */
function createTitleSlide(pptx: PptxGenJS, filename: string, theme: Record<string, string>) {
  const slide = pptx.addSlide()

  const SLIDE_WIDTH = 10
  const SLIDE_HEIGHT = 7.5

  // 顶部装饰条 - 占满宽度
  slide.addShape('rect' as any, {
    x: 0,
    y: 0,
    w: SLIDE_WIDTH,
    h: 1.5,
    fill: { color: theme.primary },
    line: { color: 'transparent' },
  })

  // 底部装饰条 - 占满宽度（使用浅色）
  slide.addShape('rect' as any, {
    x: 0,
    y: SLIDE_HEIGHT - 1.5,
    w: SLIDE_WIDTH,
    h: 1.5,
    fill: { color: 'c7d2fe' }, // 使用浅色代替opacity
    line: { color: 'transparent' },
  })

  // 左侧装饰条 - 占满高度
  slide.addShape('rect' as any, {
    x: 0,
    y: 0,
    w: 0.25,
    h: SLIDE_HEIGHT,
    fill: { color: theme.secondary },
    line: { color: 'transparent' },
  })

  // 主标题 - 居中，充分利用空间
  slide.addText(filename, {
    x: 0.5,
    y: 2.8,
    w: 9,
    h: 1.0,
    fontSize: 64,
    bold: true,
    align: 'center',
    color: theme.primary,
    fontFace: '微软雅黑',
    valign: 'middle',
  })

  // 副标题
  slide.addText('教学教案演示文稿', {
    x: 0.5,
    y: 4.0,
    w: 9,
    h: 0.5,
    fontSize: 24,
    align: 'center',
    color: theme.textLight,
    fontFace: '微软雅黑',
    valign: 'middle',
  })

  // 装饰性分隔线
  slide.addShape('rect' as any, {
    x: 3.5,
    y: 4.5,
    w: 3,
    h: 0.04,
    fill: { color: theme.accent },
    line: { color: 'transparent' },
  })

  // 底部信息
  slide.addText(`生成时间：${new Date().toLocaleDateString('zh-CN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}`, {
    x: 0.5,
    y: 5.8,
    w: 9,
    h: 0.4,
    fontSize: 16,
    align: 'center',
    color: theme.textLight,
    fontFace: '微软雅黑',
    valign: 'middle',
  })

  // 学校信息
  slide.addText('连云港市新海实验中学', {
    x: 0.5,
    y: 6.3,
    w: 9,
    h: 0.3,
    fontSize: 14,
    align: 'center',
    color: theme.textLight,
    fontFace: '微软雅黑',
    valign: 'middle',
  })
}

/**
 * 创建内容幻灯片（支持分页）- 彻底重写，修复尺寸问题
 */
function createContentSlides(
  pptx: PptxGenJS,
  slideData: SlideContent,
  theme: Record<string, string>,
  _sectionIndex: number,
) {
  // PPT标准尺寸：10英寸宽 x 7.5英寸高
  const SLIDE_WIDTH = 10
  const SLIDE_HEIGHT = 7.5
  const TITLE_AREA_HEIGHT = 0.9 // 标题栏高度
  const CONTENT_START_Y = TITLE_AREA_HEIGHT + 0.1 // 内容开始位置（紧贴标题栏）
  const CONTENT_END_Y = SLIDE_HEIGHT - 0.2 // 内容结束位置（留0.2英寸底边距）
  const CONTENT_AVAILABLE_HEIGHT = CONTENT_END_Y - CONTENT_START_Y // 可用内容高度：约6.3英寸
  const LEFT_MARGIN = 0.15 // 最小左边距，充分利用宽度
  const RIGHT_MARGIN = 0.15 // 最小右边距，充分利用宽度
  const CONTENT_WIDTH = SLIDE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN // 内容宽度：9.7英寸（几乎占满）
  const ITEM_SPACING = 0.15 // 项目间距

  let currentSlide: any = null
  let currentY = CONTENT_START_Y
  let slideIndex = 0

  const createNewSlide = () => {
    currentSlide = pptx.addSlide()
    
    // 标题栏背景 - 占满整个宽度
    currentSlide.addShape('rect' as any, {
      x: 0,
      y: 0,
      w: SLIDE_WIDTH,
      h: TITLE_AREA_HEIGHT,
      fill: { color: theme.primary },
      line: { color: 'transparent' },
    })

    // 标题栏装饰条
    currentSlide.addShape('rect' as any, {
      x: 0,
      y: TITLE_AREA_HEIGHT - 0.08,
      w: SLIDE_WIDTH,
      h: 0.08,
      fill: { color: theme.secondary },
      line: { color: 'transparent' },
    })

    // 左侧装饰条
    currentSlide.addShape('rect' as any, {
      x: 0,
      y: 0,
      w: 0.2,
      h: TITLE_AREA_HEIGHT,
      fill: { color: theme.accent },
      line: { color: 'transparent' },
    })

    // 标题文字
    const titleText = slideIndex === 0 ? slideData.title : `${slideData.title}（续${slideIndex}）`
    currentSlide.addText(titleText, {
      x: LEFT_MARGIN,
      y: 0.2,
      w: CONTENT_WIDTH,
      h: 0.5,
      fontSize: 32,
      bold: true,
      color: 'ffffff',
      fontFace: '微软雅黑',
      valign: 'middle',
    })

    // 内容区域背景 - 占满整个可用空间
    currentSlide.addShape('rect' as any, {
      x: LEFT_MARGIN,
      y: CONTENT_START_Y,
      w: CONTENT_WIDTH,
      h: CONTENT_AVAILABLE_HEIGHT,
      fill: { color: theme.backgroundLight },
      line: { color: theme.border, width: 1 },
    })

    currentY = CONTENT_START_Y + 0.1 // 内容起始位置（最小内边距）
    slideIndex++
  }

  // 创建第一张幻灯片
  createNewSlide()

  slideData.items.forEach((item) => {
    // 先确定字体大小（与addContentItem中的逻辑一致）
    let fontSize = 18
    switch (item.type) {
      case 'title':
        fontSize = 24
        break
      case 'divider':
        fontSize = 14
        break
      case 'action':
        fontSize = 16
        break
      case 'intent':
        fontSize = 18
        break
      default:
        fontSize = item.level === 0 ? 18 : Math.max(16, 18 - item.level * 1)
        break
    }
    
    // 计算文本的实际可用宽度（充分利用宽度）
    const indent = item.level * 0.3
    const padding = item.type === 'title' ? 0.12 : item.type === 'divider' ? 0.08 : 0.1
    const itemWidth = CONTENT_WIDTH - padding * 2 - indent // 充分利用宽度
    
    const itemHeight = calculateItemHeight(item, itemWidth, fontSize)
    const totalHeight = itemHeight + padding * 2 + ITEM_SPACING // 文本框高度 + 上下内边距 + 间距

    // 检查是否需要新幻灯片
    if (currentY + totalHeight > CONTENT_END_Y - 0.1) {
      createNewSlide()
    }

    // 添加内容项 - 充分利用宽度
    addContentItem(currentSlide, item, currentY, theme, LEFT_MARGIN + padding, CONTENT_WIDTH - padding * 2)
    currentY += totalHeight
  })
}

/**
 * 添加内容项到幻灯片（彻底重写，修复重叠和美观问题）
 */
function addContentItem(
  slide: any,
  item: { text: string; isList: boolean; level: number; type: string },
  y: number,
  theme: Record<string, string>,
  startX: number,
  contentWidth: number,
) {
  const cleanText = cleanMarkdown(item.text)
  
  // 根据类型设置不同的样式
  let fontSize = 18
  let color = theme.text
  let bold = false
  let indent = item.level * 0.3 // 根据层级缩进
  let align: 'left' | 'center' = 'left'
  let bgColor: string | undefined = undefined
  let borderColor: string | undefined = undefined
  let padding = 0.1 // 内边距

  switch (item.type) {
    case 'title':
      fontSize = 24
      color = theme.primary
      bold = true
      indent = 0
      padding = 0.12
      bgColor = theme.backgroundLight
      borderColor = theme.primaryLight
      break
    case 'divider':
      fontSize = 14
      color = theme.textLight
      align = 'center'
      indent = 0
      padding = 0.08
      break
    case 'action':
      fontSize = 16
      color = theme.accent
      bold = true
      indent = 0.2
      padding = 0.1
      bgColor = 'e0f2fe'
      break
    case 'intent':
      fontSize = 18
      color = theme.primary
      bold = true
      indent = 0.2
      padding = 0.12
      bgColor = 'eff6ff'
      borderColor = theme.primaryLight
      break
    default:
      fontSize = item.level === 0 ? 18 : Math.max(16, 18 - item.level * 1)
      indent = item.level * 0.3
      padding = 0.1
      break
  }

  // 计算实际可用宽度和位置 - 充分利用宽度
  const itemX = startX + indent
  const itemWidth = contentWidth - indent // 充分利用可用宽度
  const textAvailableWidth = itemWidth - padding * 2
  const itemHeight = calculateItemHeight(item, textAvailableWidth, fontSize)

  // 如果有背景色，先添加背景框
  if (bgColor) {
    slide.addShape('roundRect' as any, {
      x: itemX,
      y: y,
      w: itemWidth,
      h: itemHeight + padding * 2,
      fill: { color: bgColor },
      line: borderColor ? { color: borderColor, width: 1 } : { color: 'transparent' },
      rectRadius: 0.08,
    })
  }

  const textOptions: any = {
    x: itemX + padding,
    y: y + padding,
    w: textAvailableWidth, // 使用了修正后的可用宽度
    h: itemHeight, // 使用了修正后的高度
    fontSize: fontSize,
    color,
    fontFace: '微软雅黑',
    align,
    valign: 'top',
    wrap: true,
    lineSpacing: fontSize * 1.5, // 行间距 = 字体大小 * 1.5，确保不重叠
  }

  if (bold) {
    textOptions.bold = true
  }

  if (item.isList && item.type !== 'divider') {
    textOptions.bullet = { 
      type: 'number', 
      code: '1.',
      indentLevel: item.level,
    }
  }

  slide.addText(cleanText, textOptions)
}

/**
 * 计算内容项的高度（彻底重写，精确计算，避免重叠）
 */
function calculateItemHeight(
  item: { text: string; level: number; type: string },
  availableWidth: number,
  fontSize: number,
): number {
  const cleanText = cleanMarkdown(item.text)
  
  if (!cleanText || cleanText.length === 0) {
    return 0.3 // 最小高度
  }

  // 精确计算每行字符数
  // 中文字符宽度约为字体大小的1倍，英文字符约为0.6倍
  // 考虑到混合文本，使用平均系数0.85
  const charWidth = fontSize * 0.85 / 72 // 转换为英寸（72点=1英寸）
  const charsPerLine = Math.floor(availableWidth / charWidth)
  
  if (charsPerLine <= 0) {
    return 0.4 // 防止除零
  }

  // 计算行数
  const lineCount = Math.max(1, Math.ceil(cleanText.length / charsPerLine))
  
  // 行高计算：字体大小 + 行间距
  // 行间距 = 字体大小 * 0.5（上下各0.25）
  const lineHeight = (fontSize / 72) * 1.5 // 转换为英寸，1.5倍行高
  
  // 总高度 = 行数 * 行高
  const totalHeight = lineCount * lineHeight
  
  // 确保最小高度
  return Math.max(totalHeight, fontSize / 72 * 1.2)
}

/**
 * 清理Markdown标记
 */
function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **bold**
    .replace(/\*(.*?)\*/g, '$1') // Remove *italic*
    .replace(/__(.*?)__/g, '$1') // Remove __underline__
    .replace(/#+\s*/g, '') // Remove # headings
    .replace(/`([^`]+)`/g, '$1') // Remove `code`
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1') // Remove [link](url)
    .trim()
}

/**
 * 解析教案内容为幻灯片结构
 */
function parseLessonContent(content: string): SlideContent[] {
  const lines = content.split('\n')
  const slides: SlideContent[] = []

  let currentSlide: SlideContent | null = null

  lines.forEach((line) => {
    const trimmed = line.trim()

    if (!trimmed) {
      return // 跳过空行
    }

    // 检测一级标题（一、二、三等）- 创建新幻灯片
    if (/^[一二三四五六七八九十]+[、.]/.test(trimmed)) {
      if (currentSlide) {
        slides.push(currentSlide)
      }
      currentSlide = {
        title: trimmed,
        items: [],
      }
      return
    }

    if (!currentSlide) return

    // 检测二级标题（(一)、(二)等）
    if (/^[（(][一二三四五六七八九十]+[）)]/.test(trimmed)) {
      currentSlide.items.push({
        text: trimmed,
        isList: false,
        level: 0,
        type: 'title',
      })
      return
    }

    // 检测时间分割线（--- 约X分钟 ---）
    if (/^---\s*约\s*\d+\s*分钟\s*---/.test(trimmed)) {
      currentSlide.items.push({
        text: trimmed,
        isList: false,
        level: 1,
        type: 'divider',
      })
      return
    }

    // 检测列表项（1. 2. 3. 等）
    if (/^\d+[、.]/.test(trimmed)) {
      currentSlide.items.push({
        text: trimmed,
        isList: true,
        level: 1,
        type: 'content',
      })
      return
    }

    // 检测动作标记 [动作：...]
    if (/^\[动作：/.test(trimmed)) {
      currentSlide.items.push({
        text: trimmed,
        isList: false,
        level: 2,
        type: 'action',
      })
      return
    }

    // 检测设计意图标记 • 【设计意图】
    if (/^[•·]\s*【设计意图】/.test(trimmed)) {
      currentSlide.items.push({
        text: trimmed,
        isList: false,
        level: 1,
        type: 'intent',
      })
      return
    }

    // 普通段落
    currentSlide.items.push({
      text: trimmed,
      isList: false,
      level: 0,
      type: 'content',
    })
  })

  // 添加最后一个幻灯片
  if (currentSlide) {
    slides.push(currentSlide)
  }

  return slides
}
