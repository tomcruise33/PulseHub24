"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GovernmentRSSSource = void 0;
const rss_parser_1 = __importDefault(require("rss-parser"));
const BaseSource_1 = require("./BaseSource");
const newsProcessor_1 = require("../../newsProcessor");
class GovernmentRSSSource extends BaseSource_1.BaseSource {
    constructor(updateInterval = 10 * 60 * 1000) {
        super('Government RSS', BaseSource_1.SourceType.GOVERNMENT, 1.0, // 100% credibility score for government sources
        updateInterval);
        this.parser = new rss_parser_1.default();
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
    async fetchArticles() {
        const articles = [];
        for (const source of this.sources) {
            try {
                const feed = await this.parser.parseURL(source.url);
                const processedArticles = await Promise.all(feed.items.map(async (item) => {
                    const location = await (0, newsProcessor_1.extractLocationFromText)(item.title + ' ' + (item.contentSnippet || ''));
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
                }));
                articles.push(...processedArticles);
            }
            catch (error) {
                this.emit('error', `Error fetching from ${source.name}: ${error}`);
            }
        }
        return articles;
    }
    async startFetching() {
        await this.start();
    }
    stopFetching() {
        this.stop();
    }
    addSource(source) {
        this.sources.push(source);
    }
    removeSource(url) {
        this.sources = this.sources.filter(source => source.url !== url);
    }
}
exports.GovernmentRSSSource = GovernmentRSSSource;
