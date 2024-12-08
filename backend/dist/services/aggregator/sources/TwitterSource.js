"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwitterSource = void 0;
const twitter_api_sdk_1 = require("twitter-api-sdk");
const BaseSource_1 = require("./BaseSource");
const newsProcessor_1 = require("../../newsProcessor");
class TwitterSource extends BaseSource_1.BaseSource {
    constructor(bearerToken, config, updateInterval = 2 * 60 * 1000 // 2 minutes default
    ) {
        super('Twitter', BaseSource_1.SourceType.SOCIAL_MEDIA, 0.6, // 60% credibility score for social media
        updateInterval);
        this.client = new twitter_api_sdk_1.Client(bearerToken);
        this.config = config;
    }
    async fetchArticles() {
        var _a;
        const articles = [];
        try {
            // Fetch tweets from search queries
            for (const query of this.config.searchQueries) {
                const tweets = await this.client.tweets.tweetsRecentSearch({
                    query: `${query} -is:retweet`,
                    max_results: 50,
                    'tweet.fields': ['created_at', 'author_id', 'geo', 'lang', 'entities', 'public_metrics'],
                    'user.fields': ['name', 'username', 'verified'],
                    'place.fields': ['full_name', 'geo']
                });
                if (tweets.data) {
                    const processedTweets = await this.processTweets(tweets.data);
                    articles.push(...processedTweets);
                }
            }
            // Fetch tweets from followed accounts
            if (this.config.followAccounts.length > 0) {
                for (const username of this.config.followAccounts) {
                    const user = await this.client.users.findUserByUsername(username);
                    if ((_a = user.data) === null || _a === void 0 ? void 0 : _a.id) {
                        const userTweets = await this.client.tweets.usersIdTweets(user.data.id, {
                            max_results: 50,
                            'tweet.fields': ['created_at', 'author_id', 'geo', 'lang', 'entities', 'public_metrics'],
                            'user.fields': ['name', 'username', 'verified'],
                            'place.fields': ['full_name', 'geo']
                        });
                        if (userTweets.data) {
                            const processedTweets = await this.processTweets(userTweets.data);
                            articles.push(...processedTweets);
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('Error fetching tweets:', error);
            this.emit('error', error);
        }
        return articles;
    }
    async processTweets(tweets) {
        var _a, _b, _c, _d, _e, _f, _g;
        const processedTweets = [];
        for (const tweet of tweets) {
            try {
                // Extract location from tweet text and entities
                const locationText = ((_b = (_a = tweet.entities) === null || _a === void 0 ? void 0 : _a.places) === null || _b === void 0 ? void 0 : _b.map(p => p.full_name).join(' ')) || '';
                const location = await (0, newsProcessor_1.extractLocationFromText)(tweet.text + ' ' + locationText);
                // Use geo coordinates if available, otherwise use extracted location
                const coordinates = ((_d = (_c = tweet.geo) === null || _c === void 0 ? void 0 : _c.coordinates) === null || _d === void 0 ? void 0 : _d.coordinates) ||
                    (location ? location.coordinates : undefined);
                const article = {
                    title: tweet.text.split('\n')[0], // Use first line as title
                    description: tweet.text,
                    content: tweet.text,
                    url: `https://twitter.com/twitter/status/${tweet.id}`,
                    source: 'Twitter',
                    sourceType: this.type,
                    publishedAt: new Date(tweet.created_at),
                    language: tweet.lang,
                    location: coordinates || location ? {
                        name: (location === null || location === void 0 ? void 0 : location.location) || 'Unknown',
                        coordinates: coordinates || (location === null || location === void 0 ? void 0 : location.coordinates)
                    } : undefined,
                    credibilityScore: this.calculateTweetCredibility(tweet),
                    metadata: {
                        authorId: tweet.author_id,
                        retweetCount: ((_e = tweet.public_metrics) === null || _e === void 0 ? void 0 : _e.retweet_count) || 0,
                        likeCount: ((_f = tweet.public_metrics) === null || _f === void 0 ? void 0 : _f.like_count) || 0,
                        replyCount: ((_g = tweet.public_metrics) === null || _g === void 0 ? void 0 : _g.reply_count) || 0
                    }
                };
                processedTweets.push(article);
            }
            catch (error) {
                console.error('Error processing tweet:', error);
            }
        }
        return processedTweets;
    }
    calculateTweetCredibility(tweet) {
        var _a, _b, _c, _d;
        // Base credibility from source type
        let score = this.baseCredibilityScore;
        // Increase score for verified authors
        if ((_a = tweet.author) === null || _a === void 0 ? void 0 : _a.verified) {
            score += 0.1;
        }
        // Increase score based on engagement
        const engagementScore = ((((_b = tweet.public_metrics) === null || _b === void 0 ? void 0 : _b.retweet_count) || 0) * 0.5 +
            (((_c = tweet.public_metrics) === null || _c === void 0 ? void 0 : _c.like_count) || 0) * 0.3 +
            (((_d = tweet.public_metrics) === null || _d === void 0 ? void 0 : _d.reply_count) || 0) * 0.2) / 1000;
        score += Math.min(engagementScore, 0.2);
        // Cap the score at 0.9 for social media
        return Math.min(Math.max(score, 0), 0.9);
    }
    async startStream() {
        var _a;
        try {
            // Create filtered stream rules
            const rules = [
                ...this.config.searchQueries.map(query => ({ value: query })),
                ...this.config.followAccounts.map(account => ({ value: `from:${account}` }))
            ];
            // Delete existing rules
            const currentRules = await this.client.tweets.getRules();
            if ((_a = currentRules.data) === null || _a === void 0 ? void 0 : _a.length) {
                await this.client.tweets.deleteRules({
                    ids: currentRules.data.map(rule => rule.id)
                });
            }
            // Add new rules
            await this.client.tweets.addRules({ add: rules });
            // Start filtered stream
            const stream = this.client.tweets.searchStream({
                'tweet.fields': ['created_at', 'author_id', 'geo', 'lang', 'entities', 'public_metrics'],
                'user.fields': ['name', 'username', 'verified'],
                'place.fields': ['full_name', 'geo']
            });
            for await (const tweet of stream) {
                const processedTweet = await this.processTweets([tweet.data]);
                if (processedTweet.length > 0) {
                    this.emit('articles', processedTweet);
                }
            }
        }
        catch (error) {
            console.error('Stream error:', error);
            this.emit('error', error);
            // Attempt to restart stream after delay
            setTimeout(() => this.startStream(), 30000);
        }
    }
    async stopStream() {
        // Cleanup for stream when implemented
    }
    async startFetching() {
        // Start regular polling
        await this.start();
        // Start real-time stream
        await this.startStream();
    }
    async stopFetching() {
        this.stop();
    }
}
exports.TwitterSource = TwitterSource;
