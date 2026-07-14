/**
 * Oola Translate — GAS proxy for OpenAI Whisper (audio -> English text + segments)
 *
 * SETUP (do this once, whenever you're ready to enable the API path):
 *   1. Deploy: New deployment -> Web app -> Execute as "Me" -> Access "Anyone".
 *   2. Copy the /exec URL into the app's Settings.
 *   3. When you have an OpenAI key, add it WITHOUT redeploying:
 *        Project Settings (gear) -> Script Properties -> Add property
 *        Property: OPENAI_API_KEY   Value: sk-...
 *
 * The frontend sends base64 audio. If the key isn't set, this returns
 * { ok:false, reason:"NO_KEY" } so the app falls back to in-browser Whisper.
 */

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');

    if (body.ping) {
      return _json({ ok: true, hasKey: !!_key(), version: 'oola-translate-gas-v1' });
    }

    var key = _key();
    if (!key) return _json({ ok: false, reason: 'NO_KEY' });

    if (!body.audioBase64) return _json({ ok: false, reason: 'NO_AUDIO' });

    var bytes = Utilities.base64Decode(body.audioBase64);
    var blob = Utilities.newBlob(bytes, body.mimeType || 'audio/mpeg',
                                 body.filename || 'audio.mp3');

    // Whisper /audio/translations -> always outputs ENGLISH.
    // verbose_json gives us segment timestamps for the .srt file.
    var form = {
      file: blob,
      model: 'whisper-1',
      response_format: 'verbose_json'
    };
    if (body.prompt) form.prompt = body.prompt;

    var res = UrlFetchApp.fetch('https://api.openai.com/v1/audio/translations', {
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
  return _json({ ok: true, hasKey: !!_key(), version: 'oola-translate-gas-v1' });
}

function _key() {
  return PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
