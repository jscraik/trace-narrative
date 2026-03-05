# Annotation Schema Reference

Complete data schema for `Agentation` annotations and events.

Source: [agentation.dev/schema](https://agentation.dev/schema)

---

## Annotation Object

### Required Fields

| Field         | Type     | Description                                |
| ------------- | -------- | ------------------------------------------ |
| `id`          | `string` | Unique identifier for the annotation       |
| `comment`     | `string` | User's annotation text                     |
| `elementPath` | `string` | CSS selector path to the annotated element |
| `timestamp`   | `number` | Unix timestamp (ms)                        |
| `x`           | `number` | X position (% of `viewport` width, 0-100)  |
| `y`           | `number` | Y position (`px` from document top)        |
| `element`     | `string` | HTML tag name of the annotated element     |

### Recommended Fields

| Field         | Type                    | Description                  |
| ------------- | ----------------------- | ---------------------------- |
| `url`         | `string`                | Current page URL             |
| `boundingBox` | `{x, y, width, height}` | Element's bounding rectangle |

### Optional Context Fields

| Field             | Type          | Description                |               |                |                   |
| ----------------- | ------------- | -------------------------- | ------------- | -------------- | ----------------- |
| `reactComponents` | `string`      | React component name(s)    |               |                |                   |
| `cssClasses`      | `string`      | CSS classes on the element |               |                |                   |
| `computedStyles`  | `string`      | Computed CSS styles        |               |                |                   |
| `accessibility`   | `string`      | ARIA labels, roles, etc.   |               |                |                   |
| `nearbyText`      | `string`      | Surrounding text context   |               |                |                   |
| `selectedText`    | `string`      | User's text selection      |               |                |                   |
| `intent`          | `"fix" \      | "change" \                 | "question" \  | "approve"`     | Annotation intent |
| `severity`        | `"blocking" \ | "important" \              | "suggestion"` | Severity level |                   |

### Lifecycle Fields

| Field        | Type              | Description                 |                 |              |                |
| ------------ | ----------------- | --------------------------- | --------------- | ------------ | -------------- |
| `status`     | `"pending" \      | "acknowledged" \            | "resolved" \    | "dismissed"` | Current status |
| `resolvedAt` | `string`          | ISO timestamp when resolved |                 |              |                |
| `resolvedBy` | `"human" \        | "agent"`                    | Who resolved it |              |                |
| `thread`     | `ThreadMessage[]` | Conversation thread         |                 |              |                |

### Browser Component Fields

| Field            | Type      | Description                       |
| ---------------- | --------- | --------------------------------- |
| `isFixed`        | `boolean` | Whether element is position:fixed |
| `isMultiSelect`  | `boolean` | Part of multi-select annotation   |
| `fullPath`       | `string`  | Full DOM path                     |
| `nearbyElements` | `string`  | Nearby element context            |

---

## ThreadMessage Object

| Field       | Type       | Description         |                      |
| ----------- | ---------- | ------------------- | -------------------- |
| `id`        | `string`   | Message ID          |                      |
| `role`      | `"human" \ | "agent"`            | Who sent the message |
| `content`   | `string`   | Message content     |                      |
| `timestamp` | `number`   | Unix timestamp (ms) |                      |

---

## AgentationEvent Envelope

This envelope wraps all events:

| Field       | Type                  | Description               |                 |                |            |
| ----------- | --------------------- | ------------------------- | --------------- | -------------- | ---------- |
| `type`      | `AgentationEventType` | Event type (see below)    |                 |                |            |
| `timestamp` | `string`              | ISO 8601 timestamp        |                 |                |            |
| `sessionId` | `string`              | Session identifier        |                 |                |            |
| `sequence`  | `number`              | Monotonic sequence number |                 |                |            |
| `payload`   | `Annotation \         | Session \                 | ThreadMessage \ | ActionRequest` | Event data |

### Event Types

```typescript
type AgentationEventType =
  | "annotation.created"
  | "annotation.updated"
  | "annotation.deleted"
  | "session.created"
  | "session.updated"
  | "session.closed"
  | "thread.message"
  | "action.requested";
```

---

## Usage in This Project

The Narrative app includes the `Agentation` React component in `src/App.tsx`:

```tsx
{import.meta.env.DEV && import.meta.env.VITE_AGENTATION_ENDPOINT && (
  <Agentation
    endpoint={import.meta.env.VITE_AGENTATION_ENDPOINT}
    webhookUrl={import.meta.env.VITE_AGENTATION_WEBHOOK_URL}
    onSessionCreated={(sessionId) => {
      console.log("Session started:", sessionId);
    }}
  />
)}
```

Configure the MCP server in `~/.claude/settings.json` for Claude Code integration.

---

## Troubleshooting: Webhook/websocket panel empty on startup

If the agentation panel shows no webhook URL or a blank websocket field:

1. Verify the dev env var is loaded:

```bash
cp .env.agentation.example .env.local
```

1. Ensure Vite has:

```bash
VITE_AGENTATION_ENDPOINT=http://localhost:4747
VITE_AGENTATION_WEBHOOK_URL=http://localhost:8787
```

1. Start services in order:

```bash
pnpm agentation:dev    # starts MCP + autopilot listener
pnpm tauri:dev         # start the app
```

Expected:

- MCP endpoint in panel points to `http://localhost:4747`.
- Webhook URL is present and points to `http://localhost:8787`.
- Submitting an annotation triggers a local POST to `http://localhost:8787`.

Note: if `VITE_AGENTATION_ENDPOINT` is unset, the agentation panel stays disabled to keep local baseline runs free of expected connection-refused noise.

In this repo the app also falls back to `http://localhost:8787` if the env var is unset, but setting it explicitly keeps automation reliable across shells.

## Webhook + Automation Setup (Narrative)

1. Copy the local env template:

```bash
cp .env.agentation.example .env.local
```

1. Start `Agentation` MCP server (port `4747`):

```bash
pnpm exec agentation-mcp server
```

1. Start webhook automation listener (port `8787`):

```bash
pnpm agentation:autopilot
```

1. Start the app:

```bash
pnpm tauri:dev
```

1. In `Agentation` panel, verify:
   - MCP connection is green (`endpoint="http://localhost:4747"`)
   - Webhook URL points to `http://localhost:8787`

### Smoke test webhook

```bash
curl -sS -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{"event":"submit","output":"agentation-smoke-test"}'
```

Expected artifacts:

- `.narrative/agentation/latest-status.json`
- `.narrative/agentation/runs/<job-id>/payload.json`
- `.narrative/agentation/runs/<job-id>/implementation.txt`
- `.narrative/agentation/runs/<job-id>/review.txt`
- `.narrative/agentation/runs/<job-id>/result.json`
