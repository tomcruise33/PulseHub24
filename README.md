# PulseHub24 - AI-Powered Global News Platform

PulseHub24 is a dynamic, geographically interactive news aggregation web application that combines advanced AI capabilities with real-time visualization to deliver a unique news exploration experience.

## Features

- 🌍 Interactive global news map
- 🤖 AI-powered country information using Google's Gemini API
- 📍 Geographic location extraction
- ⚡ Real-time updates via WebSocket
- 🎨 Modern, dark-themed UI
- 📱 Responsive design

## Tech Stack

### Frontend
- React.js with TypeScript
- Mapbox GL JS for map visualization
- Material-UI for components
- WebSocket for real-time updates

### Backend
- FastAPI (Python)
- Google Gemini API for AI processing
- WebSocket for real-time communication

## Prerequisites

- Python 3.9 or higher
- Node.js (v14 or higher)
- API Keys:
  - Google Gemini API key
  - Mapbox token

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/pulsehub24.git
cd pulsehub24
```

2. Install dependencies:
```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

3. Set up environment variables:

Backend (.env):
```env
GEMINI_API_KEY=your_gemini_api_key
```

Frontend (.env):
```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000
```

4. Run the development servers:

Backend:
```bash
cd backend
uvicorn main:app --reload
```

Frontend:
```bash
cd frontend
npm start
```

## Deployment

The application is deployed using GitHub Actions with the following setup:

### Backend (Railway)
1. Create a new project on Railway.app
2. Add environment variables in Railway:
   - `GEMINI_API_KEY`
   - `PYTHON_VERSION=3.9`
3. Get your Railway token and add it to GitHub repository secrets as `RAILWAY_TOKEN`

### Frontend (Vercel)
1. Create a new project on Vercel
2. Add the following secrets to GitHub repository:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`

The deployment process is automated through GitHub Actions:
- Backend is deployed to Railway
- Frontend is deployed to Vercel
- Deployments are triggered on push to the main branch

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
