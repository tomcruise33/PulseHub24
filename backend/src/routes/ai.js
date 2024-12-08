const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generate article summary
router.post('/summarize', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that generates concise news summaries."
        },
        {
          role: "user",
          content: `Please provide a concise summary (2-3 sentences) of the following news article:\n\n${content}`
        }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const summary = completion.choices[0].message.content;
    res.json({ summary });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Extract locations from text
router.post('/extract-locations', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that extracts location information from text. Return the locations in JSON format with name, country, and approximate coordinates if possible."
        },
        {
          role: "user",
          content: `Please extract all location references from the following text:\n\n${content}`
        }
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const locations = JSON.parse(completion.choices[0].message.content);
    res.json({ locations });
  } catch (error) {
    console.error('Error extracting locations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Perform sentiment analysis
router.post('/analyze-sentiment', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that analyzes sentiment. Return only 'positive', 'negative', or 'neutral'."
        },
        {
          role: "user",
          content: `Please analyze the sentiment of the following text:\n\n${content}`
        }
      ],
      max_tokens: 10,
      temperature: 0.3,
    });

    const sentiment = completion.choices[0].message.content.toLowerCase();
    res.json({ sentiment });
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
