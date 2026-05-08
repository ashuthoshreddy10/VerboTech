# API Reference

VerboTech exposes a lightweight API surface for session orchestration, feedback management, and streaming telemetry.

## REST Endpoints

### `GET /`

Returns a health-check response and indicates the API is reachable.

**Response**

```json
{
  "message": "VerboTech Phase 1 Streaming API is live"
}
```

### `POST /api/sessions`

Saves final session metadata and confidence scores.

**Request Body**

```json
{
  "user_id": "user-123",
  "question_id": "q-456",
  "scenario_title": "Investor Pitch",
  "category": "Presentation",
  "difficulty": "Intermediate",
  "duration": 78,
  "silence_count": 4,
  "silence_ratio": 0.12,
  "eye_contact": "Good",
  "expressiveness": "Expressive",
  "confidence_score": 77.5,
  "delta_score": 5.3
}
```

**Response**

```json
{
  "status": "success",
  "session_id": 101
}
```

### `GET /api/sessions/{user_id}`

Retrieves historical sessions for a given user.

**Example**

`GET /api/sessions/user-123`

**Response**

```json
[
  {
    "id": 101,
    "questionId": "q-456",
    "scenarioTitle": "Investor Pitch",
    "category": "Presentation",
    "difficulty": "Intermediate",
    "avgConfidence": 77.5,
    "duration": 78,
    "time": "2026-05-08T13:00:00"
  }
]
```

### `POST /api/feedback`

Captures user-perceived feedback for AI score validation.

**Request Body**

```json
{
  "session_id": 101,
  "user_id": "user-123",
  "perceived_score": 72.0,
  "ai_score": 77.5,
  "user_correction": "My pacing was too fast"
}
```

**Response**

```json
{
  "status": "Feedback absorbed into Flywheel successfully"
}
```

## WebSocket Contract

### `ws://<host>/ws/stream/{session_id}`

This endpoint is the streaming entry point for audio and vision telemetry.

#### Message types

- **Binary** — raw audio payloads captured from the browser.
- **Text** — JSON payloads carrying vision tensor frames or terminal actions.

#### Completion payload

Clients should send a final `finish` action to signal the end of a session.

```json
{
  "action": "finish",
  "user_id": "user-123",
  "is_onboarding": false
}
```

### Example browser usage

```js
const ws = new WebSocket("ws://localhost:8000/ws/stream/session-001");

ws.addEventListener("open", () => {
  console.log("Connected to VerboTech telemetry stream");
});

ws.addEventListener("message", (event) => {
  console.log("Worker response:", event.data);
});

function sendVisionFrame(frame) {
  ws.send(JSON.stringify({ type: "tensor", data: frame }));
}
```

## API Design Notes

- The gateway is intentionally thin: it accepts telemetry, stores metadata, and delegates heavy compute to Celery.
- Session payloads are designed for simple mobile or browser integration.
- The WebSocket flow supports both binary audio capture and JSON tensor frames.
- Future versions can add JWT/Firebase auth wrappers and input validation middleware.

## Error Handling

VerboTech should expose consistent error responses and HTTP status codes.

**Typical response**

```json
{
  "detail": "Invalid request payload"
}
```

## Example cURL

```bash
curl -X POST http://localhost:8000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-123",
    "question_id": "q-456",
    "scenario_title": "Investor Pitch",
    "category": "Presentation",
    "difficulty": "Intermediate",
    "duration": 78,
    "silence_count": 4,
    "silence_ratio": 0.12,
    "eye_contact": "Good",
    "expressiveness": "Expressive",
    "confidence_score": 77.5,
    "delta_score": 5.3
  }'
```

## Future API Enhancements

- Add authenticated user sessions using Firebase JWT validation.
- Add `/api/sessions/{session_id}/artifacts` for raw audio and tensor retrieval.
- Add server-side model explainability metadata for each inference.
