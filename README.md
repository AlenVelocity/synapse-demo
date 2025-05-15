# Synapse - Demo

Speech to Text with Intent Recognition built with Deepgram and Google Gemini Flash

### Live Demo: [https://stt.alen.is](https://stt.alen.is)

## Local Setup

### Prerequisites

- Node.js
- pnpm

### API Keys

Deepgram: Login to [Deepgram Console](https://console.deepgram.com/) and create an API key with "Member" access.

Gemini: Get Gemini Key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### Setup

1. Clone the repository

```bash
git clone https://github.com/alenvelocity/synapse-demo.git
cd synapse-demo
```

2. Install dependencies

```bash
pnpm install
```

3. Create a `.env` file and add your Deepgram API key

```bash
DEEPGRAM_API_KEY="your_deepgram_api_key"
DEEPGRAM_PROJECT_ID="your_deepgram_project_id"
DEEPGRAM_ENV="development"
GEMINI_API_KEY="your_google_api_key"
GEMINI_MODEL_NAME="gemini-2.0-flash" # Default model
```

4. Run the development server

`https` is needed if you want to access microphone in secure context (other than `localhost`)

```bash
pnpm dev --experimental-https
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

