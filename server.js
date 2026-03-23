const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-5.3-chat';

if (!AZURE_OPENAI_API_KEY) {
  console.error('❌ ERROR: Falta AZURE_OPENAI_API_KEY en el archivo .env');
  process.exit(1);
}

if (!AZURE_OPENAI_ENDPOINT) {
  console.error('❌ ERROR: Falta AZURE_OPENAI_ENDPOINT en el archivo .env');
  process.exit(1);
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PROMPTS_DIR = path.join(__dirname, 'prompts');

function loadPromptTemplate(name) {
  const filePath = path.join(PROMPTS_DIR, `${name}.txt`);

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Advertencia: No se encontró el prompt ${name}.txt`);
    return '';
  }

  return fs.readFileSync(filePath, 'utf8');
}

function buildHistoryText(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return '(No hay historial previo)';
  }

  return messages
    .map((m) => {
      const role = m?.role;
      const content = m?.content ?? '';

      if (role === 'student') return `Estudiante: ${content}`;
      if (role === 'system') return `Sistema: ${content}`;
      return `Tutor: ${content}`;
    })
    .join('\n');
}

function getLastStudentMessage(messages) {
  if (!Array.isArray(messages)) {
    return 'El estudiante inicia el ejercicio.';
  }

  const found = [...messages].reverse().find((m) => m.role === 'student');
  return found ? found.content : 'El estudiante inicia el ejercicio.';
}

function normalizeEndpoint(endpoint) {
  return endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
}

async function callAzureChat(prompt) {
  const url = `${normalizeEndpoint(AZURE_OPENAI_ENDPOINT)}chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': AZURE_OPENAI_API_KEY,
    },
    body: JSON.stringify({
      model: AZURE_OPENAI_DEPLOYMENT,
      messages: [
        {
          role: 'developer',
          content:
            'Eres un tutor universitario de física. Responde siempre en español claro, útil y pedagógico.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.error?.message || 'Error al consultar Azure OpenAI');
    error.status = response.status;
    error.responseData = data;
    throw error;
  }

  return data?.choices?.[0]?.message?.content?.trim() || '';
}

async function generateText(prompt) {
  return callAzureChat(prompt);
}

app.post('/api/tutor', async (req, res) => {
  try {
    const { exercise, messages, mode, studentName } = req.body;

    if (!exercise) {
      return res.status(400).json({ error: 'Falta el enunciado del ejercicio.' });
    }

    const historyText = buildHistoryText(messages);
    const lastStudentMessage = getLastStudentMessage(messages);

    let promptName = 'tutor_fisica_guiada';
    if (mode === 'corta') promptName = 'tutor_fisica_corta';
    if (mode === 'diagnostico') promptName = 'tutor_fisica_diagnostico';

    const template = loadPromptTemplate(promptName);
    const basePrompt =
      template ||
      [
        'Eres un tutor de física.',
        'Estudiante: {{ESTUDIANTE}}',
        'Ejercicio: {{ENUNCIADO}}',
        'Historial: {{HISTORIAL}}',
        'Último mensaje del estudiante: {{MENSAJE_ESTUDIANTE}}',
      ].join('\n');

    const fullPrompt = basePrompt
      .replace('{{ENUNCIADO}}', exercise)
      .replace('{{HISTORIAL}}', historyText)
      .replace('{{MENSAJE_ESTUDIANTE}}', lastStudentMessage)
      .replace('{{ESTUDIANTE}}', studentName || 'Estudiante');

    const text = await generateText(fullPrompt);

    res.json({ text });
  } catch (err) {
    console.error('Error llamando a Azure OpenAI:', err.responseData || err);

    const status = err.status || 500;
    let message = 'Error interno del servidor al procesar la solicitud.';

    if (status === 429) {
      message =
        '⚠️ Se alcanzó el límite de solicitudes o de tokens. Intenta nuevamente en unos segundos.';
    } else if (status === 401 || status === 403) {
      message =
        '⚠️ Error de autenticación con la API. Revisa la clave y el endpoint configurados.';
    } else if (status >= 500) {
      message =
        '⚠️ El servicio de IA no respondió correctamente. Intenta de nuevo en unos segundos.';
    }

    res.status(status).json({
      error: message,
      detail: err.message,
    });
  }
});

app.post('/api/evaluate', async (req, res) => {
  try {
    const { exercise, messages, studentName } = req.body;

    if (!exercise || !messages || messages.length === 0) {
      return res.status(400).json({ error: 'Faltan datos para evaluar.' });
    }

    const historyText = buildHistoryText(messages);
    const evalTemplate = loadPromptTemplate('evaluacion_sesion');
    const baseEvalPrompt =
      evalTemplate ||
      [
        'Evalúa esta sesión de física y devuelve un JSON válido.',
        'Estudiante: {{ESTUDIANTE}}',
        'Ejercicio: {{ENUNCIADO}}',
        'Conversación: {{CONVERSACION}}',
      ].join('\n');

    const evalPrompt = baseEvalPrompt
      .replace('{{ENUNCIADO}}', exercise)
      .replace('{{CONVERSACION}}', historyText)
      .replace('{{ESTUDIANTE}}', studentName || 'Estudiante');

    let text = await generateText(evalPrompt);
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }

    let jsonResult;
    try {
      jsonResult = JSON.parse(text);
    } catch (e) {
      jsonResult = {
        error: 'No se pudo generar JSON válido',
        raw: text,
      };
    }

    res.json({ ok: true, evaluation: jsonResult });
  } catch (err) {
    console.error('Error en /api/evaluate:', err.responseData || err);

    res.status(err.status || 500).json({
      error: 'Error al evaluar',
      detail: err.message,
    });
  }
});

app.post('/api/save-session', (req, res) => {
  try {
    const sessionsDir = path.join(__dirname, 'sessions');

    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    const rawStudentName = req.body?.studentName || 'Sin_nombre';
    const safeStudentName = String(rawStudentName)
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^\w\-áéíóúÁÉÍÓÚñÑ]/g, '');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(
      sessionsDir,
      `sesion-${safeStudentName || 'Sin_nombre'}-${timestamp}.json`
    );

    fs.writeFileSync(filename, JSON.stringify(req.body, null, 2), 'utf8');

    res.json({ ok: true, file: filename });
  } catch (err) {
    console.error('Error guardando sesión:', err);
    res.status(500).json({
      error: 'Error guardando',
      detail: err.message,
    });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
});