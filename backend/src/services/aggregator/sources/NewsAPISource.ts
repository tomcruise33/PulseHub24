import NewsAPI from 'newsapi';
import { BaseSource, NewsArticle, SourceType } from './BaseSource';
import { extractLocationFromText } from '../../newsProcessor';

export class NewsAPISource extends BaseSource {
  private client: NewsAPI;
  private languages: string[];

  constructor(
    apiKey: string,
    languages: string[] = ['en'],
    updateInterval: number = 5 * 60 * 1000 // 5 minutes default
  ) {
    super(
      'NewsAPI',
      SourceType.BIG_MEDIA,
      0.8, // 80% credibility score for major news outlets
      updateInterval
    );

    this.client = new NewsAPI(apiKey);
    this.languages = languages;
  }

  async fetchArticles(): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];

    try {
      for (const language of this.languages) {
        const response = await this.client.v2.topHeadlines({
          language,
          pageSize: 100
        });

        if (response.articles) {
          const processedArticles = await this.processArticles(response.articles);
          articles.push(...processedArticles);
        }
      }
    } catch (error) {
      console.error('Error fetching articles from NewsAPI:', error);
      this.emit('error', error);
    }

    return articles;
  }

  private async processArticles(newsApiArticles: any[]): Promise<NewsArticle[]> {
    const processedArticles: NewsArticle[] = [];

    for (const article of newsApiArticles) {
      try {
        // Extract location from title and description
        const location = await extractLocationFromText(
          `${article.title || ''} ${article.description || ''}`
        );

        const processedArticle: NewsArticle = {
          title: article.title || 'Untitled',
          description: article.description || '',
          content: article.content || article.description || '',
          url: article.url,
          source: article.source?.name || 'NewsAPI',
          sourceType: this.type,
          publishedAt: new Date(article.publishedAt),
          language: article.language || 'en',
          location: location ? {
            name: location.location,
            coordinates: location.coordinates
          } : undefined,
          credibilityScore: this.calculateArticleCredibility(article)
        };

        processedArticles.push(processedArticle);
      } catch (error) {
        console.error('Error processing article:', error);
      }
    }

    return processedArticles;
  }

  private calculateArticleCredibility(article: any): number {
    // Base credibility from source type
    let score = this.baseCredibilityScore;

    // Additional factors could be considered here:
    // - Source reputation
    // - Article completeness
    // - Content analysis
    // - Citation verification

    return Math.min(Math.max(score, 0), 1); // Ensure score is between 0 and 1
  }

  async startFetching(): Promise<void> {
    await this.start();
  }

  stopFetching(): void {
    this.stop();
  }
}
