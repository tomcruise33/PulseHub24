const axios = require('axios');
const { OpenAI } = require('openai');
const db = require('../db');
const crypto = require('crypto');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_URL = 'https://newsapi.org/v2/top-headlines';

// Location coordinates mapping
const locationMap = {
  'syria': [38.9968, 34.8021],
  'damascus': [36.2912, 33.5138],
  'aleppo': [37.1613, 36.2021],
  'israel': [35.2137, 31.7683],
  'ukraine': [31.1656, 48.3794],
  'russia': [37.6173, 55.7558],
  'moscow': [37.6173, 55.7558],
  'kyiv': [30.5234, 50.4501],
  'washington': [-77.0369, 38.9072],
  'london': [-0.1276, 51.5074],
  'paris': [2.3522, 48.8566],
  'beijing': [116.4074, 39.9042],
  'tokyo': [139.6917, 35.6895],
  'gaza': [34.4667, 31.5017],
  'tel aviv': [34.7818, 32.0853]
};

async function extractLocationFromText(text) {
  for (const [location, coords] of Object.entries(locationMap)) {
    if (text.toLowerCase().includes(location)) {
      return { location, coordinates: coords };
    }
  }
  return null;
}

async function fetchLatestNews() {
  try {
    const response = await axios.get(NEWS_API_URL, {
      params: {
        apiKey: NEWS_API_KEY,
        language: 'en',
        pageSize: 100,
      },
    });

    return response.data.articles;
  } catch (error) {
    console.error('Error fetching news:', error);
    throw error;
  }
}

async function processArticle(article) {
  try {
    const { title, description, content, url, urlToImage, publishedAt, source, author } = article;
    
    // Try to extract location from title and description
    const locationFromTitle = await extractLocationFromText(title);
    const locationFromDesc = description ? await extractLocationFromText(description) : null;
    const location = locationFromTitle || locationFromDesc;

    // Basic sentiment analysis based on keywords
    const text = (title + ' ' + (description || '')).toLowerCase();
    const positiveWords = ['success', 'breakthrough', 'peace', 'agreement', 'positive', 'progress'];
    const negativeWords = ['crisis', 'conflict', 'war', 'death', 'disaster', 'tragedy'];
    
    let sentiment = 'neutral';
    const posCount = positiveWords.filter(word => text.includes(word)).length;
    const negCount = negativeWords.filter(word => text.includes(word)).length;
    
    if (posCount > negCount) sentiment = 'positive';
    if (negCount > posCount) sentiment = 'negative';

    // Extract keywords
    const keywords = new Set();
    const words = text.split(/\W+/).filter(word => word.length > 4);
    words.forEach(word => {
      if (!['about', 'after', 'again', 'their', 'there', 'these', 'those', 'where', 'which'].includes(word)) {
        keywords.add(word);
      }
    });

    // Determine category based on keywords
    const categoryKeywords = {
      politics: ['government', 'president', 'election', 'policy', 'minister'],
      technology: ['tech', 'innovation', 'digital', 'software', 'cyber'],
      business: ['market', 'economy', 'company', 'stock', 'trade'],
      sports: ['game', 'tournament', 'player', 'team', 'sport'],
      health: ['medical', 'health', 'disease', 'treatment', 'vaccine'],
      science: ['research', 'study', 'discovery', 'scientist', 'space']
    };

    let category = 'general';
    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        category = cat;
        break;
      }
    }

    // Create processed article
    const processedArticle = {
      id: crypto.randomUUID(),
      title,
      summary: content,
      content,
      url,
      image_url: urlToImage,
      published_at: publishedAt,
      source: source?.name || 'Unknown',
      author: author || 'Unknown',
      location_name: location ? location.location : null,
      coordinates: location ? location.coordinates : null,
      sentiment,
      keywords: Array.from(keywords).slice(0, 5),
      category,
      engagement_score: calculateEngagementScore(article)
    };

    console.log(`Processed article: ${title} | Location: ${location ? location.location : null} | Coordinates: ${location ? location.coordinates : null}`);
    return processedArticle;

  } catch (error) {
    console.error('Error processing article:', error);
    return null;
  }
}

async function updateNewsDatabase() {
  try {
    console.log('Fetching latest news...');
    const rawArticles = await fetchLatestNews();
    
    console.log(`Processing ${rawArticles.length} articles...`);
    const processedArticles = await Promise.all(
      rawArticles.map(article => processArticle(article))
    );
    
    // Filter out null articles (failed processing)
    const validArticles = processedArticles.filter(article => article !== null);
    
    console.log(`Successfully processed ${validArticles.length} articles`);
    
    // Store in database (implement your database logic here)
    // await db.storeArticles(validArticles);
    
    return validArticles;
  } catch (error) {
    console.error('Error updating news database:', error);
    throw error;
  }
}

// Update news every 5 minutes
setInterval(updateNewsDatabase, 5 * 60 * 1000);

function calculateEngagementScore(article) {
  // Simple engagement score based on article properties
  let score = 50; // Base score
  
  // Add points for having media
  if (article.urlToImage) score += 10;
  
  // Add points for longer content
  if (article.content && article.content.length > 500) score += 10;
  
  // Add points for having author
  if (article.author) score += 5;
  
  // Add points for recent publication
  const hoursSincePublished = (new Date() - new Date(article.publishedAt)) / (1000 * 60 * 60);
  if (hoursSincePublished < 24) score += 15;
  else if (hoursSincePublished < 48) score += 10;
  else if (hoursSincePublished < 72) score += 5;
  
  return Math.min(100, score); // Cap at 100
}

module.exports = {
  updateNewsDatabase,
  fetchLatestNews,
  processArticle
};
