# Lumina — AI Study Suite powered by Gemma 4

> **5 AI-powered study tools in one app — learning roadmap, flashcards, Socratic debate arena, adaptive exam & AI whiteboard — all running on Gemma 4 31B.**

Built for the **Gemma 4 Good Hackathon · Future of Education track** · May 2026

---

## What is Lumina?

Students don't struggle from a lack of information — they struggle from a lack of *structured, interactive, personalised* learning. Lumina gives every learner five deeply integrated Gemma 4-powered tools in one place, covering every stage of the learning loop: **plan → study → challenge → examine → explore**.

---

## Demo

> 📹 **[Watch the demo video →](#)**
> *(replace `#` with your YouTube / Loom link before submitting)*

---

## Features

### 🗺️ Learning GPS
Type any learning goal and get a structured week-by-week roadmap with daily focus areas, milestones, curated free resources, and self-check questions — all generated in real time by Gemma 4. One click from any week card launches that week's topic directly into Flash & Quiz, the Debate Arena, or The Examiner.

### ⚡ Flash & Quiz
Generate spaced-repetition flashcards from a topic description **or from photos of your handwritten notes** (Gemma 4's vision reads the images). Study with 3-D flip cards, then switch to quiz mode — write your answers and get instant AI feedback. Supports 5–20 cards per session.

### ⚖️ AgentDebate — Socratic Debate Arena
Enter any topic and three specialised Gemma 4 agents debate it live via real-time streaming:
- 🔍 **Critical Challenger** — attacks the mainstream position and exposes blind spots
- 🔭 **Consensus Builder** — synthesises truth by acknowledging every side
- 📚 **Fact-Checker** — grounds every claim in real Wikipedia articles fetched at session start

You can **interrupt the agents mid-debate** with a voice or typed message, directing your challenge at one agent or all three. After the final round, Gemma 4 synthesises the full transcript into a structured essay outline that you can download as a formatted `.docx` file.

### 🎓 The Examiner
An adaptive oral exam powered by Gemma 4. Answer questions by:
- **Voice** — speak your answer; the browser's Web Speech API transcribes it locally, no audio leaves your device
- **Typing** — classic text input with Ctrl+Enter to submit
- **Photo** — photograph your handwritten answer; Gemma 4 reads the handwriting via vision

The difficulty adapts in real time — harder questions when you score high, probing follow-ups when you miss. Every session ends with a graded report: overall score, grade, strengths, areas to improve, and study recommendations.

### 🎨 AI Whiteboard
A full **Excalidraw** canvas with a Gemma 4 chat panel on the side. Draw diagrams, sketch equations, write notes — then **snapshot the board** and ask Gemma anything about it. Gemma 4's vision capability reads and explains whatever is on your canvas. The chat history persists across the session for multi-turn dialogue about your work.

### 🗒️ Notes Panel
Save any output — roadmap weeks, flashcard sets, exam reports, whiteboard answers — to a persistent in-session notes panel. Download everything as a plain text file.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| LLM | **Gemma 4 31B IT** (`gemma-4-31b-it`) | Via Google AI Studio API |
| Backend | Node.js 18 + Express | REST + SSE |
| Frontend | React 18 + Vite + Tailwind CSS | |
| Canvas | **Excalidraw** | Full drawing/diagramming canvas |
| Real-time | **Server-Sent Events (SSE)** | Live token streaming for the debate |
| Knowledge / RAG | **Wikipedia REST API** | No key required — free & open |
| Speech input | **Web Speech API** | Browser-native, runs entirely on-device |
| Export | `docx` npm package | Essay outline → formatted Word file |
| Languages | English · Español · العربية | Full RTL support for Arabic |

---

## How each technology is used

### Gemma 4 31B (`gemma-4-31b-it`)
Every AI feature calls the same model through the `@google/generative-ai` SDK:

- **JSON mode** (`responseMimeType: 'application/json'`) forces structured output for roadmaps, flashcards, exam questions, and grading reports — no fragile regex parsing needed.
- **System instructions** separate the output schema from the user data prompt, preventing the model from echoing the schema instead of filling it in.
- **Vision** is used in Flash & Quiz (read handwritten note images → flashcards) and The Examiner (read handwritten answer photos → grade them) and AI Whiteboard (read whiteboard snapshots → explain/analyse).
- **Multi-turn conversation** is used in The Examiner (adaptive questioning over a full exam session) and AI Whiteboard (persistent chat about the canvas).
- **Streaming** (`generateContentStream`) powers live token-by-token output in the debate arena. A non-streaming fallback kicks in automatically if the stream fails.
- **Retry logic** with a flat 2-second backoff handles transient 500 errors, across all features (3 streaming attempts + 5 non-streaming fallback attempts for debate agents; 3 attempts for all other tools).

### Wikipedia REST API
Used as the knowledge base for the Fact-Checker debate agent. When a debate session starts, the backend calls `en.wikipedia.org/w/api.php` to:
1. **Search** for the top 5 Wikipedia articles related to the topic
2. **Fetch** the intro extract (up to 1,500 chars) of the top 3 results

These extracts are injected into the Fact-Checker's system prompt as grounded sources. The agent is instructed to cite claims with `[Source: Title]` and to challenge any unsourced assertion from the other agents. No API key required — the Wikipedia API is free and open.

### Excalidraw
The AI Whiteboard feature embeds the full Excalidraw React component as a first-class drawing canvas. When the user clicks **Snapshot**, the app uses Excalidraw's `exportToBlob` utility to render the current canvas to a PNG, converts it to base64, and sends it to Gemma 4 alongside the user's chat message. Gemma 4 responds with a vision-based analysis of whatever is drawn.

### Web Speech API (browser-native speech recognition)
Speech input is processed **entirely in the browser** — no audio is sent to any server. The app uses `window.SpeechRecognition` (or `window.webkitSpeechRecognition` for Chrome/Edge compatibility):

- In **The Examiner**: the student holds a mic button, speaks their answer, and the transcript is sent to Gemma 4 for grading. The language of recognition matches the app's selected language (`en-US`, `es-ES`, or `ar-SA`).
- In **AgentDebate**: the student holds a mic button to interrupt the agents mid-debate; the transcript is injected into the next debate round.
- In **AI Whiteboard**: voice input populates the chat text field before sending to Gemma 4.

> **Note:** Web Speech API requires Chrome or Edge. Firefox is not supported by this API. The app shows a fallback message on unsupported browsers.

---

## Prerequisites

- **Node.js v18 or later** — [download](https://nodejs.org/)
- **A free Google AI Studio API key** — [get one here](https://aistudio.google.com/apikey) (the free quota is more than enough for personal use)
- **Chrome or Edge** for voice input features (other browsers work for everything else)
- **Git** — [download](https://git-scm.com/)

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/zeyadAlmothafar-founder/Lumina.git
cd YOUR_REPO
```

### 2. Set up the backend

```bash
cd backend
npm install
```

Copy the example environment file:

```bash
# Mac / Linux
cp .env.example .env

# Windows
copy .env.example .env
```

Open `backend/.env` and paste your API key:

```env
GOOGLE_AI_KEY=your_google_ai_studio_key_here
GEMMA_MODEL=gemma-4-31b-it
PORT=3001
```

Start the backend:

```bash
node server.js
# → Lumina backend running on http://localhost:3001
```

### 3. Set up the frontend

Open a **new terminal** in the project root:

```bash
cd frontend
npm install
npm run dev
# → App running on http://localhost:5173
```

### 4. Open the app

Go to **[http://localhost:5173](http://localhost:5173)**.

> The Vite dev server automatically proxies all `/api/*` requests to the backend on port 3001 — no extra configuration needed.

---

## Project Structure

```
lumina/
├── backend/
│   ├── server.js                  # Express app — all API routes + SSE stream
│   ├── services/
│   │   ├── tools.js               # Gemma 4: GPS, Quiz, Examiner, Whiteboard
│   │   ├── gemma.js               # Gemma 4 streaming debate agents + synthesis
│   │   ├── wikipedia.js           # Wikipedia REST API — search + extract (RAG)
│   │   └── docx.js                # Essay outline → .docx export
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Root — section routing, session state, notes
│   │   ├── i18n.js                # All UI strings (EN / ES / AR)
│   │   └── components/
│   │       ├── Sidebar.jsx
│   │       ├── Landing.jsx        # Debate topic input + agent preview
│   │       ├── DebateArena.jsx    # Live 3-agent debate (SSE consumer)
│   │       ├── SynthesisScreen.jsx
│   │       ├── LearningGPS.jsx
│   │       ├── FlashQuiz.jsx
│   │       ├── TheExaminer.jsx
│   │       ├── AIWhiteboard.jsx   # Excalidraw + Gemma 4 vision chat
│   │       ├── MicButton.jsx      # Web Speech API voice input
│   │       └── NotesPanel.jsx
│   ├── vite.config.js
│   └── package.json
└── README.md
```

---

## License

This project is licensed under the **Creative Commons Attribution 4.0 International (CC-BY 4.0)** license, as required by the Gemma 4 Good Hackathon competition rules.

You are free to share and adapt this work for any purpose, including commercially, as long as you give appropriate credit.

**[View the full license →](https://creativecommons.org/licenses/by/4.0/)**
