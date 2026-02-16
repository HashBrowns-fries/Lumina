import type { EpubParseResult, EpubChapter } from './epubParser';
import type { EpubMetadata } from '@lingo-reader/epub-parser';

// We'll assume kookit libraries are loaded globally
// This should be done in index.html via script tags or dynamically imported

export class KookitEpubParser {
  private static async ensureKookitLoaded() {
    if (typeof window === 'undefined') return;

    // Check if kookit is available
    if (!(window as any).BookHelper) {
      throw new Error('Kookit library not loaded. Please load kookit.min.js and kookit-extra-browser.min.js');
    }
  }

  static async parseEpubFile(file: File | ArrayBuffer | Uint8Array): Promise<EpubParseResult> {
    await this.ensureKookitLoaded();

    const BookHelper = (window as any).BookHelper;
    const ConfigService = (window as any).ConfigService;
    const Kookit = (window as any).Kookit;

    // Convert input to ArrayBuffer
    let arrayBuffer: ArrayBuffer;
    if (file instanceof File) {
      arrayBuffer = await this.fileToArrayBuffer(file);
    } else if (file instanceof Uint8Array) {
      arrayBuffer = file.buffer;
    } else {
      arrayBuffer = file;
    }

    // Generate a simple hash for book ID
    const md5 = await this.generateSimpleHash(arrayBuffer);
    const fileName = file instanceof File ? file.name : 'book.epub';
    const fileSize = arrayBuffer.byteLength;

    try {
      // Get rendition from kookit
      const rendition = BookHelper.getRendition(
        arrayBuffer,
        {
          format: 'EPUB',
          readerMode: '',
          charset: '',
          animation: '',
          convertChinese: '',
          parserRegex: '',
          isDarkMode: 'no',
          isMobile: 'no',
          password: '',
          isScannedPDF: 'no',
        },
        Kookit
      );

      // Generate book metadata
      const bookMetadata = await BookHelper.generateBook(
        fileName,
        'epub',
        md5,
        fileSize,
        '',
        arrayBuffer,
        rendition
      );

      // Extract chapters from rendition
      const chapters = await this.extractChapters(rendition);

      // Get cover image
      let coverUrl: string | undefined;
      try {
        // Try to get cover from rendition or book metadata
        coverUrl = bookMetadata.cover || rendition.getCoverImage?.();
      } catch (error) {
        console.warn('Could not get cover image:', error);
      }

      // Convert to EpubParseResult format
      // Create metadata object that matches EpubMetadata type
      // Using type assertion to bypass strict type checking for now
      const metadata = {
        title: bookMetadata.name || fileName,
        // creator is an array in EpubMetadata
        creator: bookMetadata.author ? [{ contributor: bookMetadata.author }] : [],
        language: bookMetadata.language || 'en',
        publisher: bookMetadata.publisher || '',
        description: bookMetadata.description || '',
        identifier: bookMetadata.key || md5,
        date: bookMetadata.date || '',
        rights: bookMetadata.rights || '',
        packageIdentifier: bookMetadata.key || md5,
        // Add other required fields with default values
        contributor: [],
        subject: [],
        source: '',
        type: '',
        format: 'application/epub+zip',
        coverage: '',
        relation: '',
        modified: '',
        // Optional fields can be omitted or set to empty
      } as unknown as EpubMetadata;

      return {
        metadata,
        chapters: chapters.map((chapter, index) => ({
          id: chapter.id,
          title: chapter.title,
          content: chapter.content || '',
          index,
        })),
        coverUrl,
      };
    } catch (error) {
      console.error('Kookit EPUB parsing error:', error);
      throw new Error(`Failed to parse EPUB with kookit: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private static async extractChapters(rendition: any): Promise<Array<{ id: string; title: string; content?: string }>> {
    const chapters: Array<{ id: string; title: string; content?: string }> = [];
    
    try {
      // Try to get spine items from rendition
      const spine = rendition.spine || [];
      for (let i = 0; i < spine.length; i++) {
        const item = spine[i];
        chapters.push({
          id: item.id || `chapter-${i}`,
          title: item.title || `Chapter ${i + 1}`,
          // Content will be loaded on demand
        });
      }
    } catch (error) {
      console.warn('Could not extract chapters from rendition:', error);
      // Fallback
      chapters.push({
        id: 'chapter-1',
        title: 'Chapter 1',
      });
    }

    return chapters;
  }

  private static async fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  private static async generateSimpleHash(buffer: ArrayBuffer): Promise<string> {
    // Simple hash for demo - use proper MD5 in production
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
  }
}