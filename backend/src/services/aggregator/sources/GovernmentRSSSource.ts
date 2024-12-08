import Parser from 'rss-parser';
import { BaseSource, NewsArticle, SourceType } from './BaseSource';
import { extractLocationFromText } from '../../newsProcessor';

interface GovernmentSource {
  name: string;
  url: string;
  language: string;
  country: string;
}

export class GovernmentRSSSource extends BaseSource {
  private parser: Parser;
  private sources: GovernmentSource[];

  constructor(updateInterval: number = 10 * 60 * 1000) { // 10 minutes default
    super(
      'Government RSS',
      SourceType.GOVERNMENT,
      1.0, // 100% credibility score for government sources
      updateInterval
    );

    this.parser = new Parser();
    this.sources = [
      {
        name: 'White House Briefings',
        url: 'https://www.whitehouse.gov/feed/',
        language: 'en',
        country: 'USA'
      },
      {
        name: 'UK Government News',
        url: 'https://www.gov.uk/government/all.atom',
        language: 'en',
        country: 'UK'
      },
      {
        name: 'European Commission',
        url: 'https://ec.europa.eu/commission/presscorner/api/rss',
        language: 'en',
        country: 'EU'
      },
      // Add more government RSS feeds here
    ];
  }

  async fetchArticles(): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];

    for (const source of this.sources) {
      try {
        const feed = await this.parser.parseURL(source.url);
        
        const processedArticles = await Promise.all(
          feed.items.map(async (item) => {
            const location = await extractLocationFromText(item.title + ' ' + (item.contentSnippet || ''));
            
            return {
              title: item.title || 'Untitled',
              description: item.contentSnippet,
              content: item.content,
              url: item.link || '',
              source: source.name,
              sourceType: this.type,
              publishedAt: new Date(item.pubDate || new Date()),
              language: source.language,
              location: location ? {
                name: location.location,
                coordinates: location.coordinates
              } : undefined,
              credibilityScore: this.baseCredibilityScore,
              originalLanguage: source.language
            };
          })
        );

        articles.push(...processedArticles);
      } catch (error) {
        this.emit('error', `Error fetching from ${source.name}: ${error}`);
      }
    }

    return articles;
  }

  async startFetching(): Promise<void> {
    await this.start();
  }

  stopFetching(): void {
    this.stop();
  }

  addSource(source: GovernmentSource): void {
    this.sources.push(source);
  }

  removeSource(url: string): void {
    this.sources = this.sources.filter(source => source.url !== url);
  }
}
