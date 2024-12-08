from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
from datetime import datetime
import random
import logging
import google.generativeai as genai
import os
from dotenv import load_dotenv
from typing import List
from fastapi.responses import JSONResponse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Configure Gemini API
gemini_api_key = os.getenv("GEMINI_API_KEY")
if not gemini_api_key:
    logger.error("GEMINI_API_KEY environment variable is not set")
    raise ValueError("GEMINI_API_KEY environment variable is not set")

logger.info("Configuring Gemini API...")
try:
    genai.configure(api_key=gemini_api_key)
    model = genai.GenerativeModel('gemini-pro')
    logger.info("Gemini API configured successfully")
except Exception as e:
    logger.error(f"Failed to configure Gemini API: {str(e)}")
    raise

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Store connected WebSocket clients
connected_clients: List[WebSocket] = []

async def broadcast_news():
    """Periodically broadcast news to all connected clients."""
    while True:
        if connected_clients:
            articles = [generate_news_article() for _ in range(3)]
            message = {"type": "articles", "articles": articles}
            
            # Broadcast to all connected clients
            disconnected_clients = []
            for client in connected_clients:
                try:
                    await client.send_json(message)
                except Exception as e:
                    logger.error(f"Error broadcasting to client: {e}")
                    disconnected_clients.append(client)
            
            # Remove disconnected clients
            for client in disconnected_clients:
                connected_clients.remove(client)
        
        await asyncio.sleep(5)  # Send updates every 5 seconds

# Add country codes mapping with native names
COUNTRY_CODES = {
    # Europe
    "France": {"code": "FR", "english": "France", "native": "France"},
    "Deutschland": {"code": "DE", "english": "Germany", "native": "Deutschland"},
    "Germany": {"code": "DE", "english": "Germany", "native": "Deutschland"},
    "España": {"code": "ES", "english": "Spain", "native": "España"},
    "Spain": {"code": "ES", "english": "Spain", "native": "España"},
    "Italia": {"code": "IT", "english": "Italy", "native": "Italia"},
    "Italy": {"code": "IT", "english": "Italy", "native": "Italia"},
    "United Kingdom": {"code": "GB", "english": "United Kingdom", "native": "United Kingdom"},
    "Great Britain": {"code": "GB", "english": "United Kingdom", "native": "United Kingdom"},
    "Portugal": {"code": "PT", "english": "Portugal", "native": "Portugal"},
    "Nederland": {"code": "NL", "english": "Netherlands", "native": "Nederland"},
    "Netherlands": {"code": "NL", "english": "Netherlands", "native": "Nederland"},
    "Polska": {"code": "PL", "english": "Poland", "native": "Polska"},
    "Poland": {"code": "PL", "english": "Poland", "native": "Polska"},
    "Sverige": {"code": "SE", "english": "Sweden", "native": "Sverige"},
    "Sweden": {"code": "SE", "english": "Sweden", "native": "Sverige"},
    "Norge": {"code": "NO", "english": "Norway", "native": "Norge"},
    "Norway": {"code": "NO", "english": "Norway", "native": "Norge"},
    "Slovensko": {"code": "SK", "english": "Slovakia", "native": "Slovensko"},
    "Slovakia": {"code": "SK", "english": "Slovakia", "native": "Slovensko"},
    "België": {"code": "BE", "english": "Belgium", "native": "België"},
    "Belgium": {"code": "BE", "english": "Belgium", "native": "België"},
    "Belgique": {"code": "BE", "english": "Belgium", "native": "België"},
    "Україна": {"code": "UA", "english": "Ukraine", "native": "Україна"},
    "Ukraine": {"code": "UA", "english": "Ukraine", "native": "Україна"},
    "Беларусь": {"code": "BY", "english": "Belarus", "native": "Беларусь"},
    "Belarus": {"code": "BY", "english": "Belarus", "native": "Беларусь"},
    "România": {"code": "RO", "english": "Romania", "native": "România"},
    "Romania": {"code": "RO", "english": "Romania", "native": "România"},
    "България": {"code": "BG", "english": "Bulgaria", "native": "България"},
    "Bulgaria": {"code": "BG", "english": "Bulgaria", "native": "България"},
    "Ελλάδα": {"code": "GR", "english": "Greece", "native": "Ελλάδα"},
    "Greece": {"code": "GR", "english": "Greece", "native": "Ελλάδα"},
    "Suomi": {"code": "FI", "english": "Finland", "native": "Suomi"},
    "Finland": {"code": "FI", "english": "Finland", "native": "Suomi"},
    "Danmark": {"code": "DK", "english": "Denmark", "native": "Danmark"},
    "Denmark": {"code": "DK", "english": "Denmark", "native": "Danmark"},
    "Österreich": {"code": "AT", "english": "Austria", "native": "Österreich"},
    "Austria": {"code": "AT", "english": "Austria", "native": "Österreich"},
    "Schweiz": {"code": "CH", "english": "Switzerland", "native": "Schweiz"},
    "Switzerland": {"code": "CH", "english": "Switzerland", "native": "Schweiz"},
    "Suisse": {"code": "CH", "english": "Switzerland", "native": "Schweiz"},
    "Ireland": {"code": "IE", "english": "Ireland", "native": "Ireland"},
    "Éire": {"code": "IE", "english": "Ireland", "native": "Éire"},
    "Česko": {"code": "CZ", "english": "Czech Republic", "native": "Česko"},
    "Czech Republic": {"code": "CZ", "english": "Czech Republic", "native": "Česko"},
    "Česká republika": {"code": "CZ", "english": "Czech Republic", "native": "Česko"},
    "Magyarország": {"code": "HU", "english": "Hungary", "native": "Magyarország"},
    "Hungary": {"code": "HU", "english": "Hungary", "native": "Magyarország"},
    "Slovenija": {"code": "SI", "english": "Slovenia", "native": "Slovenija"},
    "Slovenia": {"code": "SI", "english": "Slovenia", "native": "Slovenija"},
    "Hrvatska": {"code": "HR", "english": "Croatia", "native": "Hrvatska"},
    "Croatia": {"code": "HR", "english": "Croatia", "native": "Hrvatska"},
    "Србија": {"code": "RS", "english": "Serbia", "native": "Србија"},
    "Serbia": {"code": "RS", "english": "Serbia", "native": "Србија"},
    "Црна Гора": {"code": "ME", "english": "Montenegro", "native": "Црна Гора"},
    "Montenegro": {"code": "ME", "english": "Montenegro", "native": "Црна Гора"},
    "Северна Македонија": {"code": "MK", "english": "North Macedonia", "native": "Северна Македонија"},
    "North Macedonia": {"code": "MK", "english": "North Macedonia", "native": "Северна Македонија"},
    "Albania": {"code": "AL", "english": "Albania", "native": "Shqipëria"},
    "Shqipëria": {"code": "AL", "english": "Albania", "native": "Shqipëria"},
    "Moldova": {"code": "MD", "english": "Moldova", "native": "Moldova"},
    "Latvija": {"code": "LV", "english": "Latvia", "native": "Latvija"},
    "Latvia": {"code": "LV", "english": "Latvia", "native": "Latvija"},
    "Eesti": {"code": "EE", "english": "Estonia", "native": "Eesti"},
    "Estonia": {"code": "EE", "english": "Estonia", "native": "Eesti"},
    "Lietuva": {"code": "LT", "english": "Lithuania", "native": "Lietuva"},
    "Lithuania": {"code": "LT", "english": "Lithuania", "native": "Lietuva"},
    "Iceland": {"code": "IS", "english": "Iceland", "native": "Ísland"},
    "Ísland": {"code": "IS", "english": "Iceland", "native": "Ísland"},
    
    # Asia
    "中国": {"code": "CN", "english": "China", "native": "中国"},
    "China": {"code": "CN", "english": "China", "native": "中国"},
    "日本": {"code": "JP", "english": "Japan", "native": "日本"},
    "Japan": {"code": "JP", "english": "Japan", "native": "日本"},
    "대한민국": {"code": "KR", "english": "South Korea", "native": "대한민국"},
    "South Korea": {"code": "KR", "english": "South Korea", "native": "대한민국"},
    "Korea": {"code": "KR", "english": "South Korea", "native": "대한민국"},
    "조선민주주의인민공화국": {"code": "KP", "english": "North Korea", "native": "조선민주주의인민공화국"},
    "North Korea": {"code": "KP", "english": "North Korea", "native": "조선민주주의인민공화국"},
    "भारत": {"code": "IN", "english": "India", "native": "भारत"},
    "India": {"code": "IN", "english": "India", "native": "भारत"},
    "Indonesia": {"code": "ID", "english": "Indonesia", "native": "Indonesia"},
    "Vietnam": {"code": "VN", "english": "Vietnam", "native": "Việt Nam"},
    "Việt Nam": {"code": "VN", "english": "Vietnam", "native": "Việt Nam"},
    "Thailand": {"code": "TH", "english": "Thailand", "native": "ประเทศไทย"},
    "ประเทศไทย": {"code": "TH", "english": "Thailand", "native": "ประเทศไทย"},
    "Malaysia": {"code": "MY", "english": "Malaysia", "native": "Malaysia"},
    "Philippines": {"code": "PH", "english": "Philippines", "native": "Philippines"},
    "Pilipinas": {"code": "PH", "english": "Philippines", "native": "Pilipinas"},
    "Singapore": {"code": "SG", "english": "Singapore", "native": "Singapore"},
    "Pakistan": {"code": "PK", "english": "Pakistan", "native": "پاکستان"},
    "Bangladesh": {"code": "BD", "english": "Bangladesh", "native": "বাংলাদেশ"},
    "Sri Lanka": {"code": "LK", "english": "Sri Lanka", "native": "ශ්‍රී ලංකා"},
    "Myanmar": {"code": "MM", "english": "Myanmar", "native": "မြန်မာ"},
    "Cambodia": {"code": "KH", "english": "Cambodia", "native": "កម្ពុជា"},
    "Laos": {"code": "LA", "english": "Laos", "native": "ລາວ"},
    "Mongolia": {"code": "MN", "english": "Mongolia", "native": "Монгол"},
    "Taiwan": {"code": "TW", "english": "Taiwan", "native": "臺灣"},
    "臺灣": {"code": "TW", "english": "Taiwan", "native": "臺灣"},
    "Kazakhstan": {"code": "KZ", "english": "Kazakhstan", "native": "Қазақстан"},
    "Қазақстан": {"code": "KZ", "english": "Kazakhstan", "native": "Қазақстан"},
    "Uzbekistan": {"code": "UZ", "english": "Uzbekistan", "native": "O'zbekiston"},
    "O'zbekiston": {"code": "UZ", "english": "Uzbekistan", "native": "O'zbekiston"},
    "Kyrgyzstan": {"code": "KG", "english": "Kyrgyzstan", "native": "Кыргызстан"},
    "Кыргызстан": {"code": "KG", "english": "Kyrgyzstan", "native": "Кыргызстан"},
    "Tajikistan": {"code": "TJ", "english": "Tajikistan", "native": "Тоҷикистон"},
    "Тоҷикистон": {"code": "TJ", "english": "Tajikistan", "native": "Тоҷикистон"},
    "Turkmenistan": {"code": "TM", "english": "Turkmenistan", "native": "Türkmenistan"},
    "Türkmenistan": {"code": "TM", "english": "Turkmenistan", "native": "Türkmenistan"},
    
    # Americas
    "United States": {"code": "US", "english": "United States", "native": "United States"},
    "USA": {"code": "US", "english": "United States", "native": "United States"},
    "Canada": {"code": "CA", "english": "Canada", "native": "Canada"},
    "Brasil": {"code": "BR", "english": "Brazil", "native": "Brasil"},
    "Brazil": {"code": "BR", "english": "Brazil", "native": "Brasil"},
    "México": {"code": "MX", "english": "Mexico", "native": "México"},
    "Mexico": {"code": "MX", "english": "Mexico", "native": "México"},
    "Argentina": {"code": "AR", "english": "Argentina", "native": "Argentina"},
    "Colombia": {"code": "CO", "english": "Colombia", "native": "Colombia"},
    "Chile": {"code": "CL", "english": "Chile", "native": "Chile"},
    "Peru": {"code": "PE", "english": "Peru", "native": "Perú"},
    "Perú": {"code": "PE", "english": "Peru", "native": "Perú"},
    "Venezuela": {"code": "VE", "english": "Venezuela", "native": "Venezuela"},
    "Ecuador": {"code": "EC", "english": "Ecuador", "native": "Ecuador"},
    "Bolivia": {"code": "BO", "english": "Bolivia", "native": "Bolivia"},
    "Paraguay": {"code": "PY", "english": "Paraguay", "native": "Paraguay"},
    "Uruguay": {"code": "UY", "english": "Uruguay", "native": "Uruguay"},
    "Cuba": {"code": "CU", "english": "Cuba", "native": "Cuba"},
    "Dominican Republic": {"code": "DO", "english": "Dominican Republic", "native": "República Dominicana"},
    "República Dominicana": {"code": "DO", "english": "Dominican Republic", "native": "República Dominicana"},
    "Haiti": {"code": "HT", "english": "Haiti", "native": "Haïti"},
    "Haïti": {"code": "HT", "english": "Haiti", "native": "Haïti"},
    "Guatemala": {"code": "GT", "english": "Guatemala", "native": "Guatemala"},
    "El Salvador": {"code": "SV", "english": "El Salvador", "native": "El Salvador"},
    "Honduras": {"code": "HN", "english": "Honduras", "native": "Honduras"},
    "Nicaragua": {"code": "NI", "english": "Nicaragua", "native": "Nicaragua"},
    "Costa Rica": {"code": "CR", "english": "Costa Rica", "native": "Costa Rica"},
    "Panama": {"code": "PA", "english": "Panama", "native": "Panamá"},
    "Panamá": {"code": "PA", "english": "Panama", "native": "Panamá"},
    
    # Middle East
    "مصر": {"code": "EG", "english": "Egypt", "native": "مصر"},
    "Egypt": {"code": "EG", "english": "Egypt", "native": "مصر"},
    "السعودية": {"code": "SA", "english": "Saudi Arabia", "native": "السعودية"},
    "Saudi Arabia": {"code": "SA", "english": "Saudi Arabia", "native": "السعودية"},
    "ایران": {"code": "IR", "english": "Iran", "native": "ایران"},
    "Iran": {"code": "IR", "english": "Iran", "native": "ایران"},
    "Türkiye": {"code": "TR", "english": "Turkey", "native": "Türkiye"},
    "Turkey": {"code": "TR", "english": "Turkey", "native": "Türkiye"},
    "العراق": {"code": "IQ", "english": "Iraq", "native": "العراق"},
    "Iraq": {"code": "IQ", "english": "Iraq", "native": "العراق"},
    "سوريا": {"code": "SY", "english": "Syria", "native": "سوريا"},
    "Syria": {"code": "SY", "english": "Syria", "native": "سوريا"},
    "الأردن": {"code": "JO", "english": "Jordan", "native": "الأردن"},
    "Jordan": {"code": "JO", "english": "Jordan", "native": "الأردن"},
    "لبنان": {"code": "LB", "english": "Lebanon", "native": "لبنان"},
    "Lebanon": {"code": "LB", "english": "Lebanon", "native": "لبنان"},
    "Israel": {"code": "IL", "english": "Israel", "native": "ישראל"},
    "ישראל": {"code": "IL", "english": "Israel", "native": "ישראל"},
    "الإمارات": {"code": "AE", "english": "United Arab Emirates", "native": "الإمارات"},
    "United Arab Emirates": {"code": "AE", "english": "United Arab Emirates", "native": "الإمارات"},
    "UAE": {"code": "AE", "english": "United Arab Emirates", "native": "الإمارات"},
    "قطر": {"code": "QA", "english": "Qatar", "native": "قطر"},
    "Qatar": {"code": "QA", "english": "Qatar", "native": "قطر"},
    "البحرين": {"code": "BH", "english": "Bahrain", "native": "البحرين"},
    "Bahrain": {"code": "BH", "english": "Bahrain", "native": "البحرين"},
    "عمان": {"code": "OM", "english": "Oman", "native": "عمان"},
    "Oman": {"code": "OM", "english": "Oman", "native": "عمان"},
    "الكويت": {"code": "KW", "english": "Kuwait", "native": "الكويت"},
    "Kuwait": {"code": "KW", "english": "Kuwait", "native": "الكويت"},
    "اليمن": {"code": "YE", "english": "Yemen", "native": "اليمن"},
    "Yemen": {"code": "YE", "english": "Yemen", "native": "اليمن"},
    
    # Africa
    "South Africa": {"code": "ZA", "english": "South Africa", "native": "South Africa"},
    "Nigeria": {"code": "NG", "english": "Nigeria", "native": "Nigeria"},
    "Kenya": {"code": "KE", "english": "Kenya", "native": "Kenya"},
    "المغرب": {"code": "MA", "english": "Morocco", "native": "المغرب"},
    "Morocco": {"code": "MA", "english": "Morocco", "native": "المغرب"},
    "Maroc": {"code": "MA", "english": "Morocco", "native": "المغرب"},
    "ليبيا": {"code": "LY", "english": "Libya", "native": "ليبيا"},
    "Libya": {"code": "LY", "english": "Libya", "native": "ليبيا"},
    "تونس": {"code": "TN", "english": "Tunisia", "native": "تونس"},
    "Tunisia": {"code": "TN", "english": "Tunisia", "native": "تونس"},
    "الجزائر": {"code": "DZ", "english": "Algeria", "native": "الجزائر"},
    "Algeria": {"code": "DZ", "english": "Algeria", "native": "الجزائر"},
    "Ethiopia": {"code": "ET", "english": "Ethiopia", "native": "ኢትዮጵያ"},
    "Ghana": {"code": "GH", "english": "Ghana", "native": "Ghana"},
    "Tanzania": {"code": "TZ", "english": "Tanzania", "native": "Tanzania"},
    "Uganda": {"code": "UG", "english": "Uganda", "native": "Uganda"},
    "Angola": {"code": "AO", "english": "Angola", "native": "Angola"},
    "Mozambique": {"code": "MZ", "english": "Mozambique", "native": "Moçambique"},
    "Zimbabwe": {"code": "ZW", "english": "Zimbabwe", "native": "Zimbabwe"},
    "Sudan": {"code": "SD", "english": "Sudan", "native": "السودان"},
    "السودان": {"code": "SD", "english": "Sudan", "native": "السودان"},
    "Senegal": {"code": "SN", "english": "Senegal", "native": "Sénégal"},
    "Sénégal": {"code": "SN", "english": "Senegal", "native": "Sénégal"},
    "Cameroon": {"code": "CM", "english": "Cameroon", "native": "Cameroun"},
    "Cameroun": {"code": "CM", "english": "Cameroon", "native": "Cameroun"},
    "Côte d'Ivoire": {"code": "CI", "english": "Ivory Coast", "native": "Côte d'Ivoire"},
    "Ivory Coast": {"code": "CI", "english": "Ivory Coast", "native": "Côte d'Ivoire"},
    "Madagascar": {"code": "MG", "english": "Madagascar", "native": "Madagascar"},
    "Mali": {"code": "ML", "english": "Mali", "native": "Mali"},
    "Burkina Faso": {"code": "BF", "english": "Burkina Faso", "native": "Burkina Faso"},
    "Niger": {"code": "NE", "english": "Niger", "native": "Niger"},
    "Chad": {"code": "TD", "english": "Chad", "native": "Tchad"},
    "Tchad": {"code": "TD", "english": "Chad", "native": "Tchad"},
    "Somalia": {"code": "SO", "english": "Somalia", "native": "Soomaaliya"},
    "Soomaaliya": {"code": "SO", "english": "Somalia", "native": "Soomaaliya"},
    
    # Oceania
    "Australia": {"code": "AU", "english": "Australia", "native": "Australia"},
    "New Zealand": {"code": "NZ", "english": "New Zealand", "native": "New Zealand"},
    "Papua New Guinea": {"code": "PG", "english": "Papua New Guinea", "native": "Papua New Guinea"},
    "Fiji": {"code": "FJ", "english": "Fiji", "native": "Fiji"},
    "Solomon Islands": {"code": "SB", "english": "Solomon Islands", "native": "Solomon Islands"},
    "Vanuatu": {"code": "VU", "english": "Vanuatu", "native": "Vanuatu"},
    "New Caledonia": {"code": "NC", "english": "New Caledonia", "native": "Nouvelle-Calédonie"},
    "Nouvelle-Calédonie": {"code": "NC", "english": "New Caledonia", "native": "Nouvelle-Calédonie"},
    "French Polynesia": {"code": "PF", "english": "French Polynesia", "native": "Polynésie française"},
    "Polynésie française": {"code": "PF", "english": "French Polynesia", "native": "Polynésie française"},
    
    # Others
    "Россия": {"code": "RU", "english": "Russia", "native": "Россия"},
    "Russia": {"code": "RU", "english": "Russia", "native": "Россия"}
}

# Sample news data
def generate_news_article():
    locations = [
        {"name": "New York", "coordinates": [-74.006, 40.7128]},
        {"name": "London", "coordinates": [-0.1276, 51.5074]},
        {"name": "Tokyo", "coordinates": [139.6917, 35.6895]},
        {"name": "Sydney", "coordinates": [151.2093, -33.8688]},
        {"name": "Paris", "coordinates": [2.3522, 48.8566]},
    ]
    
    sources = ["Reuters", "AP News", "BBC", "CNN", "Local News"]
    source_types = ["big_media", "government", "local_media", "social_media"]
    sentiments = ["positive", "neutral", "negative"]
    categories = ["politics", "business", "technology", "science", "health"]
    
    location = random.choice(locations)
    return {
        "id": str(random.randint(1000, 9999)),
        "title": f"Breaking News from {location['name']}",
        "description": f"Latest updates from {location['name']} about current events.",
        "content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
        "url": "https://example.com/news",
        "source": random.choice(sources),
        "sourceType": random.choice(source_types),
        "sentiment": random.choice(sentiments),
        "category": random.choice(categories),
        "publishedAt": datetime.now().isoformat(),
        "location": location
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo the received data back to the client
            await websocket.send_text(f"Message text was: {data}")
    except WebSocketDisconnect:
        connected_clients.remove(websocket)
        logger.info("Client disconnected")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "PulseHub24 Backend API"}

@app.post("/country-info")
async def get_country_info(request: Request):
    try:
        logger.info(f"Received request to /country-info at {datetime.now()}")
        
        # Handle preflight requests
        if request.method == "OPTIONS":
            return Response(
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                }
            )
        
        data = await request.json()
        logger.info(f"Request data: {data}")
        
        country = data.get("country")
        if not country:
            logger.error("Country name is missing")
            return JSONResponse(
                status_code=400,
                content={"error": "Country name is required"}
            )
        
        logger.info(f"Processing request for country: {country}")
        
        # Get country code and names
        country_data = COUNTRY_CODES.get(country, {"code": "UN", "english": country, "native": country})
        logger.info(f"Country data: {country_data}")
        
        try:
            # Create the prompt for Gemini
            prompt = f"""Provide information about {country_data['english']} in the following JSON format:
            {{
                "summary": "A brief 2-sentence summary of the country",
                "capital": "The capital city",
                "area": "The total area in square kilometers",
                "funFact": "An interesting fun fact about the country"
            }}"""
            
            # Call Gemini API
            logger.info(f"Calling Gemini API for country: {country_data['english']}")
            response = model.generate_content(prompt)
            
            logger.info("Gemini API response received")
            logger.info(f"Raw response content: {response.text}")
            
            # Parse the response
            content = response.text.strip()
            if content.startswith("```json"):
                content = content[7:-3]
            elif content.startswith("```"):
                content = content[3:-3]
            content = content.strip()
            
            try:
                result = json.loads(content)
                result["code"] = country_data["code"]
                result["native"] = country_data["native"]
                logger.info(f"Processed result: {result}")
                return JSONResponse(content=result)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Gemini response as JSON: {str(e)}")
                return JSONResponse(
                    status_code=500,
                    content={"error": "Failed to process country information"}
                )
                
        except Exception as e:
            logger.error(f"Error calling Gemini API: {str(e)}")
            return JSONResponse(
                status_code=500,
                content={"error": "Failed to fetch country information"}
            )
            
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"}
        )

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(broadcast_news())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
