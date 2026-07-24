#!/usr/bin/env python3
"""Offline AI HTTP service — HTTP only, bind 0.0.0.0 for server deploy."""
from __future__ import annotations

import os
from flask import Flask, jsonify, request
from rnn_model import get_model

app = Flask(__name__)
API_KEY = os.environ.get("OFFLINE_AI_KEY", "offline-dev-key")
HOST = os.environ.get("OFFLINE_AI_HOST", "0.0.0.0")
PORT = int(os.environ.get("OFFLINE_AI_PORT", "5005"))


@app.after_request
def cors(resp):
    # HTTP-friendly CORS (no HTTPS-only)
    origin = request.headers.get("Origin", "*")
    resp.headers["Access-Control-Allow-Origin"] = origin or "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Offline-Key"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return resp


@app.route("/health", methods=["GET", "OPTIONS"])
def health():
    if request.method == "OPTIONS":
        return ("", 204)
    m = get_model()
    return jsonify({
        "ok": True,
        "model": "offline-smart-v2",
        "corpus_chars": len(m.corpus),
        "paragraphs": len(m.paragraphs),
        "vocab": m.vocab_size,
        "http": True,
    })


@app.route("/chat", methods=["POST", "OPTIONS"])
def chat():
    if request.method == "OPTIONS":
        return ("", 204)
    key = request.headers.get("X-Offline-Key") or request.args.get("key")
    if key != API_KEY:
        return jsonify({"error": "unauthorized"}), 401
    data = request.get_json(force=True, silent=True) or {}
    message = (data.get("message") or data.get("question") or "").strip()
    if not message:
        return jsonify({"error": "message required"}), 400
    result = get_model().answer(message)
    return jsonify(result)


@app.route("/retrain", methods=["POST", "OPTIONS"])
def retrain():
    if request.method == "OPTIONS":
        return ("", 204)
    key = request.headers.get("X-Offline-Key") or request.args.get("key")
    if key != API_KEY:
        return jsonify({"error": "unauthorized"}), 401
    import rnn_model as rm
    from rnn_model import CharRNN
    model = CharRNN()
    # force retrain
    for p in (rm.MODEL_DIR / "rnn_weights.npz", rm.MODEL_DIR / "rnn_meta.json"):
        if p.exists():
            p.unlink()
    stats = model.load_or_train(steps=int(os.environ.get("RNN_TRAIN_STEPS", "100")))
    rm._model = model
    return jsonify({"ok": True, "stats": stats})


if __name__ == "__main__":
    print(f"Offline AI HTTP on http://{HOST}:{PORT}")
    print(f"Data dir: corpus load on first request / startup")
    get_model()
    app.run(host=HOST, port=PORT, debug=False, threaded=True)
