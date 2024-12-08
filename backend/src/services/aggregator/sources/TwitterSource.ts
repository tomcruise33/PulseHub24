import { Client } from 'twitter-api-sdk';
import { BaseSource, NewsArticle, SourceType } from './BaseSource';
import { extractLocationFromText } from '../../newsProcessor';

interface TwitterConfig {
  searchQueries: string[];
  followAccounts: string[];
  languages: string[];
}

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  lang: string;
  geo?: {
    coordinates?: {
      coordinates: [number, number];
    };
  };
  entities?: {
    places?: Array<{
      full_name: string;
    }>;
  };
  public_metrics?: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
  };
  author?: {
    verified: boolean;
  };
}

export class TwitterSource extends BaseSource {
  private client: Client;
  private config: TwitterConfig;

  constructor(
    bearerToken: string,
    config: TwitterConfig,
    updateInterval: number = 2 * 60 * 1000 // 2 minutes default
  ) {
    super(
      'Twitter',
      SourceType.SOCIAL_MEDIA,
      0.6, // 60% credibility score for social media
      updateInterval
    );

    this.client = new Client(bearerToken);
    this.config = config;
  }

  async fetchArticles(): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];

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
          const processedTweets = await this.processTweets(tweets.data as Tweet[]);
          articles.push(...processedTweets);
        }
      }

      // Fetch tweets from followed accounts
      if (this.config.followAccounts.length > 0) {
        for (const username of this.config.followAccounts) {
          const user = await this.client.users.findUserByUsername(username);
          if (user.data?.id) {
            const userTweets = await this.client.tweets.usersIdTweets(user.data.id, {
              max_results: 50,
              'tweet.fields': ['created_at', 'author_id', 'geo', 'lang', 'entities', 'public_metrics'],
              'user.fields': ['name', 'username', 'verified'],
              'place.fields': ['full_name', 'geo']
            });

            if (userTweets.data) {
              const processedTweets = await this.processTweets(userTweets.data as Tweet[]);
              articles.push(...processedTweets);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching tweets:', error);
      this.emit('error', error);
    }

    return articles;
  }

  private async processTweets(tweets: Tweet[]): Promise<NewsArticle[]> {
    const processedTweets: NewsArticle[] = [];

    for (const tweet of tweets) {
      try {
        // Extract location from tweet text and entities
        const locationText = tweet.entities?.places?.map(p => p.full_name).join(' ') || '';
        const location = await extractLocationFromText(tweet.text + ' ' + locationText);

        // Use geo coordinates if available, otherwise use extracted location
        const coordinates = tweet.geo?.coordinates?.coordinates || 
                          (location ? location.coordinates : undefined);

        const article: NewsArticle = {
          title: tweet.text.split('\n')[0], // Use first line as title
          description: tweet.text,
          content: tweet.text,
          url: `https://twitter.com/twitter/status/${tweet.id}`,
          source: 'Twitter',
          sourceType: this.type,
          publishedAt: new Date(tweet.created_at),
          language: tweet.lang,
          location: coordinates || location ? {
            name: location?.location || 'Unknown',
            coordinates: coordinates || location?.coordinates
          } : undefined,
          credibilityScore: this.calculateTweetCredibility(tweet),
          metadata: {
            authorId: tweet.author_id,
            retweetCount: tweet.public_metrics?.retweet_count || 0,
            likeCount: tweet.public_metrics?.like_count || 0,
            replyCount: tweet.public_metrics?.reply_count || 0
          }
        };

        processedTweets.push(article);
      } catch (error) {
        console.error('Error processing tweet:', error);
      }
    }

    return processedTweets;
  }

  private calculateTweetCredibility(tweet: Tweet): number {
    // Base credibility from source type
    let score = this.baseCredibilityScore;

    // Increase score for verified authors
    if (tweet.author?.verified) {
      score += 0.1;
    }

    // Increase score based on engagement
    const engagementScore = 
      ((tweet.public_metrics?.retweet_count || 0) * 0.5 +
       (tweet.public_metrics?.like_count || 0) * 0.3 +
       (tweet.public_metrics?.reply_count || 0) * 0.2) / 1000;
    
    score += Math.min(engagementScore, 0.2);

    // Cap the score at 0.9 for social media
    return Math.min(Math.max(score, 0), 0.9);
  }

  async startStream(): Promise<void> {
    try {
      // Create filtered stream rules
      const rules = [
        ...this.config.searchQueries.map(query => ({ value: query })),
        ...this.config.followAccounts.map(account => ({ value: `from:${account}` }))
      ];

      // Delete existing rules
      const currentRules = await this.client.tweets.getRules();
      if (currentRules.data?.length) {
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
        const processedTweet = await this.processTweets([tweet.data as Tweet]);
        if (processedTweet.length > 0) {
          this.emit('articles', processedTweet);
        }
      }
    } catch (error) {
      console.error('Stream error:', error);
      this.emit('error', error);
      
      // Attempt to restart stream after delay
      setTimeout(() => this.startStream(), 30000);
    }
  }

  async stopStream(): Promise<void> {
    // Cleanup for stream when implemented
  }

  async startFetching(): Promise<void> {
    // Start regular polling
    await this.start();
    
    // Start real-time stream
    await this.startStream();
  }

  async stopFetching(): void {
    this.stop();
  }
}
