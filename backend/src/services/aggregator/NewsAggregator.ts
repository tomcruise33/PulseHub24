import { EventEmitter } from 'events';
import { BaseSource, NewsArticle, SourceType } from './sources/BaseSource';
import { NewsAPISource } from './sources/NewsAPISource';
import { GovernmentRSSSource } from './sources/GovernmentRSSSource';

export class NewsAggregator extends EventEmitter {
  private sources: Map<string, BaseSource>;
  private articles: NewsArticle[];
  private maxArticles: number;

  constructor(maxArticles: number = 1000) {
    super();
    this.sources = new Map();
    this.articles = [];
    this.maxArticles = maxArticles;
  }

  initialize(): void {
    // Initialize NewsAPI source
    const newsApiSource = new NewsAPISource(process.env.NEWS_API_KEY || '');
    this.addSource(newsApiSource);

    // Initialize Government RSS source
    const governmentSource = new GovernmentRSSSource();
    this.addSource(governmentSource);

    // Add event listeners for each source
    this.sources.forEach(source => {
      source.on('articles', (articles: NewsArticle[]) => {
        this.processNewArticles(articles);
      });

      source.on('error', (error: Error) => {
        console.error(`Error from ${source.getName()}: ${error}`);
        this.emit('error', { source: source.getName(), error });
      });
    });
  }

  addSource(source: BaseSource): void {
    this.sources.set(source.getName(), source);
  }

  removeSource(sourceName: string): void {
    const source = this.sources.get(sourceName);
    if (source) {
      source.removeAllListeners();
      this.sources.delete(sourceName);
    }
  }

  async startAggregation(): Promise<void> {
    console.log('Starting news aggregation...');
    
    for (const source of this.sources.values()) {
      try {
        if (source instanceof NewsAPISource || source instanceof GovernmentRSSSource) {
          await source.startFetching();
          console.log(`Started fetching from ${source.getName()}`);
        }
      } catch (error) {
        console.error(`Error starting ${source.getName()}: ${error}`);
      }
    }
  }

  stopAggregation(): void {
    console.log('Stopping news aggregation...');
    
    this.sources.forEach(source => {
      if (source instanceof NewsAPISource || source instanceof GovernmentRSSSource) {
        source.stopFetching();
      }
    });
  }

  private processNewArticles(newArticles: NewsArticle[]): void {
    // Add new articles
    this.articles.push(...newArticles);

    // Sort by date (newest first)
    this.articles.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    // Keep only the most recent articles up to maxArticles
    if (this.articles.length > this.maxArticles) {
      this.articles = this.articles.slice(0, this.maxArticles);
    }

    // Emit the new articles
    this.emit('update', newArticles);
  }

  getArticles(): NewsArticle[] {
    return this.articles;
  }

  getArticlesBySource(sourceType: SourceType): NewsArticle[] {
    return this.articles.filter(article => article.sourceType === sourceType);
  }

  getArticlesByCredibilityThreshold(threshold: number): NewsArticle[] {
    return this.articles.filter(article => article.credibilityScore >= threshold);
  }

  getSourceStatus(): Array<{name: string; type: SourceType; active: boolean}> {
    return Array.from(this.sources.values()).map(source => ({
      name: source.getName(),
      type: source.getType(),
      active: true // TODO: Add actual status tracking
    }));
  }
}
