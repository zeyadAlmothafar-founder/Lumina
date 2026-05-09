import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI;
function getClient() {
  if (!genAI) genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
  return genAI;
}
function gemma(maxTokens = 2048, systemInstruction, jsonMode = false) {
  return getClient().getGenerativeModel({
    model: process.env.GEMMA_MODEL || 'gemma-4-31b-it',
    generationConfig: {
      maxOutputTokens: maxTokens,
      // Hard API-level constraint: forces raw JSON output, prevents echo/summary
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
    ...(systemInstruction ? { systemInstruction } : {}),
  });
}

// Retry wrapper for transient 500s and non-JSON echo responses from the Gemma API.
// Uses exponential backoff starting at 2 s (2 s → 4 s → 6 s → 8 s → throw).
async function withRetry(fn, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err) {
      const msg = String(err?.message || '');
      const isRetryable = err?.status === 500
        || msg.includes('500')
        || msg.includes('non-JSON')
        || msg.includes('UNAVAILABLE')
        || msg.includes('503');
      if (isRetryable && i < attempts - 1) {
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
}

// Language name helper
const LANG_NAMES = { en: 'English', es: 'Spanish', ar: 'Arabic' };
function langNote(lang) {
  if (!lang || lang === 'en') return '';
  return `\n\nIMPORTANT: All text content in your JSON response (questions, answers, explanations, feedback, summaries, recommendations, etc.) MUST be written entirely in ${LANG_NAMES[lang] || lang}.`;
}

// Robust JSON extractor — strips preamble/echo text before JSON
function parseJSON(raw) {
  let s = raw.trim();
  // Strip all ``` fences (including mid-string ones)
  s = s.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
  // Try direct parse
  try { return JSON.parse(s); } catch {}
  // Extract outermost { } block (handles preamble echo before JSON)
  const start = s.indexOf('{');
  const end   = s.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(s.slice(start, end + 1)); } catch {}
  }
  // Extract outermost [ ] block
  const aStart = s.indexOf('[');
  const aEnd   = s.lastIndexOf(']');
  if (aStart !== -1 && aEnd > aStart) {
    try { return JSON.parse(s.slice(aStart, aEnd + 1)); } catch {}
  }
  throw new Error('Gemma returned non-JSON: ' + s.slice(0, 300));
}

// Uses systemInstruction (officially supported in Gemma 4 via Gemini API).
// Schema goes in systemInstruction; user prompt is kept minimal (just input data).
// This prevents Gemma from echoing/summarising the schema instead of filling it in.
async function callJSON(systemPromptWithSchema, userDataPrompt, maxTokens = 2048) {
  // jsonMode=true sets responseMimeType:'application/json' — a hard API constraint
  // that forces JSON output regardless of what the model "wants" to say.
  // This is more reliable than any system-prompt instruction alone.
  const m = gemma(maxTokens, systemPromptWithSchema.trim(), true);

  return withRetry(async () => {
    const result = await m.generateContent({
      contents: [{ role: 'user', parts: [{ text: userDataPrompt }] }],
    });
    return parseJSON(result.response.text());
  });
}

// ── LEARNING GPS ─────────────────────────────────────────────────────────────

export async function generateRoadmap({ goal, weeks, hoursPerDay, language = 'en' }) {
  // Schema lives in systemInstruction — keeps the user prompt minimal so Gemma
  // fills the structure in rather than echoing/describing it.
  const systemPrompt = `You are an expert curriculum designer.
When given a learning goal, output a JSON object with EXACTLY these fields:
  "title": string — short catchy title
  "overview": string — 2 sentences on what the learner will achieve
  "prerequisites": array of strings — prior knowledge needed (empty array if none)
  "weeks": array — one object per week, each with:
    "week": integer
    "theme": string
    "topics": array of 3-4 strings
    "dailyFocus": string — one sentence on daily practice
    "resources": array of 2 strings (book names, search terms, or URLs)
    "milestone": string — concrete deliverable by week end
    "checkpoint": string — one self-test question
  "finalOutcome": string — what the learner can build/do by the end
${langNote(language)}`;

  const userPrompt = `Learning goal: "${goal}"
Weeks: ${weeks}
Hours per day: ${hoursPerDay}
Generate ${weeks} week objects.`;

  return callJSON(systemPrompt, userPrompt, 2048);
}

// ── FLASH & QUIZ ─────────────────────────────────────────────────────────────

export async function generateFlashcards({ topic, count = 10, language = 'en' }) {
  const systemPrompt = `You are a master educator specialising in spaced-repetition flashcard creation.
Output a JSON array of exactly the requested number of flashcard objects.
Each object has these fields:
  "id": integer starting at 1
  "question": string — clear, specific question
  "answer": string — concise correct answer (1-2 sentences)
  "explanation": string — brief explanation with context (2-3 sentences)
  "difficulty": one of "easy", "medium", or "hard"
Mix: ~30% easy, ~50% medium, ~20% hard.
${langNote(language)}`;

  const userPrompt = `Topic: "${topic}"
Number of flashcards: ${count}`;

  return callJSON(systemPrompt, userPrompt, 2048);
}

// ── THE EXAMINER ─────────────────────────────────────────────────────────────

export async function generateFirstQuestion({ subject, difficulty, language = 'en' }) {
  const systemPrompt = `You are a strict but fair academic examiner.
Output a JSON object with exactly these fields:
  "question": string — the exam question text
  "type": one of "short_answer", "scenario", "definition", or "application"
  "hint": string — subtle hint, or empty string if none
Make the question appropriately challenging for the given difficulty level.
${langNote(language)}`;

  const userPrompt = `Subject: "${subject}"
Difficulty: ${difficulty}
Generate the first exam question.`;

  return callJSON(systemPrompt, userPrompt, 512);
}

export async function evaluateAndContinue({ subject, difficulty, history, totalQuestions, language = 'en' }) {
  const isLast = history.filter(h => h.score != null).length >= totalQuestions - 1;

  const systemPrompt = isLast
    ? `You are a strict but constructive academic examiner evaluating the final answer of an exam.
Output a JSON object with these fields:
  "score": integer 0-10
  "feedback": string — specific, constructive 2-3 sentence feedback on the last answer
  "correctAnswer": string — the ideal answer to the last question
  "isLast": true
  "report": object with:
    "overallScore": number to 1 decimal (average of all scores)
    "grade": one of "A", "B", "C", "D", "F"
    "summary": string — 2-sentence overall performance summary
    "strengths": array of 2-3 strength strings
    "areasToImprove": array of 2-3 improvement area strings
    "studyRecommendations": array of 3 specific study recommendation strings
${langNote(language)}`
    : `You are a strict but constructive academic examiner.
Evaluate the student's last answer and generate an adaptive next question.
Output a JSON object with these fields:
  "score": integer 0-10
  "feedback": string — specific, constructive 2-3 sentence feedback
  "correctAnswer": string — the ideal answer
  "isLast": false
  "nextQuestion": object with:
    "question": string — next exam question (harder if score≥7, probing the gap if score<7)
    "type": one of "short_answer", "scenario", "definition", "application"
    "hint": string — subtle hint, or empty string
${langNote(language)}`;

  const historyText = history.map((h, i) =>
    `[Q${i + 1}] ${h.question} | Answer: ${h.answer ?? '(none)'} | Score: ${h.score ?? 'pending'}/10`
  ).join('\n');

  const userPrompt = `OUTPUT ONLY JSON. Do not echo, repeat, or summarize this input.

subject="${subject}" difficulty="${difficulty}" evaluating=Q${history.length} of ${history.length}/${totalQuestions}

${historyText}`;

  return callJSON(systemPrompt, userPrompt, 1024);
}

// ── IMAGE-BASED FLASHCARD GENERATION ─────────────────────────────────────────

export async function generateFlashcardsFromImages({ images, count = 10, language = 'en' }) {
  const sysPrompt = `You are a master educator specialising in spaced-repetition flashcard creation.
You will receive images of handwritten or printed study notes. Read all visible content and produce flashcards.
Output a JSON array of exactly ${count} flashcard objects.
Each object has these fields:
  "id": integer starting at 1
  "question": string — clear question derived from the notes
  "answer": string — concise correct answer (1-2 sentences)
  "explanation": string — brief explanation with context (2-3 sentences)
  "difficulty": one of "easy", "medium", or "hard"
Mix: ~30% easy, ~50% medium, ~20% hard.
${langNote(language)}`;

  const parts = [
    { text: `Attached are ${images.length} image(s) of study notes. Generate ${count} flashcards from the content.` },
    ...images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
  ];

  const m = gemma(2048, sysPrompt, true); // jsonMode
  return withRetry(async () => {
    const result = await m.generateContent({
      contents: [{ role: 'user', parts }],
    });
    return parseJSON(result.response.text());
  });
}

// ── AI WHITEBOARD CHAT ────────────────────────────────────────────────────────

export async function chatWithWhiteboard({ message, imageBase64, mimeType = 'image/png', history = [], language = 'en' }) {
  const systemPrompt = `You are a visual AI learning assistant embedded in a whiteboard tool for students.
Students share screenshots of their whiteboard — which may contain diagrams, equations, sketches, mind maps, handwritten notes, graphs, or text — and ask questions about it.

Your role:
- Analyse the whiteboard content carefully and completely before answering
- Describe what you see when asked, including all text, symbols, and drawings
- Help explain concepts, verify student work, suggest corrections, and provide hints
- Be educational, precise, and encouraging — you are helping a student learn
- When making factual claims, add a brief [Source: topic] marker
- If the whiteboard is blank or unclear, say so and invite the student to add content

Formatting rules (STRICTLY FOLLOW):
- Use Markdown: ## headings, **bold**, *italic*, bullet lists, numbered lists
- NEVER wrap your response in triple backticks (\`\`\`). Do NOT use code blocks for text analysis or explanations
- Only use inline \`code\` or code blocks for actual code snippets or mathematical notation that requires it
- Structure longer answers with clear headings and bullet points
${langNote(language)}`;

  // Reconstruct multi-turn history for the API (text only — images are only in the current turn)
  const historyContents = history
    .filter(h => h.role && h.text)
    .map(h => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: h.text }],
    }));

  // Current user turn: optional image + text
  const currentParts = [];
  if (imageBase64) {
    currentParts.push({ inlineData: { mimeType, data: imageBase64 } });
  }
  currentParts.push({ text: message?.trim() || 'What can you see on my whiteboard? Please describe and explain it.' });

  const contents = [
    ...historyContents,
    { role: 'user', parts: currentParts },
  ];

  const m = gemma(2048, systemPrompt.trim());
  return withRetry(async () => {
    const result = await m.generateContent({ contents });
    // Filter out thinking/reasoning tokens (part.thought === true) — same fix as debate agents
    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter(p => !p.thought).map(p => p.text ?? '').join('').trim();
    return text || result.response.text().trim(); // fallback if no parts (shouldn't happen)
  });
}

// ── HANDWRITING TRANSCRIPTION ─────────────────────────────────────────────────

export async function transcribeHandwriting({ imageBase64, mimeType }) {
  const sysPrompt = `You are an OCR assistant. Your only task is to read handwritten text from an image and transcribe it verbatim. Output ONLY the transcribed text — no preamble, no explanation, no formatting.`;

  const m = gemma(512, sysPrompt);
  return withRetry(async () => {
    const result = await m.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: 'Transcribe all the handwritten text you can see in this image.' },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      }],
    });
    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter(p => !p.thought).map(p => p.text ?? '').join('').trim();
    return text || result.response.text().trim();
  });
}
