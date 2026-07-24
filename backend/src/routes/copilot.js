import { Router } from 'express';
import { randomUUID } from 'crypto';
import { queryAll, queryOne, queryRun, jparse, jstr, wsId, validateWorkspaceAccess, tokenize } from '../utils/helper.js';
import { createStoreAdapter } from '../utils/storeAdapter.js';
import { buildContext } from '../ai/builder.js';
import { callLLM, buildSystemPrompt } from '../engines/llm.js';
import { answerLocal } from '../ai/copilot.js';
import { validateChatBody } from '../middleware/security.js';

const router = Router();

router.post('/copilot/chat', validateChatBody, async (req, res) => {
  try {
    const { message, actorId, selectedNodeIds, role, tab } = req.body || {};
    const wid = wsId(req);

    if (!await validateWorkspaceAccess(req, wid)) {
      return res.status(403).json({ error: 'Access denied to this workspace' });
    }

    const storeAdapter = createStoreAdapter(wid);
    const context = await buildContext({ store: storeAdapter, actorId, selectedNodeIds, role });
    if (tab) context.nodes = context.nodes.filter(n => !n.tab || n.tab === tab);

    // RAG retrieve
    const qTokens = tokenize(message || '');
    const allChunks = await queryAll('SELECT * FROM chunks WHERE workspace_id = ?', [wid]);
    const ragHits = allChunks.map(c => {
      let score = 0;
      const tokens = jparse(c.tokens_json, []);
      for (const t of qTokens) {
        if (tokens.includes(t)) score += 1;
        if ((c.text || '').toLowerCase().includes(t)) score += 0.5;
      }
      return { chunkId: c.id, documentId: c.document_id, text: c.text, score };
    }).filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);

    const contextText = [
      'Узлы:',
      ...context.nodes.map(n => `- [${n.layer}/${n.tab || '-'}] ${n.label}: ${n.description || n.kind}`),
      'Связи:',
      ...context.edges.slice(0, 30).map(e => `- ${e.source} → ${e.target} (${e.label || ''})`),
      'WorkItems:',
      ...context.workItems.map(w => `- (${w.type}/${w.status}) ${w.title}`),
      'RAG:',
      ...ragHits.map(h => `- ${h.text.slice(0, 350)}`)
    ].join('\n');

    const llm = await callLLM({ system: buildSystemPrompt(), user: message || '', contextText });

    let answer, model = llm.model;
    if (llm.usedExternal && llm.text) {
      answer = llm.text;
    } else if (llm.fallback && llm.text) {
      answer = llm.text;
      model = llm.model || 'offline-char-rnn-v1';
    } else {
      const local = answerLocal({ message, context, store: storeAdapter, ragHits });
      answer = 'Основной ИИ временно недоступен. Его заменяю я — локальный ассистент.\n\n' + local.answer;
      if (llm.reason) answer += `\n\n[${llm.reason}]`;
      model = local.model || 'local-v2';
    }

    const qid = randomUUID();
    await queryRun(
      `INSERT INTO questions (id, workspace_id, message, answer, model, actor_id, role, selected_node_ids_json, context_node_ids_json, rag_chunk_ids_json, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [qid, wid, message || '', answer, model, actorId || null, role || null,
       jstr(selectedNodeIds || []), jstr(context.nodeIds || []), jstr(ragHits.map(h => h.chunkId)), Date.now()]
    );

    res.json({
      answer, model, usedExternalLLM: !!llm.usedExternal,
      sources: { nodes: context.nodeIds || [], rag: ragHits.map(h => h.documentId) },
      questionId: qid, usage: llm.usage || null
    });
  } catch (e) {
    console.error('copilot/chat error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/copilot/history', async (req, res) => {
  try {
    const wid = wsId(req);
    if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
    res.json(await queryAll('SELECT id, message, answer, model, ts FROM questions WHERE workspace_id = ? ORDER BY ts DESC LIMIT 40', [wid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
