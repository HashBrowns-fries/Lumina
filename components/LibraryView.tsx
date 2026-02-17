
// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { Text, Language, TextSourceType } from '../types';
import { Plus, Book, Calendar, Search, Trash2, Languages, FileText, Upload, Loader2, FileType } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import { parseEpubFile, extractPlainText } from '../services/epubParser';
import { saveLargeTextContent } from '../services/fileStorage';
import { db, StoredDocument, ReadingProgress } from '../services/storageService';
import { storeEpubDocument, storePdfDocument, storePlainTextDocument, getRecentDocuments, deleteDocument, getDocumentChapters } from '../services/documentStorage';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;

interface LibraryViewProps {
  texts: Text[];
  languages: Language[];
  onSelect: (id: string) => void;
  onAdd: (text: Text) => void;
  onDelete: (id: string) => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({ texts, languages, onSelect, onAdd, onDelete }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [newText, setNewText] = useState({ title: '', content: '', languageId: languages[0]?.id || '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 新存储系统的文档状态
  const [storedDocuments, setStoredDocuments] = useState<StoredDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  // 阅读进度映射表: docId -> progress (0-1)
  const [readingProgressMap, setReadingProgressMap] = useState<Record<string, number>>({});
  // 待处理的文件上传
  const [pendingFile, setPendingFile] = useState<{
    file: File;
    type: TextSourceType;
    content: string;
    parsedData?: any;
  } | null>(null);

  // 加载存储的文档和阅读进度
  const loadDocuments = async () => {
    try {
      setIsLoadingDocuments(true);
      const docs = await getRecentDocuments(100); // 加载最近100个文档
      setStoredDocuments(docs);
      
      // 加载所有阅读进度
      await loadReadingProgress(docs);
    } catch (error) {
      console.error('[LibraryView] Failed to load documents:', error);
    } finally {
      setIsLoadingDocuments(false);
    }
  };
  
  // 加载阅读进度
  const loadReadingProgress = async (docs: StoredDocument[]) => {
    try {
      const progressMap: Record<string, number> = {};
      
      for (const doc of docs) {
        const progress = await db.readingProgress.get(doc.id);
        if (progress) {
          // 计算总体进度百分比
          const totalChapters = doc.totalChapters || 1;
          const currentChapter = progress.chapterIndex || 0;
          
          // 解析位置信息
          let positionProgress = 0;
          try {
            const position = JSON.parse(progress.position);
            positionProgress = position.progress || 0;
          } catch {
            positionProgress = 0;
          }
          
          // 总体进度 = (已完成章节 / 总章节) + (当前章节的进度 / 总章节)
          const overallProgress = (currentChapter / totalChapters) + (positionProgress / totalChapters);
          progressMap[doc.id] = Math.min(overallProgress, 1); // 最大100%
        } else {
          progressMap[doc.id] = 0;
        }
      }
      
      setReadingProgressMap(progressMap);
      console.debug('[LibraryView] Loaded reading progress:', progressMap);
    } catch (error) {
      console.error('[LibraryView] Failed to load reading progress:', error);
    }
  };

  // 组件挂载时加载文档
  useEffect(() => {
    loadDocuments();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.title || !newText.content) return;
    
    const id = `${Date.now()}`;
    const languageId = newText.languageId;
    
    // 如果有待处理文件，使用文件存储逻辑
    if (pendingFile) {
      const { file, type, content, parsedData } = pendingFile;
      
      // 同时保持向后兼容（现有系统）
      await saveLargeTextContent(id, content);
      
      // 使用新存储系统
      try {
        if (type === 'pdf') {
          // 对于PDF，我们需要重新提取页面文本用于存储
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          const pages: { pageIndex: number; text: string }[] = [];
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            pages.push({ pageIndex: i - 1, text: pageText });
          }
          
          await storePdfDocument(file, pdf, pages, id);
        } else if (type === 'epub') {
          // 使用新解析器存储章节
          await storeEpubDocument(file, id, languageId);
          // 同时存储纯文本版本用于向后兼容
          await storePlainTextDocument(
            file,
            newText.title,
            content,
            languageId,
            id
          );
        } else {
          // 纯文本
          await storePlainTextDocument(
            file,
            newText.title,
            content,
            languageId,
            id
          );
        }
      } catch (storageError) {
        console.error('[LibraryView] Failed to store document in new system:', storageError);
        // 继续使用旧系统
      }
      
      onAdd({
        id,
        title: newText.title,
        content: '', 
        languageId,
        createdAt: Date.now(),
        sourceType: type,
        progress: 0
      });
      
    } else {
      // 纯文本粘贴
      // 同时保持向后兼容（现有系统）
      await saveLargeTextContent(id, newText.content);
      
      // 使用新存储系统
      try {
        await storePlainTextDocument(
          new File([newText.content], `${newText.title}.txt`, { type: 'text/plain' }),
          newText.title,
          newText.content,
          languageId,
          id
        );
      } catch (error) {
        console.error('[LibraryView] Failed to store document in new system:', error);
        // 继续执行，使用旧系统作为后备
      }

      onAdd({
        id,
        title: newText.title,
        content: '', // Content is now stored in IndexedDB, metadata here
        languageId,
        createdAt: Date.now(),
        sourceType: 'plain',
        progress: 0
      });
    }
    
    // 重新加载文档列表
    await loadDocuments();
    
    setShowAdd(false);
    setNewText({ title: '', content: '', languageId: languages[0]?.id || '' });
    setPendingFile(null);
  };

    // Helper function to fix common XML/XHTML parsing issues
    const fixXMLIssues = (xmlString: string): string => {
      // Fix missing attribute values (e.g., crossorigin without value)
      let fixed = xmlString.replace(/\bcrossorigin\b(?=\s*[=>])/gi, 'crossorigin="anonymous"');
      
      // Fix other common issues
      // Remove XML declaration if it causes issues (some parsers don't like it in HTML context)
      fixed = fixed.replace(/<\?xml[^>]*\?>\s*/i, '');
      
      // Ensure proper namespace for XHTML
      if (!fixed.includes('xmlns=') && fixed.includes('html')) {
        // Add XHTML namespace if missing
        fixed = fixed.replace(/<html([^>]*)>/i, '<html$1 xmlns="http://www.w3.org/1999/xhtml">');
      }
      
      // Fix self-closing tags that shouldn't be self-closed in HTML
      const htmlTags = ['script', 'style', 'div', 'span', 'p', 'a', 'img', 'br', 'hr', 'meta', 'link'];
      htmlTags.forEach(tag => {
        const regex = new RegExp(`<${tag}\\b([^>]*)/>`, 'gi');
        fixed = fixed.replace(regex, `<${tag}$1></${tag}>`);
      });
      
      return fixed;
    };

    // Helper function to extract text from XML/XHTML documents with namespaces
    const extractTextFromXMLDocument = (doc: Document): string => {
      let text = '';
      
      // Method 1: Use textContent on documentElement (works for most XHTML)
      if (doc.documentElement && doc.documentElement.textContent) {
        text = doc.documentElement.textContent;
        if (text.trim()) return text.trim();
      }
      
      // Method 2: Recursive traversal to get all text nodes, ignoring script/style tags
      const getTextFromNode = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
          return node.textContent?.trim() || '';
        }
        
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          const tagName = element.tagName.toLowerCase();
          // Skip script, style, meta, link elements
          if (['script', 'style', 'meta', 'link', 'svg', 'math'].includes(tagName)) {
            return '';
          }
          
          let childText = '';
          for (let i = 0; i < element.childNodes.length; i++) {
            childText += getTextFromNode(element.childNodes[i]) + ' ';
          }
          return childText;
        }
        
        return '';
      };
      
      if (doc.documentElement) {
        text = getTextFromNode(doc.documentElement);
        if (text.trim()) return text.trim();
      }
      
      // Method 3: Use TreeWalker
      if (doc.documentElement) {
        const textNodes: string[] = [];
        const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_TEXT, null);
        let node;
        while (node = walker.nextNode()) {
          if (node.textContent && node.textContent.trim()) {
            textNodes.push(node.textContent.trim());
          }
        }
        text = textNodes.join(' ');
        if (text.trim()) return text.trim();
      }
      
      return '';
    };

    // Helper function to extract text from any DOM node (Document, Element, etc.)
    const extractTextFromDOMNode = (node: any): string => {
      if (!node) return '';
      
      console.log(`[LibraryView] extractTextFromDOMNode called with type:`, typeof node, 'constructor:', node.constructor?.name, 'nodeType:', node.nodeType);
      
      // If it's a string, try to parse it as XML/HTML
      if (typeof node === 'string') {
        console.log(`[LibraryView] Parsing string content, length:`, node.length);
        
        // First, try to fix common XML issues
        const fixedXML = fixXMLIssues(node);
        if (fixedXML !== node) {
          console.log(`[LibraryView] XML fixes applied`);
        }
        
        // Try XML parsing with fixed content first
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(fixedXML, 'application/xml');
          // Check for parser errors
          const parserErrors = xmlDoc.getElementsByTagName('parsererror');
          if (parserErrors.length === 0) {
            const text = extractTextFromXMLDocument(xmlDoc);
            if (text.trim()) {
              console.log(`[LibraryView] XML parsing successful, extracted ${text.length} chars`);
              return text;
            }
          } else {
            console.log(`[LibraryView] XML parser errors found: ${parserErrors.length}`);
            // Try to extract text from parsererror or fall back to HTML parsing
          }
        } catch (xmlErr) {
          console.log(`[LibraryView] XML parsing failed:`, xmlErr);
        }
        
        // Try HTML parsing as fallback (more tolerant of errors)
        try {
          const parser = new DOMParser();
          const htmlDoc = parser.parseFromString(fixedXML, 'text/html');
          const text = extractTextFromXMLDocument(htmlDoc);
          if (text.trim()) {
            console.log(`[LibraryView] HTML parsing successful, extracted ${text.length} chars`);
            return text;
          }
        } catch (htmlErr) {
          console.log(`[LibraryView] HTML parsing failed:`, htmlErr);
        }
        
        // Try parsing the original string as HTML (without fixes)
        if (fixedXML !== node) {
          try {
            const parser = new DOMParser();
            const htmlDoc = parser.parseFromString(node, 'text/html');
            const text = extractTextFromXMLDocument(htmlDoc);
            if (text.trim()) {
              console.log(`[LibraryView] Original HTML parsing successful, extracted ${text.length} chars`);
              return text;
            }
          } catch (htmlErr2) {
            console.log(`[LibraryView] Original HTML parsing failed:`, htmlErr2);
          }
        }
        
        // Last resort: strip HTML tags and extract any text
        const strippedText = node.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (strippedText) {
          console.log(`[LibraryView] Stripped HTML tags, extracted ${strippedText.length} chars`);
          return strippedText;
        }
        
        // If all else fails, try the fixed XML with tag stripping
        if (fixedXML !== node) {
          const fixedStripped = fixedXML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          if (fixedStripped) {
            console.log(`[LibraryView] Fixed XML stripped, extracted ${fixedStripped.length} chars`);
            return fixedStripped;
          }
        }
        
        return '';
      }
      
      // If it's a Document object
      if (node.documentElement && typeof node.documentElement.nodeType !== 'undefined') {
        return extractTextFromXMLDocument(node);
      }
      
      // If it's an Element (like <html> element)
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Use textContent directly
        const text = node.textContent || '';
        if (text.trim()) return text.trim();
        
        // Fallback: recursive extraction
        const getTextFromElement = (element: Element): string => {
          let result = '';
          for (let i = 0; i < element.childNodes.length; i++) {
            const child = element.childNodes[i];
            if (child.nodeType === Node.TEXT_NODE) {
              result += (child.textContent || '').trim() + ' ';
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              const childElement = child as Element;
              const tagName = childElement.tagName.toLowerCase();
              // Skip script, style, meta, link elements
              if (!['script', 'style', 'meta', 'link', 'svg', 'math'].includes(tagName)) {
                result += getTextFromElement(childElement) + ' ';
              }
            }
          }
          return result.trim();
        };
        
        const elementText = getTextFromElement(node as Element);
        if (elementText.trim()) return elementText;
        
        // Final fallback: innerHTML stripping
        const html = node.innerHTML || node.outerHTML || '';
        return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      }
      
      // If it's a NodeList or array
      if (Array.isArray(node) || (node.length && typeof node !== 'string')) {
        let text = '';
        for (let i = 0; i < node.length; i++) {
          text += extractTextFromDOMNode(node[i]) + ' ';
        }
        return text.trim();
      }
      
      // Default: try to get textContent or toString()
    return (node.textContent || node.toString?.() || '').toString().trim();
  };

  // Direct EPUB ZIP extraction - bypasses epubjs entirely
  const extractEPUBContentDirect = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    console.log("[LibraryView] Starting direct EPUB ZIP extraction");
    let fullText = '';
    
    try {
      // Basic ZIP parser for EPUB files
      const view = new DataView(arrayBuffer);
      let offset = arrayBuffer.byteLength - 22; // Start at end-of-central-directory
      
      // Find end of central directory signature
      let found = false;
      for (let i = offset; i >= 0; i--) {
        if (view.getUint32(i, true) === 0x06054b50) { // EOCD signature
          offset = i;
          found = true;
          break;
        }
      }
      
      if (!found) {
        console.error("[LibraryView] Could not find ZIP end of central directory");
        return '';
      }
      
      // Read end of central directory
      const eocdOffset = offset + 4;
      const diskNumber = view.getUint16(eocdOffset, true);
      const diskStart = view.getUint16(eocdOffset + 2, true);
      const centralDirEntries = view.getUint16(eocdOffset + 8, true);
      const centralDirSize = view.getUint32(eocdOffset + 12, true);
      const centralDirOffset = view.getUint32(eocdOffset + 16, true);
      
      console.log(`[LibraryView] ZIP structure: entries=${centralDirEntries}, dirOffset=${centralDirOffset}, dirSize=${centralDirSize}`);
      
      // Parse central directory to find files
      offset = centralDirOffset;
      const files: Array<{name: string, offset: number, compressedSize: number, uncompressedSize: number, compression: number}> = [];
      
      for (let i = 0; i < centralDirEntries; i++) {
        if (view.getUint32(offset, true) !== 0x02014b50) { // Central file header signature
          console.error(`[LibraryView] Invalid central file header at offset ${offset}`);
          break;
        }
        
        const versionMadeBy = view.getUint16(offset + 4, true);
        const versionNeeded = view.getUint16(offset + 6, true);
        const flags = view.getUint16(offset + 8, true);
        const compression = view.getUint16(offset + 10, true);
        const fileTime = view.getUint16(offset + 12, true);
        const fileDate = view.getUint16(offset + 14, true);
        const crc32 = view.getUint32(offset + 16, true);
        const compressedSize = view.getUint32(offset + 20, true);
        const uncompressedSize = view.getUint32(offset + 24, true);
        const fileNameLength = view.getUint16(offset + 28, true);
        const extraFieldLength = view.getUint16(offset + 30, true);
        const fileCommentLength = view.getUint16(offset + 32, true);
        const diskStartFile = view.getUint16(offset + 34, true);
        const internalAttrs = view.getUint16(offset + 36, true);
        const externalAttrs = view.getUint32(offset + 38, true);
        const localHeaderOffset = view.getUint32(offset + 42, true);
        
        const fileName = new TextDecoder().decode(
          new Uint8Array(arrayBuffer, offset + 46, fileNameLength)
        );
        
        // Only process text files
        if (fileName.match(/\.(xhtml|html|htm|xml|txt)$/i)) {
          files.push({
            name: fileName,
            offset: localHeaderOffset,
            compressedSize,
            uncompressedSize,
            compression
          });
          console.log(`[LibraryView] Found text file: ${fileName}, size=${uncompressedSize}, compressed=${compressedSize}, compression=${compression}`);
        }
        
        offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
      }
      
      // Extract and process text files
      for (const file of files) {
        try {
          // Read local file header
          const localHeaderSignature = view.getUint32(file.offset, true);
          if (localHeaderSignature !== 0x04034b50) {
            console.warn(`[LibraryView] Invalid local file header for ${file.name}`);
            continue;
          }
          
          const localFileNameLength = view.getUint16(file.offset + 26, true);
          const localExtraFieldLength = view.getUint16(file.offset + 28, true);
          const dataOffset = file.offset + 30 + localFileNameLength + localExtraFieldLength;
          
          // Get compressed data
          const compressedData = new Uint8Array(arrayBuffer, dataOffset, file.compressedSize);
          let textData: Uint8Array;
          
          if (file.compression === 0) { // No compression
            textData = compressedData;
          } else if (file.compression === 8) { // DEFLATE
            try {
              const ds = new DecompressionStream('deflate');
              const writer = ds.writable.getWriter();
              writer.write(compressedData);
              writer.close();
              
              const decompressed = await new Response(ds.readable).arrayBuffer();
              textData = new Uint8Array(decompressed);
            } catch (decompressErr) {
              console.warn(`[LibraryView] Failed to decompress ${file.name}:`, decompressErr);
              continue;
            }
          } else {
            console.warn(`[LibraryView] Unsupported compression method ${file.compression} for ${file.name}`);
            continue;
          }
          
          // Convert to text and extract content
          const text = new TextDecoder().decode(textData);
          
          // Extract text from XML/HTML
          let extractedText = '';
          
          // Try to parse as XML first
          try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'application/xml');
            if (xmlDoc.getElementsByTagName('parsererror').length === 0) {
              extractedText = extractTextFromXMLDocument(xmlDoc);
            } else {
              // Parser error, try as HTML
              const htmlDoc = parser.parseFromString(text, 'text/html');
              extractedText = extractTextFromXMLDocument(htmlDoc);
            }
          } catch (parseErr) {
            console.warn(`[LibraryView] Failed to parse ${file.name}:`, parseErr);
            // Fallback: strip HTML tags
            extractedText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          }
          
          if (extractedText.trim()) {
            fullText += extractedText.trim() + '\n\n';
            console.log(`[LibraryView] Direct extraction: ${file.name} -> ${extractedText.length} chars`);
          }
          
        } catch (fileErr) {
          console.warn(`[LibraryView] Error processing file ${file.name}:`, fileErr);
        }
      }
      
      console.log(`[LibraryView] Direct EPUB extraction complete: ${fullText.length} total chars`);
      
    } catch (zipErr) {
      console.error("[LibraryView] Direct EPUB ZIP extraction failed:", zipErr);
    }
    
    return fullText.trim();
  };

   // Alternative EPUB content extraction method
   const extractEPUBContentAlternative = async (book: any): Promise<string> => {
    console.log("[LibraryView] Using alternative EPUB extraction method");
    let fullText = '';
    
    try {
      // Method 2: Try using spine.spineItems property with render()
      if (book.spine && book.spine.spineItems) {
        const spineItems = book.spine.spineItems || [];
        console.log(`[LibraryView] Found ${spineItems.length} spine items via spine.spineItems`);
        
        for (const section of spineItems) {
          try {
            console.log(`[LibraryView] Alternative loading section:`, section.href);
            
            // Try render() method which may work better for XHTML content
            let renderedContent: any = null;
            try {
              renderedContent = await section.render();
              console.log(`[LibraryView] Alternative section rendered:`, renderedContent);
            } catch (renderErr) {
              console.log(`[LibraryView] render() failed, trying load():`, renderErr);
              renderedContent = await section.load();
              console.log(`[LibraryView] Alternative section loaded:`, renderedContent);
            }
            
              if (renderedContent) {
                // Extract text using the unified helper function
                const sectionText = extractTextFromDOMNode(renderedContent);
                console.log(`[LibraryView] Alternative extracted text length from ${section.href}:`, sectionText.length);
              
              if (sectionText.trim()) {
                fullText += sectionText.trim() + '\n\n';
                console.log(`[LibraryView] Alternative extracted ${sectionText.length} chars from ${section.href}`);
              } else {
                console.warn(`[LibraryView] Alternative: No text in ${section.href}, content type:`, typeof renderedContent);
              }
            }
            section.unload();
          } catch (sectionErr) {
            console.warn("[LibraryView] Alternative: Could not load spine section:", section.href, sectionErr);
          }
        }
      }
      
       // Method 3: Try direct archive access (low-level) - disabled due to API differences
       // Note: book.archive.find is not a function in epubjs 0.3.93
       /* if (!fullText.trim() && book.archive) {
         console.log("[LibraryView] Trying archive-based extraction");
         try {
           // Try to access archive differently - epubjs 0.3.93 might have different API
           // For now, skip archive extraction as it's not working
           console.log("[LibraryView] Archive access disabled due to API differences");
         } catch (archiveErr) {
           console.warn("[LibraryView] Archive extraction failed:", archiveErr);
         }
       } */
      
      // Method 4: Try to get content from navigation items
      if (!fullText.trim() && book.navigation) {
        console.log("[LibraryView] Trying navigation-based extraction");
        try {
          const toc = book.navigation.toc;
          if (toc && toc.length > 0) {
            for (const item of toc) {
              if (item.href) {
                try {
                  const section = book.spine.get(item.href);
                  if (section) {
                    const doc = await section.load();
                    if (doc && doc.documentElement) {
                      const sectionText = doc.documentElement.textContent || '';
                      if (sectionText.trim()) {
                        fullText += sectionText.trim() + '\n\n';
                      }
                    }
                    section.unload();
                  }
                } catch (itemErr) {
                  // Ignore individual item errors
                }
              }
            }
          }
        } catch (navErr) {
          console.warn("[LibraryView] Navigation extraction failed:", navErr);
        }
      }
      
      // Method 5: Try to access any available sections through iteration
      if (!fullText.trim()) {
        console.log("[LibraryView] Trying iterative extraction");
        try {
          // Try to iterate through whatever sections we can find
          for (let i = 0; i < 100; i++) { // Reasonable limit
            try {
              const section = (book.spine as any).get(i);
              if (!section) break;
              
              const doc = await section.load();
              if (doc && doc.documentElement) {
                const sectionText = doc.documentElement.textContent || '';
                if (sectionText.trim()) {
                  fullText += sectionText.trim() + '\n\n';
                }
              }
              section.unload();
            } catch (iterErr) {
              // Stop when we can't load more sections
              break;
            }
          }
        } catch (iterErr) {
          console.warn("[LibraryView] Iterative extraction failed:", iterErr);
        }
      }
      
    } catch (altErr) {
      console.error("[LibraryView] Alternative extraction failed:", altErr);
    }
    
    return fullText.trim();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    let content = '';
    let type: TextSourceType = 'plain';
    let parsedData: any = null;

    try {
      if (file.type === 'application/pdf') {
        type = 'pdf';
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
        }
        content = fullText;
        parsedData = { pdf, arrayBuffer };
      } else if (file.name.endsWith('.epub')) {
        type = 'epub';
        
        try {
          console.debug('[LibraryView] Parsing EPUB file with new parser');
          const result = await parseEpubFile(file);
          
          // 生成纯文本内容用于向后兼容
          const plainText = result.chapters.map(ch => extractPlainText(ch.content)).join('\n\n');
          content = plainText;
          parsedData = result;
          
          console.debug(`[LibraryView] EPUB parsed successfully: ${result.chapters.length} chapters extracted`);
          
        } catch (error) {
          console.error('[LibraryView] EPUB parsing failed:', error);
          
          let errorMsg = "Failed to parse EPUB file.\n\n";
          errorMsg += `File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)\n`;
          errorMsg += "Error: " + (error instanceof Error ? error.message : 'Unknown error') + "\n\n";
          errorMsg += "Possible reasons:\n";
          errorMsg += "1. The file may be encrypted or DRM-protected\n";
          errorMsg += "2. The file format may not be a standard EPUB\n";
          errorMsg += "3. The file may be corrupted\n\n";
          errorMsg += "Please try a different EPUB file or convert it to plain text/PDF.";
          
          alert(errorMsg);
          setIsProcessing(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
      }

      if (content && content.trim()) {
        // 设置待处理文件
        setPendingFile({
          file,
          type,
          content,
          parsedData
        });
        
        // 填充表单
        setNewText(prev => ({
          ...prev,
          title: file.name.replace(/\.[^/.]+$/, ""),
          content: content
        }));
        
        // 显示表单让用户选择语言
        setShowAdd(true);
        
        console.log(`[LibraryView] File processed successfully: ${content.length} characters extracted, waiting for user to confirm language`);
      } else if (type !== 'epub') {
        // Only show generic error for non-EPUB files (EPUB errors handled above)
        console.error("[LibraryView] No text content extracted from file:", {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        });
        
        alert("No text content could be extracted from this file. It may be encrypted, corrupted, or contain only non-text content.");
      }
    } catch (err) {
      console.error("[LibraryView] File processing error:", err);
      alert("Failed to process file. It might be encrypted or corrupted.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 lg:p-12">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Your Library</h1>
            <p className="text-slate-500 mt-1 font-medium">Continue reading or import a new book.</p>
          </div>
          <div className="flex gap-3">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".pdf,.epub" 
              onChange={handleFileUpload} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="bg-white text-slate-700 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 border border-slate-200 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
            >
              {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
              Upload Book
            </button>
            <button 
              onClick={() => setShowAdd(true)}
              className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
            >
              <Plus size={20} strokeWidth={3} />
              Paste Text
            </button>
          </div>
        </header>

        {showAdd && (
          <div className="mb-12 bg-white rounded-3xl border border-slate-200 p-8 shadow-xl shadow-slate-200/50 animate-in fade-in slide-in-from-top-4 duration-300">
             <h2 className="text-xl font-bold mb-6 text-slate-800">
               {pendingFile ? `New ${pendingFile.type.toUpperCase()}` : 'New Plain Text'}
             </h2>
            <form onSubmit={handleAddSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Title</label>
                  <input 
                    type="text" 
                    value={newText.title}
                    onChange={(e) => setNewText(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500" 
                    placeholder="E.g., Article Title"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Language</label>
                  <select 
                    value={newText.languageId}
                    onChange={(e) => setNewText(prev => ({ ...prev, languageId: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                  >
                    {languages.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Content</label>
                <textarea 
                  value={newText.content}
                  onChange={(e) => setNewText(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 min-h-[200px] focus:outline-none focus:border-indigo-500"
                  placeholder="Paste contents here..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-3 text-slate-500 font-bold hover:text-slate-700">Cancel</button>
                <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100">Save</button>
              </div>
            </form>
          </div>
        )}

        {texts.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Book size={32} className="text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Your library is empty</h3>
            <p className="text-slate-500 mt-2 max-w-sm mx-auto">Upload a PDF/EPUB or paste some text to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {texts.map(text => (
              <div 
                key={text.id} 
                onClick={() => onSelect(text.id)}
                className="group relative bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden flex flex-col h-full"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-2xl transition-colors ${
                    text.sourceType === 'pdf' ? 'bg-rose-50 text-rose-600' : 
                    text.sourceType === 'epub' ? 'bg-emerald-50 text-emerald-600' : 
                    'bg-indigo-50 text-indigo-600'
                  }`}>
                    {text.sourceType === 'pdf' ? <FileType size={20} /> : 
                     text.sourceType === 'epub' ? <Book size={20} /> : 
                     <FileText size={20} />}
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(text.id); }}
                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2">{text.title}</h3>
                
                <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-auto pb-4">
                  <span className="flex items-center gap-1"><Languages size={12} /> {languages.find(l => l.id === text.languageId)?.name}</span>
                  <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(text.createdAt).toLocaleDateString()}</span>
                </div>

                {/* Progress Bar - 使用真实阅读进度 */}
                {(() => {
                  const realProgress = readingProgressMap[text.id] ?? 0;
                  const isStarted = realProgress > 0;
                  return (
                    <>
                      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mt-2">
                        <div 
                          className={`h-full transition-all duration-500 ${isStarted ? 'bg-indigo-500' : 'bg-slate-300'}`}
                          style={{ width: `${realProgress * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1 text-[9px] font-bold uppercase">
                        <span className={isStarted ? 'text-indigo-500' : 'text-slate-400'}>
                          {isStarted ? 'Reading' : 'Not started'}
                        </span>
                        <span className={isStarted ? 'text-indigo-600' : 'text-slate-400'}>
                          {Math.round(realProgress * 100)}%
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
       </div>
     </div>
   );
};

export default LibraryView;
