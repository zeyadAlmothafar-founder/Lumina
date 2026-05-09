import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI;
function getClient() {
  if (!genAI) genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
  return genAI;
}

function model(maxTokens = 1024, systemInstruction) {
  return getClient().getGenerativeModel({
    model: process.env.GEMMA_MODEL || 'gemma-4-31b-it',
    generationConfig: { maxOutputTokens: maxTokens },
    ...(systemInstruction ? { systemInstruction } : {}),
  });
}

// Retry wrapper — handles intermittent Gemma 4 API failures (500s, stream parse errors)
async function withRetry(fn, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err) {
      const msg = String(err?.message || '');
      const isRetryable = err?.status === 500
        || msg.includes('500')
        || msg.includes('parse stream')
        || msg.includes('Failed to parse')
        || msg.includes('UNAVAILABLE')
        || msg.includes('503');
      if (isRetryable && i < attempts - 1) {
        await new Promise(r => setTimeout(r, 1500 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
}

// ── Localization helpers ──────────────────────────────────────────────────────

// History section labels per language
const H = {
  en: { round: 'Round', interrupt: 'Student interrupted', devil: 'Critical Challenger', consensus: 'Consensus Builder', fact: 'Fact-Checker', history: 'Debate history so far' },
  es: { round: 'Ronda', interrupt: 'El estudiante interrumpió', devil: 'Desafiador Crítico', consensus: 'Constructor de Consenso', fact: 'Verificador de Hechos', history: 'Historial del debate hasta ahora' },
  ar: { round: 'الجولة', interrupt: 'تدخّل الطالب', devil: 'المتحدي الناقد', consensus: 'باني التوافق', fact: 'مدقق الحقائق', history: 'سجل النقاش حتى الآن' },
};

function formatHistory(history, lang = 'en') {
  const l = H[lang] || H.en;
  return history.map(h => {
    let s = `--- ${l.round} ${h.round} ---\n`;
    if (h.interrupt) s += `[${l.interrupt}]: "${h.interrupt}"\n`;
    s += `${l.devil}: ${h.devil}\n`;
    s += `${l.consensus}: ${h.consensus}\n`;
    s += `${l.fact}: ${h.factchecker}\n`;
    return s;
  }).join('\n');
}

// Pre-filled model "acknowledgment" — primes it to respond directly, not echo the role
const READY = {
  en: 'Understood. Ready.',
  es: 'Entendido. Listo.',
  ar: 'مفهوم. جاهز.',
};

// Final trigger message per language
const TRIGGER = {
  en: (n) => `Write your Round ${n} argument. Start directly — no role introduction, no preamble.`,
  es: (n) => `Escribe tu argumento de la Ronda ${n}. Empieza directamente — sin introducción ni preámbulo.`,
  ar: (n) => `اكتب حجتك في الجولة ${n}. ابدأ مباشرةً — بدون مقدمة أو وصف للدور.`,
};

// ── Role prompts — written in the target language ─────────────────────────────

const ROLES = {
  devil: (topic, history, interrupt, lang) => {
    const l = H[lang] || H.en;
    const hist = history.length
      ? `\n\n${l.history}:\n${formatHistory(history, lang)}`
      : '';
    const int = interrupt ? `\n\n${l.interrupt}: "${interrupt}"` : '';

    if (lang === 'ar') return `أنت **المتحدي الناقد** في نقاش تعليمي منظم.

الموضوع: ${topic}

مهمتك:
- تحدّ الموقف الأكثر قبولاً بصرامة فكرية
- اكشف الأخطاء المنطقية والعواقب غير المدروسة
- لا تتنازل دون تقديم حجة مضادة أقوى
- استخدم **الخط العريض** للمطالبات الرئيسية
- اكتب 2-3 فقرات واضحة بتنسيق markdown${hist}${int}`;

    if (lang === 'es') return `Eres el **Desafiador Crítico** en un debate educativo estructurado.

Tema: ${topic}

Tu misión:
- Desafiar rigurosamente la posición más aceptada
- Encontrar fallas lógicas y consecuencias ignoradas
- Nunca ceder sin un contraargumento más sólido
- Usar **negrita** para afirmaciones clave
- Escribir 2-3 párrafos claros con formato markdown${hist}${int}`;

    return `You are the **Critical Challenger** in a structured educational debate.

Topic: ${topic}

Your role:
- Rigorously challenge the most widely accepted position
- Expose logical flaws and unconsidered consequences
- Never concede without a stronger counter-argument
- Use **bold** for key claims
- Write 2-3 clear paragraphs using markdown formatting${hist}${int}`;
  },

  consensus: (topic, history, interrupt, lang) => {
    const l = H[lang] || H.en;
    const hist = history.length
      ? `\n\n${l.history}:\n${formatHistory(history, lang)}`
      : '';
    const int = interrupt ? `\n\n${l.interrupt}: "${interrupt}"` : '';

    if (lang === 'ar') return `أنت **باني التوافق** في نقاش تعليمي منظم.

الموضوع: ${topic}

مهمتك:
- ابحث عن الحقيقة في كل موقف — تفهّم عميق لا توازن زائف
- اعترف بأقوى النقاط من جميع الجوانب
- كن حاسماً حين يكون أحد الجانبين أقوى وضوحاً
- استخدم **الخط العريض** للرؤى الرئيسية
- اكتب 2-3 فقرات واضحة بتنسيق markdown${hist}${int}`;

    if (lang === 'es') return `Eres el **Constructor de Consenso** en un debate educativo estructurado.

Tema: ${topic}

Tu misión:
- Encontrar la verdad en cada posición — comprensión profunda, no falso equilibrio
- Reconocer los puntos más fuertes de todos los lados
- Ser decisivo cuando un lado sea claramente más sólido
- Usar **negrita** para ideas clave
- Escribir 2-3 párrafos claros con formato markdown${hist}${int}`;

    return `You are the **Consensus Builder** in a structured educational debate.

Topic: ${topic}

Your role:
- Find the truth in every position — seek nuanced understanding, not false balance
- Acknowledge the strongest points from all sides
- Be decisive when one side is clearly stronger
- Use **bold** for key insights
- Write 2-3 clear paragraphs using markdown formatting${hist}${int}`;
  },

  factchecker: (topic, ragDocs, history, interrupt, lang) => {
    const l = H[lang] || H.en;
    const hist = history.length
      ? `\n\n${l.history}:\n${formatHistory(history, lang)}`
      : '';
    const int = interrupt ? `\n\n${l.interrupt}: "${interrupt}"` : '';
    const docs = ragDocs.map(d => `[${d.title}]: ${d.extract}`).join('\n\n');

    const sourceLabel = lang === 'ar' ? 'المصدر' : lang === 'es' ? 'Fuente' : 'Source';
    const docsLabel   = lang === 'ar' ? 'المستندات المسترجعة' : lang === 'es' ? 'Documentos recuperados' : 'Retrieved documents';
    const round1      = lang === 'ar' ? 'الجولة الأولى: أرسّخ النقاش في الحقائق أعلاه.'
                      : lang === 'es' ? 'Ronda 1: Fundamenta el debate en los hechos anteriores.'
                      : 'Round 1: Ground the debate in the facts above.';

    if (lang === 'ar') return `أنت **مدقق الحقائق** في نقاش تعليمي منظم.

الموضوع: ${topic}

مهمتك:
- اذكر فقط ادعاءات قابلة للتحقق — بعد كل جملة حقيقية اكتب [${sourceLabel}: العنوان]
- تحدّ الادعاءات غير الموثقة من العوامل الأخرى صراحةً
- استخدم **الخط العريض** للحقائق الرئيسية
- اكتب 2-3 فقرات واضحة بتنسيق markdown

${docsLabel}:
${docs}
${history.length ? hist : `\n${round1}`}${int}`;

    if (lang === 'es') return `Eres el **Verificador de Hechos** en un debate educativo estructurado.

Tema: ${topic}

Tu misión:
- Solo hacer afirmaciones verificables — después de cada dato escribe [${sourceLabel}: Título]
- Desafiar explícitamente afirmaciones sin respaldo de los otros agentes
- Usar **negrita** para hechos clave
- Escribir 2-3 párrafos claros con formato markdown

${docsLabel}:
${docs}
${history.length ? hist : `\n${round1}`}${int}`;

    return `You are the **Fact-Checker** in a structured educational debate.

Topic: ${topic}

Your role:
- Only make verifiable claims — after every factual statement write [${sourceLabel}: Title]
- Explicitly challenge unsupported assertions from other agents
- Use **bold** for key facts
- Write 2-3 clear paragraphs using markdown formatting

${docsLabel}:
${docs}
${history.length ? hist : `\n${round1}`}${int}`;
  },
};

// ── Streaming ─────────────────────────────────────────────────────────────────
// Multi-turn priming: User → role desc | Model → acknowledgment | User → trigger
// This prevents the model from echoing the role description in its output.

async function streamWithRole(roleText, roundNum, onToken, maxTokens = 2048, lang = 'en') {
  const m = model(maxTokens);
  const ready   = READY[lang]   || READY.en;
  const trigger = (TRIGGER[lang] || TRIGGER.en)(roundNum);
  const contents = [
    { role: 'user',  parts: [{ text: roleText.trim() }] },
    { role: 'model', parts: [{ text: ready }] },
    { role: 'user',  parts: [{ text: trigger }] },
  ];

  const isRetryable = (err) => {
    const msg = String(err?.message || '');
    return err?.status === 500 || msg.includes('500') || msg.includes('parse')
        || msg.includes('UNAVAILABLE') || msg.includes('503');
  };

  // ── Phase 1: streaming (up to 3 attempts, live tokens) ──────────────────────
  for (let i = 0; i < 3; i++) {
    try {
      const result = await m.generateContentStream({ contents });

      // Attach a silent .catch to the SDK's internal response promise to prevent
      // "Failed to parse stream" from leaking as an unhandledRejection
      result.response?.catch?.(() => {});

      let full = '';
      for await (const chunk of result.stream) {
        const parts = chunk.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
          if (part.thought) continue;
          const text = part.text ?? '';
          if (text) { full += text; if (onToken) onToken(text); }
        }
      }
      return full;
    } catch (err) {
      if (!isRetryable(err) || i === 2) break;   // give up streaming, fall through
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // ── Phase 2: non-streaming fallback (more reliable, no parse-stream issues) ──
  for (let i = 0; i < 5; i++) {
    try {
      const result = await m.generateContent({ contents });
      const parts  = result.response.candidates?.[0]?.content?.parts ?? [];
      const text   = parts.filter(p => !p.thought).map(p => p.text ?? '').join('')
                   || result.response.text();
      if (text && onToken) onToken(text);   // send as one block
      return text;
    } catch (err) {
      if (!isRetryable(err) || i === 4) throw err;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

export async function generateDebateRound(agentType, session, roundNum, interrupt, onToken) {
  const lang = session.language || 'en';
  const roleText = agentType === 'factchecker'
    ? ROLES.factchecker(session.topic, session.ragDocs, session.history, interrupt, lang)
    : ROLES[agentType](session.topic, session.history, interrupt, lang);

  return streamWithRole(roleText, roundNum, onToken, 2048, lang);
}

// ── Synthesis ─────────────────────────────────────────────────────────────────

export async function generateSynthesis(session) {
  const lang = session.language || 'en';

  const SYNTH_ROLE = {
    en: `You are an academic writing coach. Produce a structured Markdown essay outline from the debate transcript below.

Exact structure required:
# [Nuanced thesis that acknowledges complexity]

## Body 1: [Perspective name]
- [Specific claim with evidence]
- [Specific claim with evidence]

## Body 2: [Perspective name]
- ...

## Body 3: [Perspective name]
- ...

## Conclusion
[Synthesis paragraph — do NOT restate thesis]

Rules: use [Source: Title] citations from the Fact-Checker. Output ONLY the outline — no preamble.`,

    es: `Eres un coach de escritura académica. Produce un esquema de ensayo en Markdown a partir del debate.

Estructura exacta requerida:
# [Tesis matizada que reconoce la complejidad]

## Cuerpo 1: [Nombre de perspectiva]
- [Afirmación específica con evidencia]
- [Afirmación específica con evidencia]

## Cuerpo 2: [Nombre de perspectiva]
- ...

## Cuerpo 3: [Nombre de perspectiva]
- ...

## Conclusión
[Párrafo de síntesis — NO restate la tesis]

Reglas: usa citas [Fuente: Título] del Verificador. Entrega SOLO el esquema — sin preámbulo.`,

    ar: `أنت مدرّب كتابة أكاديمية. أنتج مخططاً للمقال بتنسيق Markdown من سجل النقاش.

الهيكل المطلوب:
# [أطروحة دقيقة تعترف بالتعقيد]

## الجزء الأول: [اسم المنظور]
- [ادعاء محدد مع دليل]
- [ادعاء محدد مع دليل]

## الجزء الثاني: [اسم المنظور]
- ...

## الجزء الثالث: [اسم المنظور]
- ...

## الخاتمة
[فقرة تركيبية — لا تُعد صياغة الأطروحة]

القواعد: استخدم اقتباسات [المصدر: العنوان] من مدقق الحقائق. أخرج المخطط فقط — بدون مقدمة.`,
  };

  const SYNTH_TRIGGER = {
    en: (t) => `Here is the debate transcript. Produce the essay outline now.\n\n${t}`,
    es: (t) => `Aquí está la transcripción del debate. Produce el esquema ahora.\n\n${t}`,
    ar: (t) => `هذا سجل النقاش. أنتج مخطط المقال الآن.\n\n${t}`,
  };

  const l = H[lang] || H.en;
  const transcript = `${lang === 'ar' ? 'الموضوع' : lang === 'es' ? 'Tema' : 'Topic'}: ${session.topic}\n\n`
    + session.history.map(h => {
        let s = `### ${l.round} ${h.round}\n`;
        if (h.interrupt) s += `**${l.interrupt}:** ${h.interrupt}\n\n`;
        s += `**${l.devil}:** ${h.devil}\n\n`;
        s += `**${l.consensus}:** ${h.consensus}\n\n`;
        s += `**${l.fact}:** ${h.factchecker}\n`;
        return s;
      }).join('\n---\n\n');

  const roleText = (SYNTH_ROLE[lang] || SYNTH_ROLE.en).trim();
  const triggerFn = SYNTH_TRIGGER[lang] || SYNTH_TRIGGER.en;
  const ready = READY[lang] || READY.en;

  const m2 = model(2048);
  return withRetry(async () => {
    const result = await m2.generateContent({
      contents: [
        { role: 'user',  parts: [{ text: roleText }] },
        { role: 'model', parts: [{ text: ready }] },
        { role: 'user',  parts: [{ text: triggerFn(transcript) }] },
      ],
    });
    // Filter out thought/thinking parts — only return actual response text
    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    const raw = parts.filter(p => !p.thought).map(p => p.text ?? '').join('')
                || result.response.text();

    // Strip any preamble before the first markdown heading (#) — the model sometimes
    // outputs its role description / planning before the actual outline starts
    const headingIdx = raw.indexOf('#');
    return headingIdx > 0 ? raw.slice(headingIdx) : raw;
  });
}

// transcribeAudio removed — Gemma 4 31B does not support audio input.
// Voice transcription is now handled in-browser via the Web Speech API (MicButton.jsx).
