# VerboTech — Technical Due Diligence

**Commit analysed:** `9f0f8f5` (= `origin/main`, 3 commits total)
**Scope:** full repository — 54 tracked files, ~1,100 lines of Python, ~3,000 lines of JS/JSX/CSS, ~9,500 words of documentation.
**Posture:** adversarial. Every claim was checked against the running code, and several were executed to confirm failure.

---

## 0. A discrepancy you need to resolve before reading anything else

You supplied `project_history.md`, which concatenates 17 documents including `docs/audio-pipeline.md`, `docs/expression-analysis.md`, `docs/nvidia-nim-asr.md`, and `docs/notifications.md`. Its README describes Firebase ID token verification, NVIDIA NIM ASR with faster-whisper fallback, PostgreSQL with TIMESTAMPTZ, Redis-backed rate limiting, web push with real VAPID/AES128GCM, MediaPipe blendshapes, learned calibration, docker-compose, and **"251 tests."**

**None of that exists in this repository.**

```
$ git rev-parse origin/main HEAD
9f0f8f5c7cece192f79a578243b03edd73ef5a2f
9f0f8f5c7cece192f79a578243b03edd73ef5a2f

$ find . -iname "*test*" -o -iname "Dockerfile*" -o -iname "*.yml"
(nothing)
```

There are no `tests/`, no `auth.py`, no `db.py`, no `rate_limit.py`, no `streaks.py`, no `notifications.py`, no `ml/asr/`, no `ml/llm/`, no `docker-compose.yml`. Four of the twelve documents that `project_history.md` claims to concatenate "verbatim from their own paths" have no such path.

**Three possibilities, and you know which one is true:**

1. That work exists locally and was never pushed. → Push it. Everything below about the *current* main still applies to what a reviewer, recruiter, or investor sees today, because they see `origin/main`.
2. That README is aspirational and was written describing intent as completed fact. → This is the most serious problem in the entire project, and it is not a technical problem. A README that says "251 tests" and "Everything below is implemented and covered by tests — not aspirational" when zero tests exist is the kind of thing that ends a due-diligence conversation in one sentence. Not because the engineering is weak; because the claim was falsifiable in eleven seconds.
3. It belongs to a different branch or fork. → Then it is not this project's history.

**Everything in this document analyses the code that actually exists at `9f0f8f5`.** Where `project_history.md` makes a claim, I treat it as an unverified claim about a system I cannot find.

---

# PHASE 1 — README REALITY CHECK

The root `README.md` is the artefact under review. Each claim verified against source.

| README Claim | Reality | Evidence | Risk | Required Correction |
|---|---|---|---|---|
| "AI-powered public speaking and confidence analytics platform" | **MISLEADING.** The neural network is never trained and no checkpoint is ever loaded. `grep -rn "load_state_dict\|torch.load"` returns **0 hits**. `MultimodalConfidenceNetwork.__init__` builds `audio_proj`, `vision_tcn`, and `fusion_layer` with PyTorch default random init and calls `.eval()`. Its output is `sigmoid(random_linear(features)) * 100` — a near-constant arbitrary number. | `ml/models/fusion.py:9-25,47-55` | Highest. This is the product. | Say "heuristic scoring with a scaffolded, untrained neural path." Or train it. |
| "production-ready APIs" | **TECHNICALLY INCORRECT.** No auth, no rate limiting, no input size limits, no structured logging (`import logging` appears **0 times**; there are **28 `print()` calls**), no migrations, no health check beyond a string literal, no tests, no CI, no Dockerfile. `CORSMiddleware(allow_origins=["*"], allow_credentials=True)`. | `confidence-backend/main.py:13-19,98` | High | Delete the phrase. |
| "Real-time speech confidence analysis" | **OVERSTATED.** Nothing is analysed in real time by a model. Audio is buffered for the full session and scored once at the end. The live on-screen number is a client-side if/else ladder in `Speaking.jsx` — the comment even says the REST polling was disabled and "the UI heuristic will sustain the visual element." | `Speaking.jsx:143-180` | Medium | "Live capture, end-of-session scoring." |
| "Multimodal fusion scoring with audio + vision embeddings" | **PLAUSIBLE BUT UNVERIFIED → effectively OVERSTATED.** The fusion *graph* exists and runs. But it is untrained, so the fusion contributes no information. The score that reaches the user is produced by four hand-written `if` statements immediately after. | `workers/tasks.py:51-81` | High | "Scaffolded fusion architecture; scoring is currently heuristic." |
| "Facial engagement and posture analysis" | **TECHNICALLY INCORRECT.** No posture is computed anywhere — MediaPipe *Face* Landmarker only, no pose model. "Eye contact" is `noseX > 0.45 && noseX < 0.55` — whether your nose is horizontally centred in frame. "Expressiveness" is mouth-open distance > 0.02 — i.e. whether you are currently talking. | `useFaceAnalyzer.js:85-95` | High. Adjacent to hiring = liability. | Remove "posture." Rename the two metrics to what they measure: frame-centering and mouth aperture. |
| "Celery worker orchestration" / "the API gateway never blocks on model inference" (`docs/architecture.md`) | **TECHNICALLY INCORRECT — and it is the opposite of true.** `task.get(timeout=25)` is a *synchronous blocking call* executed inside an `async def` WebSocket handler. It blocks the entire uvicorn event loop — every other connection on the process — for up to 25 seconds. The fallback path then runs HuBERT *inside the gateway* via `asyncio.to_thread`. | `main.py:190-213` | Critical | See P0-1. |
| "persistent storage for session telemetry" | **BROKEN.** The committed `confidence.db` has a stale schema. `Base.metadata.create_all` skips existing tables, so the new columns are never added. Every `POST /api/sessions` raises `OperationalError`. Executed and confirmed: `INSERT FAILED -> OperationalError table sessions has no column named scenario_title`. | `main.py:22-28,65`; `confidence.db` | Critical — the app is broken on clone | `.gitignore` the DB; add Alembic. |
| "Session history" | **MISSING IMPORTANT CONTEXT.** History renders from `localStorage`, not the server. `GET /api/sessions/{user_id}` is never called by any frontend file. History is per-browser and vanishes on cache clear or device change. | `storage.js:56-66`, `History.jsx:13-18` | Medium | "Local session history (per-browser)." |
| "Personalization" | **OVERSTATED.** The delta is cosine similarity between two *randomly-projected* HuBERT means, then `(1 - similarity) * 20.0` — a magic constant with no derivation. Two separate, unreconciled baseline systems exist: a localStorage casual-question average and a server-side centroid. | `tasks.py:105-127`, `storage.js:71-88` | Medium | Pick one. Justify the constant or drop it. |
| "Feedback capture" / "Data Flywheel" | **BROKEN BY CONSTRUCTION.** `result.id` is never assigned anywhere in the frontend, so `/api/feedback` always receives `session_id: 0` — feedback rows can never be joined to the session they describe. And `perceived_score` is fabricated from a thumbs-down: `result.avgConfidence < 50 ? 80 : 20`. That is not a label; it is a coin flip dressed as ground truth. | `Feedback.jsx:88-100` | High — poisons any future training set | Return the server `session_id` and thread it through. Ask for a number, don't invent one. |
| Badge: `Python 3.11` | **INCORRECT.** Committed bytecode is `cpython-313`. | `__pycache__/*.cpython-313.pyc` | Low | Fix or delete the badge. |
| Badge: `PyTorch 2.x`, `Redis-compatible` | **UNVERIFIABLE FROM THE REPO.** `requirements.txt` is UTF-16LE encoded and contains **no `torch`, no `transformers`, no `celery`, no `redis`**. `pip install -r requirements.txt` yields a backend that cannot import `workers/tasks.py`. | `requirements.txt` | Critical — nobody can run this | Re-encode UTF-8, add the four missing packages. |
| "Quick Start" (PowerShell, `..\.venv\Scripts\`) | **MISSING CONTEXT.** Windows-only. No worker start command in the README. And per the above, the documented install does not produce a working backend. | `README.md:44-50` | Medium | Provide POSIX + Windows, or just provide Docker. |
| `docs/deployment.md` docker-compose with `build: ./confidence-backend` | **MISLEADING.** There is no Dockerfile. The documented production deployment cannot be built. | `docs/deployment.md:52-95` | High | Write the Dockerfile or mark the section as a proposal. |
| `docs/environment.md` documents `DATABASE_URL`, `ENVIRONMENT`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `JWT_SECRET` | **MISLEADING.** `os.getenv` appears exactly once in the entire backend, for `REDIS_URL`. The DB URL is hardcoded. None of the other six variables are read by anything. | `celery_app.py:5`, `main.py:23` | Medium | Introduce `pydantic-settings` and actually read them, or delete the rows. |
| `docs/environment.md` "examples" `verbotech-a6953`, `1:290443785030:web:` | **MISSING CONTEXT.** Those are your real project and sender IDs, not placeholders. Not a secret (Firebase web config is public by design), but it advertises the exact project to attack if your Firebase rules are loose. | `docs/environment.md:12-14` | Low–Medium | Use `your-project-id`. Audit your Firebase security rules. |
| `ml/README.md` "DELETE IMMEDIATELY: the entire `train.py` (Random Forest) and SQLite implementation" | **The project contradicts its own written plan.** Both still exist, on main, at the top of the tree. | `ml/README.md:§7`; `train.py`, `confidence.db` | Medium | Execute your own decision. |
| UI panel titled **"Whisper-X Transcription"** | **MISLEADING — the worst instance in the codebase.** There is no ASR anywhere. `useSpeechRecognition` performs no speech recognition; its `transcript` is a `useState("")` that is never written. The string rendered under that heading is hardcoded in `Speaking.jsx`. | `Speaking.jsx:62`, `useSpeechRecognition.js:7-8`, `Feedback.jsx:155-168` | Highest non-security risk | Remove the panel until ASR exists. |

**Verdict on the README:** it is not a description of this system. It is a description of the system the author intended to build, written in the present indicative.

---

# PHASE 2 — WHAT IS ACTUALLY GOOD

Genuine, with the technically-impressive / business-valuable distinction kept strict.

### 1. The frontend UX is real, and it is the best thing here
**What:** `Situation → countdown → Speaking dashboard → Feedback report` is a coherent, complete loop. Framer Motion stagger variants, a live camera tile with a LIVE/SILENT pill, a progress-track confidence meter, a skeleton-loader state while the critique is fetched, an 851-line hand-written CSS design system with light/dark tokens.
**Why it matters:** most ML side-projects ship a Streamlit page. This ships something that looks like a product. You can put it in front of a user tomorrow and they will know what to do.
**Differentiated?** No. It is well-executed standard React. Any competent frontend engineer reproduces it in a week.
**Business valuable?** Yes — it is what makes user testing possible at all.
**Evidence needed to make it a claim:** a 60-second screen recording in the README. You currently have zero screenshots, which for a product whose *only* proven strength is visual is a straightforward unforced error.

### 2. Every React render loop is deliberately guarded
**What:** `useAudioAnalyzer` and `useFaceAnalyzer` both keep high-frequency values in refs and gate `setState` behind a `lastMetricsRef` equality check, with an explanatory comment (`🔒 prevents infinite update loops`). MediaPipe tensor emission is throttled to 10 Hz with an explicit rationale.
**Why it matters:** running `getByteTimeDomainData` at 60 fps into React state is the single most common way a browser-audio app dies. Whoever wrote this hit that bug and fixed it properly rather than reaching for a debounce library.
**Why an engineer cares:** it is evidence of real debugging under a real constraint. That is a genuine positive signal about the author.
**Differentiated?** No — correct, not novel.

### 3. Personalised delta is the right *product* instinct
**What:** `ml/README.md §5`: *"A score of 65% means nothing. What matters is: did you deviate from your baseline?"*
**Why it matters:** this is the one genuinely good product idea in the repository. Absolute confidence scores are unfalsifiable and users correctly distrust them. Within-speaker delta sidesteps the entire calibration and fairness problem, because the speaker is their own control.
**Differentiated?** The *framing* is. The implementation is not — cosine similarity over untrained random projections measures nothing.
**Evidence needed:** a within-subject study. Record 30 people doing a low-stakes prompt and a high-stakes prompt. If your delta correlates with self-reported stress at r > 0.4, you have a defensible claim. Right now you have a sentence.

### 4. The three-tier repo split is the right shape
**What:** `confidence-speaker/` (capture + UI), `confidence-backend/` (gateway + workers), `ml/` (model code).
**Why it matters:** the seam between gateway and inference is where this kind of system must eventually split, and it is already drawn.
**Caveat:** the seam is drawn but then punched through — `workers/tasks.py:9` does `from main import SessionLocal, UserBaseline`, so the Celery worker imports and instantiates the entire FastAPI application, including running `create_all` against the DB. The boundary is decorative.

### 5. The technology *selections* are defensible
FastAPI, Celery+Redis, PyTorch, React+Vite, MediaPipe WASM, Firebase Auth. Nothing here is a fashion choice. The decision to run MediaPipe client-side and ship 52 floats instead of video frames is a real bandwidth win and the correct call.
**Differentiated?** No. Choosing the right tools is table stakes, not an achievement.

### Explicitly NOT good, despite appearing so
- **The Mermaid diagrams.** They depict a system that does not exist (S3, PostgreSQL, non-blocking dispatch). A diagram that contradicts the code is worse than no diagram.
- **The docs volume.** ~9,500 words of documentation against ~1,100 lines of Python is a 9:1 ratio. `docs/security.md` is 100% aspirational — every line is "Recommendations" and "Potential enhancements," not one sentence describes the current posture, which is *none*.
- **The `ml/README.md` blueprint.** It is a competent architecture essay. It is also a plan for a system nobody has started, and it is 12KB — larger than the entire backend it describes.

---

# PHASE 3 — HARDCORE WEAKNESS ANALYSIS

## 3.1 Architecture

**A1 — The gateway blocks on inference. This is the defining architectural defect.**
```python
# main.py:194-201  (inside `async def stream_telemetry`)
task = process_multimodal_session.delay(...)
result = task.get(timeout=25)     # ← synchronous. Blocks the uvicorn event loop.
```
`AsyncResult.get()` is a blocking poll. Inside `async def`, it halts the event loop for the whole process. One user finishing a session freezes every other WebSocket, every REST request, and every health check on that worker for up to 25 seconds. With 4 uvicorn workers, **four concurrent session-endings take the service down.** Celery's own documentation warns against `.get()` in this position; here it is worse, because async makes the blast radius the entire process rather than one thread.

**Fix:** the WebSocket must return immediately. `task_id = task.id; await websocket.send_json({"status":"queued","task_id":task_id})`. Then either (a) poll `GET /api/results/{task_id}` from the client, or (b) have the worker publish to a Redis pub/sub channel that the gateway subscribes to with `redis.asyncio`. Option (b) is ~40 lines and keeps the WebSocket useful.
**Evidence of fix:** `locust` with 50 concurrent sessions all finishing within a 5-second window; p99 latency on `GET /` stays under 100 ms throughout.

**A2 — The fallback path defeats the entire architecture.**
```python
except Exception as worker_err:
    result = await asyncio.to_thread(process_multimodal_session, ...)
```
When Redis is down — or, far more commonly, when the 25-second timeout fires because CPU HuBERT inference on 60 seconds of audio genuinely takes longer than that — the gateway runs a 380 MB model in its own process. Unbounded: `asyncio.to_thread` uses the default executor, so ~`min(32, cpu+4)` concurrent HuBERT forwards, each allocating hundreds of MB. This is the OOM path, and it is the *default* path under load. Your own `ml/README.md` says the gateway does "**zero** ML processing."

**A3 — Hex-encoding a multi-megabyte audio buffer through the broker.**
60 s × 16 kHz × 4 bytes = **3.84 MB** of raw Float32, held in a `bytearray` in the gateway, then `.hex()`-ed to a **7.68 MB** string, then JSON-serialised into Redis. Redis is a queue, not a blob store. At 100 concurrent sessions this is ~768 MB of broker memory in transit for data that should never have entered the broker.
**Fix:** write the buffer to object storage (or Redis with a TTL, as a binary value under a key), pass the *key* in the task. Use `msgpack` or raw bytes, never hex. This is a 20× payload reduction and it is the difference between Redis being a queue and Redis being your bottleneck.

**A4 — No circuit breaker, no backpressure, no bulkhead.** No limit on concurrent inferences, no queue depth check, no shedding. The only timeout in the system is the 25 s `task.get`, and exceeding it makes things *worse* (see A2).

**A5 — SQLite with `check_same_thread=False` under a Celery worker + an async gateway.** Both processes open the same file. SQLite's writer lock is file-global; concurrent writes will produce `database is locked` under any real load. `docs/architecture.md` correctly says "migrate to PostgreSQL for production" — but there is no configuration path to do so, because `DATABASE_URL` is never read.

**A6 — Circular import as the module boundary.** `workers/tasks.py` imports from `main.py`. Extract `db.py` (engine, `SessionLocal`, models) and have both import from it. Twenty minutes of work; removes a whole class of confusing startup behaviour.

**Overengineered relative to value:** Celery + Redis for a system with three real sessions in its database. A single `BackgroundTasks` or a `ThreadPoolExecutor(max_workers=2)` would serve the first 1,000 users and would not have produced A1 or A3. The distributed architecture is currently *paying* complexity costs while *delivering* the failure mode it was introduced to prevent.

**Underengineered:** no config layer, no migrations, no auth layer, no logging layer, no test layer. The five things that make a codebase survivable are all absent while the one thing that makes it complicated is present.

## 3.2 AI / ML

**M1 — The neural network is untrained, and this is not a nuance. It is the whole finding.**
```
$ grep -rn "load_state_dict\|torch.load" --include=*.py .
(0 results)
```
`HubertModel.from_pretrained("facebook/hubert-base-ls960")` loads real pretrained acoustic weights — good. But `audio_proj` (Linear 768→256), the entire `TemporalConvNet`, and `fusion_layer` are randomly initialised and never trained. The forward pass runs a 95M-parameter transformer to produce features that are then multiplied by random numbers and squashed through a sigmoid.

`tasks.py:53` says the quiet part out loud:
> `# Since the neural model is uncalibrated (untrained), we anchor it with empirical acoustic/visual features to make it "properly functioning"`

The scare quotes around "properly functioning" are the author's own.

**This means the ~15–25 seconds of CPU HuBERT inference per session produces literally zero information used in the final score.** You are paying the entire compute bill of the system for a number that a `random.seed(0); random.random()` would replace without any user noticing.

**M2 — The actual scoring function, in full:**
```python
calibrated_score = neural_score          # ≈ constant, from random weights
if pitch_var > 40:      calibrated_score += 20
if avg_volume > 0.02:   calibrated_score += 15
if zcr > 0.05:          calibrated_score += 10
if v_std < 0.03:        calibrated_score += 5
if avg_volume < 0.005:  calibrated_score *= 0.4
```
Four thresholds and four weights — eight magic numbers with no citation, no derivation, no validation, and no sensitivity analysis. **`avg_volume > 0.02` grades microphone gain, not confidence.** Move closer to your laptop, score +15. Use a headset instead of a built-in array, score +15. This is a direct, trivially-gamed equipment bias, and it is 15% of the range.

`zcr > 0.05` is described in a comment as "clear consonants." Zero-crossing rate is elevated by fricatives *and by broadband noise*. A user in a café scores higher for "clear consonants."

**M3 — The LLM critiques a string the user never said.**
```javascript
// Speaking.jsx:62
let finalTranscript = "[Acoustic telemetry captured and analyzed by Deep Learning Fusion Engine. Full semantic transcription disabled in this phase.]";
```
This exact string is passed to Groq as `Transcript: "..."` with the system prompt *"You are an elite executive communications coach. Analyze the given transcript based on clarity, filler words, and narrative structure."* The model is asked to critique clarity and filler words in a sentence the user did not produce. Whatever it returns is rendered to the user as **"Executive AI Critique."**

This is not a bug with a workaround. It is a hallucination pipeline: a system deliberately constructed to generate confident-sounding feedback about content it has never observed, presented to the user as analysis of their performance. Under a panel labelled "Whisper-X Transcription."

If one person who is evaluating you finds this — and it is four lines of reading — the conversation is over, and reasonably so.

**Fix, in priority order:** (1) delete the critique panel today; (2) ship real ASR (`faster-whisper` `base.en` runs ~10× real-time on CPU and is ~140 MB); (3) only then re-enable the LLM, on the real transcript.

**M4 — `train.py` learns to reproduce its own labels.** It reads `confidence_score` from the sessions table as `y`, where that column was written *by the scoring pipeline*. With fewer than 5 rows — which is always, since there are 3 — it fabricates 100 synthetic rows from `40 + (silence term) + eye*20 + exp*20`, the exact heuristic it then "learns." Reported R² is a measure of how well a RandomForest memorises a closed-form formula. Then:
```
$ grep -rn "joblib.load" .
(0 results)
```
The 553 KB `confidence_model.joblib` is committed to git and **loaded by nothing**. `train.py:93` prints *"The FastAPI backend will automatically use this model on next restart."* It will not.

**M5 — The vision tensor contract is semantically wrong.** `fusion.py:14` comments *"Assuming 52 flattened landmark floats"*, and 52 is the ARKit/MediaPipe **blendshape** count — normalised 0–1 expression coefficients, pose-invariant by construction. What the client actually sends:
```javascript
const tensor = lm.map(p => [p.x, p.y, p.z]).flat().slice(0, 52);
```
That is the first **17⅓ landmarks'** raw normalised coordinates, truncated mid-point. Raw coordinates move with head position, camera distance, and framing. So `v_std < 0.03 → +5 for stable body language` rewards *sitting still relative to the webcam*, and penalises anyone who gestures, leans, or has a shorter desk. The model was designed for one input and is being fed a different one, with a comment asserting they are the same.

**M6 — Zero evaluation infrastructure.** No benchmark, no held-out set, no ground truth, no inter-rater agreement, no test-retest reliability, no fairness analysis, no confusion matrix, no ablation. You cannot answer: *if the same person gives the same answer twice, do they get the same score?* That is the minimum bar, and it is one afternoon of work — and if the answer is "no," nothing else in the ML stack matters.

**M7 — Fairness exposure, and this one is a legal issue, not an engineering one.** Pitch variance, absolute volume, ZCR, mouth aperture, and head stability all vary systematically with gender, age, native language, accent, neurotype, and disability. A system that scores "confidence" from these, marketed for **interview practice**, is one deployment decision away from being a hiring tool with unaudited adverse impact. `ml/README.md` shows the author already understands this (it explicitly rules out emotion/personality inference — genuinely good judgement). The current scoring function does not honour that judgement.

**M8 — No model versioning, no reproducibility, no inference logging.** No seed, no model hash, no feature snapshot stored with the session. You could not reproduce or explain any past score. You are also not storing the per-modality signals, so even if you later collect good feedback labels you will have nothing to train *on* — the features behind each rating are unrecoverable.

**M9 — Vendor and cost blindness.** Groq is called directly from the browser (see S3). No token accounting, no retry, no timeout, no fallback, no circuit breaker. `catch { return null }` swallows everything and shows "Unable to acquire AI critique at this time."

## 3.3 Backend

**B1 — No authentication of any kind.** The frontend has Firebase Auth; the backend has never heard of it. `user_id` is an unvalidated client-supplied string on both the REST and WebSocket surfaces.

**B2 — IDOR, full read.** `GET /api/sessions/{user_id}` has no authorization check. Firebase UIDs are 28-char opaque strings, but they are not secret — they leak through client code, logs, and support channels, and the endpoint enumerates cleanly for weak IDs like the `"guest"` and `"anonymous_user"` that this code writes by default.
```
curl http://api/api/sessions/guest   # every guest session ever recorded
```

**B3 — Cross-user data corruption via the WebSocket.** `payload.get("user_id")` on the `finish` action is written straight into `UserBaseline`. Any client can connect to `/ws/stream/anything`, stream two seconds of noise, send `{"action":"finish","user_id":"<victim>","is_onboarding":true}`, and permanently overwrite that user's acoustic and vision centroids. No auth, no ownership check, no audit.

**B4 — Unauthenticated memory-exhaustion DoS, ~6 lines of attacker code.**
```python
audio_buffer.extend(message["bytes"])     # no cap
vision_tensors.append(payload["data"])    # no cap, no shape validation
```
A single client opens the WebSocket and streams binary at line rate. The gateway buffers all of it in RAM, forever, with no size limit, no timeout, no per-IP connection cap, and no auth. Ten connections at 10 MB/s exhausts a 4 GB instance in under a minute.
**Fix:** require a verified Firebase ID token in the connect query or first frame; cap `len(audio_buffer)` at `sample_rate * 4 * max_seconds` and close 1009 on exceed; cap `len(vision_tensors)`; validate each frame is exactly 52 floats; set an idle timeout; limit concurrent sessions per account.

**B5 — CORS wildcard with credentials.** `allow_origins=["*"]` + `allow_credentials=True`. Starlette resolves this by echoing the requesting `Origin` back with `Access-Control-Allow-Credentials: true` — i.e. **every origin on the internet is trusted**. Impact is currently bounded only because there are no cookies to steal; the moment you add session auth, this is account takeover from any page the user visits.

**B6 — No rate limiting anywhere.** `POST /api/sessions`, `POST /api/feedback`, and the WebSocket are all unbounded. Anyone can write unlimited rows into your DB — and thereby into your "flywheel" training set.

**B7 — Every session is written twice.** `Speaking.jsx:104` POSTs to `/api/sessions` at session end. Then `Feedback.jsx:74/79` → `storage.saveSession()` POSTs the *same* session again with a different, inconsistent field mapping (`scenarioTitle: situation?.text` vs `scenario_title: situation?.title`). **Every session produces two DB rows with divergent data.** No idempotency key, no dedup.

**B8 — Errors are recorded as scores.** Every failure path returns `{"confidence_score": 0.0}` — insufficient audio, tensor shape mismatch, DB error, unhandled exception. The client renders 0 as a legitimate result. Your shipped `confidence.db` row `id=1` has `confidence_score: 0.0` and `silence_count: 2613`, which is almost certainly a crashed run preserved as data. **Your errors are silently poisoning the dataset you plan to train on.** Return `{"status":"error"}` and render an error state.

**B9 — `silence_count: 2613` for a 60-second session.** The counter is broken. `silentFramesRef.current === 20` is an exact-equality check inside a `requestAnimationFrame` loop, which fires only on the single frame where the count is exactly 20 — but `speakingFramesRef` is deliberately never reset (`// We no longer reset speakingFramesRef to 0`), so once `> 6` the debounce latches `isSpeaking = true` permanently and the transition logic degenerates. The number is meaningless, it is shipped to users as "Silence Intercalation: 2613 instances," and it is a feature in `train.py`.

**B10 — Database session leak in the worker's error path.** `tasks.py` opens `db = SessionLocal()` inside the outer `try` and closes it in an inner `finally` — but if `get_multimodal_predictor()` or the forward pass raises, the outer `except` catches and returns without the DB block ever running. The `finally: pass` at the end is dead code.

**B11 — No validation on any numeric field.** `duration`, `silence_count`, `silence_ratio`, `confidence_score` accept any value Pydantic will coerce. `confidence_score: 1e308` is accepted and stored, and will corrupt every average in the history view.

## 3.4 Frontend

**F1 — Two microphone streams, two AudioContexts, simultaneously.** `useAudioAnalyzer` calls `getUserMedia({audio:true})` and opens an `AudioContext`; `useSpeechRecognition` does it again at 16 kHz. Both run for the whole session. Double the permission surface, double the CPU, double the battery, and a real source of device-specific breakage (some Android browsers and most Bluetooth headsets will not grant two concurrent capture streams cleanly). **Fix:** one `getUserMedia`, one `AudioContext`, fan out to both consumers from one `MediaStreamSource`.

**F2 — `createScriptProcessor` is deprecated and runs on the main thread.** It has been deprecated since 2014. Every 4096-sample callback competes with React rendering, Framer Motion's animation frames, and MediaPipe's `detectForVideo` — all on the same thread, during the exact moment you claim to be measuring the user's performance. Dropped buffers are silent data loss. **Fix:** `AudioWorkletNode` (~30 lines, runs on the audio thread).

**F3 — Three hardcoded `localhost` endpoints.** `storage.js:3`, `Speaking.jsx:30`, `Feedback.jsx:57` (`http://localhost:8000`) and `useSpeechRecognition.js:26` (`ws://localhost:8000`). The frontend **cannot be deployed**. `npm run build` produces a bundle that talks to the user's own machine. And an HTTPS-hosted page calling `http://`/`ws://` is blocked as mixed content regardless. **Fix:** `VITE_API_BASE_URL` / derive the WS URL from it, and use `wss://` in production.

**F4 — `Situation.jsx:63` renders `{q.title}` — `questions.js` has no `title` field.** Every scenario card has an empty `<h3>`. Then `Speaking.jsx:110` sends `scenario_title: situation?.title` → always `"Unknown"`, while `storage.js:34` sends `session.scenarioTitle` (which *was* set from `.text`). The same field is wrong in the UI and inconsistent between the two duplicate writes.

**F5 — Three unrouted screens.** `Start.jsx`, `Profile.jsx`, `ConfidenceTrends.jsx` are not referenced in `App.jsx`. `Start.jsx` duplicates `Login.jsx`'s Google auth with `alert()` instead of proper error UI. `ConfidenceTrends.jsx` would **throw on render** if it were reachable — it uses `react-chartjs-2`'s `<Line>` without ever calling `ChartJS.register(...)`, which is a hard runtime error in Chart.js v4. Dead code that does not work.

**F6 — Unused dependency.** `@google/generative-ai` is in `package.json` and imported nowhere. Remove it.

**F7 — No error boundary, no offline handling, no retry.** `fetch(...).catch(() => {})` twice. If the backend is down the session silently vanishes.

**F8 — No double-submit guard on session finalisation.** The `timeLeft <= 0` effect has no ref guard. `<React.StrictMode>` is enabled in `main.jsx`, and the "End" button sets `timeLeft = 0` directly — a second click during the async finalise re-enters the whole path.

**F9 — Accessibility is effectively absent.** In 851 lines of CSS there are **two** `@media` queries, **one** `:focus-visible` rule, zero `prefers-reduced-motion` (in an app built on Framer Motion), zero `aria-live` on a screen whose entire purpose is announcing changing values. `<a href="#" onClick={onViewHistory}>` is a nav link that is not a link. Colour is the sole carrier of meaning for every signal ("positive"/"negative"). `<title>confidence-speaker</title>` — the product is not even named in the browser tab.

**F10 — Mobile is not considered.** A two-column `dashboard-layout` with a live camera tile, at two breakpoints. For a product whose core action is "record yourself speaking" — the single most natural phone behaviour imaginable.

**F11 — `key={i}` on a reversed list** in `History.jsx:126`. Standard React correctness bug.

**F12 — "Export JSON" writes to the clipboard with no confirmation, no error handling, and no fallback** when `navigator.clipboard` is unavailable (non-secure context). The user clicks and nothing appears to happen.

## 3.5 Security — concrete attack scenarios

| # | Vulnerability | Attack scenario | Severity | Mitigation |
|---|---|---|---|---|
| S1 | No auth on backend | Attacker reads/writes any user's data. See S2/S3. | **Critical** | Verify Firebase ID tokens server-side via `google-auth` + Google's public JWKs (no service-account key needed). One `Depends(current_user)` on every route; token in the WS connect params. Never trust a client `user_id`. |
| S2 | IDOR on `GET /api/sessions/{user_id}` | `curl api/api/sessions/guest` → every guest session: scenario, category, scores, timestamps. Behavioural data about named individuals if UIDs leak. | **Critical** | Derive `user_id` from the verified token. Delete the path parameter. |
| S3 | **Groq API key shipped in the browser bundle** | `VITE_` variables are **inlined into the JS bundle at build time**. Anyone who loads your site opens DevTools → Sources → Ctrl-F "gsk_" and has your key. They then bill your account for their own workload until you notice. | **Critical** | Move the call server-side. `POST /api/critique` with auth + rate limit; key lives in the backend env only. **If this key has ever been in a deployed build, rotate it now.** |
| S4 | Unauth'd WS memory exhaustion | One socket, unbounded binary → gateway OOM. No auth, no cap, no timeout. ~6 lines of attacker code. | **Critical** | Auth the socket; hard-cap buffer bytes and frame count; idle timeout; per-account concurrency limit. |
| S5 | Baseline overwrite | `{"action":"finish","user_id":"<victim>","is_onboarding":true}` permanently corrupts a victim's personalisation. | **High** | Same fix as S1. |
| S6 | CORS `*` + credentials | Every origin trusted with credentials. Currently low-impact (no cookies); becomes account takeover the day you add session auth. | **High** | Explicit origin allowlist from config. |
| S7 | No rate limiting | Unbounded writes to `/api/sessions`, `/api/feedback`, and the WS. Free DB bloat and training-data poisoning. | **High** | Redis-backed limiter (`slowapi` or equivalent), per-account and per-IP. |
| S8 | Prompt injection (latent) | Today the LLM input is a fixed string, so exposure is nil. But `user_correction` is a free-text field already being collected, and the obvious next step is feeding transcripts to the LLM. The moment either reaches a prompt, a user can rewrite the coach's instructions. | **Medium now, High on the current trajectory** | Structural separation (user text in a distinct message, never concatenated into the system prompt), output length caps, and never let LLM output drive a control decision. |
| S9 | Committed database | `confidence.db` is in git with 3 sessions and a `user_baselines` row (`test_ai_user`, 9 KB of embeddings). Voice-derived embeddings are biometric-adjacent and in scope for GDPR Art. 9 / BIPA. | **Medium** | `git rm --cached`, add to `.gitignore`. Rewrite history if this was ever real user data. |
| S10 | No dependency scanning | 302 locked npm packages, zero Python lockfile (and the requirements file is unreadable by `pip` as encoded). No `npm audit`, no `pip-audit`, no Dependabot. | **Medium** | Dependabot + `pip-audit` + `npm audit --audit-level=high` in CI. |
| S11 | Unpinned remote model fetch | `useFaceAnalyzer` loads WASM from `cdn.jsdelivr.net` and a `.task` model from `storage.googleapis.com` at runtime, with no SRI and no version pin on the model. A CDN compromise executes arbitrary code with camera access. | **Medium** | Self-host both; pin versions; SRI where applicable; CSP. |
| S12 | No CSP, HSTS, or security headers | XSS from any injected dependency has full run of the page, including the live camera and microphone streams. | **Medium** | Strict CSP; `Permissions-Policy` scoping camera/microphone. |
| S13 | No secure-context / permission UX | The app requests camera and mic with no explanation, no revoke path, no retention statement, and no deletion endpoint. Privacy posture is not just a legal gap — it is a conversion killer. | **Medium** | Pre-permission explainer; "delete my data" endpoint; a plain-English retention statement. |

---

# PHASE 4 — CODEBASE VS README GAP

| README / docs claim | Implementation | Actual status | Gap | Priority |
|---|---|---|---|---|
| "AI-powered … multimodal fusion scoring" | `fusion.py` runs; untrained; output discarded by heuristics | **Cosmetic** | The AI does not contribute to the output | **P0** |
| "Real-time speech confidence analysis" | Client-side if/else ladder; single end-of-session server score | **Partial** | No real-time model inference | P1 |
| "Facial engagement and posture analysis" | Nose-centering + mouth-aperture; no pose model | **Mislabelled** | Neither engagement nor posture is measured | **P0** |
| "Production-ready APIs" | No auth/limits/logging/tests/CI/Docker/migrations | **Absent** | Everything the phrase implies | **P0** |
| `docs/security.md` (entire file) | Zero security controls implemented | **0% implemented** | The file describes a posture that does not exist | **P0** |
| `docs/deployment.md` compose + Dockerfile | No Dockerfile; compose `build:` cannot resolve | **Non-functional** | Documented deploy path is impossible | P1 |
| `docs/environment.md`: 7 backend vars | `os.getenv` called once, for `REDIS_URL` | **6 of 7 fictional** | No config layer exists | P1 |
| `docs/api.md` "consistent error responses and HTTP status codes" | Bare `except: print()`; 200 + score 0.0 on all failures | **Absent** | No error contract | P1 |
| UI: "Whisper-X Transcription" | No ASR; hardcoded placeholder string | **Fabricated** | Panel describes a component that does not exist | **P0** |
| UI: "Executive AI Critique" | LLM critiques the placeholder string | **Hallucination by design** | Feedback is about content never observed | **P0** |
| "Session history" | `localStorage`; server endpoint unused | **Partial** | Not durable, not cross-device | P1 |
| "Data Flywheel" | `session_id` always 0; `perceived_score` fabricated | **Structurally broken** | Feedback unjoinable and unlabelled | P1 |
| `train.py`: "backend will automatically use this model" | `joblib.load` appears 0 times | **False** | Dead 553 KB artefact in git | P2 |
| `ml/README.md`: "DELETE IMMEDIATELY: train.py, SQLite" | Both present on main | **Ignored** | Project contradicts its own plan | P2 |
| `project_history.md`: "251 tests," NIM ASR, Postgres, push, blendshapes, calibration, auth | **None of it exists at `origin/main`** | **Not in this repository** | See §0 | **P0** |

**Additional dead / placeholder / hygiene inventory:**
- `confidence_model.joblib` (553 KB) — trained, committed, never loaded
- `train.py` — tautological, superseded, marked for deletion by the project's own blueprint
- `hubert_audio.py` — entirely superseded by `fusion.py`; its `process_audio_buffer` (webm → tempfile → librosa) is called by nothing
- `Start.jsx`, `Profile.jsx`, `ConfidenceTrends.jsx` — unrouted; the last one throws on render
- `@google/generative-ai` — unused dependency
- `confidence-speaker/out.log` — UTF-16 Vite dev log, committed
- `confidence-speaker/README.md` — still the stock `create-vite` template
- `__pycache__/*.cpython-313.pyc` — bytecode committed (4 files)
- `confidence.db` — committed, stale schema, breaks the app
- 5 questions in the entire bank, all interview-generic
- `main.py:22` "SQLite for Phase 1", `tasks.py:51` "Phase 2/3", `tasks.py:113` "before real pgvector migration" — phase markers as a substitute for issue tracking
- `finally: pass` — dead code

---

# PHASE 5 — STARTUP VIABILITY

**What problem does this actually solve?** Practising a spoken answer alone is unfalsifiable. You cannot hear yourself the way others hear you, and re-listening is uncomfortable enough that almost nobody does it twice. That is a real problem and it is real.

**What does this product currently solve?** Nothing yet — because the feedback it returns is not derived from the user's performance. A number driven by microphone gain and a critique of a string they never spoke. A user who practises three times and notices the score tracks how close they sat to the laptop will never open it again. **The product's credibility is one observant user away from zero.**

**Who has the problem:**
- **University students before placement season.** Highest volume, highest anxiety, sharpest deadline, near-zero willingness to pay.
- **Career switchers and laid-off mid-career engineers.** Acute pain, measurable stakes, real budget ($50–300 for interview prep is a normal purchase).
- **Non-native English speakers interviewing internationally.** Structurally underserved. Highest pain. Strongest willingness to pay.
- **Sales reps and founders.** Budget exists but they buy coaching, not software.

**How painful?** For someone two weeks from an interview that determines their next three years: 8/10. Four weeks after they get the job: 0/10. **This is episodic pain, not chronic pain,** and it is the central business problem — you get a 2–6 week engagement window and then the user is gone forever, satisfied. Retention is structurally hostile. Everything strategic flows from this fact.

**Who would pay, and why:**
| | Consumer | University career services | Corporate L&D |
|---|---|---|---|
| Willingness to pay | Low ($5–15 one-off) | Medium ($5–20k/yr) | High ($20–100k/yr) |
| Sales cycle | Instant | 6–12 months | 6–18 months |
| Retention | Terrible (episodic) | Good (annual renewal) | Good |
| Buyer ≠ user | No | **Yes** | **Yes** |
| Requirements | Works, feels fair | Cohort analytics, SSO, DPA, accessibility | SSO, SOC 2, audit logs, RBAC, DPA |

The B2B buyer is the only one with money, and the B2B buyer's first question is *"can you show me this is fair across demographics?"* — which is exactly the question M7 says you cannot currently answer.

**Alternatives users have today:** a phone camera and a mirror (free, works, universally available, and genuinely the main competitor); ChatGPT/Claude voice mode (free-ish, gives *substantive* feedback on content, improving monthly); Pramp/Exponent (free peer mock interviews with a real human — the strongest substitute); Yoodli, Orai, Poised (direct commercial competitors); a $150/hr human coach.

**Why would they switch?** Today: they would not. The mirror gives more honest feedback than a score driven by microphone gain. Tomorrow, if you build content relevance, they might — because the mirror cannot tell you that you never actually answered the question, and neither can any tool that only scores how you sound.

**The wedge:** *"Did you actually answer the question?"* Score delivery, but **cap it on relevance** — a fluent answer to a different question must not score well. Your own `project_history.md` identifies this exact insight ("a fluent recitation of an unrelated passage scored 85/100 is what motivated the relevance-judging pipeline"). That is the single best idea across all your documents, and it is not in this codebase. It is also cheap: one LLM call over a real transcript, costing well under a cent.

**Beachhead:** non-native English speakers preparing for technical interviews at international companies. Concentrated, findable (r/cscareerquestions, Blind, bootcamp Discords, university international-student offices), acutely underserved by human coaching (accent bias, cost, scheduling), and — critically — the group for whom "did you answer the question" beats "did you sound confident," because fluency and comprehension diverge most sharply for them.

**Larger platform:** *structured spoken-communication assessment.* Interview practice → sales pitch review → conference talk rehearsal → medical/legal oral exam prep → customer-call QA. The underlying primitive — "transcribe a spoken response, judge it against a rubric, return evidence-cited findings" — generalises well beyond interviews. But only after the core assessment is trustworthy.

**Roles:**
- **User** = job seeker · **Buyer** = same person (consumer) or career-services director / L&D manager (B2B)
- **Beneficiary** = the user, and the employer who interviews a better-prepared candidate
- **Decision maker** = the user (consumer); a committee with a security questionnaire (B2B)
- **Economic value** = P(offer) × Δcompensation. For a $120k role, a 2-point probability shift is ~$2,400 of expected value — which means $30 is an easy purchase **if** the user believes the feedback. Belief is the entire business, and belief is what the current scoring function destroys.

### Classification

**B — Portfolio project**, with a demo-quality UI, carrying documentation written at level **H (Enterprise product)**.

Evidence for B: 3 commits · 0 tests · 0 CI · 0 Dockerfiles · hardcoded `localhost` in 3 files · no auth · 3 rows in the shipped database · `__pycache__` and a dev log committed · deps file that does not install a working system · untrained model.

It is not C (hackathon prototype) — the UI polish and the deliberate render-loop work are beyond hackathon standard. It is not D (research prototype) — there is no experiment, no dataset, no metric. It is not F (SaaS MVP) — it cannot be deployed.

**The gap between the documentation's level (H) and the code's level (B) is the finding.** A portfolio project honestly labelled is a positive signal. A portfolio project labelled "production-ready" and "enterprise" is a negative one, because the reviewer stops evaluating your engineering and starts evaluating your judgement.

---

# PHASE 6 — MARKET DIFFERENTIATION

> Market statements below are reasoning from the product, not researched facts. **Every competitor claim needs validation** — spend a day using Yoodli, Orai, Poised, and ChatGPT voice mode before committing to any of it.

**What already exists (assumption, verify):** Yoodli (filler-word and pace analytics, freemium, strongest direct competitor); Orai (mobile-first speech coaching); Poised (real-time meeting coaching); Interviewing.io / Pramp / Exponent (human mock interviews — the real substitute); ChatGPT/Gemini voice mode (free, improving, and already better at content feedback than anything in this repo); LinkedIn Interview Prep (free, enormous distribution).

**What this duplicates:** essentially all of the current feature set. Record → score → tips is the category's table stakes. Prosody metrics are a solved commodity — `librosa` gives you pitch and RMS in three lines, which is exactly what this code does.

**Genuinely differentiated — in the documents, not in the code:** (a) **relevance-capped scoring**, (b) **within-speaker delta as the headline number** rather than an absolute score.

**Trivially copied:** the UI, the prosody metrics, the question bank, the LLM critique, the scoring heuristics. Assume a funded competitor replicates the entire current feature set in three weeks.

| Moat type | Current state | Realistic path |
|---|---|---|
| **Feature** | None | Relevance-capping ships in ~2 weeks. Buys ~6 months. |
| **Technical** | **Negative** — untrained net, gain-driven score | Only real after a within-speaker reliability study + a fairness audit. Publish both. |
| **Business** | None | University/bootcamp partnerships — slow, defensible, and the buyer has budget. |
| **Data** | **Structurally blocked** | The strongest available moat. Blocked today: `session_id=0`, fabricated `perceived_score`, per-modality signals never persisted. **Fixing that persistence is the single highest-leverage engineering act in this document** — it converts every future session into an asset instead of a log line. |
| **Network effect** | None | Weak for solo practice. Real if you add peer review ("3 strangers rated your answer") — but that is a different, much harder product. |
| **Distribution** | None | The only genuinely fast lever: university career centres, bootcamp curricula, /r/cscareerquestions. Free tier as a wedge. |
| **Switching cost** | **Near zero** — history is in `localStorage` | Server-side longitudinal history against a personal baseline. Six months of your own trend line is genuinely hard to walk away from. |

**Strongest realistic moat: the data flywheel, built on relevance-judged sessions.** Concretely: persist `(question, transcript, per-modality signal vector, model score, user-supplied expected score, whether they got the offer)`. After ~5,000 labelled sessions you can train calibration that no competitor can replicate without their own 5,000. **That outcome label — did they get the offer — is the asset.** Nobody in this category is collecting it, it is the only ground truth that matters, and asking for it is one email six weeks after a session.

To be blunt about sequencing: you cannot build that moat until B8 (errors recorded as scores), B7 (duplicate writes), and the `session_id=0` bug are fixed, because right now every row you collect is noise.

---

# PHASE 7 — INDUSTRY-STANDARD ENGINEERING GAP

| Dimension | Current | Required | Gap |
|---|---|---|---|
| **Architecture** | Gateway blocks on inference; worker imports the web app | Async dispatch; shared `db.py`; no cross-imports | Large |
| **Modularity** | `main.py` holds app, models, schemas, routes, WS | `api/routes/`, `schemas/`, `db.py`, `core/config.py` | Medium — `ml/README.md` already specifies the target layout |
| **Type safety** | Pydantic on 2 request bodies only; no response models; no mypy; JS with no TS | Typed responses; `mypy --strict` on `ml/` and `workers/`; TS or JSDoc on the client | Large |
| **Error handling** | `except Exception: print()`; failures returned as score 0.0 | Typed exception hierarchy; RFC 7807 responses; failures never become data | Large |
| **Logging** | 28 × `print()`; `import logging` appears **0 times** | `structlog` JSON to stdout with `session_id`/`user_id`/`request_id`/`task_id` | Large |
| **Configuration** | One `os.getenv`; DB URL and 3 API URLs hardcoded | `pydantic-settings` server-side; `VITE_API_BASE_URL` client-side; fail fast on missing required config | Large |
| **Dependencies** | UTF-16 requirements missing torch/transformers/celery/redis; unused npm package | `pyproject.toml` + lockfile (uv/poetry); prune npm | Large |
| **Unit tests** | **0** | Scoring pure functions, prosody extractors, delta math, Pydantic schemas. ≥70% on `ml/` and `workers/` | Total |
| **Integration tests** | **0** | `httpx.AsyncClient` over every route; WS handshake → stream → finish; auth rejection cases | Total |
| **E2E** | **0** | Playwright (already installed in this environment): login → record → report | Total |
| **Load tests** | **0** | Locust: 50 concurrent session-ends. This is the test that would have caught A1 on day one. | Total |
| **Security tests** | **0** | Auth bypass, IDOR, oversized-payload, CORS assertions in CI | Total |
| **AI evaluation** | **0** | **Test-retest reliability first** (same speaker, same answer, twice → score delta). Then a 50-recording golden set with 3 human raters and inter-rater agreement. Then a fairness slice. | Total — and this is the one that decides whether the product is real |
| **CI/CD** | **0** | GitHub Actions: ruff + mypy + pytest + eslint + build + `pip-audit` + `npm audit` on every PR | Total |
| **Containers** | **0** | Multi-stage Dockerfile; model weights baked into the image (a cold `from_pretrained` on boot is a 380 MB download on every scale-up) | Total |
| **Deployment** | Manual PowerShell | One-command compose locally; managed platform in prod; versioned images | Total |
| **IaC** | **0** | Not needed at this stage. Render/Fly config files are sufficient until ~10k users. |
| **Secrets** | **Groq key shipped in the browser bundle** | Server-side only; platform secret store; rotate the current key | Critical |
| **Rollback** | None | Tagged images + one-command redeploy | Total |
| **Health checks** | `GET /` returns a string literal | `/healthz` (liveness) + `/readyz` (DB, Redis, model loaded) | Medium |
| **Timeouts** | One (25 s, on the wrong call) | Timeouts on every external call: Groq, DB, Redis, model inference | Large |
| **Retries** | None | Celery `autoretry_for` with backoff; idempotency key on session writes | Large |
| **Circuit breakers** | None | On Groq and on inference; shed load rather than OOM | Large |
| **Graceful degradation** | Inverted — the fallback is *more* dangerous than the failure | Fallback must be *cheaper*: heuristic-only score, clearly labelled | Large |
| **Backup / DR** | None (SQLite in git) | Managed Postgres with PITR; a restore actually rehearsed | Total |
| **SLO/SLI** | None | p95 score latency < 20 s; availability 99.5%; score-error rate < 1% | Total |
| **Metrics** | None | `prometheus-fastapi-instrumentator` + queue depth, inference duration, score distribution, per-modality null rate | Total |
| **Tracing** | None | OpenTelemetry: WS connect → dispatch → inference → LLM → persist | Total |
| **Error monitoring** | None | Sentry, both ends. Highest value per hour spent of anything in this table. | Total |
| **LLM observability** | None | Log prompt hash, model, tokens, latency, cost per call | Total |
| **Cost monitoring** | None | Per-session cost attribution | Total |
| **Threat model** | None | One page: assets (voice, embeddings, transcripts), actors, surfaces, controls | Total |
| **RBAC** | None | Not needed pre-B2B. Required the day a university signs. |
| **Encryption** | TLS unavailable (`http://`/`ws://` hardcoded) | TLS everywhere; at-rest encryption on managed DB; explicit policy for voice artefacts | Large |
| **Audit logging** | None | Required for B2B. Immutable log of data access and export. |
| **Product analytics** | **0** | You cannot currently answer "how many sessions does a user complete?" | Total |
| **Onboarding** | None | First-run explainer; permission pre-prompt; a guided first session |
| **Feedback loop** | Broken (`session_id=0`, fabricated scores) | Real session linkage; ask for a number; persist per-modality signals alongside | Critical |
| **Retention mechanics** | None | Streaks, daily challenge, email nudge |
| **Telemetry** | None | PostHog (free tier, self-hostable, 30 minutes to integrate) |

---

# PHASE 8 — SCALABILITY

Assume 1 session ≈ 60 s audio ≈ 3.84 MB raw Float32, ~600 vision frames, one HuBERT forward pass, one LLM call. Assume 2 sessions/user/week.

### 10 users (~3 sessions/day)
Works on one laptop. **But the first bottleneck appears at 2 concurrent session-ends, not at scale** — `task.get(timeout=25)` blocks the event loop, so the second user's page hangs. **This is the first architectural bottleneck and it appears at single-digit concurrency.** Also: the shipped DB breaks every write until it is deleted.

### 100 users (~30 sessions/day, peak ~5 concurrent)
SQLite `database is locked` begins under concurrent gateway+worker writes. HuBERT on a 2-vCPU box takes 15–25 s per 60 s clip, so the 25 s timeout fires regularly → the fallback runs inference *in the gateway* → memory climbs → OOM. Needs: Postgres, async dispatch, 2+ worker processes. **Cost: ~$50–80/mo.**

### 1,000 users (~300 sessions/day, peak ~20 concurrent)
Attention over ~3,000 HuBERT frames allocates roughly `12 heads × 3000² × 4 B ≈ 432 MB` **per layer** for the attention matrix on a 60 s clip; a 90 s clip roughly doubles it. A 4 GB worker handles ~1–2 concurrent inferences before OOM. You need ~6–8 worker vCPUs or a single small GPU. Redis holds ~150 MB of in-flight hex payloads at peak. Object storage becomes mandatory for audio. Needs: managed Redis, managed Postgres, worker autoscaling on queue depth, structured logs, Sentry, metrics. **Cost: ~$250–400/mo. At 1,000 free users that is pure burn.**

### 10,000 users (~3,000 sessions/day, peak ~120 concurrent)
CPU inference is now the dominant line item and it is buying you nothing (M1). **This is where you either train the model or delete it.** Deleting it drops per-session compute by ~99% and the score does not change. Needs: GPU inference nodes (or none), read replica, CDN, batched inference, a real queue (the ingest path outgrows Redis lists), per-tenant rate limiting, OTel tracing. **Cost with HuBERT: $2,000–4,000/mo. Without it: ~$400–700/mo.**

### 100,000 users (~30,000 sessions/day, peak ~1,200 concurrent)
WebSocket fan-out needs sticky routing and a connection-state store. Postgres needs partitioning on `sessions` by month. Raw audio at 30k sessions/day ≈ 115 GB/day if retained — **retention policy becomes a cost decision, not a privacy one**. LLM calls are now the dominant *variable* cost. Needs: multi-region, ASR batching, aggressive audio TTL, dedicated data warehouse. **Cost: $8,000–20,000/mo depending on ASR/LLM choices.**

### 1,000,000 users
A different company. Self-hosted ASR on owned GPUs, a fine-tuned small model replacing the general LLM, Kafka ingest, a tiered storage lifecycle, full SRE practice. Not a useful planning horizon today.

**The honest summary:** every scaling number above is dominated by inference for a model that contributes nothing to the output. **Deleting the untrained HuBERT path reduces your cost curve by roughly an order of magnitude and improves nothing about the product's accuracy, because it currently contributes nothing to accuracy.** That is the most important scalability fact in this document, and it is also a product fact.

---

# PHASE 9 — UNIT ECONOMICS

**Assumptions — all require validation:**
- 60 s session, 2 sessions/user/week, 8 sessions/user/month
- Groq `llama-3.1-8b-instant` ≈ $0.05/M input, $0.08/M output *(verify — provider pricing moves)*
- ~600 input + 250 output tokens per critique
- `faster-whisper base.en` on CPU ≈ 0.1× real-time
- Commodity cloud CPU ≈ $0.04/vCPU-hour; storage $0.023/GB-mo; egress $0.09/GB

### Cost per session, current architecture

| Component | Compute | Cost | Note |
|---|---|---|---|
| HuBERT forward (CPU, 60 s) | ~20 vCPU-s | **$0.00022** | **Buys zero information** |
| Librosa `piptrack` + RMS + ZCR | ~2 vCPU-s | $0.00002 | This *is* the actual score |
| TCN + fusion | <0.1 vCPU-s | ~$0 | Untrained |
| Groq critique | 850 tokens | **$0.00005** | Critiques a fake transcript |
| Gateway WS (60 s) | ~2 vCPU-s | $0.00002 | |
| DB write | — | ~$0.000001 | |
| Audio egress (3.84 MB in) | — | $0 | Ingress free |
| **Total** | | **≈ $0.00031** | |

### Cost per session, corrected architecture (HuBERT deleted, real ASR added)

| Component | Cost |
|---|---|
| `faster-whisper base.en` (0.1× RT, 60 s) | **$0.00007** |
| Prosody + lexical extraction | $0.00002 |
| LLM relevance + critique (one call, ~1,400 tok) | **$0.00012** |
| Gateway + DB | $0.00002 |
| **Total** | **≈ $0.00023** |

**You can add real transcription and real relevance judging — the two things that would make the product work — and *reduce* cost per session by ~25%.** That is the single most important number in this analysis. The expensive component produces nothing; the components that produce everything are nearly free.

### Monthly economics (8 sessions/user/month)

| | Current | Corrected |
|---|---|---|
| Variable cost/user/mo | $0.0025 | $0.0018 |
| Fixed infra at 1k users | $250–400 | $60–100 |
| **Total cost/user/mo @ 1k** | **~$0.30** | **~$0.08** |
| **Total cost/user/mo @ 10k** | ~$0.25 | ~$0.05 |

At **$9/mo**: gross margin **~97%** corrected, ~96% current. Both are excellent SaaS margins.

**So cost is not the problem, and it is important to say that clearly.** The problem is CAC and churn against episodic pain. If CAC is $25 (realistic for consumer with no organic channel) and average tenure is 2 months at $9, LTV is $17.40 — **LTV:CAC of 0.7, which is a business that loses money on every customer.** Fixing that is a distribution and packaging problem, not an infrastructure problem:
1. **Price for the episode, not the month.** "$29 for 30 days of unlimited interview prep" matches the pain shape. Do not fight the churn; monetise the burst.
2. **Sell to institutions.** One university at $10k/yr with 2,000 students is a CAC of $5/user and 12-month retention by contract.
3. **Free tier as the acquisition channel.** At $0.0018/session, 10,000 free users cost ~$18/month in variable cost. Free is essentially free. Use it.

**Cost bottlenecks in priority order:** (1) untrained HuBERT — delete it; (2) raw audio retention at scale — 30-day TTL, keep derived features forever (they are ~2 KB/session and they are the actual asset); (3) LLM tokens — cap input length, one combined call not two; (4) always-on GPU — do not buy one until CPU ASR is measurably the constraint.

---

# PHASE 10 — PRODUCTIZATION

| Area | Current | MVP (must have) | Can wait |
|---|---|---|---|
| **Onboarding** | None | Permission pre-prompt explaining why mic/camera; one guided baseline session; a "here's what we measure and what we don't" screen | Personalised goal setting |
| **Auth** | Firebase on the client, **nothing on the server** | Server-side ID token verification. **P0 — everything else is theatre without it** | SSO, MFA |
| **Accounts** | None server-side | `users` table keyed on Firebase UID; profile; **delete-my-data endpoint** (legal requirement given voice data) | Teams, orgs |
| **Billing** | None | Nothing until retention is proven. Building Stripe before you know anyone returns is the classic wasted month. | Stripe Checkout + webhook at PMF |
| **Subscriptions** | None | — | Tiering |
| **Usage limits** | None | Per-account rate limit (abuse control, not monetisation). **P0 — it is a security control.** | Quota tiers |
| **Analytics** | **None** | PostHog. Funnel: `landing → permission grant → session start → session complete → report view → second session`. **You currently cannot answer a single product question.** | Cohorts, experiments |
| **Admin** | None | A read-only SQL console is sufficient | Real admin UI |
| **Support** | None | An email address in the footer | Intercom |
| **Docs** | 9,500 words describing a different system | An honest README + a 60 s demo GIF. **Delete more than you add.** | API docs |
| **API strategy** | Accidental public API | Lock it behind auth. It is not a product. | Public API at enterprise |
| **Notifications** | None | Email: "your streak is at risk" (a cron + SendGrid, one afternoon) | Web push |
| **Feedback** | Broken (`session_id=0`) | Fix linkage; ask "what score did you expect?" **as a number**; persist per-modality signals with every session | Labelling UI |
| **Feature flags** | None | An env var is sufficient at this size | LaunchDarkly |
| **Experimentation** | None | — | A/B at >1k users |
| **Retention** | None | Streaks + personal-baseline trend on the report. Cheap, and directly attacks the episodic-pain problem. | Leaderboards |
| **Data export** | Clipboard JSON, no error handling | Real JSON/CSV download | PDF report |
| **Privacy** | **None** | Retention statement; audio deleted after N days; explicit consent before first recording; deletion endpoint. **P0 — biometric-adjacent data with no policy is a legal problem, not a roadmap item.** | GDPR DSAR automation, DPA |

---

# PHASE 11 — ENTERPRISE READINESS

An enterprise evaluation of this system ends at question 1. For completeness:

| Question they will ask | Current answer | Gap |
|---|---|---|
| "How do you authenticate API requests?" | We don't. | **Blocking** |
| "Show me your tenant isolation model." | Any client can read any user's sessions by changing a URL path segment. | **Blocking** |
| "Are you SOC 2 Type II?" | No audit, no controls, no evidence collection. | Blocking (6–12 months, ~$30–60k) |
| "Where is voice data stored and for how long?" | Buffered in application memory; no retention policy exists. | **Blocking** |
| "Is voice data used for training? Can we opt out?" | The `/api/feedback` endpoint says "absorbed into Flywheel"; there is no opt-out and no policy. | **Blocking** |
| "Who owns the data?" | Undefined. | Blocking |
| "GDPR Art. 15/17 — access and erasure?" | No endpoints. Voice embeddings are biometric-adjacent (GDPR Art. 9 special category; US state biometric statutes). | **Blocking + legal exposure** |
| "Audit logs for data access?" | 28 `print()` statements to stdout. | Blocking |
| "SSO — SAML or OIDC?" | Firebase email/Google only. | Blocking |
| "RBAC for admins and managers?" | No roles. | Blocking |
| "SLA?" | No health check, no uptime monitoring, no incident process, no status page. | Blocking |
| "Can you deploy in our VPC?" | No container image exists. | Blocking |
| "API versioning and deprecation policy?" | Unversioned; no contract. | Medium |
| "Integrations — Workday, Greenhouse, Canvas, LMS?" | None. | Medium |
| "Sub-processors?" | Google/Firebase and Groq, undisclosed. Groq is called **from the user's browser**, so user IP addresses reach a third party with no DPA. | **Blocking** |
| "Disaster recovery — RTO/RPO?" | SQLite file, no backups. | Blocking |
| "Penetration test report?" | None. An internal test would find S1–S6 in under an hour. | Blocking |
| **"Prove the model does not discriminate by gender, accent, age, or disability."** | **Cannot be answered.** The score is driven by microphone gain, pitch variance, and head stability — all demographically correlated. No fairness data exists. | **Blocking, and the hardest one** |
| "Accessibility — VPAT / WCAG 2.1 AA?" | Two media queries, one focus style, no ARIA, no reduced-motion. A public university cannot procure this. | Blocking |

**Realistic assessment: enterprise is 18–24 months away and should not shape any decision you make this year.** Targeting it now would mean building SSO and audit logs for a product whose score is not yet trustworthy — spending a year of work to make an untrustworthy product auditable. The correct move is to ignore enterprise entirely until the assessment is defensible, then let a university pilot pull you into the compliance work.

---

# PHASE 12 — 0 → 1 PRODUCT STRATEGY

### Stage 1 — Honest Technical MVP (Weeks 1–3)
**Objective:** the repository tells the truth, runs from a clean clone, and cannot be trivially attacked.
**Engineering:** fix `requirements.txt`; delete the committed DB and add Alembic; server-side Firebase token verification; non-blocking task dispatch; WS payload caps; move the Groq key server-side and **rotate it**; `VITE_API_BASE_URL`; delete the "Whisper-X" panel and the LLM critique; Dockerfile + compose; GitHub Actions running lint + a first test.
**Product:** rewrite the README to describe what exists.
**Validation:** a stranger clones and runs it in under 10 minutes on a machine that is not yours.
**Success metric:** clean clone → working session, no manual fixes. CI green.
**Do NOT build:** billing, teams, admin, mobile app, GPU infra, Kubernetes.

### Stage 2 — Usable MVP (Weeks 4–7)
**Objective:** feedback derived from what the user actually said.
**Engineering:** `faster-whisper base.en` transcription; **one** LLM call returning relevance score + critique together; cap the final score on relevance; replace mouth-aperture/nose-centering with MediaPipe **blendshapes**; measure pitch in **semitones relative to the speaker's own median** (removes the gain and register bias); **delete HuBERT and `train.py`**; persist per-modality signals with every session; PostHog.
**Product:** report screen shows evidence, not adjectives — "7 fillers: 'um' ×4, 'like' ×3", "you didn't mention the outcome."
**Validation:** record the same answer twice. **Score delta must be < 5 points.** If it isn't, nothing downstream matters.
**Success metric:** test-retest delta < 5; relevance cap demonstrably fires on an off-topic answer.
**Do NOT build:** streaks, notifications, social, more question categories.

### Stage 3 — Early Users (Weeks 8–12)
**Objective:** 50 real users, 10 of them recurring.
**Engineering:** deploy for real (Render/Fly + managed Postgres + Redis); Sentry; `/healthz`; server-side session history; delete-my-data endpoint; 68+ questions across 10 categories.
**Product:** find 50 non-native-English job seekers in bootcamp Discords, `/r/cscareerquestions`, and university international-student offices. Watch 10 of them use it live. Say nothing while they do.
**Validation:** do they return unprompted within 7 days?
**Success metric:** ≥20% of users complete a 2nd session within 7 days. **Below 10%, stop and re-examine the product, not the code.**
**Do NOT build:** billing, teams, mobile.

### Stage 4 — Product-Market Validation (Months 4–6)
**Objective:** evidence the feedback changes behaviour.
**Engineering:** longitudinal baseline trend; streaks; email nudges; calibration fitted on real ratings once you have ≥200.
**Product:** 20 structured interviews. Ask: *"did you change how you answered because of this?"*
**Validation:** 5 users who say the product made a specific, nameable difference.
**Success metric:** D7 ≥ 25%; ≥5 unsolicited "this helped me" messages; a measurable within-user score improvement across ≥5 sessions.
**Do NOT build:** enterprise anything.

### Stage 5 — Repeatable Use Case (Months 6–8)
**Objective:** one segment, one job, one measurable outcome.
**Validation:** 3 users in the *same* segment describing the *same* value in the *same* words. That sentence becomes your landing page.
**Success metric:** a written ICP you would bet on.

### Stage 6 — Paid (Months 8–11)
**Objective:** revenue.
**Engineering:** Stripe Checkout + webhook + quota enforcement.
**Product:** $29 for a 30-day unlimited pass. Price the episode.
**Validation:** 25 paying users acquired without a discount.
**Success metric:** ≥3% free→paid; CAC < $20.
**Do NOT build:** annual plans, enterprise tiers, an affiliate program.

### Stage 7 — Scalable Startup (Year 2)
**Objective:** a channel that compounds.
**Engineering:** learned weights from the accumulated per-modality signals + outcome labels; the fairness harness; SOC 2 if institutional demand is real.
**Validation:** one repeatable acquisition channel with predictable CAC.
**Success metric:** LTV:CAC > 3 with month-over-month growth that does not depend on you posting.

---

# PHASE 13 — PRIORITIZED EXECUTION PLAN

## P0 — Critical blockers

| # | Problem | Why it matters | Exact fix | Effort | Depends on | Success metric |
|---|---|---|---|---|---|---|
| P0-1 | `task.get(timeout=25)` blocks the event loop (`main.py:194-201`) | 4 concurrent session-ends take the service down. Refutes the core architectural claim. | Return `task_id` immediately; worker publishes to a Redis pub/sub channel; gateway subscribes with `redis.asyncio`. Delete the `asyncio.to_thread` fallback. | 1 d | — | Locust, 50 concurrent finishes: p99 on `GET /` < 100 ms |
| P0-2 | No backend auth; IDOR; baseline overwrite (S1, S2, S5) | Any user's data is readable and corruptible by anyone. | Verify Firebase ID tokens via `google-auth` + Google JWKs. `Depends(current_user)` on every route. Token on the WS connect. Delete `{user_id}` from the path and every client-supplied `user_id`. | 2 d | — | Integration test: request without a token → 401; with user A's token for user B's data → 403 |
| P0-3 | **Groq API key in the browser bundle** (S3) | Anyone who loads the site can extract and spend your key. | Move to `POST /api/critique` behind auth + rate limit. Key in server env only. **Rotate the existing key now.** | 0.5 d | P0-2 | `grep -r "gsk_" dist/` returns nothing |
| P0-4 | Unauth'd WS memory-exhaustion DoS (S4) | One socket OOMs the gateway. | Auth the socket; cap `audio_buffer` at `16000*4*180` bytes; cap `vision_tensors` at 2,000 frames; validate each frame is 52 floats; 5-min idle timeout; close 1009 on exceed. | 0.5 d | P0-2 | Test: 100 MB stream → clean close, flat memory |
| P0-5 | Stale committed `confidence.db` breaks every write | **Proven:** `OperationalError: table sessions has no column named scenario_title`. Clean clone = broken app. | `git rm --cached confidence.db confidence_model.joblib out.log __pycache__`; `.gitignore` them; add Alembic. | 0.5 d | — | Fresh clone → session saves |
| P0-6 | `requirements.txt` UTF-16 and missing torch/transformers/celery/redis | Documented install produces a backend that cannot import its own worker. | Re-encode UTF-8; move to `pyproject.toml` with a lockfile; add all real deps. | 0.5 d | — | Clean venv install → `uvicorn main:app` boots; worker imports |
| P0-7 | **LLM critiques a hardcoded placeholder, under a "Whisper-X Transcription" heading** | A system designed to produce confident feedback about content it never observed. Reputationally fatal. | Delete the transcript panel and the critique call **today**. Re-enable only after real ASR (P1-1). | 2 h | — | No LLM call without a real transcript |
| P0-8 | Hardcoded `localhost` in 4 files | Frontend cannot be deployed. | `VITE_API_BASE_URL`; derive WS URL; `wss://` in prod. | 2 h | — | Built bundle contains no `localhost` |
| P0-9 | README claims "production-ready," untrained model, posture analysis | Every claim is falsifiable in minutes. The credibility cost exceeds the feature value. | Rewrite per Phase 18. State the untrained model explicitly. | 4 h | — | Every remaining claim traceable to a file or a metric |
| P0-10 | `project_history.md` claims 251 tests, NIM ASR, Postgres, auth — none present | If it is a draft, it is a false claim. If the work exists, it is unpushed. | Push the work, or correct the document. | ? | Your answer | The doc matches `git ls-tree -r origin/main` |
| P0-11 | CORS `*` + credentials (S6) | Every origin trusted with credentials. | Explicit allowlist from config. | 1 h | — | Preflight from an unknown origin → no CORS headers |

## P1 — Must fix before serious users

| # | Problem | Why | Fix | Effort | Dep | Metric |
|---|---|---|---|---|---|---|
| P1-1 | No ASR — content is never analysed | Without a transcript the product cannot answer the only question that matters. | `faster-whisper base.en` in the worker. | 2 d | P0-1 | WER < 15% on 20 real recordings |
| P1-2 | Score driven by mic gain (`avg_volume > 0.02` = +15) | Trivially gamed; demographically biased; destroys trust the moment anyone notices. | Delete the absolute-volume term. Measure pitch in **semitones relative to the speaker's own median**; measure *pace*, not loudness. | 2 d | P1-1 | Same speaker at 2 mic distances: score delta < 3 |
| P1-3 | No relevance check | **This is the wedge.** A fluent off-topic answer currently scores well. | One LLM call returning `{relevance: 0-1, critique: str}`; cap the final score at `min(score, 40 + relevance*60)`. | 2 d | P1-1 | Off-topic answer scores < 50; on-topic unaffected |
| P1-4 | Untrained HuBERT burns ~20 vCPU-s/session for zero information | It is ~95% of compute and contributes nothing. | Delete `fusion.py`, `hubert_audio.py`, `tcn_vision.py`, `train.py`, `confidence_model.joblib` from the scoring path. Keep the blueprint in `ml/README.md` as a design doc. | 0.5 d | P1-1, P1-2 | Session latency < 5 s; score unchanged |
| P1-5 | `session_id: 0`; fabricated `perceived_score` | Feedback is unjoinable and unlabelled — the flywheel collects noise. | Return the server `session_id` and thread it through. Ask "what score did you expect?" as a number. | 1 d | P0-2 | Every feedback row joins to a real session |
| P1-6 | Per-modality signals never persisted | **Highest-leverage data decision in the project.** Without them, ratings can never train anything. | `signals JSONB` column on `sessions`; write every measured value with a schema version. | 1 d | P0-5 | Every session has a complete, versioned signal vector |
| P1-7 | Errors recorded as `confidence_score: 0.0` | Failures silently become training data. Already present in the shipped DB. | Return `{"status":"error"}`; never persist a failed run as a score; render an error state. | 0.5 d | — | Zero rows with a score from a failed run |
| P1-8 | Every session written twice with divergent fields | Duplicate rows, inconsistent data. | Single write path in `storage.js`; remove the `Speaking.jsx` POST; idempotency key. | 0.5 d | — | 1 row per session |
| P1-9 | Zero tests | No refactor is safe; no claim is verifiable. | pytest: schemas, scoring, auth, IDOR, WS caps. Playwright: login → record → report. | 3 d | P0-1..6 | ≥70% on `ml/` + `workers/`; CI green |
| P1-10 | No CI | Nothing is enforced. | Actions: ruff, mypy, pytest, eslint, build, `pip-audit`, `npm audit`. | 1 d | P1-9 | Required checks on every PR |
| P1-11 | No Docker | Documented deploy is impossible. | Multi-stage Dockerfile with weights baked in; compose with Postgres + Redis. | 1 d | P0-6 | `docker compose up` → working stack |
| P1-12 | 28 `print()`, zero logging, zero metrics | Production would be unobservable. | `structlog` JSON with `session_id`/`user_id`/`request_id`; Sentry both ends; `prometheus-fastapi-instrumentator`. | 1.5 d | — | Every request traceable by ID |
| P1-13 | `ScriptProcessorNode` + duplicate mic streams | Deprecated, main-thread, drops buffers during the measurement. | One `getUserMedia`, one `AudioContext`, `AudioWorkletNode`. | 1 d | — | Zero dropped buffers over a 60 s session |
| P1-14 | Raw landmarks sent where blendshapes are assumed | Measures head position, not expression. | `outputFaceBlendshapes: true`; send the 52 coefficients. | 0.5 d | — | Head rotation changes the vector by < 5% |
| P1-15 | No privacy policy, retention, or deletion | Voice embeddings are biometric-adjacent. | Retention statement; audio TTL 30 d; `DELETE /api/me`. | 1 d | P0-2 | A user can delete everything in one click |
| P1-16 | No product analytics | You cannot answer a single product question. | PostHog + the core funnel. | 0.5 d | — | D7 retention is measurable |

## P2 — Product maturity

| # | Problem | Fix | Effort | Metric |
|---|---|---|---|---|
| P2-1 | 5 questions | Seed 68+ from JSON across 10 categories | 1 d | Users don't exhaust the bank |
| P2-2 | History in `localStorage` | Server as source of truth | 1 d | History survives device change |
| P2-3 | Broken `silence_count` (2613/60 s) | Rewrite on VAD, not frame counting | 1 d | Count matches manual annotation ±1 |
| P2-4 | `{q.title}` renders empty; inconsistent field mapping | Add `title` to the seed; unify the mapping | 2 h | Cards render; fields agree |
| P2-5 | Dead screens (`Start`, `Profile`, `ConfidenceTrends`) | Delete, or route and fix (Chart.js registration) | 2 h | No unreachable code |
| P2-6 | Findings are adjectives | Quantified, evidence-cited findings | 2 d | Every claim names its evidence |
| P2-7 | No retention mechanic | Server-side streak + daily challenge | 2 d | D7 +10pp |
| P2-8 | No onboarding | Permission explainer + guided baseline | 1 d | Permission-grant rate > 80% |
| P2-9 | Accessibility | Focus states, ARIA, `aria-live` on the score, `prefers-reduced-motion`, keyboard nav | 2 d | axe-core: 0 critical |
| P2-10 | No mobile layout | Responsive; portrait camera | 2 d | Usable at 390 px |
| P2-11 | Circular import (`tasks.py` → `main.py`) | Extract `db.py` | 2 h | Worker starts without importing FastAPI |
| P2-12 | No config layer | `pydantic-settings`; fail fast | 0.5 d | Missing required config → refuses to boot |
| P2-13 | Unused `@google/generative-ai` | Remove | 5 min | — |
| P2-14 | Stock `create-vite` README; `<title>confidence-speaker</title>` | Rewrite; brand the tab | 1 h | — |

## P3 — Scale

| # | Problem | Fix | Metric |
|---|---|---|---|
| P3-1 | 7.68 MB hex payloads through Redis | Object storage; pass the key; `msgpack` | 20× payload reduction |
| P3-2 | SQLite | Managed Postgres + PITR | Restore rehearsed |
| P3-3 | Raw audio retention | 30-day TTL; keep derived features forever | Storage flat as users grow |
| P3-4 | No autoscaling | Scale workers on queue depth | p95 < 20 s at 10× load |
| P3-5 | No tracing | OpenTelemetry end-to-end | One trace per session |
| P3-6 | No cost attribution | Per-session cost metric | Cost/session on a dashboard |

## P4 — Later
Learned weights from accumulated signals · demographic fairness harness · conversational follow-up · session replay with synced transcript · web push · team analytics · SSO/RBAC · SOC 2 · public API.

---

# PHASE 14 — THE 10 HIGHEST-LEVERAGE CHANGES

**1. Delete the untrained HuBERT/TCN/fusion path.**
Removes ~95% of compute, ~90% of infra cost, the OOM failure mode, the 25 s timeout, the Redis payload problem, and the single largest false claim — **and the score does not change**, because it currently contributes nothing. One deletion fixes an architecture problem, a cost problem, a scaling problem, and a credibility problem simultaneously. Nothing else in this document has that ratio.

**2. Add real ASR.**
`faster-whisper base.en` costs ~$0.00007/session and unlocks: content relevance, filler counting, hedging detection, pace in words-per-minute, structure analysis, and session replay. **One dependency turns five impossible features into free ones**, because they all derive from the same transcript. It is also the prerequisite for every genuine differentiator you have identified.

**3. Cap the score on content relevance.**
Your wedge. Every competitor scores *how you sound*; this scores *whether you answered*. One LLM call. It is the only claim in your entire document set that a user would switch products for, and the only one a competitor cannot copy in an afternoon — not because the technique is hard, but because it requires admitting that fluency scoring alone is not a product.

**4. Verify Firebase ID tokens server-side.**
Closes S1, S2, S4, and S5 at once. It is the difference between a demo and software. `google-auth` against Google's public JWKs needs no service-account key — roughly 30 lines.

**5. Persist per-modality signals with every session.**
The highest-leverage *data* decision available. Today a rating tells you "the score was wrong" with no recoverable record of what produced it. With a versioned signal vector, every session becomes a training example forever. This is the only line item that compounds, and **the cost of not doing it is every session recorded between now and whenever you do**.

**6. Delete the "Whisper-X Transcription" panel and the placeholder-fed LLM critique.**
Two hours of deletion that removes the most damaging artefact in the repository. A reviewer who finds a system generating confident feedback about content it never observed stops evaluating your engineering and starts evaluating your judgement — and they are right to.

**7. Rewrite the README to describe what exists.**
Your documentation is currently a *liability with a positive word count*. A README saying "heuristic prosody scoring; the fusion network is scaffolded and untrained; here is the reliability measurement" is more impressive to a senior engineer than "production-ready enterprise AI platform," because the first is a claim they can check and the second is one they will check.

**8. Measure test-retest reliability, and publish the number.**
Same speaker, same answer, twice. If the delta is > 10 points, the product does not work and no feature matters. One afternoon. This single metric is the entire difference between "an app that prints a number" and "a measurement instrument" — and no competitor publishes it, so publishing it is itself differentiation.

**9. Remove absolute volume from scoring; measure pitch in semitones relative to the speaker's median.**
Eliminates equipment bias and a large share of demographic bias in one change. It converts your headline metric from something gamed by moving closer to the laptop into something that reflects the speaker. It is also the first thing any B2B buyer will probe.

**10. Ship a Dockerfile, CI, and twenty tests.**
Not because tests find bugs here — the bugs are visible without them. Because a repository with `docker compose up`, a green CI badge, and a `tests/` directory is read by a senior engineer as *"this person has shipped before."* That perception gates hiring, co-founder conversations, and every technical diligence call. It is the cheapest credibility in software.

---

# PHASE 15 — WHAT TO DELETE

**Delete outright:**

1. **`ml/models/fusion.py`, `hubert_audio.py`, `tcn_vision.py`** — from the scoring path. Untrained, uncalibrated, never checkpointed, ~95% of compute, zero contribution. Keep the design in `ml/README.md` as a documented plan. *Removes: 380 MB RSS, the OOM path, the 25 s timeout, the 7.68 MB Redis payload, and the largest false claim.*
2. **`train.py`** — trains on its own outputs, bootstraps from the formula it claims to learn, and produces an artefact nothing loads. Your own blueprint says "DELETE IMMEDIATELY."
3. **`confidence_model.joblib`** — 553 KB, `joblib.load` appears zero times.
4. **`confidence.db`** — committed, stale schema, **proven to break every write**, and it carries a real user's voice-derived embeddings.
5. **`confidence-speaker/out.log`** — UTF-16 Vite dev log.
6. **`__pycache__/*.pyc`** — 4 committed bytecode files.
7. **The "Whisper-X Transcription" panel and the placeholder-fed LLM critique** — the most damaging four lines in the repo.
8. **`Start.jsx`** — duplicates `Login.jsx` with `alert()` error handling.
9. **`ConfidenceTrends.jsx`** — unrouted and would throw (missing Chart.js registration). Rebuild it later against server data.
10. **`Profile.jsx`** — unrouted; localStorage name + goal that nothing reads.
11. **`@google/generative-ai`** — unused dependency.
12. **The `asyncio.to_thread` fallback in `main.py`** — a fallback more dangerous than the failure it handles.
13. **`avg_volume > 0.02 → +15`** — grades microphone gain.
14. **`zcr > 0.05 → +10`** — rewards background noise as "clear consonants."
15. **`v_std < 0.03 → +5`** — rewards sitting still relative to a webcam.
16. **`confidence-speaker/README.md`** — still the stock `create-vite` template.

**Delete / rewrite in documentation:**

17. **`docs/security.md`** — 100% aspirational, 0% implemented. Replace with a short, honest posture statement. Claiming security you do not have is worse than claiming none.
18. **The Mermaid diagrams in `README.md` and `docs/architecture.md`** — they depict S3, PostgreSQL, and non-blocking dispatch, none of which exist.
19. **`docs/environment.md` rows for `DATABASE_URL`, `ENVIRONMENT`, `AWS_*`, `JWT_SECRET`** — six of seven are never read. Also replace the real project IDs with placeholders.
20. **The "Production Readiness" section of the README** — five bullets, zero of which are implemented.
21. **`docs/deployment.md`'s compose block** — it references a Dockerfile that does not exist. Either write the Dockerfile or label the section a proposal.
22. **~60% of the documentation overall.** 9,500 words against 1,100 lines of Python. Documentation that describes intent as fact is negative-value: it costs the reader time and costs you credibility.

**Technologies to remove for now:**

23. **Celery + Redis** — genuinely overengineered at this stage, and it *caused* the worst bug in the codebase. A `ThreadPoolExecutor(max_workers=2)` plus a results table serves the first 1,000 users with a fraction of the complexity. Reintroduce Celery when queue depth is an actual measured problem.
24. **PyTorch + transformers as runtime dependencies** — a 2.5 GB dependency tree for a code path that contributes nothing. Removing them makes the Docker image ~20× smaller and boot ~50× faster.
25. **SQLite as the production story** — not deletion but replacement. Keep it for local dev *behind a real `DATABASE_URL`*, which currently does not exist.

**Features that distract from the core value proposition:**

26. **"Posture analysis"** — never implemented, not measurable from a face landmarker, and a liability near hiring.
27. **Absolute confidence scoring as the headline number.** Lead with the delta against the user's own baseline. Absolute scores invite a fairness argument you cannot win; within-speaker deltas sidestep it entirely, and your own blueprint already makes that argument better than I can.
28. **The `delta_score` / `deltaConfidenceVsCasual` duplication** — two baseline systems, one in localStorage and one server-side, computing different things under similar names. Keep the server one.

**The honest summary of this phase: the project's problem is not missing features. It is that the most complex, most expensive, most prominently advertised component contributes nothing, while the components that would make the product actually work — transcription, relevance, reliability measurement — are absent, and are each cheaper than what is already there.**

---

# PHASE 16 — WHAT TO BUILD NEXT (exact order)

1. **Delete** `confidence.db`, `confidence_model.joblib`, `out.log`, `__pycache__` from git; add `.gitignore` entries. *Because the repo is currently broken on clone — proven, not theorised.*
2. **Fix** `requirements.txt`: re-encode UTF-8, move to `pyproject.toml` + lockfile, add `torch`/`transformers`/`celery`/`redis` (temporarily — steps 8–9 remove them). *Because nobody can install what exists today.*
3. **Delete** the "Whisper-X Transcription" panel and the placeholder-fed Groq call. *Two hours; removes the most damaging artefact in the repository.*
4. **Introduce** `confidence-backend/auth.py`: Firebase ID token verification via `google-auth` + Google JWKs. Apply `Depends(current_user)` to every route; token on the WS connect; delete `{user_id}` from the path and every client-supplied `user_id`. *Closes four critical vulnerabilities at once.*
5. **Move** the Groq call to `POST /api/critique` behind auth and a rate limit; **rotate the key today**. *It is currently extractable from any deployed bundle.*
6. **Replace** `task.get(timeout=25)` with immediate `task_id` return plus a Redis pub/sub result channel consumed via `redis.asyncio`; delete the `asyncio.to_thread` fallback. *Because 4 concurrent users currently take the service down.*
7. **Add** WS payload caps, frame-shape validation, idle timeout, and per-account concurrency limits. *Because the DoS is six lines of attacker code.*
8. **Introduce** `faster-whisper base.en` in the worker. *Prerequisite for every real differentiator, at $0.00007/session.*
9. **Delete** `fusion.py`, `hubert_audio.py`, `tcn_vision.py`, `train.py` from the scoring path, and drop `torch`/`transformers` from runtime deps. *Do this only after step 8 proves the replacement works — then it removes 95% of compute and changes no output.*
10. **Replace** the volume/ZCR/landmark-variance heuristics with: pitch in **semitones relative to the speaker's median**, **pace in words/min** from the transcript, **fillers and hedges** from the transcript, and **blendshape**-based facial behaviour (`outputFaceBlendshapes: true`). *Removes equipment bias and most demographic bias.*
11. **Add** the relevance-capped score: one LLM call returning `{relevance, critique}`; `final = min(delivery_score, 40 + relevance*60)`. *This is the wedge.*
12. **Add** `signals JSONB` to `sessions` and write every measured value with a schema version. *Before the next session is recorded, because everything recorded before this is unusable for training.*
13. **Fix** the feedback loop: return the real `session_id`, thread it through, ask for an expected score **as a number**, and stop fabricating `perceived_score`.
14. **Fix** the double-write: one write path in `storage.js`, remove the `Speaking.jsx` POST, add an idempotency key.
15. **Stop** persisting failures as `confidence_score: 0.0`; return `{"status":"error"}` and render an error state.
16. **Add** `VITE_API_BASE_URL`, derive the WS URL, enforce `wss://` in production.
17. **Add** `structlog` JSON logging with `session_id`/`user_id`/`request_id`; Sentry on both ends; `prometheus-fastapi-instrumentator`; `/healthz` and `/readyz`.
18. **Add** a benchmark: record 20 speakers giving the same answer twice. Report the mean absolute test-retest delta. **Put the number in the README.** *This is the measurement that decides whether the product is real, and publishing it is itself differentiation.*
19. **Add** the Dockerfile + `docker-compose.yml` (Postgres, Redis, API, worker, nginx SPA) and GitHub Actions running ruff, mypy, pytest, eslint, build, `pip-audit`, `npm audit`.
20. **Add** 20 tests: auth rejection, IDOR rejection, WS payload caps, scoring determinism, relevance capping, one Playwright E2E.
21. **Rewrite** the README per Phase 18.
22. **Then, and only then:** deploy, find 50 users in the beachhead, and watch 10 of them use it without speaking.

---

# PHASE 17 — TARGET ARCHITECTURE

```
┌─ BROWSER ─────────────────────────────────────────────────────────┐
│  React + Vite SPA                                                  │
│  ├─ ONE getUserMedia → ONE AudioContext → AudioWorkletNode         │
│  │    Opus-encoded chunks over WSS  (~6 KB/s, vs 64 KB/s raw)      │
│  ├─ MediaPipe FaceLandmarker (WASM, self-hosted)                   │
│  │    → 52 BLENDSHAPE coefficients @ 10 Hz                         │
│  └─ Firebase Auth → ID token on every request and on WS connect    │
└───────────────────────────┬───────────────────────────────────────┘
                            │ HTTPS / WSS
┌─ EDGE ────────────────────┴───────────────────────────────────────┐
│  CDN (static SPA) · TLS termination · WAF · per-IP rate limit      │
└───────────────────────────┬───────────────────────────────────────┘
┌─ API GATEWAY (FastAPI, stateless, 2+ replicas) ───────────────────┐
│  auth.py      Firebase ID token verification (google-auth + JWKs)  │
│  rate_limit   Redis token bucket, per-account and per-IP           │
│  routes/      sessions · feedback · critique · me · healthz/readyz │
│  ws/stream    capped buffers, shape validation, idle timeout,      │
│               per-account concurrency. Dispatches and RETURNS.     │
│               NEVER blocks. NEVER runs inference.                  │
└──────┬─────────────────────────────┬──────────────────────────────┘
       │ enqueue(job_id)             │ subscribe(results:{job_id})
┌─ ASYNC LAYER ─────────────────────┴───────────────────────────────┐
│  Redis: broker · result pub/sub · rate-limit counters · cache      │
│  Object storage: raw audio, 30-day TTL. NEVER the broker.          │
│  (Start with ThreadPoolExecutor + a results table. Move to Celery  │
│   when measured queue depth demands it — not before.)              │
└───────────────────────────┬───────────────────────────────────────┘
┌─ SCORING WORKER ──────────────────────────────────────────────────┐
│  1. Silero VAD          → speech segments, real silence counts     │
│  2. faster-whisper      → transcript + word timestamps             │
│  3. prosody.py          → pitch in SEMITONES vs speaker median,    │
│                           pace (wpm), dynamics. NOT loudness.      │
│  4. lexical.py          → fillers, hedges, STAR structure (free)   │
│  5. blendshapes.py      → facial behaviour from 52 coefficients    │
│  6. ONE LLM call        → {relevance: 0-1, critique: str}          │
│  7. fusion              → weighted sum; renormalise over available │
│                           modalities; CAP on relevance             │
│  8. calibration         → identity until ≥200 real ratings exist   │
│  9. persist             → score + FULL versioned signal vector     │
└───────────────────────────┬───────────────────────────────────────┘
┌─ DATA ────────────────────┴───────────────────────────────────────┐
│  PostgreSQL: users · sessions(+signals JSONB) · feedback ·         │
│              baselines · questions.  TIMESTAMPTZ. Alembic. PITR.   │
│  Object storage: audio (30 d TTL) · transcripts (indefinite)       │
└───────────────────────────────────────────────────────────────────┘
┌─ OBSERVABILITY ───────────────────────────────────────────────────┐
│  structlog JSON → aggregator · Sentry · Prometheus + Grafana ·     │
│  OpenTelemetry traces · PostHog product analytics ·                │
│  LLM cost/token/latency per call                                   │
└───────────────────────────────────────────────────────────────────┘
```

**Justification for every component — and every omission:**

| Component | Why it exists |
|---|---|
| **AudioWorklet + Opus** | `ScriptProcessorNode` is deprecated and steals main-thread time during the exact window you claim to be measuring. Opus at ~48 kbps is a **10× bandwidth reduction** over raw Float32 with no meaningful loss for ASR. |
| **Blendshapes, not landmarks** | Pose-invariant by construction. Raw coordinates measure head position and camera distance, which is what the current code accidentally grades. |
| **Firebase ID token verification** | You already run Firebase on the client. `google-auth` against Google's JWKs needs no service-account key. It is the cheapest possible path from zero auth to real auth. |
| **Gateway never blocks, never infers** | The single defining fix. Your own `ml/README.md` states this requirement; the code violates it twice. |
| **Redis pub/sub for results** | Keeps the WebSocket useful (push the result when ready) without any blocking poll. |
| **Object storage for audio, never the broker** | Redis is a queue. A 7.68 MB hex string is not a queue message. 20× payload reduction. |
| **`ThreadPoolExecutor` before Celery** | Celery is correct *eventually* and overengineered *now* — and it directly caused this codebase's worst bug. Earn the complexity with a measurement. |
| **Silero VAD** | ~2 MB ONNX. Fixes the meaningless `silence_count: 2613` and cuts ASR cost by skipping silence. |
| **faster-whisper `base.en`** | ~140 MB, ~10× real-time on CPU, ~$0.00007/session. Unlocks relevance, fillers, pace, structure, and replay from one artefact. |
| **Semitones relative to speaker median** | Makes expressiveness comparable across a bass and a soprano. Removes register bias. Directly reduces the fairness exposure. |
| **Lexical signals** | Free — already have the transcript. Highest insight-per-compute in the entire pipeline. |
| **ONE LLM call for relevance + critique** | Identical inputs. Two calls double cost and let the score and the critique contradict each other in front of the user. |
| **Relevance capping** | The wedge. The one thing that makes this different from every "how do I sound" tool. |
| **Calibration as identity until ≥200 ratings** | Fitting on thin data produces a model that wins on MSE by predicting the mean. Running as identity is the *correct* behaviour, not a gap — say so in the README. |
| **`signals JSONB` persisted per session** | The data moat. Without it, feedback ratings are unusable forever. |
| **PostgreSQL + Alembic + TIMESTAMPTZ** | SQLite's global write lock fails under a gateway and a worker. A bare `DateTime` on Postgres silently drops the UTC offset and breaks any date-window logic. |
| **30-day audio TTL** | Storage grows linearly with users. Derived features are ~2 KB/session and are the actual asset. |
| **Sentry** | Highest value per hour spent of anything in the observability stack. |
| **PostHog** | You currently cannot answer "does anyone come back?" That is the only question that matters at this stage. |

**Deliberately NOT included, and why:** Kubernetes (Render/Fly until ~10k users); Kafka (Redis until measured); pgvector (three baseline vectors do not need a vector index); a GPU (CPU ASR is sufficient until measured otherwise); a feature store (one table); a service mesh (two services); microservices (you have three files); Terraform (platform config files suffice); GraphQL (six endpoints); LangChain (one LLM call).

---

# PHASE 18 — README REWRITE STRATEGY

**The current README's failure mode:** it is a technology list wearing a product's clothes. It opens with five badges, names six technologies in the first paragraph, and never states what problem it solves for whom. It then asserts "production-ready" five times against a codebase with no auth, no tests, and a shipped database that breaks on first write.

**Remove:**
- "Production Readiness" section — five bullets, zero implemented
- "AI-powered," "production-ready APIs," "Real-time" — unbacked
- "posture analysis" — never implemented, and a liability near hiring
- The `PyTorch 2.x` badge (not in requirements) and `Python 3.11` (bytecode says 3.13)
- The architecture Mermaid diagram — it shows a non-blocking dispatch that does not exist
- The "Codebase Highlights" file tree — `git ls-tree` does this better
- The "Recommended Next Steps" section — that is a roadmap, not a README
- The PowerShell-only quickstart (which, as written, does not produce a working backend)

**Rewrite:**
- **Opening line** → problem, not technology. *"Practise an interview answer and find out whether you actually answered the question — not just whether you sounded confident."*
- **"What's Included"** → what a user gets, not what directories exist
- **Architecture** → one diagram that matches the code, with the blocking dispatch either fixed or drawn honestly
- **Quick start** → `docker compose up`, POSIX and Windows

**Add — in this order:**
1. **A 60-second demo GIF, above the fold.** You have the single best-looking artefact in the project and zero images in the README. This is the cheapest credibility available and you are leaving it on the table.
2. **An explicit honesty section:**
   > **What this does and does not measure.** Scoring is currently heuristic: prosody (pitch variability, pace) and lexical signals from the transcript. The multimodal fusion network in `ml/models/` is architecturally complete but **untrained** and is not in the scoring path — see `ml/README.md` for the intended training design. This system does not infer emotion or personality, and does not analyse posture.

   **A senior engineer reading that trusts you more, not less.** It converts your biggest liability into a signal of judgement — and it is the exact register `ml/README.md` already achieves when it rules out micro-expression and personality inference.
3. **The reliability number.** *"Test-retest: the same speaker giving the same answer twice scores within X points (n=20)."* No competitor publishes this. Publishing it is differentiation.
4. **Cost per session.** *"$0.00023 per scored session (ASR + one LLM call)."* Engineers and investors both read this as evidence you understand your own system.
5. **A limitations section** — known bias sources, what breaks, what is untested.
6. **A `tests/` badge** once CI exists.

**Move to `docs/`:** deployment topology, the full environment table, contributing, the API reference, the ML blueprint.

**Target structure:**
```
PROBLEM         two sentences — the fluent-off-topic-answer problem
DEMO            60s GIF, above the fold
SOLUTION        what the user gets: transcript, relevance-capped score, cited findings
HOW IT WORKS    one accurate diagram
WHAT IT MEASURES / WHAT IT DOESN'T   ← the honesty section
EVIDENCE        test-retest reliability · cost/session · test count
QUICK START     docker compose up
ARCHITECTURE    one paragraph + link
ROADMAP         shipped vs. genuinely open, clearly separated
LIMITATIONS     bias sources, what breaks
```

Notably, the README inside `project_history.md` is already written closer to this shape — problem-first, with an explicit "the deep-learning fusion network is untrained and not in this scoring path" disclosure. **That instinct is right.** The problem is not its structure; it is that it asserts as shipped a great deal that is not in this repository. Keep the voice. Fix the facts.

---

# EXECUTIVE VERDICT

VerboTech is a **well-presented portfolio project with enterprise-grade documentation attached to prototype-grade engineering.** The gap between those two things is the finding, and it is larger than any individual bug.

**Evidence for the classification:** 3 commits. 0 tests. 0 CI. 0 Dockerfiles. `import logging` appears 0 times against 28 `print()` calls. `torch.load`/`load_state_dict` appear 0 times — the advertised neural network has never been trained. `os.getenv` appears once. `localhost` is hardcoded in 4 files, so the frontend cannot be deployed. `requirements.txt` is UTF-16-encoded and omits torch, transformers, celery, and redis, so the documented install does not produce a working backend. The committed database has a stale schema and **provably** breaks every write (`OperationalError: table sessions has no column named scenario_title`). The backend has no authentication of any kind. The Groq API key is inlined into the browser bundle. The production database contains 3 rows, one of which is an error recorded as a score.

**What the system actually does when a user presses record:** it streams uncompressed audio to a server, runs a 95-million-parameter transformer whose output it then discards, adds four hand-tuned constants driven mostly by microphone gain, and asks an LLM to critique a hardcoded placeholder sentence — displaying the result under a heading that reads "Whisper-X Transcription," a component that does not exist.

That is not a harsh reading. It is a line-by-line description of `main.py`, `workers/tasks.py`, `Speaking.jsx:62`, and `Feedback.jsx:155`.

**And yet the underlying opportunity is real,** which is why this document is long. The product instinct in `ml/README.md` — *"a score of 65% means nothing; what matters is whether you deviated from your baseline"* — is better than most funded companies in this category operate on. The relevance-capping idea in `project_history.md` is a genuine wedge. The frontend is good enough to put in front of users tomorrow. **The distance from here to a credible product is roughly six weeks of focused work, and most of that work is deletion.**

---

# WHAT IS ACTUALLY IMPRESSIVE

1. **The frontend experience.** A real, coherent, animated product loop with considered empty, loading, and error states, on an 851-line hand-written design system. This is genuinely above the bar for a solo project, and it is the one asset that makes user testing possible tomorrow.
2. **The deliberate solution to the React re-render problem.** Refs + `lastMetricsRef` equality gates in both analyzer hooks, with comments explaining why. Evidence of real debugging under a real constraint.
3. **The personalised-delta framing.** The best idea in the repository. It is correct, it is under-exploited by competitors, and it sidesteps the calibration and fairness problems that will eventually block everyone scoring absolute confidence.
4. **The explicit refusal to infer emotion or personality** (`ml/README.md`). Most people building in this space do not think about this at all, and the ones who do usually think about it after a lawyer raises it. That is mature judgement and it deserves to be said plainly.
5. **The architecture essay in `ml/README.md`.** As a plan it is well-reasoned and mostly correct — including the instruction to delete `train.py` and SQLite, which was the right call.
6. **The honesty that does exist in the code.** `# Since the neural model is uncalibrated (untrained)...` and `// Transcript engine placeholder` are accurate comments. The author knew. That matters, because a person who knows and documents it can fix it; the README is what needs to catch up to the code comments, not the reverse.

Everything else is competent-standard or below.

---

# HARDEST TRUTHS

**1. The AI does not work, and the code says so.** Not "needs tuning." The network has never been trained, no checkpoint is ever loaded, and its output is discarded by four `if` statements. `tasks.py:53` puts scare quotes around "properly functioning." You already knew.

**2. You built a hallucination pipeline and labelled it "Whisper-X Transcription."** An LLM critiques a hardcoded placeholder sentence and the output is shown to users as analysis of their performance. This is the single most serious thing in the repository — worse than the missing auth, because auth is an omission and this is a construction.

**3. Your headline metric grades microphone gain.** `avg_volume > 0.02 → +15` is 15% of the range awarded for sitting closer to your laptop. The first user who notices stops believing anything the product says, permanently.

**4. 9,500 words of documentation against 1,100 lines of Python is a tell, not an achievement.** The ratio reads as effort redirected from the hard problem to the comfortable one. `docs/security.md` describes a security posture that is 0% implemented. `docs/deployment.md` documents a docker-compose that references a Dockerfile that does not exist. **Documentation describing intent as fact is negative-value.**

**5. `project_history.md` claims "251 tests" and "Everything below is implemented and covered by tests — not aspirational."** There are zero tests. Whatever the explanation, the sentence is falsifiable in eleven seconds, and it is the sentence a reviewer will remember. Fix this before anyone else reads it.

**6. The repository does not run from a clean clone, and it has not for three commits.** The deps file will not install a working backend. The committed database breaks every write. Nobody has tried. That is the most damaging fact about the *process*, independent of any individual bug.

**7. Your "data flywheel" collects noise.** `session_id` is always 0, so feedback cannot be joined to sessions. `perceived_score` is fabricated from a thumbs-down. Errors are persisted as `confidence_score: 0.0`. Per-modality signals are never stored. Every session recorded until this is fixed is unusable for training, forever.

**8. The hardest one: you have not watched anyone use this.** There are three rows in the database, one of which is a crash. Every architectural decision here — Celery, HuBERT, fusion networks, pgvector plans, Ray DDP roadmaps — was made in the absence of a single observed user. That is the actual root cause of everything above. The engineering effort went to the part that was intellectually satisfying rather than the part that was uncertain.

---

# BIGGEST TECHNICAL RISKS

**Severity ordered.**

- **The scoring function measures equipment, not people.** If the core measurement is not valid, nothing built on it is. Everything else is a fixable engineering problem; this is an existential product problem.
- **A system that generates confident feedback about content it never observed.** Reputational and, in a hiring-adjacent context, legal.
- **Zero backend authentication → full IDOR read, cross-user baseline corruption, unauth'd memory-exhaustion DoS.** Four critical vulnerabilities, all closed by one 2-day fix.
- **Groq API key extractable from any deployed bundle.** Direct financial exposure, live today if this has ever been deployed.
- **The gateway blocks on inference.** Service down at 4 concurrent users; the fallback path makes it worse.
- **No tests, no CI, no Docker.** No change is safe; no claim is verifiable; no deploy is repeatable.
- **The repository does not run from a clean clone.** Broken deps + broken committed DB.
- **Demographic bias in a hiring-adjacent product, with no way to measure it.** Blocks every B2B conversation and is the hardest gap to close because it needs collected data, not code.
- **No observability.** 28 `print()` calls. Production incidents would be undiagnosable.
- **SQLite with two writer processes.** `database is locked` under any real concurrency.
- **Errors persisted as scores.** Silently poisoning your own dataset, already visible in the shipped database.
- **Deprecated `ScriptProcessorNode` + two concurrent mic streams.** Main-thread contention causing silent data loss during the measurement window.

---

# BIGGEST PRODUCT RISKS

- **The feedback is not about the user.** A critique of a placeholder and a score driven by mic gain. Users will not articulate this — they will simply not return.
- **Nobody has used it.** Three sessions, one a crash.
- **Episodic pain.** The user's problem disappears the week they get the job. Retention is structurally hostile and no mechanic addresses it.
- **The free alternative is genuinely good.** A phone camera gives more honest feedback than a gain-driven score, and ChatGPT voice mode gives better *content* feedback than anything here — for free, improving monthly.
- **Five questions.** A user exhausts the entire product in one sitting.
- **No mobile layout,** for a product whose core action is the most natural phone behaviour there is.
- **History lives in `localStorage`.** Clear your cache and the product forgets you — which also means zero switching cost.
- **"Confidence" is the wrong noun.** It is unfalsifiable, it invites a fairness fight, and users cannot act on it. "You used 7 fillers" and "you never stated the outcome" are actionable. The pivot from scoring *confidence* to scoring *answers* is a product decision, not an engineering one, and it is the most important one available.

---

# BIGGEST BUSINESS RISKS

- **LTV:CAC is currently negative.** ~$25 CAC against ~$17 LTV at $9/mo with 2-month tenure. Fixable with episode pricing and institutional sales, but not with features.
- **Zero distribution and no channel hypothesis.**
- **No defensibility.** Every current feature is reproducible in three weeks. The only available moat — the data flywheel — is structurally blocked by bugs.
- **Fairness liability.** A hiring-adjacent scoring product with unaudited demographic bias is a regulatory and reputational exposure, and it is the first thing a serious B2B buyer probes.
- **Biometric data handling with no policy.** Voice embeddings in a committed SQLite file, no retention statement, no deletion endpoint, an undisclosed sub-processor called directly from the user's browser.
- **Platform risk.** Groq, Firebase, and a Google CDN, all unpinned, all single points of failure.
- **The credibility risk.** The most immediate business risk is not technical — it is that a recruiter, investor, or co-founder reads "production-ready," "251 tests," or "Whisper-X Transcription," checks, and stops. That outcome is available today, costs you the opportunity entirely, and is fixable in one afternoon of honest editing.

---

# BIGGEST OPPORTUNITIES

1. **Relevance-capped scoring.** The wedge. Two weeks. Nobody in the category leads with it because it requires admitting fluency scoring alone is not a product.
2. **The transcript unlocks five features for one dependency.** Fillers, hedging, pace, structure, replay — all free once ASR exists, all currently impossible.
3. **Within-speaker delta as the headline number.** Sidesteps calibration and fairness entirely; the speaker is their own control.
4. **Outcome labels — "did you get the offer?"** One email six weeks after a session. Nobody collects this. It is the only ground truth that matters and it is the strongest available moat.
5. **Non-native English speakers interviewing internationally.** Acute pain, underserved by human coaching, willing to pay, findable, and the segment where "did you answer the question" beats "did you sound confident" most sharply.
6. **Publishing a reliability number.** *"Same answer twice scores within X points."* No competitor does this. It costs one afternoon and it is real differentiation.
7. **Institutional distribution.** One university at $10k/yr with 2,000 students is CAC $5 and contractual retention.
8. **Deleting HuBERT is a ~10× cost reduction with zero product impact** — which makes a generous free tier essentially free, which is your acquisition channel.

---

# WHAT TO DELETE

HuBERT/TCN/fusion from the scoring path · `train.py` · `confidence_model.joblib` · `confidence.db` · `out.log` · `__pycache__` · the "Whisper-X Transcription" panel · the placeholder-fed LLM critique · `Start.jsx` · `Profile.jsx` · `ConfidenceTrends.jsx` · `@google/generative-ai` · the `asyncio.to_thread` fallback · the volume/ZCR/landmark-variance heuristics · the stock Vite README · `docs/security.md` as written · the inaccurate Mermaid diagrams · the "Production Readiness" section · six fictional rows in `docs/environment.md` · Celery + Redis until measured · PyTorch + transformers as runtime deps · "posture analysis" · the duplicate localStorage baseline · ~60% of the documentation.

**Deletion is roughly half the work between here and a credible product, and it is the half that can start today.**

---

# WHAT TO BUILD

Server-side Firebase token verification · `faster-whisper base.en` · relevance-capped scoring in one LLM call · semitone-relative prosody + pace + lexical signals · blendshape facial behaviour · `signals JSONB` persisted per session · a working feedback loop with real `session_id` and a real expected-score number · non-blocking task dispatch via Redis pub/sub · WS payload caps and rate limiting · `VITE_API_BASE_URL` · Dockerfile + compose · GitHub Actions · 20 tests · `structlog` + Sentry + PostHog · a test-retest reliability benchmark **published in the README** · 68+ seeded questions · a delete-my-data endpoint · an honest README with a demo GIF.

---

# EXACT EXECUTION ORDER

**Week 1 — Stop the bleeding.**
1 Delete committed DB/model/log/pyc · 2 Fix `requirements.txt` · 3 Delete the Whisper-X panel and the placeholder LLM call · 4 Rewrite the README honestly · 5 Rotate the Groq key.

**Week 2 — Make it safe.**
6 Firebase token verification on every route and the WS · 7 Move the Groq call server-side behind auth + rate limit · 8 Non-blocking dispatch; delete the inline-inference fallback · 9 WS payload caps, shape validation, idle timeout · 10 CORS allowlist.

**Week 3 — Make it real.**
11 `faster-whisper` in the worker · 12 Delete HuBERT/TCN/fusion/`train.py`; drop torch+transformers · 13 Semitone prosody + pace + lexical signals; delete the volume and ZCR terms · 14 Blendshapes instead of raw landmarks.

**Week 4 — Make it differentiated.**
15 Relevance-capped scoring, one LLM call · 16 `signals JSONB` per session · 17 Fix the feedback loop · 18 Stop persisting errors as scores · 19 Single write path.

**Week 5 — Make it verifiable.**
20 Dockerfile + compose · 21 CI · 22 20 tests incl. one Playwright E2E · 23 `structlog` + Sentry + `/healthz` · 24 **Test-retest benchmark, n=20, number published in the README.**

**Week 6 — Make it deployable and find users.**
25 `VITE_API_BASE_URL` + `wss://` · 26 Deploy (Render/Fly + managed Postgres + Redis) · 27 PostHog funnel · 28 Delete-my-data endpoint · 29 68 seeded questions · 30 **Recruit 50 beachhead users and watch 10 of them, silently.**

**The ordering principle:** honesty before security, security before capability, capability before differentiation, differentiation before scale. Every step is shippable on its own, and step 30 is the one that determines whether any of the rest mattered.

---

# STARTUP-GRADE DEFINITION — for this project specifically

Startup-grade does **not** mean multi-region, Kubernetes, or SOC 2. For VerboTech it means all ten of these are true:

1. **The score reflects the speaker, not their equipment.** Same person, same answer, two microphones, two distances → within 5 points. Measured, with the number published.
2. **The feedback references what they actually said.** A real transcript, quoted back, with specific evidence: *"7 fillers: 'um' ×4"*, *"you never stated the outcome."*
3. **An off-topic answer cannot score well.** The relevance cap fires, demonstrably, in a regression test.
4. **No user can read or corrupt another user's data.** Every route authenticated; identity derived from a verified token, never from a request body.
5. **A stranger runs it in under 10 minutes** from a clean clone, on a machine that is not yours, with one command.
6. **CI is green on every PR** — lint, types, tests, build, dependency audit.
7. **Production is observable.** Every session traceable by ID; errors in Sentry; p95 latency and cost per session on a dashboard.
8. **Failures are visible, never silent.** No error is ever persisted as a score.
9. **Every session becomes an asset.** Full versioned signal vector + outcome-linkable feedback, stored from day one.
10. **The README is true.** Every claim traceable to a file, a test, or a published number — including an explicit statement of what the system does *not* measure.

**Currently true: zero of ten.** Reachable in ~6 weeks by one person working the order above, and most of the distance is deletion.

---

# INDUSTRY-GRADE DEFINITION — for this project specifically

Everything in startup-grade, plus:

- **Measured model validity:** 50-recording golden set, 3 human raters, published inter-rater agreement and model-vs-human correlation. Inference is reproducible from a stored model version, feature snapshot, and seed.
- **A demographic fairness audit** across gender, age, accent, and native language, published with methodology and limitations, with an explicit statement of the populations on which the system has *not* been validated.
- **Test pyramid:** ≥70% unit coverage on `ml/` and `workers/`, integration coverage on every route and the WS lifecycle, E2E on the critical path, load tests in CI gating on p95, security tests asserting auth and IDOR rejection, and AI regression tests that fail the build on score drift.
- **Reliability engineering:** timeouts and retries on every external call, circuit breakers on LLM and inference, graceful degradation that is strictly *cheaper* than the happy path, a rehearsed restore from backup, documented RTO/RPO, and published SLOs with alerting.
- **Full observability:** structured logs, RED metrics, distributed traces from WS connect to persist, LLM cost/token/latency per call, and per-session cost attribution.
- **Security program:** written threat model, RBAC, encryption in transit and at rest, immutable audit logging for data access and export, automated dependency scanning, annual third-party penetration test, documented incident response.
- **Data governance:** documented retention with automated enforcement, GDPR Art. 15/17 endpoints, sub-processor disclosure, DPAs, explicit consent for biometric-adjacent processing, and a training opt-out that is actually honoured in the pipeline.
- **Operational maturity:** versioned immutable images, one-command rollback, migrations tested forward *and* backward, a staging environment that mirrors production, feature flags, and an on-call rotation with runbooks.
- **Accessibility:** WCAG 2.1 AA, VPAT, axe-core clean in CI, keyboard-complete, screen-reader tested on the recording flow specifically.
- **API stability:** versioned, documented, with a published deprecation policy.

**Realistic timeline: 18–24 months with a team of 3–5.** It should not influence any decision you make this year.

---

# 30-DAY PLAN

**Objective: the repository tells the truth, cannot be trivially attacked, and analyses what the user actually said.**

**Days 1–3 — Honesty.** Delete the committed DB, model artefact, log, and bytecode. Fix `requirements.txt`. Delete the Whisper-X panel and the placeholder-fed LLM call. Rewrite the README (state the untrained model explicitly, delete "production-ready"). Reconcile `project_history.md` with reality. **Rotate the Groq key.**
*Done when: a stranger clones, installs, and runs a session with no manual fixes.*

**Days 4–10 — Security.** Firebase token verification on every route and the WS. Move the Groq call server-side behind auth and a rate limit. Non-blocking dispatch via Redis pub/sub; delete the inline-inference fallback. WS payload caps, shape validation, idle timeout, per-account concurrency. CORS allowlist. `VITE_API_BASE_URL` + `wss://`.
*Done when: unauthenticated requests 401; user A cannot read user B; a 100 MB stream closes cleanly with flat memory; 50 concurrent finishes keep `GET /` under 100 ms.*

**Days 11–18 — Substance.** `faster-whisper base.en`. Delete HuBERT/TCN/fusion/`train.py`; drop torch and transformers. Semitone-relative pitch, pace in wpm, fillers and hedges from the transcript; delete the volume and ZCR terms. Blendshapes instead of raw landmarks.
*Done when: the report quotes what the user said; two mic distances score within 3 points; session latency is under 5 s.*

**Days 19–24 — Differentiation.** Relevance-capped scoring in one LLM call. `signals JSONB` per session. Fix the feedback loop (real `session_id`, real expected-score number). Stop persisting errors as scores. Single write path with an idempotency key.
*Done when: an off-topic answer scores below 50; every feedback row joins to a session carrying a full signal vector.*

**Days 25–30 — Credibility.** Dockerfile + compose. GitHub Actions. 20 tests including one Playwright E2E. `structlog` + Sentry + `/healthz`. **Test-retest benchmark, n=20 — publish the number in the README.**
*Done when: `docker compose up` works, CI is green, and the README's central claim is a measured number.*

**30-day success metric:** a stranger clones the repo, runs one command, records an answer, and receives feedback that quotes what they said and identifies whether they answered the question — and the README's claims are all checkable.

---

# 90-DAY PLAN

**Days 31–60 — Deploy and observe.**
Deploy for real (Render/Fly + managed Postgres + managed Redis). PostHog with the full funnel. Delete-my-data endpoint, retention statement, 30-day audio TTL. 68+ seeded questions across 10 categories. Server-side session history with a personal-baseline trend. Responsive mobile layout. Accessibility pass to axe-core clean.
**Then the part that actually matters:** recruit 50 users from the beachhead — non-native English speakers preparing for technical interviews — through bootcamp Discords, `/r/cscareerquestions`, and university international-student offices. **Watch 10 of them use it live, over a call, and say nothing while they do.**
*Metric: 50 users, ≥20% completing a second session within 7 days.*

**Days 61–90 — Iterate on evidence, not intuition.**
Rebuild the report screen from what you watched people ignore. Streaks + daily challenge + an email nudge (the only structural answer to episodic pain). Fit calibration once ≥200 real ratings exist — and run it as identity until then, because that is correct. 20 structured interviews asking one question: *"did you change how you answered because of this?"*
*Metric: D7 ≥ 25%; ≥5 unsolicited "this helped me" messages; a measurable within-user improvement across ≥5 sessions.*

**90-day success criterion:** you can name three users in the same segment who describe the same value in the same words. That sentence is your landing page, your ICP, and your first real evidence that this is a business.

If D7 is under 10% at day 90, **stop building and re-examine the product.** The engineering will be sound by then; the problem would be the product thesis, and no amount of further engineering fixes that.

---

# 12-MONTH VISION

**Realistic, if executed in the order above:**

A focused interview-answer coach for non-native English speakers, with a few thousand users and a few hundred paying $29 for a 30-day pass. The core loop works and is trusted: record, get a transcript, find out whether you answered the question, see specific evidence, watch your delta against your own baseline move over six weeks. A published reliability number and a published cost-per-session that no competitor offers. One or two university career centres in a paid pilot, pulling you toward the compliance work rather than you building it speculatively. A database of ~20,000 sessions with full per-modality signal vectors and — the real asset — a few hundred outcome labels from the "did you get the offer?" email.

That last item is the difference between a good app and a company. With outcome labels you can train the thing everyone else claims and nobody has: a model that predicts interview success rather than one that scores vocal aesthetics. That is defensible, that is a data moat, and it takes a year of disciplined collection that must start with the `signals JSONB` column in week 4.

**What it will not be in 12 months:** an enterprise platform, SOC 2 certified, multi-language, or team-analytics-enabled. Anyone telling you otherwise is selling you a roadmap instead of a product.

**The failure mode to watch for is not technical.** It is spending month 4 rebuilding the fusion network because it is intellectually satisfying, instead of spending month 4 watching ten people use the product and discovering they ignore the score entirely and only read the filler-word count. **The engineering instincts in this repository are good. The judgement about where to aim them is what needs to change.**

---

# FINAL CTO ASSESSMENT

**Current state:** a portfolio project with a genuinely good frontend, a real product insight, and a backend that has no authentication, no tests, no CI, no deployability, and an AI component that has never been trained and contributes nothing to its own output — documented as if it were an enterprise platform.

**The largest gap is not technical.** Every technical problem in this document is closable in six weeks by one person, and roughly half the work is deletion. The requirements file, the committed database, the missing auth, the blocking dispatch, the untrained model — these are all Tuesday-afternoon problems for someone who can write the code in this repository, and the code in this repository shows someone who can.

**The largest gap is between what you build and what you validate.** This project contains a Celery cluster, a multimodal fusion network, a pgvector migration plan, and a Ray DDP retraining roadmap — and three sessions in its database, one of which is a crash recorded as a score. Every significant architectural decision was made without a single observed user. That is the root cause of everything else, including the documentation problem: when you cannot validate against users, you validate against how sophisticated the architecture sounds, and the README becomes a place to assert progress rather than describe it.

**The specific thing to internalise:** the most complex, most expensive, most prominently advertised component of this system contributes exactly nothing to its output — and adding the two things that would make the product genuinely work, real transcription and relevance judging, would *reduce* your cost per session by 25%. **The hard part was never the hard part.** You built the impressive thing and skipped the useful thing, which is the most common and most expensive mistake a strong engineer makes early.

**The encouraging part, stated as fact rather than consolation:** the instincts visible in `ml/README.md` — that absolute scores are meaningless and deltas are what matter, that emotion and personality inference are not evidence-based and are a liability near hiring — are better than what most funded companies in this category operate on. The relevance-capping idea is a real wedge. The frontend is good enough to test tomorrow. And the code comments were honest about the untrained model even while the README was not, which means the knowledge was always there; only the documentation drifted.

**Do this in order: tell the truth in the README, add auth, add transcription, delete HuBERT, cap on relevance, then go watch ten people use it.** Six weeks. Most of it deletion. Then you will have something real — and, more importantly, you will have the evidence to know whether it should exist at all, which is a question no amount of further architecture can answer.
