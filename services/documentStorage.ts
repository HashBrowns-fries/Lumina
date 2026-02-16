import { db, StoredDocument, StoredChapter, ReadingProgress } from './storageService';
import * as pdfjs from 'pdfjs-dist';

import { parseEpubFile, EpubParseResult } from './epubParser';

/**
 * 保存 EPUB 文档
 */
export async function storeEpubDocument(
  file: File,
  docId?: string
): Promise<string> {
  const finalDocId = docId || `${file.name}_${Date.now()}`; // 使用提供的ID或生成新ID
  
  console.debug('[DocumentStorage] Parsing EPUB file:', file.name);
  const result = await parseEpubFile(file);
  const { metadata, chapters, coverUrl } = result;
  
  console.debug(`[DocumentStorage] EPUB parsed: ${chapters.length} chapters`);

  const author = metadata.creator?.[0]?.contributor || metadata.contributor?.[0]?.contributor;
  
  const document: StoredDocument = {
    id: finalDocId,
    title: metadata.title || file.name.replace(/\.epub$/i, ''),
    author,
    language: metadata.language,
    format: 'epub',
    coverUrl,
    totalChapters: chapters.length,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fileSize: file.size,
  };

  await db.transaction('rw', db.documents, db.chapters, async () => {
    await db.documents.add(document);

    const chapterEntries: StoredChapter[] = chapters.map((ch, idx) => ({
      id: `${finalDocId}:${idx}`,
      docId: finalDocId,
      index: idx,
      title: ch.title || `第 ${idx + 1} 章`,
      content: ch.content,
    }));
    await db.chapters.bulkAdd(chapterEntries);
  });

  return finalDocId;
}

/**
 * 保存 PDF 文档（按页存储内容）
 */
export async function storePdfDocument(
  file: File,
  pdf: pdfjs.PDFDocumentProxy,
  pages: { pageIndex: number; text: string }[],
  docId?: string
): Promise<string> {
  const finalDocId = docId || `${file.name}_${Date.now()}`;
  
  // 尝试获取PDF元数据
  let metadata = {};
  try {
    metadata = await pdf.getMetadata();
  } catch (e) {
    console.debug('Failed to get PDF metadata:', e);
  }

  const document: StoredDocument = {
    id: finalDocId,
    title: (metadata as any)?.title || file.name.replace(/\.pdf$/i, ''),
    author: (metadata as any)?.author,
    format: 'pdf',
    totalChapters: pdf.numPages,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fileSize: file.size,
  };

  await db.transaction('rw', db.documents, db.chapters, async () => {
    await db.documents.add(document);

    const chapterEntries: StoredChapter[] = pages.map((page) => ({
      id: `${finalDocId}:${page.pageIndex}`,
      docId: finalDocId,
      index: page.pageIndex,
      title: `第 ${page.pageIndex + 1} 页`,
      content: page.text,
    }));
    await db.chapters.bulkAdd(chapterEntries);
  });

  return finalDocId;
}

/**
 * 保存纯文本文档
 */
export async function storePlainTextDocument(
  file: File,
  title: string,
  content: string,
  language?: string,
  docId?: string
): Promise<string> {
  const finalDocId = docId || `${file ? file.name : title}_${Date.now()}`;
  
  const document: StoredDocument = {
    id: finalDocId,
    title,
    language,
    format: 'txt',
    totalChapters: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fileSize: file?.size || 0,
  };

  await db.transaction('rw', db.documents, db.chapters, async () => {
    await db.documents.add(document);

    const chapter: StoredChapter = {
      id: `${finalDocId}:0`,
      docId: finalDocId,
      index: 0,
      title,
      content,
    };
    await db.chapters.add(chapter);
  });

  return finalDocId;
}

/**
 * 读取章节内容
 */
export async function loadChapter(docId: string, chapterIndex: number): Promise<StoredChapter | null> {
  const chapter = await db.chapters
    .where('[docId+index]')
    .equals([docId, chapterIndex])
    .first();
  return chapter || null;
}

/**
 * 保存/更新阅读进度
 */
export async function saveReadingProgress(docId: string, chapterIndex: number, position: string) {
  await db.readingProgress.put({
    docId,
    chapterIndex,
    position,
    updatedAt: Date.now()
  });
  
  // 同时更新文档的 updatedAt
  await db.documents.update(docId, { updatedAt: Date.now() });
}

/**
 * 获取阅读进度
 */
export async function getReadingProgress(docId: string): Promise<ReadingProgress | null> {
  return await db.readingProgress.get(docId);
}

/**
 * 获取文档列表（最近阅读）
 */
export async function getRecentDocuments(limit = 10): Promise<StoredDocument[]> {
  return await db.documents
    .orderBy('updatedAt')
    .reverse()
    .limit(limit)
    .toArray();
}

/**
 * 获取文档详情
 */
export async function getDocument(docId: string): Promise<StoredDocument | null> {
  return await db.documents.get(docId);
}

/**
 * 删除文档（级联删除章节和进度）
 */
export async function deleteDocument(docId: string): Promise<void> {
  await db.transaction('rw', db.documents, db.chapters, db.readingProgress, async () => {
    await db.documents.delete(docId);
    await db.chapters.where('docId').equals(docId).delete();
    await db.readingProgress.delete(docId);
  });
}

/**
 * 获取文档的所有章节
 */
export async function getDocumentChapters(docId: string): Promise<StoredChapter[]> {
  return await db.chapters
    .where('docId')
    .equals(docId)
    .sortBy('index');
}

/**
 * 更新文档元数据
 */
export async function updateDocument(docId: string, updates: Partial<StoredDocument>): Promise<void> {
  await db.documents.update(docId, { ...updates, updatedAt: Date.now() });
}