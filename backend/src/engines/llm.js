/**
 * LLM Gateway:
 * 1) DeepSeek / OpenAI (OpenAI-compatible)
 * 2) On failure → offline Python RNN service
 *
 * DeepSeek:
 *   OPENAI_API_KEY / DEEPSEEK_API_KEY
 *   OPENAI_BASE_URL=https://api.deepseek.com
 *   OPENAI_MODEL=deepseek-chat
 *
 * Offline RNN:
 *   OFFLINE_AI_URL=http://127.0.0.1:5005
 *   OFFLINE_AI_KEY=offline-dev-key
 */

const OFFLINE_URL = (process.env.OFFLINE_AI_URL || 'http://127.0.0.1:5005').replace(/\/$/, '');
const OFFLINE_KEY = process.env.OFFLINE_AI_KEY || 'offline-dev-key';

export async function callOfflineRNN(message) {
  try {
    const res = await fetch(`${OFFLINE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Offline-Key': OFFLINE_KEY
      },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) {
      const t = await res.text();
      return { text: null, model: 'offline-char-rnn-v1', usedExternal: false, fallback: true, reason: `RNN HTTP ${res.status}: ${t.slice(0, 120)}` };
    }
    const data = await res.json();
    return {
      text: data.answer || data.text,
      model: data.model || 'offline-char-rnn-v1',
      usedExternal: false,
      fallback: true,
      sources: data.sources || [],
      reason: null
    };
  } catch (e) {
    return {
      text: null,
      model: 'offline-char-rnn-v1',
      usedExternal: false,
      fallback: true,
      reason: `RNN offline: ${e.message || e}`
    };
  }
}

export async function callLLM({ system, user, contextText }) {
  const key = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
  const base = (process.env.OPENAI_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  // No key → go offline RNN immediately
  if (!key) {
    const offline = await callOfflineRNN(user);
    if (offline.text) return offline;
    return {
      text: null,
      model: 'local-kb',
      usedExternal: false,
      fallback: true,
      reason: offline.reason || 'Нет API ключа и offline RNN недоступен'
    };
  }

  try {
    let res = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Контекст графа и RAG:\n${contextText}\n\nВопрос:\n${user}` }
        ]
      }),
      signal: AbortSignal.timeout(45000)
    });

    if (res.status === 404) {
      res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: `Контекст графа и RAG:\n${contextText}\n\nВопрос:\n${user}` }
          ]
        }),
        signal: AbortSignal.timeout(45000)
      });
    }

    if (!res.ok) {
      const err = await res.text();
      const offline = await callOfflineRNN(user);
      if (offline.text) {
        offline.reason = `Основной LLM HTTP ${res.status}; включён offline RNN`;
        return offline;
      }
      return { text: null, model, usedExternal: false, reason: `LLM HTTP ${res.status}: ${err.slice(0, 160)}` };
    }

    const data = await res.json();
    return {
      text: data.choices?.[0]?.message?.content || '',
      model,
      usedExternal: true,
      usage: data.usage || null
    };
  } catch (e) {
    const offline = await callOfflineRNN(user);
    if (offline.text) {
      offline.reason = `Основной LLM недоступен (${e.message || e}); включён offline RNN`;
      return offline;
    }
    return { text: null, model, usedExternal: false, reason: String(e.message || e) };
  }
}

export function buildSystemPrompt() {
  return `Ты Graph Copilot платформы знаний Graph Platform.
Отвечай только по контексту графа и RAG. Если данных мало — скажи.
По-русски, кратко. Actor, Interest Scope, 4 слоя, Pipe soft, Default First ontology.`;
}
