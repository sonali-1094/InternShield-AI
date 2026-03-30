# InternShield AI

An AI-powered tool to detect internship scams and find legitimate opportunities.

## Features

- **Scam Detection**: Upload PDF offer letters or paste messages for AI analysis
- **Red Flag Identification**: Checks for common scam indicators
- **Trust Scoring**: Provides a trust score from 0-100
- **Detailed Reports**: Includes explanations and advice

## Tech Stack

- **Frontend**: React + Tailwind CSS
- **Backend**: Node.js + Express
- **AI**: OpenAI API
- **PDF Parsing**: pdf-parse

## Setup

1. Clone the repository.

2. **Backend Setup**:
   - cd backend
   - npm install
   - Create a `.env` file with:
     - `MONGODB_URI=your_mongodb_connection_string`
     - `OPENAI_API_KEY=your_key_here`
   - npm start

3. **Frontend Setup**:
   - cd frontend
   - npm install
   - npm start

4. Open http://localhost:3000

## API

- POST /api/analyze: Analyze text or PDF for scams
  - Body: `text` (string) or `file` (PDF upload)
- GET /api/analyses: Return recent saved analyses from MongoDB
- GET /api/insights: Return dashboard metrics based on MongoDB data

## Usage

Paste an internship offer or upload a PDF to get an instant scam analysis.
