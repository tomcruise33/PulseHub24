-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create enum types
CREATE TYPE news_status AS ENUM ('pending', 'processed', 'published');
CREATE TYPE sentiment_type AS ENUM ('positive', 'negative', 'neutral');

-- Create tables
CREATE TABLE IF NOT EXISTS news_articles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    source_url TEXT NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status news_status DEFAULT 'pending',
    sentiment sentiment_type,
    location_point GEOGRAPHY(POINT),
    location_name TEXT,
    country_code CHAR(2)
);

CREATE TABLE IF NOT EXISTS news_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS article_categories (
    article_id INTEGER REFERENCES news_articles(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES news_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, category_id)
);

CREATE TABLE IF NOT EXISTS social_media_posts (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    post_url TEXT,
    posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sentiment sentiment_type,
    location_point GEOGRAPHY(POINT),
    location_name TEXT,
    country_code CHAR(2)
);

-- Create indexes
CREATE INDEX idx_news_articles_location ON news_articles USING GIST (location_point);
CREATE INDEX idx_news_articles_published_at ON news_articles(published_at);
CREATE INDEX idx_social_media_posts_location ON social_media_posts USING GIST (location_point);
CREATE INDEX idx_social_media_posts_posted_at ON social_media_posts(posted_at);

-- Create function for updating timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_news_articles_updated_at
    BEFORE UPDATE ON news_articles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
