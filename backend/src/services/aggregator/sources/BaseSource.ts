import { EventEmitter } from 'events';

export interface NewsArticle {
  id?: string;
  title: string;
  description?: string;
  content?: string;
  url: string;
  source: string;
  sourceType: SourceType;
  publishedAt: Date;
  language: string;
  location?: {
    name: string;
    coordinates?: [number, number];
  };
  credibilityScore: number;
  originalLanguage?: string;
  translatedFrom?: string;
}

export enum SourceType {
  GOVERNMENT = 'government',
  BIG_MEDIA = 'big_media',
  LOCAL_MEDIA = 'local_media',
  SOCIAL_MEDIA = 'social_media'
}

export abstract class BaseSource extends EventEmitter {
  protected name: string;
  protected type: SourceType;
  protected baseCredibilityScore: number;
  protected updateInterval: number; // in milliseconds
  protected isActive: boolean = false;

  constructor(
    name: string,
    type: SourceType,
    baseCredibilityScore: number,
    updateInterval: number
  ) {
    super();
    this.name = name;
    this.type = type;
    this.baseCredibilityScore = baseCredibilityScore;
    this.updateInterval = updateInterval;
  }

  abstract fetchArticles(): Promise<NewsArticle[]>;

  protected async start(): Promise<void> {
    if (this.isActive) return;
    this.isActive = true;
    
    const runUpdate = async () => {
      if (!this.isActive) return;
      
      try {
        const articles = await this.fetchArticles();
        this.emit('articles', articles);
      } catch (error) {
        this.emit('error', error);
      }

      if (this.isActive) {
        setTimeout(runUpdate, this.updateInterval);
      }
    };

    await runUpdate();
  }

  protected stop(): void {
    this.isActive = false;
  }

  getName(): string {
    return this.name;
  }

  getType(): SourceType {
    return this.type;
  }

  getCredibilityScore(): number {
    return this.baseCredibilityScore;
  }
}
