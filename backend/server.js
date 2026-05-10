import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { searchWikipedia, fetchExtracts } from './services/wikipedia.js';
import { generateDebateRound, generateSynthesis } from './services/gemma.js';
import { generateDocx } from './services/docx.js';
import { generateRoadmap, generateFlashcards, generateFirstQuestion, evaluateAndContinue, generateFlashcardsFromImages, transcribeHandwriting, chatWithWhiteboard } from './services/tools.js';
import * as ollamaService from './services/ollama.js';

// Pick the right service based on the X-Inference-Mode request header
function svc(req) {
  return req.headers['x-inference-mode'] === 'local' ? ollamaService : null;
}
// Shorthand tool-function resolver
function tool(req, name) {
  const s = svc(req);
  if (s) return s[name].bind(s);
  const tools = { generateRoadmap, generateFlashcards, generateFirstQuestion, evaluateAndContinue, generateFlashcardsFromImages, transcribeHandwriting, chatWithWhiteboard };
  return tools[name];
}

// Prevent stray rejected promises from crashing the server
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '8mb' })); // whiteboard screenshots can be a few MB as base64

// ── LEARNING GPS ──────────────────────────────────────────────────────────────
app.post('/api/gps/generate', async (req, res) => {
  const { goal, weeks = 4, hoursPerDay = 1, language = 'en' } = req.body;
  if (!goal?.trim()) return res.status(400).json({ error: 'Goal is required' });
  try {
    const roadmap = await tool(req, 'generateRoadmap')({ goal: goal.trim(), weeks: Number(weeks), hoursPerDay: Number(hoursPerDay), language });
    res.json(roadmap);
  } catch (err) {
    console.error('[gps]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── FLASH & QUIZ ──────────────────────────────────────────────────────────────
app.post('/api/quiz/generate', async (req, res) => {
  const { topic, count = 10, language = 'en' } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: 'Topic is required' });
  try {
    const cards = await tool(req, 'generateFlashcards')({ topic: topic.trim(), count: Number(count), language });
    res.json({ cards });
  } catch (err) {
    console.error('[quiz]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── FLASH & QUIZ — From Images ────────────────────────────────────────────────
app.post('/api/quiz/from-images', upload.array('images', 5), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No images provided' });
  const { count = 10, language = 'en' } = req.body;
  try {
    const images = req.files.map(f => ({
      mimeType: f.mimetype,
      data: f.buffer.toString('base64'),
    }));
    const cards = await tool(req, 'generateFlashcardsFromImages')({ images, count: Number(count), language });
    res.json({ cards });
  } catch (err) {
    console.error('[quiz/from-images]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── THE EXAMINER ──────────────────────────────────────────────────────────────
const examSessions = new Map();

app.post('/api/examiner/start', async (req, res) => {
  const { subject, difficulty = 'intermediate', totalQuestions = 5, language = 'en' } = req.body;
  if (!subject?.trim()) return res.status(400).json({ error: 'Subject is required' });
  try {
    const firstQ = await tool(req, 'generateFirstQuestion')({ subject: subject.trim(), difficulty, language });
    const sessionId = uuidv4();
    examSessions.set(sessionId, {
      subject: subject.trim(), difficulty, language,
      totalQuestions: Number(totalQuestions),
      history: [{ question: firstQ.question, type: firstQ.type, hint: firstQ.hint, answer: null, score: null }],
    });
    res.json({ sessionId, question: firstQ });
  } catch (err) {
    console.error('[examiner/start]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/examiner/:id/answer', async (req, res) => {
  const session = examSessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const { answer } = req.body;
  if (!answer?.trim()) return res.status(400).json({ error: 'Answer is required' });

  // Store answer on the last unanswered question
  const last = session.history[session.history.length - 1];
  last.answer = answer.trim();

  try {
    const result = await tool(req, 'evaluateAndContinue')({
      subject: session.subject,
      difficulty: session.difficulty,
      history: session.history,
      totalQuestions: session.totalQuestions,
      language: session.language || 'en',
    });

    last.score = result.score;
    last.feedback = result.feedback;
    last.correctAnswer = result.correctAnswer;

    if (!result.isLast && result.nextQuestion) {
      session.history.push({
        question: result.nextQuestion.question,
        type: result.nextQuestion.type,
        hint: result.nextQuestion.hint,
        answer: null,
        score: null,
      });
    }

    res.json(result);
  } catch (err) {
    console.error('[examiner/answer]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/examiner/:id/answer-image', upload.single('image'), async (req, res) => {
  const session = examSessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!req.file) return res.status(400).json({ error: 'No image provided' });

  const last = session.history[session.history.length - 1];

  try {
    // Step 1: transcribe handwriting via Gemma 4 multimodal
    const transcribed = await tool(req, 'transcribeHandwriting')({
      imageBase64: req.file.buffer.toString('base64'),
      mimeType: req.file.mimetype,
    });

    // Step 2: evaluate the transcribed answer using the existing flow
    last.answer = transcribed;

    const result = await tool(req, 'evaluateAndContinue')({
      subject: session.subject,
      difficulty: session.difficulty,
      history: session.history,
      totalQuestions: session.totalQuestions,
      language: session.language || 'en',
    });

    last.score = result.score;
    last.feedback = result.feedback;
    last.correctAnswer = result.correctAnswer;

    if (!result.isLast && result.nextQuestion) {
      session.history.push({
        question: result.nextQuestion.question,
        type: result.nextQuestion.type,
        hint: result.nextQuestion.hint,
        answer: null,
        score: null,
      });
    }

    res.json({ ...result, transcribedAnswer: transcribed });
  } catch (err) {
    console.error('[examiner/answer-image]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── AI WHITEBOARD ─────────────────────────────────────────────────────────────
app.post('/api/whiteboard/chat', async (req, res) => {
  const { message, imageBase64, mimeType = 'image/png', history = [], language = 'en' } = req.body;
  if (!message?.trim() && !imageBase64) {
    return res.status(400).json({ error: 'A message or whiteboard snapshot is required' });
  }
  try {
    const reply = await tool(req, 'chatWithWhiteboard')({
      message: message?.trim() || '',
      imageBase64,
      mimeType,
      history,
      language,
    });
    res.json({ reply });
  } catch (err) {
    console.error('[whiteboard/chat]', err);
    res.status(500).json({ error: err.message });
  }
});

// In-memory session store (sufficient for hackathon demo)
const sessions = new Map();

// ── POST /api/session ─────────────────────────────────────────────────────────
// Creates a session: fetches Wikipedia RAG docs, stores state, returns sessionId
app.post('/api/session', async (req, res) => {
  const { topic, rounds = 4, language = 'en' } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: 'Topic is required' });

  try {
    const titles = await searchWikipedia(topic);
    const ragDocs = await fetchExtracts(titles.slice(0, 3));

    const sessionId = uuidv4();
    sessions.set(sessionId, {
      topic: topic.trim(),
      totalRounds: Number(rounds),
      language,
      ragDocs,
      history: [],
      pendingInterrupt: null,
      firedRounds: new Set(),
      synthesis: null,
    });

    res.json({ sessionId, ragTitles: ragDocs.map(d => d.title) });
  } catch (err) {
    console.error('[session/start]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/session/:id/stream?round=N ──────────────────────────────────────
// SSE: fires round N for the session, streams all 3 agents in parallel
app.get('/api/session/:id/stream', async (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const roundNum = parseInt(req.query.round, 10);
  if (!roundNum || roundNum < 1) return res.status(400).json({ error: 'round query param required' });

  // Idempotency guard — don't re-fire a completed round on reconnect
  if (session.firedRounds.has(roundNum)) {
    return res.status(409).json({ error: `Round ${roundNum} already completed` });
  }
  session.firedRounds.add(roundNum);

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event, data) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Read interrupt text and target agent from query params (set by DebateArena frontend)
  // Express already URL-decodes query params, so use req.query.interrupt directly
  const interrupt = req.query.interrupt || null;
  const interruptTarget = req.query.target || 'all';

  send('round_start', { round: roundNum, interrupt: interrupt ?? null, target: interruptTarget });

  // EventSource cannot set custom headers — accept mode as query param too
  const isLocal = req.headers['x-inference-mode'] === 'local' || req.query.mode === 'local';
  const debateRound = isLocal ? ollamaService.generateDebateRound : generateDebateRound;

  try {
    const agentInterrupt = (agentId) => {
      if (!interrupt) return null;
      if (interruptTarget === 'all' || interruptTarget === agentId) return interrupt;
      return null;
    };

    const runAgent = async (type) => {
      try {
        return await debateRound(
          type, session, roundNum, agentInterrupt(type),
          tok => send('token', { agent: type, text: tok }),
        );
      } catch (err) {
        console.error(`[agent ${type} round=${roundNum}]`, err);
        const errText = `\n\n⚠️ *${err.message}*`;
        send('token', { agent: type, text: errText });
        return errText;
      }
    };

    let devil, consensus, factchecker;

    if (isLocal) {
      // Local Ollama: run sequentially so one model call finishes before the next
      send('local_sequential', { message: 'Running agents sequentially (local mode)…' });
      devil       = await runAgent('devil');
      consensus   = await runAgent('consensus');
      factchecker = await runAgent('factchecker');
    } else {
      // Cloud API: run all three agents in parallel with staggered starts
      const delay = ms => new Promise(r => setTimeout(r, ms));
      [devil, consensus, factchecker] = await Promise.all([
        runAgent('devil'),
        delay(2000).then(() => runAgent('consensus')),
        delay(5000).then(() => runAgent('factchecker')),
      ]);
    }

    session.history.push({ round: roundNum, interrupt, devil, consensus, factchecker });

    send('round_complete', { round: roundNum });
    res.end();
  } catch (err) {
    console.error(`[stream round=${roundNum}]`, err);
    send('error', { message: err.message });
    res.end();
    session.firedRounds.delete(roundNum);
  }
});

// /api/session/:id/voice removed — transcription now handled in-browser via Web Speech API.

// ── POST /api/session/:id/synthesize ─────────────────────────────────────────
// Generates essay outline from full debate transcript
app.post('/api/session/:id/synthesize', async (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!session.history.length) return res.status(400).json({ error: 'No debate history yet' });

  try {
    const synthFn = req.headers['x-inference-mode'] === 'local' ? ollamaService.generateSynthesis : generateSynthesis;
    const outline = await synthFn(session);
    session.synthesis = outline;
    res.json({ outline });
  } catch (err) {
    console.error('[synthesize]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/session/:id/docx ─────────────────────────────────────────────────
// Returns a downloadable DOCX of the essay outline
app.get('/api/session/:id/docx', async (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session?.synthesis) return res.status(404).json({ error: 'No synthesis found for this session' });

  try {
    const buffer = await generateDocx(session.topic, session.synthesis);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="debate-outline.docx"');
    res.send(buffer);
  } catch (err) {
    console.error('[docx]', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`AgentDebate backend → http://localhost:${PORT}`));
