# VentureVibe
A trip focused social media app with a built in social network that identifies legs as "trips" and make planning and posting trips easier!

## Tech Stack
- **Frontend:** React + TypeScript + Vite
- **Backend:** FastAPI (Python)
- **Database & Auth:** Supabase
- **Maps:** Google Maps API

## Setup

### Prerequisites
- Node.js (v18+)
- Python 3.8+
- Supabase account
- Google Maps API key

### Environment Variables
Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_Key=your-google-maps-api-key
```

### Installation

1. **Install frontend dependencies:**
   ```bash
   npm install
   ```

2. **Create Python virtual environment and install backend dependencies:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install fastapi uvicorn
   ```

## Running the Application

### Start Backend (Terminal 1)
```bash
source venv/bin/activate  # On Windows: venv\Scripts\activate
uvicorn backend:app --reload --port 8000
```

Backend will run on `http://localhost:8000`

### Start Frontend (Terminal 2)
```bash
npm run dev
```

Frontend will run on `http://localhost:5173`

## Testing

1. Open `http://localhost:5173` in your browser
2. Sign up with email/password/username
3. After login, you should see:
   - Google Map with markers from the backend
   - Form to add new markers
   - Logout button
4. Test adding markers and logout functionality

## Project Structure
```
VentureVibe/
├── src/
│   ├── components/       # Reusable React components
│   ├── pages/           # Page components
│   ├── lib/             # Utilities (Supabase client)
│   ├── AuthContext.tsx  # Authentication context
│   └── App.tsx          # Main app component
├── backend.py           # FastAPI backend
├── venv/               # Python virtual environment
└── .env                # Environment variables (not in git)
```

## API Endpoints

- `GET /` - Health check
- `GET /markers` - Returns list of map markers
