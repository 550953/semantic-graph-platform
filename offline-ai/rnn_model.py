"""
Enhanced Offline Knowledge Assistant with Advanced NLP Capabilities
"""
from __future__ import annotations

import json
import os
import re
import pickle
import hashlib
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass, field
from collections import defaultdict, OrderedDict
import math

import numpy as np
from scipy import sparse
from scipy.sparse import linalg as spla

DATA_DIR = Path(os.environ.get("GP_DATA_DIR", Path(__file__).resolve().parents[1] / "Data"))
MODEL_DIR = Path(__file__).resolve().parent / "model"
CACHE_DIR = MODEL_DIR / "cache"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

SYNONYMS = {
    "граф": ["граф", "graph", "знания", "knowledge", "онтология", "ontology", "семантика", "semantic"],
    "interest": ["interest", "scope", "интерес", "область", "зона", "контекст", "context"],
    "control": ["control", "кс", "delta", "контроль", "управление", "governance"],
    "pipe": ["pipe", "труба", "поток", "pipeline", "flow", "процесс", "workflow"],
    "actor": ["actor", "актор", "роль", "role", "участник", "participant", "пользователь"],
    "owner": ["owner", "владелец", "заказчик", "ответственный", "responsible"],
    "rag": ["rag", "документ", "chunk", "поиск", "retrieval", "индексация"],
    "fsm": ["fsm", "статус", "переход", "work item", "задача", "task", "state machine"],
    "workspace": ["workspace", "тенант", "tenant", "пространство", "среда"],
    "слой": ["слой", "layer", "level", "проекция", "projection", "view"],
    "онтолог": ["онтолог", "ontology", "профиль", "profile", "конфигурация"],
    "админ": ["админ", "admin", "панель", "dashboard", "управление"],
    "api": ["api", "интерфейс", "endpoint", "rest", "graphql"],
    "security": ["security", "безопасность", "auth", "jwt", "token"],
}

INTENT_PATTERNS = {
    "greeting": {
        "patterns": ["привет", "здравствуй", "hello", "hi", "добрый"],
        "weight": 1.0
    },
    "identity": {
        "patterns": ["кто ты", "ты кто", "who are you", "представься", "what are you"],
        "weight": 0.9
    },
    "owner_question": {
        "patterns": ["заказчик", "owner", "владелец", "ответственный"],
        "weight": 0.8
    },
    "interest_question": {
        "patterns": ["interest", "scope", "интерес", "область интересов"],
        "weight": 0.8
    },
    "pipe_question": {
        "patterns": ["pipe", "труб", "поток", "pipeline", "процесс"],
        "weight": 0.8
    }
}


@dataclass
class DialogueContext:
    history: List[Dict] = field(default_factory=list)
    topics: Set[str] = field(default_factory=set)
    last_intent: Optional[str] = None
    question_count: int = 0
    
    def add_exchange(self, question: str, answer: str):
        self.history.append({"q": question, "a": answer, "timestamp": np.datetime64('now')})
        if len(self.history) > 10:
            self.history.pop(0)
    
    def get_context_string(self) -> str:
        if not self.history:
            return ""
        return " | ".join([h["q"][:100] for h in self.history[-3:]])


class AdvancedRNN:
    def __init__(self, hidden_size: int = 128, seq_length: int = 50, learning_rate: float = 0.01):
        self.hidden_size = hidden_size
        self.seq_length = seq_length
        self.learning_rate = learning_rate
        self.char_to_ix: Dict[str, int] = {}
        self.ix_to_char: Dict[int, str] = {}
        self.vocab_size = 0
        
        self.Wf = self.Wi = self.Wc = self.Wo = None
        self.Uf = self.Ui = self.Uc = self.Uo = None
        self.bf = self.bi = self.bc = self.bo = None
        self.Wy = self.by = None
        
        self.corpus = ""
        self.paragraphs: List[str] = []
        self.tfidf_vectorizer = None
        self.tfidf_matrix = None
        self.word_to_idx: Dict[str, int] = {}
        self.idx_to_word: Dict[int, str] = {}
        self.dialogue_context = DialogueContext()

    def load_corpus(self) -> str:
        texts = []
        if DATA_DIR.exists():
            for p in sorted(DATA_DIR.glob("*.txt")):
                text = p.read_text(encoding="utf-8", errors="ignore")
                texts.append(text)
            for p in sorted(DATA_DIR.glob("*.md")):
                texts.append(p.read_text(encoding="utf-8", errors="ignore"))
        
        self.corpus = "\n\n".join(texts) if texts else ""
        self.paragraphs = []
        raw_paragraphs = re.split(r"\n\n+", self.corpus)
        for p in raw_paragraphs:
            cleaned = p.strip()
            if len(cleaned) > 20:
                self.paragraphs.append(cleaned)
        
        return self.corpus

    def _build_tfidf(self):
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        
        if not self.paragraphs:
            return
        
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 3),
            stop_words=None,
            token_pattern=r'(?u)\b\w+\b'
        )
        
        try:
            self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(self.paragraphs)
            self.word_to_idx = self.tfidf_vectorizer.vocabulary_
            self.idx_to_word = {v: k for k, v in self.word_to_idx.items()}
        except Exception as e:
            print(f"TF-IDF build error: {e}")
            self.tfidf_matrix = None

    def _init_weights(self):
        n, h = self.vocab_size, self.hidden_size
        
        self.Wf = np.random.randn(h, n) * 0.01
        self.Wi = np.random.randn(h, n) * 0.01
        self.Wc = np.random.randn(h, n) * 0.01
        self.Wo = np.random.randn(h, n) * 0.01
        
        self.Uf = np.random.randn(h, h) * 0.01
        self.Ui = np.random.randn(h, h) * 0.01
        self.Uc = np.random.randn(h, h) * 0.01
        self.Uo = np.random.randn(h, h) * 0.01
        
        self.bf = np.zeros((h, 1))
        self.bi = np.zeros((h, 1))
        self.bc = np.zeros((h, 1))
        self.bo = np.zeros((h, 1))
        
        self.Wy = np.random.randn(n, h) * 0.01
        self.by = np.zeros((n, 1))

    def build_vocab(self):
        chars = sorted(list(set(self.corpus))) if self.corpus else list(" абвгдеёжзийклмнопрстуфхцчшщъыьэюяabcdefghijklmnopqrstuvwxyz0123456789.,-!?\"'()")
        self.char_to_ix = {ch: i for i, ch in enumerate(chars)}
        self.ix_to_char = {i: ch for ch, i in self.char_to_ix.items()}
        self.vocab_size = len(chars)
        self._init_weights()

    def _sigmoid(self, x):
        return 1 / (1 + np.exp(-np.clip(x, -50, 50)))

    def _lstm_step(self, x, h_prev, c_prev):
        f = self._sigmoid(self.Wf @ x + self.Uf @ h_prev + self.bf)
        i = self._sigmoid(self.Wi @ x + self.Ui @ h_prev + self.bi)
        c_candidate = np.tanh(self.Wc @ x + self.Uc @ h_prev + self.bc)
        c = f * c_prev + i * c_candidate
        o = self._sigmoid(self.Wo @ x + self.Uo @ h_prev + self.bo)
        h = o * np.tanh(c)
        
        cache = (x, h_prev, c_prev, f, i, c_candidate, c, o, h)
        return h, c, cache

    def _lstm_backward(self, dnext_h, dnext_c, cache):
        x, h_prev, c_prev, f, i, c_candidate, c, o, h = cache
        
        do = dnext_h * np.tanh(c)
        dc = dnext_h * o * (1 - np.tanh(c) ** 2) + dnext_c
        
        df = dc * c_prev * f * (1 - f)
        di = dc * c_candidate * i * (1 - i)
        dc_candidate = dc * i * (1 - c_candidate ** 2)
        
        dWf = df @ x.T
        dWi = di @ x.T
        dWc = dc_candidate @ x.T
        dWo = do @ x.T
        
        dUf = df @ h_prev.T
        dUi = di @ h_prev.T
        dUc = dc_candidate @ h_prev.T
        dWo_ = do @ h_prev.T
        
        dbf = np.sum(df, axis=1, keepdims=True)
        dbi = np.sum(di, axis=1, keepdims=True)
        dbc = np.sum(dc_candidate, axis=1, keepdims=True)
        dbo = np.sum(do, axis=1, keepdims=True)
        
        dx = self.Wf.T @ df + self.Wi.T @ di + self.Wc.T @ dc_candidate + self.Wo.T @ do
        dh_prev = self.Uf.T @ df + self.Ui.T @ di + self.Uc.T @ dc_candidate + self.Uo.T @ do_
        dc_prev = f * dc
        
        return dx, dh_prev, dc_prev, dWf, dWi, dWc, dWo_, dUf, dUi, dUc, dWo_, dbf, dbi, dbc, dbo

    def loss_fun(self, inputs, targets, hprev, cprev):
        xs, hs, cs, ys, ps = {}, {}, {}, {}, {}
        caches = {}
        hs[-1] = np.copy(hprev)
        cs[-1] = np.copy(cprev)
        loss = 0
        
        for t in range(len(inputs)):
            xs[t] = np.zeros((self.vocab_size, 1))
            xs[t][inputs[t]] = 1
            
            hs[t], cs[t], caches[t] = self._lstm_step(xs[t], hs[t-1], cs[t-1])
            
            ys[t] = self.Wy @ hs[t] + self.by
            ys[t] = ys[t] - np.max(ys[t])
            ps[t] = np.exp(ys[t])
            ps[t] = ps[t] / np.sum(ps[t])
            
            loss += -np.log(ps[t][targets[t], 0] + 1e-12)
        
        dWf = np.zeros_like(self.Wf)
        dWi = np.zeros_like(self.Wi)
        dWc = np.zeros_like(self.Wc)
        dWo = np.zeros_like(self.Wo)
        dUf = np.zeros_like(self.Uf)
        dUi = np.zeros_like(self.Ui)
        dUc = np.zeros_like(self.Uc)
        dUo = np.zeros_like(self.Uo)
        dbf = np.zeros_like(self.bf)
        dbi = np.zeros_like(self.bi)
        dbc = np.zeros_like(self.bc)
        dbo = np.zeros_like(self.bo)
        dWy = np.zeros_like(self.Wy)
        dby = np.zeros_like(self.by)
        
        dhnext = np.zeros_like(hs[0])
        dcnext = np.zeros_like(cs[0])
        
        for t in reversed(range(len(inputs))):
            dy = np.copy(ps[t])
            dy[targets[t]] -= 1
            
            dWy += dy @ hs[t].T
            dby += dy
            
            dh = self.Wy.T @ dy + dhnext
            
            dx, dhnext, dcnext, dWf_t, dWi_t, dWc_t, dWo_t, dUf_t, dUi_t, dUc_t, dUo_t, dbf_t, dbi_t, dbc_t, dbo_t = \
                self._lstm_backward(dh, dcnext, caches[t])
            
            dWf += dWf_t
            dWi += dWi_t
            dWc += dWc_t
            dWo += dWo_t
            dUf += dUf_t
            dUi += dUi_t
            dUc += dUc_t
            dUo += dUo_t
            dbf += dbf_t
            dbi += dbi_t
            dbc += dbc_t
            dbo += dbo_t
        
        for dparam in [dWf, dWi, dWc, dWo, dUf, dUi, dUc, dUo, dbf, dbi, dbc, dbo, dWy, dby]:
            np.clip(dparam, -5, 5, out=dparam)
        
        return loss, dWf, dWi, dWc, dWo, dUf, dUi, dUc, dUo, dbf, dbi, dbc, dbo, dWy, dby, hs[len(inputs)-1], cs[len(inputs)-1]

    def train(self, steps: int = 200):
        data = self.corpus
        if len(data) < self.seq_length + 2:
            return {"steps": 0}
        
        params = {
            'Wf': self.Wf, 'Wi': self.Wi, 'Wc': self.Wc, 'Wo': self.Wo,
            'Uf': self.Uf, 'Ui': self.Ui, 'Uc': self.Uc, 'Uo': self.Uo,
            'bf': self.bf, 'bi': self.bi, 'bc': self.bc, 'bo': self.bo,
            'Wy': self.Wy, 'by': self.by
        }
        
        mem = {k: np.zeros_like(v) for k, v in params.items()}
        
        p = 0
        hprev = np.zeros((self.hidden_size, 1))
        cprev = np.zeros((self.hidden_size, 1))
        smooth_loss = -np.log(1.0 / max(self.vocab_size, 1)) * self.seq_length
        
        for n in range(steps):
            if p + self.seq_length + 1 >= len(data) or n == 0:
                hprev = np.zeros((self.hidden_size, 1))
                cprev = np.zeros((self.hidden_size, 1))
                p = 0
            
            inputs = [self.char_to_ix.get(ch, 0) for ch in data[p:p + self.seq_length]]
            targets = [self.char_to_ix.get(ch, 0) for ch in data[p + 1:p + self.seq_length + 1]]
            
            if len(inputs) != len(targets):
                break
            
            loss, dWf, dWi, dWc, dWo, dUf, dUi, dUc, dUo, dbf, dbi, dbc, dbo, dWy, dby, hprev, cprev = \
                self.loss_fun(inputs, targets, hprev, cprev)
            
            smooth_loss = smooth_loss * 0.999 + loss * 0.001
            
            grads = {
                'Wf': dWf, 'Wi': dWi, 'Wc': dWc, 'Wo': dWo,
                'Uf': dUf, 'Ui': dUi, 'Uc': dUc, 'Uo': dUo,
                'bf': dbf, 'bi': dbi, 'bc': dbc, 'bo': dbo,
                'Wy': dWy, 'by': dby
            }
            
            for k in params:
                mem[k] += grads[k] ** 2
                params[k] += -self.learning_rate * grads[k] / np.sqrt(mem[k] + 1e-8)
            
            p += self.seq_length
        
        return {"steps": steps, "loss": float(smooth_loss)}

    def sample(self, seed: str, n: int = 80) -> str:
        if not self.vocab_size:
            return ""
        
        seed = (seed or " ")[-self.seq_length:]
        h = np.zeros((self.hidden_size, 1))
        c = np.zeros((self.hidden_size, 1))
        ix = 0
        
        for ch in seed:
            ix = self.char_to_ix.get(ch, 0)
            x = np.zeros((self.vocab_size, 1))
            x[ix] = 1
            h, c, _ = self._lstm_step(x, h, c)
        
        out = []
        for _ in range(n):
            x = np.zeros((self.vocab_size, 1))
            x[ix] = 1
            h, c, _ = self._lstm_step(x, h, c)
            y = self.Wy @ h + self.by
            y = y - np.max(y)
            p = np.exp(y)
            p = p / np.sum(p)
            
            temperature = 0.8
            p = np.exp(np.log(p + 1e-12) / temperature)
            p = p / np.sum(p)
            
            ix = int(np.random.choice(range(self.vocab_size), p=p.ravel()))
            out.append(self.ix_to_char[ix])
        
        return "".join(out)

    def _expand_query(self, query: str) -> Set[str]:
        tokens = set(re.findall(r"[a-zA-Zа-яА-ЯёЁ0-9]+", query.lower()))
        expanded = set(tokens)
        
        for token in tokens:
            for key, syns in SYNONYMS.items():
                if token in syns or token == key:
                    expanded.update(syns)
                    break
                for syn in syns:
                    if len(token) > 3 and len(syn) > 3:
                        if token in syn or syn in token:
                            expanded.update(syns)
                            break
        
        return expanded

    def _semantic_search(self, query: str, k: int = 5) -> List[Tuple[int, float]]:
        if self.tfidf_matrix is None or self.tfidf_vectorizer is None:
            return []
        
        try:
            query_vec = self.tfidf_vectorizer.transform([query])
            from sklearn.metrics.pairwise import cosine_similarity
            similarities = cosine_similarity(query_vec, self.tfidf_matrix).flatten()
            
            top_indices = np.argsort(similarities)[::-1][:k*2]
            results = [(idx, similarities[idx]) for idx in top_indices if similarities[idx] > 0.05]
            
            return results[:k]
        except Exception:
            return []

    def retrieve(self, query: str, k: int = 5) -> List[str]:
        query_tokens = self._expand_query(query)
        
        keyword_scores = []
        for idx, p in enumerate(self.paragraphs):
            tokens = set(re.findall(r"[a-zA-Zа-яА-ЯёЁ0-9]+", p.lower()))
            overlap = len(query_tokens & tokens)
            
            if overlap > 0:
                score = overlap
                for token in query_tokens:
                    if len(token) > 3 and token in p.lower():
                        score += 0.5
                keyword_scores.append((idx, score))
        
        keyword_scores.sort(key=lambda x: -x[1])
        keyword_results = {idx: score for idx, score in keyword_scores[:k*2]}
        
        semantic_results = self._semantic_search(query, k*2)
        
        combined_scores = {}
        for idx, score in keyword_results.items():
            combined_scores[idx] = combined_scores.get(idx, 0) + score * 2
        
        for idx, score in semantic_results:
            combined_scores[idx] = combined_scores.get(idx, 0) + score * 1.5
        
        sorted_results = sorted(combined_scores.items(), key=lambda x: -x[1])
        
        final_paragraphs = []
        seen = set()
        for idx, _ in sorted_results[:k]:
            if idx not in seen and idx < len(self.paragraphs):
                p = self.paragraphs[idx]
                if len(p) > 20:
                    final_paragraphs.append(p)
                    seen.add(idx)
        
        return final_paragraphs

    def _detect_intent(self, query: str) -> Optional[str]:
        q = query.lower()
        best_intent = None
        best_score = 0.0
        
        for intent, config in INTENT_PATTERNS.items():
            score = 0.0
            for pattern in config["patterns"]:
                if pattern in q:
                    score += 1.0
                pattern_chars = re.findall(r'\w+', pattern)
                query_chars = re.findall(r'\w+', q)
                
                pattern_set = set(pattern_chars)
                query_set = set(query_chars)
                
                if pattern_set and query_set:
                    jaccard = len(pattern_set & query_set) / len(pattern_set | query_set)
                    score += jaccard * 0.3
            
            score *= config["weight"]
            
            if score > best_score:
                best_score = score
                best_intent = intent
        
        return best_intent if best_score > 0.3 else None

    def _intent_answer(self, q: str) -> Optional[str]:
        intent = self._detect_intent(q)
        
        if intent == "greeting":
            return (
                "Привет! Я локальный Graph Copilot (offline). "
                "Спросите про граф знаний, Interest Scope, Control Knowledge, Pipe, Actor, "
                "Заказчик/Owner, слои Transformation Graph или админку."
            )
        elif intent == "identity":
            return (
                "Я резервный ассистент Graph Platform: поиск по корпусу Data/ + char-RNN. "
                "Включаюсь, когда DeepSeek/OpenAI недоступны. Данные наружу не отправляю."
            )
        elif intent == "owner_question" or ("заказчик" in q or "owner" in q):
            return (
                "Заказчик ≠ Owner. Роль висит на связи Actor↔Object, а не на персоне глобально. "
                "Один человек может быть Заказчиком в одном проекте и Owner в другом."
            )
        elif intent == "interest_question" or ("interest" in q or "scope" in q or "интерес" in q):
            return (
                "Interest Scope — вычисляемая область интересов Actor по Work Items и соседним узлам. "
                "Не хранится атрибутом; используется для UI, поиска и контекста LLM."
            )
        elif intent == "pipe_question" or ("pipe" in q or "труб" in q):
            return (
                "Pipe — поток изменения через стадии. Намеренно не зашит жёсткими правилами в онтологию: "
                "критерии остаются на уровне конфигурации процессов. Sprint связан с Pipe many-to-many."
            )
        elif "админ" in q or "admin" in q:
            return (
                "Админ-панель открывается только после входа пользователя с role=admin (JWT). "
                "Демо: admin@graph.local / admin123. Обычная регистрация создаёт member."
            )
        elif "слой" in q or "transformation" in q or "knowledge graph" in q:
            return (
                "Transformation Graph: Knowledge, Implementation, Project, Resource — "
                "четыре проекции с общими ID сущностей. Фильтр слоя показывает проекцию, не отдельную БД."
            )
        elif "default" in q or "онтолог" in q:
            return (
                "Default First → Configure Second → Extend Third. "
                "Новый workspace получает дефолтный профиль онтологии; расширения только аддитивные."
            )
        
        return None

    def answer(self, question: str) -> Dict:
        self.dialogue_context.question_count += 1
        
        prefix = (
            "Основной ИИ временно недоступен. Его заменяю я — локальный ассистент Graph Platform "
            "(корпус Data/ + RNN, без отправки данных наружу).\n\n"
        )
        
        q = (question or "").strip().lower()
        intent = self._intent_answer(q)
        hits = self.retrieve(question or "", k=5)
        
        if intent:
            body = intent
            if hits:
                body += "\n\nДополнительно из корпуса:\n" + "\n".join(f"• {h[:200]}..." if len(h) > 200 else f"• {h}" for h in hits[:3])
        elif hits:
            body = "По корпусу знаний:\n" + "\n\n".join(f"• {h[:300]}..." if len(h) > 300 else f"• {h}" for h in hits[:4])
        else:
            body = (
                "Точного фрагмента нет. Темы: граф знаний, Interest Scope, Actor, Заказчик/Owner, "
                "Pipe, Control Knowledge, FSM, RAG, Workspace, админка. Уточните вопрос."
            )
        
        if self.dialogue_context.question_count % 3 == 0:
            try:
                context = self.dialogue_context.get_context_string()
                seed = context if context else question[:40]
                cont = self.sample(seed, n=60).strip()
                if cont and len(cont) > 15:
                    body += f"\n\n[RNN]: {cont[:150]}"
            except Exception:
                pass
        
        self.dialogue_context.add_exchange(question, body[:200])
        
        return {
            "answer": prefix + body,
            "model": "offline-smart-v2",
            "usedExternal": False,
            "fallback": True,
            "sources": [h[:200] for h in hits[:5]],
            "intent": intent
        }

    def save(self):
        (MODEL_DIR / "rnn_meta.json").write_text(
            json.dumps(
                {
                    "vocab_size": self.vocab_size,
                    "hidden_size": self.hidden_size,
                    "paragraphs": len(self.paragraphs),
                    "corpus_chars": len(self.corpus),
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        
        np.savez_compressed(
            MODEL_DIR / "rnn_weights.npz",
            Wf=self.Wf, Wi=self.Wi, Wc=self.Wc, Wo=self.Wo,
            Uf=self.Uf, Ui=self.Ui, Uc=self.Uc, Uo=self.Uo,
            bf=self.bf, bi=self.bi, bc=self.bc, bo=self.bo,
            Wy=self.Wy, by=self.by
        )
        
        if self.tfidf_vectorizer and self.tfidf_matrix is not None:
            with open(CACHE_DIR / "tfidf.pkl", "wb") as f:
                pickle.dump({
                    "vectorizer": self.tfidf_vectorizer,
                    "matrix": self.tfidf_matrix,
                    "word_to_idx": self.word_to_idx,
                    "idx_to_word": self.idx_to_word
                }, f)

    def load_or_train(self, steps: int = 200):
        self.load_corpus()
        self.build_vocab()
        
        weights_path = MODEL_DIR / "rnn_weights.npz"
        tfidf_path = CACHE_DIR / "tfidf.pkl"
        
        if weights_path.exists():
            data = np.load(weights_path)
            self.Wf, self.Wi, self.Wc, self.Wo = data["Wf"], data["Wi"], data["Wc"], data["Wo"]
            self.Uf, self.Ui, self.Uc, self.Uo = data["Uf"], data["Ui"], data["Uc"], data["Uo"]
            self.bf, self.bi, self.bc, self.bo = data["bf"], data["bi"], data["bc"], data["bo"]
            self.Wy, self.by = data["Wy"], data["by"]
            loaded = True
        else:
            stats = self.train(steps=steps)
            loaded = False
        
        if tfidf_path.exists():
            try:
                with open(tfidf_path, "rb") as f:
                    tfidf_data = pickle.load(f)
                self.tfidf_vectorizer = tfidf_data["vectorizer"]
                self.tfidf_matrix = tfidf_data["matrix"]
                self.word_to_idx = tfidf_data.get("word_to_idx", {})
                self.idx_to_word = tfidf_data.get("idx_to_word", {})
            except Exception:
                self._build_tfidf()
        else:
            self._build_tfidf()
            self.save()
        
        return {
            "loaded": loaded,
            "corpus_chars": len(self.corpus),
            "paragraphs": len(self.paragraphs),
            "tfidf_ready": self.tfidf_matrix is not None
        }


_model: Optional[AdvancedRNN] = None


def get_model() -> AdvancedRNN:
    global _model
    if _model is None:
        _model = AdvancedRNN()
        _model.load_or_train(steps=int(os.environ.get("RNN_TRAIN_STEPS", "150")))
    return _model