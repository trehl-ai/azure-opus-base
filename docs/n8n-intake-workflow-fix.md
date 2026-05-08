# EIC — Gmail Intake → CRM Workflow Fix

Workflow-ID: `hXTJI3RR4pOxVLa4`

## Problem

- Seit ~30.04.2026 landet `parsed_payload_json` als `NULL` in `intake_messages`.
- INSERT läuft durch, Gemini-Extraktion schlägt still fehl.
- 2 betroffene Einträge in DB bestätigt.

## Korrekte Gemini HTTP Request Node Konfiguration

- **Method:** `POST`
- **URL:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=GEMINI_API_KEY`
- **specifyBody:** `json`
- **jsonBody** (exakt so, mit echtem Feldnamen):

```json
{
  "contents": [{
    "parts": [{
      "text": "Extrahiere aus dieser E-Mail die folgenden Felder als JSON:\nfirst_name, last_name, company, job_title (NUR Positionsbezeichnung wie 'Geschäftsführer' oder 'Marketing Manager' - NICHT den Firmennamen), email, phone, notes (Kerninhalt der E-Mail, max 200 Zeichen), pipeline_guess (genau einer dieser Werte: Erlebniswelten | Viktoria Rebensburg - Industrie | Viktoria Rebensburg - Stiftungen | Werteraum - Schulen | Corporate Events | Ausschreibungen).\n\nAntworte NUR mit validem JSON-Objekt. Kein Markdown, keine Erklärung, keine Backticks.\n\nE-Mail:\n{{$json.text}}"
    }]
  }]
}
```

## Defensiver Code Node (nach Gemini, vor Supabase INSERT)

JavaScript:

```javascript
const response = $input.first().json;
const text = response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
const cleaned = text.replace(/```json|```/g, '').trim();

try {
  const parsed = JSON.parse(cleaned);
  return [{ json: { ...parsed, parse_error: false, raw_text: text } }];
} catch (e) {
  return [{
    json: {
      parse_error: true,
      raw_text: text,
      error: e.message,
    },
  }];
}
```

## IF Node nach Code Node

**Condition:** `{{ $json.parse_error }} === false`

### TRUE Branch → Supabase INSERT Node

- **Method:** `POST`
- **URL:** `https://ttgvhqygmgtnjgwunuwz.supabase.co/rest/v1/intake_messages`
- **Headers:**
  - `apikey: SUPABASE_SERVICE_ROLE_KEY`
  - `Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY`
  - `Content-Type: application/json`
  - `Prefer: return=representation`
- **Body:**

```json
{
  "sender_email": "={{ $('Gmail Trigger').item.json.from }}",
  "subject": "={{ $('Gmail Trigger').item.json.subject }}",
  "raw_body": "={{ $('Gmail Trigger').item.json.text }}",
  "parsed_payload_json": "={{ JSON.stringify($json) }}",
  "received_at": "={{ $('Gmail Trigger').item.json.date }}",
  "status": "new"
}
```

### FALSE Branch → HTTP Request Telegram Alert

- **Method:** `POST`
- **URL:** `https://api.telegram.org/bot{{EIC_BOT_TOKEN_PLACEHOLDER}}/sendMessage`
- **specifyBody:** `json`
- **jsonBody:**

```javascript
JSON.stringify({
  chat_id: "6299105090",
  text: "❌ EIC Intake Parse-Fehler\nVon: " + $('Gmail Trigger').item.json.from
        + "\nBetreff: " + $('Gmail Trigger').item.json.subject
        + "\nFehler: " + $json.error
        + "\nGemini Raw: " + ($json.raw_text || '').substring(0, 200)
})
```

Danach: Supabase INSERT ohne `parsed_payload_json` (damit die Mail nicht verloren geht):

```json
{
  "sender_email": "={{ $('Gmail Trigger').item.json.from }}",
  "subject": "={{ $('Gmail Trigger').item.json.subject }}",
  "raw_body": "={{ $('Gmail Trigger').item.json.text }}",
  "received_at": "={{ $('Gmail Trigger').item.json.date }}",
  "status": "new"
}
```

## Wichtige Hinweise

- n8n Gmail Trigger Field für Mail-Body: `$json.text` (plain text) — **NICHT** `$json.body`.
- Gemini API Key muss als Query-Parameter in der URL stehen (`?key=...`), **NICHT** im Header.
- `specifyBody` muss `json` sein, **NICHT** "Using Fields Below" bei nested Objekten wie Gemini `contents[]`.
- `false` Branch IMMER sofort verdrahten — n8n bricht sonst silent ab.
- Nach Änderungen: Workflow speichern + manuell mit einer Test-Mail triggern.

## Validierung nach Fix

1. Test-Mail an `sales@trehl-ai.com` schicken.
2. n8n Execution Log prüfen: alle Nodes grün?
3. Supabase prüfen:
   ```sql
   SELECT id, parsed_payload_json IS NOT NULL AS ok
   FROM intake_messages
   ORDER BY created_at DESC
   LIMIT 1;
   ```
4. Health Check manuell triggern: `get_health_check_stats()` sollte `intake_null_payload = 0` zeigen.
