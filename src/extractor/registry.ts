import { BaseExtractor } from './base-extractor.js';
import { TypeScriptExtractor } from './code/typescript.js';

export class ExtractorRegistry {
  private extractors: Map<string, BaseExtractor> = new Map();
  private extToLang: Map<string, string> = new Map();

  constructor() {
    this.register(new TypeScriptExtractor());
  }

  register(extractor: BaseExtractor) {
    this.extractors.set(extractor.language, extractor);
    for (const ext of extractor.extensions) {
      this.extToLang.set(ext, extractor.language);
    }
  }

  supportsFile(filePath: string): boolean {
    const ext = this.getExtension(filePath);
    return this.extToLang.has(ext);
  }

  getExtractor(filePath: string): BaseExtractor | null {
    const ext = this.getExtension(filePath);
    const lang = this.extToLang.get(ext);
    if (!lang) return null;
    return this.extractors.get(lang) || null;
  }

  private getExtension(filePath: string): string {
    const match = filePath.match(/\.[0-9a-z]+$/i);
    return match ? match[0].toLowerCase() : '';
  }
}
