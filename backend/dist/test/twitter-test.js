"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const TwitterSource_1 = require("../services/aggregator/sources/TwitterSource");
const twitter_api_sdk_1 = require("twitter-api-sdk");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Ensure required environment variables are present
if (!process.env.TWITTER_BEARER_TOKEN) {
    throw new Error('TWITTER_BEARER_TOKEN is not set in environment variables');
}
// Get environment variables with type safety
const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const searchQueries = (process.env.TWITTER_SEARCH_QUERIES || 'world news,breaking news').split(',').map(q => q.trim());
const followAccounts = (process.env.TWITTER_FOLLOW_ACCOUNTS || 'BBCBreaking,CNNBreaking').split(',').map(a => a.trim());
const languages = (process.env.TWITTER_LANGUAGES || 'en').split(',').map(l => l.trim());
async function testTwitterIntegration() {
    try {
        // First, verify the Twitter API connection
        const client = new twitter_api_sdk_1.Client(BEARER_TOKEN);
        console.log('Twitter API client initialized successfully');
        // Initialize Twitter source with configuration
        const twitterSource = new TwitterSource_1.TwitterSource(BEARER_TOKEN, {
            searchQueries,
            followAccounts,
            languages
        }, 2 * 60 * 1000 // 2 minutes update interval
        );
        console.log('Fetching recent news from Twitter...');
        console.log('Using search queries:', searchQueries);
        console.log('Following accounts:', followAccounts);
        const articles = await twitterSource.fetchArticles();
        console.log(`\nFetched ${articles.length} articles from Twitter:\n`);
        articles.slice(0, 5).forEach((article, index) => {
            console.log(`${index + 1}. ${article.title}`);
            console.log(`   Source: ${article.source}`);
            console.log(`   Type: ${article.sourceType}`);
            console.log(`   Published: ${article.publishedAt}`);
            console.log(`   URL: ${article.url}`);
            if (article.location) {
                console.log(`   Location: ${article.location.name}`);
            }
            console.log('');
        });
    }
    catch (error) {
        console.error('Error testing Twitter integration:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
            console.error('Stack trace:', error.stack);
        }
    }
}
testTwitterIntegration();
