"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsAggregator = void 0;
const events_1 = require("events");
const NewsAPISource_1 = require("./sources/NewsAPISource");
const GovernmentRSSSource_1 = require("./sources/GovernmentRSSSource");
class NewsAggregator extends events_1.EventEmitter {
    constructor(maxArticles = 1000) {
        super();
        this.sources = new Map();
        this.articles = [];
        this.maxArticles = maxArticles;
    }
    initialize() {
        // Initialize NewsAPI source
        const newsApiSource = new NewsAPISource_1.NewsAPISource(process.env.NEWS_API_KEY || '');
        this.addSource(newsApiSource);
        // Initialize Government RSS source
        const governmentSource = new GovernmentRSSSource_1.GovernmentRSSSource();
        this.addSource(governmentSource);
        // Add event listeners for each source
        this.sources.forEach(source => {
            source.on('articles', (articles) => {
                this.processNewArticles(articles);
            });
            source.on('error', (error) => {
                console.error(`Error from ${source.getName()}: ${error}`);
                this.emit('error', { source: source.getName(), error });
            });
        });
    }
    addSource(source) {
        this.sources.set(source.getName(), source);
    }
    removeSource(sourceName) {
        const source = this.sources.get(sourceName);
        if (source) {
            source.removeAllListeners();
            this.sources.delete(sourceName);
        }
    }
    async startAggregation() {
        console.log('Starting news aggregation...');
        for (const source of this.sources.values()) {
            try {
                if (source instanceof NewsAPISource_1.NewsAPISource || source instanceof GovernmentRSSSource_1.GovernmentRSSSource) {
                    await source.startFetching();
                    console.log(`Started fetching from ${source.getName()}`);
                }
            }
            catch (error) {
                console.error(`Error starting ${source.getName()}: ${error}`);
            }
        }
    }
    stopAggregation() {
        console.log('Stopping news aggregation...');
        this.sources.forEach(source => {
            if (source instanceof NewsAPISource_1.NewsAPISource || source instanceof GovernmentRSSSource_1.GovernmentRSSSource) {
                source.stopFetching();
            }
        });
    }
    processNewArticles(newArticles) {
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
    getArticles() {
        return this.articles;
    }
    getArticlesBySource(sourceType) {
        return this.articles.filter(article => article.sourceType === sourceType);
    }
    getArticlesByCredibilityThreshold(threshold) {
        return this.articles.filter(article => article.credibilityScore >= threshold);
    }
    getSourceStatus() {
        return Array.from(this.sources.values()).map(source => ({
            name: source.getName(),
            type: source.getType(),
            active: true // TODO: Add actual status tracking
        }));
    }
}
exports.NewsAggregator = NewsAggregator;
