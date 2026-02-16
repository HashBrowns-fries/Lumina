declare module 'kookit' {
  export interface RenditionOptions {
    format: string;
    readerMode: string;
    charset: string;
    animation: string;
    convertChinese: string;
    parserRegex: string;
    isDarkMode: string;
    isMobile: string;
    password: string;
    isScannedPDF: string;
  }

  export interface BookMetadata {
    key: string;
    name: string;
    format: string;
    size: number;
    path: string;
    // Add other properties as needed
  }

  export class BookHelper {
    static getRendition(
      fileContent: ArrayBuffer | string,
      options: RenditionOptions,
      kookit: any
    ): any;

    static generateBook(
      name: string,
      format: string,
      md5: string,
      size: number,
      path: string,
      fileContent: ArrayBuffer | string,
      rendition: any
    ): Promise<BookMetadata>;

    static preCache?(fileContent: ArrayBuffer | string): Promise<ArrayBuffer | string>;
  }

  export class ConfigService {
    static getReaderConfig(key: string): string;
    static setItem(key: string, value: string): void;
    static getItem(key: string): string;
    // Add other methods as needed
  }

  export class CommonTool {
    // Add methods as needed
  }

  export class TokenService {
    // Add methods as needed
  }

  export const KookitConfig: any;
}