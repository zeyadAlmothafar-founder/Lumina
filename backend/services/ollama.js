// Ollama local inference — same function signatures as tools.js + gemma.js
// Calls the Ollama native chat API (http://localhost:11434/api/chat)

const OLLAMA_BASE  = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL_LOCAL || 'gemma4';

const LANG_NAMES = { en: 'English', es: 'Spanish', ar: 'Arabic' };

// ── Core request helpers ──────────────────────────────────────────────────────

async function ollamaChat(messages, { jsonMode = false, maxTokens = 2048 } = {}) {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:   OLLAMA_MODEL,
      messages,
      stream:  false,
      options: { num_predict: maxTokens },
      ...(jsonMode ? { format: 'json' } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return data.message?.content ?? '';
}

async function ollamaChatStream(messages, onToken, { maxTokens = 2048 } = {}) {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:   OLLAMA_MODEL,
      messages,
      stream:  true,
      options: { num_predict: maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${res.statusText}`);

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value, { stream: true }).split('\n')) {
      if (!line.trim()) continue;
      try {
        const chunk = JSON.parse(line);
        const token = chunk.message?.content ?? '';
        if (token) { full += token; if (onToken) onToken(token); }
      } catch {}
    }
  }
  return full;
}

function parseJSON(raw) {
  let s = raw.trim().replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
  try { return JSON.parse(s); } catch {}
  const obj = s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1);
  if (obj) try { return JSON.parse(obj); } catch {}
  const arr = s.slice(s.indexOf('['), s.lastIndexOf(']') + 1);
  if (arr) try { return JSON.parse(arr); } catch {}
  throw new Error('Ollama returned non-JSON: ' + s.slice(0, 300));
}

function langNote(lang) {
  if (!lang || lang === 'en') return '';
  return ` Respond entirely in ${LANG_NAMES[lang] || lang}.`;
}

// ── Learning GPS ──────────────────────────────────────────────────────────────

export async function generateRoadmap({ goal, weeks, hoursPerDay, language = 'en' }) {
  const raw = await ollamaChat([
    {
      role: 'system',
      content: `You are an expert curriculum designer. Output ONLY valid JSON with fields: "title" (string), "overview" (string), "prerequisites" (string[]), "weeks" (array of {week, theme, topics, dailyFocus, resources, milestone, checkpoint}), "finalOutcome" (string).${langNote(language)}`,
    },
    {
      role: 'user',
      content: `Learning goal: "${goal}" | Weeks: ${weeks} | Hours/day: ${hoursPerDay}. Generate exactly ${weeks} week objects. OUTPUT ONLY JSON.`,
    },
  ], { jsonMode: true, maxTokens: 3000 });
  return parseJSON(raw);
}

// ── Flash & Quiz ──────────────────────────────────────────────────────────────

export async function generateFlashcards({ topic, count = 10, language = 'en' }) {
  const raw = await ollamaChat([
    {
      role: 'system',
      content: `You are a flashcard expert. Output ONLY a JSON array of exactly ${count} objects, each with: "id" (int), "question" (string), "answer" (string), "explanation" (string), "difficulty" ("easy"|"medium"|"hard"). Mix: ~30% easy, ~50% medium, ~20% hard.${langNote(language)}`,
    },
    {
      role: 'user',
      content: `Topic: "${topic}" | Cards: ${count}. OUTPUT ONLY JSON ARRAY.`,
    },
  ], { jsonMode: true, maxTokens: 3000 });
  return parseJSON(raw);
}

export async function generateFlashcardsFromImages({ images, count = 10, language = 'en' }) {
  // Ollama vision — requires a multimodal model (e.g. gemma4 with vision weights)
  const raw = await ollamaChat([
    {
      role: 'system',
      content: `You are a flashcard expert. Read all visible content in the attached images. Output ONLY a JSON array of exactly ${count} flashcard objects, each with: "id", "question", "answer", "explanation", "difficulty".${langNote(language)}`,
    },
    {
      role: 'user',
      content: `Generate ${count} flashcards from the content in these images. OUTPUT ONLY JSON ARRAY.`,
      images: images.map(img => img.data),
    },
  ], { jsonMode: true, maxTokens: 3000 });
  return parseJSON(raw);
}

// ── The Examiner ──────────────────────────────────────────────────────────────

export async function generateFirstQuestion({ subject, difficulty, language = 'en' }) {
  const raw = await ollamaChat([
    {
      role: 'system',
      content: `You are an academic examiner. Output ONLY a JSON object with: "question" (string), "type" ("short_answer"|"scenario"|"definition"|"application"), "hint" (string, may be empty).${langNote(language)}`,
    },
    {
      role: 'user',
      content: `Subject: "${subject}" | Difficulty: ${difficulty}. Generate the first exam question. OUTPUT ONLY JSON.`,
    },
  ], { jsonMode: true, maxTokens: 512 });
  return parseJSON(raw);
}

export async function evaluateAndContinue({ subject, difficulty, history, totalQuestions, language = 'en' }) {
  const isLast = history.filter(h => h.score != null).length >= totalQuestions - 1;

  const historyText = history.map((h, i) =>
    `[Q${i + 1}] ${h.question} | Answer: ${h.answer ?? '(none)'} | Score: ${h.score ?? 'pending'}/10`
  ).join('\n');

  const schema = isLast
    ? `{"score":int,"feedback":string,"correctAnswer":string,"isLast":true,"report":{"overallScore":number,"grade":"A|B|C|D|F","summary":string,"strengths":[string],"areasToImprove":[string],"studyRecommendations":[string]}}`
    : `{"score":int,"feedback":string,"correctAnswer":string,"isLast":false,"nextQuestion":{"question":string,"type":string,"hint":string}}`;

  const raw = await ollamaChat([
    {
      role: 'system',
      content: `You are an academic examiner. OUTPUT ONLY JSON matching: ${schema}${langNote(language)}`,
    },
    {
      role: 'user',
      content: `OUTPUT ONLY JSON. subject="${subject}" difficulty="${difficulty}" Q${history.length}/${totalQuestions}\n\n${historyText}`,
    },
  ], { jsonMode: true, maxTokens: 1024 });
  return parseJSON(raw);
}

export async function transcribeHandwriting({ imageBase64, mimeType }) {
  return ollamaChat([
    {
      role: 'user',
      content: 'Transcribe all handwritten text in this image. Output ONLY the transcribed text, nothing else.',
      images: [imageBase64],
    },
  ], { maxTokens: 512 });
}

// ── AI Whiteboard ─────────────────────────────────────────────────────────────

export async function chatWithWhiteboard({ message, imageBase64, history = [], language = 'en' }) {
  const historyMessages = history
    .filter(h => h.role && h.text)
    .map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text }));

  const userMsg = imageBase64
    ? { role: 'user', content: message?.trim() || 'What can you see on my whiteboard?', images: [imageBase64] }
    : { role: 'user', content: message?.trim() || 'What can you see on my whiteboard?' };

  return ollamaChat([
    {
      role: 'system',
      content: `You are a visual AI learning assistant in a whiteboard tool. Use Markdown. NEVER wrap responses in triple backticks.${language !== 'en' ? ` Respond in ${LANG_NAMES[language] || language}.` : ''}`,
    },
    ...historyMessages,
    userMsg,
  ], { maxTokens: 2048 });
}

// ── Debate agents (called sequentially by server.js in local mode) ────────────

const AGENT_SYSTEM = {
  devil: (topic, hist, interrupt, lang) =>
    `You are the **Critical Challenger** in a structured educational debate.\nTopic: ${topic}\nChallenge the mainstream position rigorously. Use **bold** for key claims. Write 2-3 paragraphs in markdown.${hist}${interrupt ? `\n\nStudent interrupted: "${interrupt}"` : ''}${lang !== 'en' ? `\n\nRespond in ${LANG_NAMES[lang]}.` : ''}`,

  consensus: (topic, hist, interrupt, lang) =>
    `You are the **Consensus Builder** in a structured educational debate.\nTopic: ${topic}\nFind truth in every perspective. Use **bold** for key insights. Write 2-3 paragraphs in markdown.${hist}${interrupt ? `\n\nStudent interrupted: "${interrupt}"` : ''}${lang !== 'en' ? `\n\nRespond in ${LANG_NAMES[lang]}.` : ''}`,

  factchecker: (topic, hist, interrupt, ragDocs, lang) => {
    const docs = ragDocs?.length
      ? '\n\nRetrieved sources:\n' + ragDocs.map(d => `[${d.title}]: ${d.extract}`).join('\n\n')
      : '';
    return `You are the **Fact-Checker** in a structured educational debate.\nTopic: ${topic}\nOnly make verifiable claims — cite each with [Source: Title]. Use **bold** for key facts. Write 2-3 paragraphs in markdown.${docs}${hist}${interrupt ? `\n\nStudent interrupted: "${interrupt}"` : ''}${lang !== 'en' ? `\n\nRespond in ${LANG_NAMES[lang]}.` : ''}`;
  },
};

export async function generateDebateRound(agentType, session, roundNum, interrupt, onToken) {
  const lang = session.language || 'en';
  const hist = session.history.length
    ? '\n\nDebate so far:\n' + session.history.map(h =>
        `--- Round ${h.round} ---\nCritical Challenger: ${h.devil}\nConsensus Builder: ${h.consensus}\nFact-Checker: ${h.factchecker}`
      ).join('\n\n')
    : '';

  const system = agentType === 'factchecker'
    ? AGENT_SYSTEM.factchecker(session.topic, hist, interrupt, session.ragDocs, lang)
    : AGENT_SYSTEM[agentType](session.topic, hist, interrupt, lang);

  return ollamaChatStream([
    { role: 'system', content: system },
    { role: 'user',   content: `Write your Round ${roundNum} argument. Start directly — no preamble.` },
  ], onToken, { maxTokens: 2048 });
}

export async function generateSynthesis(session) {
  const lang = session.language || 'en';
  const transcript = session.history.map(h =>
    `### Round ${h.round}\n**Critical Challenger:** ${h.devil}\n\n**Consensus Builder:** ${h.consensus}\n\n**Fact-Checker:** ${h.factchecker}`
  ).join('\n\n---\n\n');

  const raw = await ollamaChat([
    {
      role: 'system',
      content: `You are an academic writing coach. Produce a structured Markdown essay outline from the debate transcript. Structure: # [thesis], ## Body 1, ## Body 2, ## Body 3, ## Conclusion. Use [Source: Title] citations. Output ONLY the outline.${lang !== 'en' ? ` Write in ${LANG_NAMES[lang]}.` : ''}`,
    },
    {
      role: 'user',
      content: `Topic: ${session.topic}\n\n${transcript}`,
    },
  ], { maxTokens: 2048 });

  const idx = raw.indexOf('#');
  return idx > 0 ? raw.slice(idx) : raw;
}
