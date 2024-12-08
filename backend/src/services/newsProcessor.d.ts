interface Location {
  location: string;
  coordinates?: [number, number];
}

export function extractLocationFromText(text: string): Promise<Location | undefined>;
export function translateText(text: string, targetLanguage: string): Promise<string>;
export function analyzeSentiment(text: string): Promise<{
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
}>;
export function categorizeText(text: string): Promise<string[]>;
