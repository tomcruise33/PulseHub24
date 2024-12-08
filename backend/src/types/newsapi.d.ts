declare module 'newsapi' {
  interface Article {
    source: {
      id: string | null;
      name: string;
    };
    author: string | null;
    title: string;
    description: string | null;
    url: string;
    urlToImage: string | null;
    publishedAt: string;
    content: string | null;
  }

  interface NewsAPIResponse {
    status: string;
    totalResults: number;
    articles: Article[];
  }

  interface NewsAPIOptions {
    q?: string;
    sources?: string;
    domains?: string;
    excludeDomains?: string;
    from?: string;
    to?: string;
    language?: string;
    sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
    pageSize?: number;
    page?: number;
  }

  class NewsAPI {
    constructor(apiKey: string);
    v2: {
      everything(options: NewsAPIOptions): Promise<NewsAPIResponse>;
      topHeadlines(options: NewsAPIOptions): Promise<NewsAPIResponse>;
    };
  }

  export = NewsAPI;
}
