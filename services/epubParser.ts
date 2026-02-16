// Polyfill for Node.js process API which is needed by @lingo-reader/epub-parser in browser
if (typeof process === 'undefined') {
  const processPolyfill = {
    env: {},
    cwd: () => '',
    platform: 'browser',
    version: 'v18.0.0',
    versions: {},
    nextTick: (callback: Function, ...args: any[]) => setTimeout(() => callback(...args), 0),
    uptime: () => 0,
    hrtime: () => [0, 0],
    argv: []
  };
  (window as any).process = processPolyfill;
} else {
  if (!process.cwd) (process as any).cwd = () => '';
  if (!process.platform) (process as any).platform = 'browser';
  if (!process.nextTick) (process as any).nextTick = (callback: Function, ...args: any[]) => setTimeout(() => callback(...args), 0);
}

import { initEpubFile, EpubFile, EpubMetadata } from '@lingo-reader/epub-parser';
import DOMPurify from 'dompurify';

// 配置 DOMPurify（允许安全的 HTML 标签，移除危险属性）
const configureDOMPurify = () => {
  // 默认配置已经足够安全，但可以添加自定义规则
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    // 可以在这里添加自定义元素处理逻辑
    const element = node as Element;
    console.debug('[DOMPurify] Sanitizing element:', element.tagName, data);
  });
  
  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    // 可以在这里添加自定义属性处理逻辑
    console.debug('[DOMPurify] Sanitizing attribute:', data.attrName, data.attrValue);
  });
};

// 初始化配置（在首次使用时调用）
let isDOMPurifyConfigured = false;
const ensureDOMPurifyConfigured = () => {
  if (!isDOMPurifyConfigured) {
    configureDOMPurify();
    isDOMPurifyConfigured = true;
  }
};

/**
 * EPUB 解析结果
 */
export interface EpubParseResult {
  metadata: EpubMetadata;
  chapters: EpubChapter[];
  coverUrl?: string;
}

/**
 * EPUB 章节
 */
export interface EpubChapter {
  id: string;
  title: string;
  content: string; // 净化后的 HTML 内容
  index: number;
}

/**
 * 解析 EPUB 文件，提取所有章节内容
 * @param file EPUB 文件（File 对象、ArrayBuffer 或 Uint8Array）
 * @returns 解析结果，包含元数据和章节
 */
export async function parseEpubFile(file: File | ArrayBuffer | Uint8Array): Promise<EpubParseResult> {
  console.debug('[EpubParser] Starting EPUB parsing');
  
  let epub: EpubFile | null = null;
  try {
    // 确保 DOMPurify 已配置
    ensureDOMPurifyConfigured();
    
    // 初始化 EPUB 文件 - @lingo-reader/epub-parser 期望 Blob/File 对象
    let input: any;
    if (file instanceof File) {
      // 直接传递 File 对象（File 继承自 Blob）
      input = file;
    } else if (file instanceof ArrayBuffer) {
      // 将 ArrayBuffer 转换为 Blob
      input = new Blob([file], { type: 'application/epub+zip' });
    } else if (file instanceof Uint8Array) {
      // 将 Uint8Array 转换为 Blob
      input = new Blob([file], { type: 'application/epub+zip' });
    } else {
      // 假设已经是 Blob 或 File
      input = file;
    }
    
    epub = await initEpubFile(input);
    
    // 等待 EPUB 加载完成
    await epub.loadEpub();
    await epub.parse();
    
    // 获取元数据
    const metadata = epub.getMetadata();
    console.debug('[EpubParser] EPUB metadata:', metadata);
    
    // 获取目录（TOC）
    const toc = epub.getToc();
    console.debug(`[EpubParser] TOC items: ${toc.length}`);
    
    // 获取脊柱（spine） - 实际阅读顺序
    const spine = epub.getSpine();
    console.debug(`[EpubParser] Spine items: ${spine.length}`);
    
    // 获取封面图片
    let coverUrl: string | undefined;
    try {
      coverUrl = epub.getCoverImage();
    } catch (coverError) {
      console.warn('[EpubParser] Could not get cover image:', coverError);
    }
    
    // 提取章节内容 - 使用智能章节检测
    const chapters: EpubChapter[] = [];
    let chapterIndex = 0;
    
    // 优先使用目录中的章节，但确保按脊柱顺序
    for (let i = 0; i < spine.length; i++) {
      const spineItem = spine[i];
      try {
        console.debug(`[EpubParser] Loading spine item ${i}: ${spineItem.id}`);
        
        // 加载章节内容
        const chapterContent = await epub.loadChapter(spineItem.id);
        
        // 净化 HTML 内容
        const sanitizedHtml = DOMPurify.sanitize(chapterContent.html, {
          ALLOWED_TAGS: [
            'p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'blockquote', 'code', 'pre', 'br', 'hr', 'strong', 'em',
            'b', 'i', 'u', 'sub', 'sup', 'ul', 'ol', 'li', 'a',
            'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
          ],
          ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'style'],
          ALLOW_DATA_ATTR: false,
          USE_PROFILES: { html: true }
        });
        
        // 使用智能章节检测：基于标题标签划分有意义的章节
        const detectedChapters = detectChaptersFromHtml(sanitizedHtml, i);
        
        // 为每个检测到的章节创建记录
        for (let j = 0; j < detectedChapters.length; j++) {
          const detectedChapter = detectedChapters[j];
          
          // 查找对应的目录项（如果有） - 尝试匹配标题
          let chapterTitle = detectedChapter.title;
          const tocItem = toc.find(item => {
            // 尝试不同的属性名来获取标题
            const tocTitle = (item as any).title || (item as any).label || (item as any).text;
            return tocTitle && chapterTitle.includes(tocTitle) || tocTitle?.includes(chapterTitle);
          });
          
          if (tocItem) {
            // 使用目录项标题（可能更准确）
            const tocTitle = (tocItem as any).title || (tocItem as any).label || (tocItem as any).text;
            if (tocTitle) {
              chapterTitle = tocTitle;
            }
          }
          
          // 如果这是spine中的第一个检测到的章节，并且有目录项匹配，使用目录标题
          if (j === 0 && tocItem) {
            const tocTitle = (tocItem as any).title || (tocItem as any).label || (tocItem as any).text;
            if (tocTitle) {
              chapterTitle = tocTitle;
            }
          }
          
          chapters.push({
            id: `${spineItem.id}_${j}`,
            title: chapterTitle,
            content: detectedChapter.content,
            index: chapterIndex,
          });
          
          chapterIndex++;
        }
        
      } catch (chapterError) {
        console.error(`[EpubParser] Failed to load spine item ${spineItem.id}:`, chapterError);
        // 添加空章节占位符
        chapters.push({
          id: spineItem.id,
          title: `Chapter ${i + 1}`,
          content: '<p>Failed to load chapter content</p>',
          index: chapterIndex,
        });
        chapterIndex++;
      }
    }
    
    console.debug(`[EpubParser] Successfully parsed ${chapters.length} chapters`);
    
    return {
      metadata,
      chapters,
      coverUrl,
    };
    
  } catch (error) {
    console.error('[EpubParser] Failed to parse EPUB:', error);
    throw new Error(`Failed to parse EPUB: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    // 清理资源
    if (epub) {
      try {
        await epub.destroy();
      } catch (destroyError) {
        console.warn('[EpubParser] Failed to destroy EPUB instance:', destroyError);
      }
    }
  }
}

/**
 * 从净化后的 HTML 中提取纯文本（用于搜索、摘要等）
 * @param sanitizedHtml 净化后的 HTML 内容
 * @returns 纯文本
 */
export function extractPlainText(sanitizedHtml: string): string {
  // 创建临时元素来提取文本
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = sanitizedHtml;
  
  // 移除脚本、样式等不需要的元素
  const scripts = tempDiv.querySelectorAll('script, style, noscript');
  scripts.forEach(script => script.remove());
  
  // 获取纯文本
  let text = tempDiv.textContent || tempDiv.innerText || '';
  
  // 清理多余的空白字符
  text = text
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .trim();
    
  return text;
}

/**
 * 从 HTML 内容中检测章节结构
 * 基于标题标签 (h1-h6) 划分有意义的章节
 * @param html 净化后的 HTML 内容
 * @param spineIndex 脊柱索引（用于默认章节标题）
 * @returns 检测到的章节数组
 */
export function detectChaptersFromHtml(html: string, spineIndex: number): { title: string; content: string }[] {
  console.debug(`[EpubParser] Detecting chapters from HTML (spine ${spineIndex})`);
  
  // 创建临时元素
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // 获取所有直接子元素（保持结构）
  const childElements = Array.from(tempDiv.children);
  
  // 如果没有子元素，返回整个内容作为一个章节
  if (childElements.length === 0) {
    return [{
      title: `Chapter ${spineIndex + 1}`,
      content: html
    }];
  }
  
  const chapters: { title: string; content: string }[] = [];
  let currentChapter: { title: string; contentParts: string[] } | null = null;
  
  // 遍历所有元素，根据标题划分章节
  for (const element of childElements) {
    const isHeading = isHeadingElement(element);
    
    if (isHeading) {
      // 保存当前章节（如果有）
      if (currentChapter) {
        chapters.push({
          title: currentChapter.title,
          content: currentChapter.contentParts.join('')
        });
      }
      
      // 开始新章节
      const title = element.textContent?.trim() || `Section ${chapters.length + 1}`;
      currentChapter = {
        title,
        contentParts: [element.outerHTML]
      };
    } else {
      // 如果没有当前章节（即第一个元素不是标题），创建一个默认章节
      if (!currentChapter) {
        currentChapter = {
          title: `Chapter ${spineIndex + 1}`,
          contentParts: []
        };
      }
      
      // 将元素内容添加到当前章节
      currentChapter.contentParts.push(element.outerHTML);
    }
  }
  
  // 保存最后一个章节
  if (currentChapter) {
    chapters.push({
      title: currentChapter.title,
      content: currentChapter.contentParts.join('')
    });
  }
  
  console.debug(`[EpubParser] Split into ${chapters.length} chapters based on headings`);
  
  // 过滤掉空章节和无效章节
  const filteredChapters = chapters.filter(chapter => {
    // 检查标题是否有效
    const hasValidTitle = chapter.title.trim().length > 0 && 
                         !chapter.title.toLowerCase().includes('blank') &&
                         !chapter.title.toLowerCase().includes('empty');
    
    // 检查内容是否有实质文本
    const plainText = extractPlainText(chapter.content);
    const hasMeaningfulContent = plainText.trim().length > 20; // 至少20个字符
    
    return hasValidTitle && hasMeaningfulContent;
  });
  
  console.debug(`[EpubParser] After filtering: ${filteredChapters.length} meaningful chapters`);
  
  // 如果过滤后没有章节，至少保留一个
  if (filteredChapters.length === 0 && chapters.length > 0) {
    // 使用第一个章节，但尝试改进标题
    const firstChapter = chapters[0];
    const firstHeading = tempDiv.querySelector('h1, h2, h3');
    if (firstHeading) {
      const betterTitle = firstHeading.textContent?.trim();
      if (betterTitle && betterTitle.length > 0) {
        firstChapter.title = betterTitle;
      }
    }
    return [firstChapter];
  }
  
  // 如果只有一个章节且标题是默认的，尝试查找更好的标题
  if (filteredChapters.length === 1 && filteredChapters[0].title.startsWith('Chapter ')) {
    // 尝试在内容中查找标题
    const firstHeading = tempDiv.querySelector('h1, h2, h3');
    if (firstHeading) {
      const betterTitle = firstHeading.textContent?.trim();
      if (betterTitle && betterTitle.length > 0) {
        filteredChapters[0].title = betterTitle;
        console.debug(`[EpubParser] Found better title: ${betterTitle}`);
      }
    }
  }
  
  return filteredChapters;
}

/**
 * 检查元素是否是标题元素
 */
function isHeadingElement(element: Element): boolean {
  return ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName);
}

/**
 * 将章节内容分页（按词数分页）
 * @param chapterContent 章节内容（HTML）
 * @param wordsPerPage 每页词数（默认 1000）
 * @returns 分页后的页面数组
 */
export function paginateChapter(chapterContent: string, wordsPerPage: number = 1000): string[] {
  console.debug(`[EpubParser] Paginating chapter content (target: ${wordsPerPage} words per page)`);
  
  // 提取纯文本以计算词数
  const plainText = extractPlainText(chapterContent);
  const words = plainText.split(/\s+/).filter(word => word.length > 0);
  
  console.debug(`[EpubParser] Chapter has ${words.length} words total`);
  
  if (words.length <= wordsPerPage) {
    return [chapterContent];
  }
  
  // 解析 HTML 结构以便智能分页
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = chapterContent;
  
  const pages: string[] = [];
  let currentPageContent = '';
  let currentWordCount = 0;
  let currentElements: Element[] = [];
  
  // 遍历所有子元素
  const allElements = Array.from(tempDiv.children);
  
  for (const element of allElements) {
    // 计算此元素的词数
    const elementText = extractPlainText(element.outerHTML);
    const elementWordCount = elementText.split(/\s+/).filter(word => word.length > 0).length;
    
    // 如果添加此元素会超过页面限制，并且当前页面已有内容，则结束当前页面
    if (currentWordCount + elementWordCount > wordsPerPage && currentWordCount > 0) {
      // 创建当前页面
      const pageHtml = currentElements.map(el => el.outerHTML).join('');
      pages.push(pageHtml);
      
      // 重置计数器
      currentPageContent = '';
      currentWordCount = 0;
      currentElements = [];
    }
    
    // 添加元素到当前页面
    currentElements.push(element);
    currentWordCount += elementWordCount;
  }
  
  // 添加最后一页
  if (currentElements.length > 0) {
    const pageHtml = currentElements.map(el => el.outerHTML).join('');
    pages.push(pageHtml);
  }
  
  console.debug(`[EpubParser] Split into ${pages.length} pages`);
  return pages;
}