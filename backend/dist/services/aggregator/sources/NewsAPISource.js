"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsAPISource = void 0;
const newsapi_1 = __importDefault(require("newsapi"));
const BaseSource_1 = require("./BaseSource");
const newsProcessor_1 = require("../../newsProcessor");
class NewsAPISource extends BaseSource_1.BaseSource {
    constructor(apiKey, languages = ['en'], updateInterval = 5 * 60 * 1000 // 5 minutes default
    ) {
        super('NewsAPI', BaseSource_1.SourceType.BIG_MEDIA, 0.8, // 80% credibility score for major news outlets
        updateInterval);
        this.client = new newsapi_1.default(apiKey);
        this.languages = languages;
    }
    async fetchArticles() {
        const articles = [];
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
        }
        catch (error) {
            console.error('Error fetching articles from NewsAPI:', error);
            this.emit('error', error);
        }
        return articles;
    }
    async processArticles(newsApiArticles) {
        var _a;
        const processedArticles = [];
        for (const article of newsApiArticles) {
            try {
                // Extract location from title and description
                const location = await (0, newsProcessor_1.extractLocationFromText)(`${article.title || ''} ${article.description || ''}`);
                const processedArticle = {
                    title: article.title || 'Untitled',
                    description: article.description || '',
                    content: article.content || article.description || '',
                    url: article.url,
                    source: ((_a = article.source) === null || _a === void 0 ? void 0 : _a.name) || 'NewsAPI',
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
            }
            catch (error) {
                console.error('Error processing article:', error);
            }
        }
        return processedArticles;
    }
    calculateArticleCredibility(article) {
        // Base credibility from source type
        let score = this.baseCredibilityScore;
        // Additional factors could be considered here:
        // - Source reputation
        // - Article completeness
        // - Content analysis
        // - Citation verification
        return Math.min(Math.max(score, 0), 1); // Ensure score is between 0 and 1
    }
    async startFetching() {
        await this.start();
    }
    stopFetching() {
        this.stop();
    }
}
exports.NewsAPISource = NewsAPISource;
