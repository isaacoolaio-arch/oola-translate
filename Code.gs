/**
 * Oola Translate — GAS proxy for Groq Whisper (audio -> English text + segments)
 *
 * Groq runs whisper-large-v3, so accuracy is high and the "da da da" repetition
 * loop that the small in-browser model hits does NOT happen here.
 *
 * SETUP (once):
 *   1. Deploy: New deployment -> Web app -> Execute as "Me" -> Access "Anyone".
 *   2. Copy the /exec URL into the app's Settings.
 *   3. Get a Groq key at https://console.groq.com/keys (free tier available).
 *   4. Add it WITHOUT redeploying:
 *        Project Settings (gear) -> Script Properties -> Add property
 *        Property: GROQ_API_KEY   Value: gsk_...
 *
 * If no key is set, returns { ok:false, reason:"NO_KEY" } and the app
 * falls back to in-browser Whisper.
 */

var GROQ_URL = 'https://api.groq.com/openai/v1/audio/translations';
var GROQ_MODEL = 'whisper-large-v3';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');

    if (body.ping) {
      return _json({ ok: true, hasKey: !!_key(), provider: 'groq', version: 'oola-translate-gas-v2' });
    }

    var key = _key();
    if (!key) return _json({ ok: false, reason: 'NO_KEY' });
    if (!body.audioBase64) return _json({ ok: false, reason: 'NO_AUDIO' });

    var bytes = Utilities.base64Decode(body.audioBase64);
    var blob = Utilities.newBlob(bytes, body.mimeType || 'audio/wav',
                                 body.filename || 'audio.wav');

    // /audio/translations -> always outputs ENGLISH.
    // verbose_json gives segment timestamps for the .srt file.
    var form = {
      file: blob,
      model: GROQ_MODEL,
      response_format: 'verbose_json'
    };
    if (body.prompt) form.prompt = body.prompt;

    var res = UrlFetchApp.fetch(GROQ_URL, {
      method: 'post',
      headers: { Authorization: 'Bearer ' + key },
      payload: form,
      muteHttpExceptions: true
    });

    var code = res.getResponseCode();
    var text = res.getContentText();
    if (code !== 200) {
      return _json({ ok: false, reason: 'API_ERROR', status: code, detail: text });
    }

    var data = JSON.parse(text);
    var segs = (data.segments || []).map(function (s) {
      return { start: s.start, end: s.end, text: (s.text || '').trim() };
    });

    return _json({ ok: true, text: (data.text || '').trim(), segments: segs });

  } catch (err) {
    return _json({ ok: false, reason: 'EXCEPTION', detail: String(err) });
  }
}

function doGet() {
  return _json({ ok: true, hasKey: !!_key(), provider: 'groq', version: 'oola-translate-gas-v2' });
}

// Prefer GROQ_API_KEY; fall back to OPENAI_API_KEY if you ever switch back.
function _key() {
  var p = PropertiesService.getScriptProperties();
  return p.getProperty('GROQ_API_KEY') || p.getProperty('OPENAI_API_KEY');
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
