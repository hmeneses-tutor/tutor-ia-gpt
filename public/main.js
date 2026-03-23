// main.js

// ==========================
// Estado en memoria del navegador
// ==========================
let messages = []; // { role: 'student' | 'tutor' | 'system', content: string }
let currentMode = 'guiada'; // guiada | corta | diagnostico
let sessionFinished = false; // se vuelve true al evaluar la sesión

// ==========================
// Elementos del DOM
// ==========================
const exerciseEl = document.getElementById('exercise');
const chatEl = document.getElementById('chat');
const studentMessageEl = document.getElementById('studentMessage');
const statusEl = document.getElementById('status');
const evaluationOutputEl = document.getElementById('evaluationOutput');
const studentNameEl = document.getElementById('studentName');

const sessionEndCardEl = document.getElementById('sessionEndCard');
const sessionEndSummaryEl = document.getElementById('sessionEndSummary');
const newSessionBtn = document.getElementById('newSessionBtn');

const sendBtn = document.getElementById('sendBtn');
const saveSessionBtn = document.getElementById('saveSessionBtn');
const evaluateSessionBtn = document.getElementById('evaluateSessionBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const finalExportPdfBtn = document.getElementById('finalExportPdfBtn');

const toggleThemeBtn = document.getElementById('toggleThemeBtn');
const startTutorBtn = document.getElementById('startTutorBtn');

const modeButtons = document.querySelectorAll('.btn-mode');
const mathSymbolButtons = document.querySelectorAll('.math-symbol-btn');

// Toggle del panel de símbolos extra
const mathToggleBtn = document.getElementById('mathToggleBtn');
const mathExtraPanel = document.getElementById('mathExtraPanel');

if (mathToggleBtn && mathExtraPanel) {
  mathToggleBtn.addEventListener('click', () => {
    const wasHidden = mathExtraPanel.classList.contains('hidden');
    mathExtraPanel.classList.toggle('hidden', !wasHidden);
    mathToggleBtn.classList.toggle('active', wasHidden);
    mathToggleBtn.textContent = wasHidden ? 'Menos símbolos ▴' : 'Más símbolos ▾';
  });
}

// ==========================
// Mapas para superíndices y subíndices
// ==========================
const superMap = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  "n": "ⁿ",
  "i": "ⁱ", "j": "ʲ",
  "a": "ᵃ", "b": "ᵇ", "c": "ᶜ", "d": "ᵈ", "e": "ᵉ", "f": "ᶠ", "g": "ᵍ",
  "h": "ʰ", "k": "ᵏ", "l": "ˡ", "m": "ᵐ", "o": "ᵒ", "p": "ᵖ",
  "r": "ʳ", "s": "ˢ", "t": "ᵗ", "u": "ᵘ", "v": "ᵛ", "w": "ʷ", "x": "ˣ", "y": "ʸ", "z": "ᶻ"
};

const subMap = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
  "n": "ₙ",
  "i": "ᵢ", "j": "ⱼ",
  "a": "ₐ", "e": "ₑ", "h": "ₕ", "k": "ₖ", "l": "ₗ", "m": "ₘ",
  "o": "ₒ", "p": "ₚ", "r": "ᵣ", "s": "ₛ", "t": "ₜ", "u": "ᵤ", "v": "ᵥ", "x": "ₓ"
};

// ==========================
// Identidad básica del estudiante
// ==========================
function loadStudentIdentity() {
  if (!studentNameEl) return;
  const savedName = localStorage.getItem('studentName');
  if (savedName) {
    studentNameEl.value = savedName;
  }
}

function persistStudentIdentity() {
  if (!studentNameEl) return;
  localStorage.setItem('studentName', studentNameEl.value.trim());
}

function getStudentName() {
  if (!studentNameEl) return 'Sin nombre';
  const name = studentNameEl.value.trim();
  return name ? name : 'Sin nombre';
}

function hideSessionEndCard() {
  if (!sessionEndCardEl) return;
  sessionEndCardEl.classList.add('hidden');
  if (sessionEndSummaryEl) {
    sessionEndSummaryEl.textContent = 'La sesión fue evaluada correctamente.';
  }
}

function showSessionEndCard() {
  if (!sessionEndCardEl || !sessionEndSummaryEl) return;

  const modeMap = {
    guiada: 'Guía paso a paso',
    corta: 'Explicación corta',
    diagnostico: 'Diagnóstico inicial'
  };

  const modeLabel = modeMap[currentMode] || currentMode;
  const studentName = getStudentName();

  sessionEndSummaryEl.innerHTML = `
    <strong>Estudiante:</strong> ${studentName}<br>
    <strong>Modo:</strong> ${modeLabel}<br>
    <strong>Estado:</strong> Sesión finalizada y evaluada
  `;

  sessionEndCardEl.classList.remove('hidden');
}

// ==========================
// Conversión porcentaje (0–100) → nota UTEC (1.00–5.00)
// ==========================
function convertirPorcentajeUTEC(p) {
  const tabla = [
    1.00, 1.04, 1.08, 1.12, 1.17, 1.21, 1.25, 1.29, 1.33, 1.37,
    1.41, 1.45, 1.50, 1.54, 1.58, 1.62, 1.66, 1.70, 1.74, 1.78,
    1.83, 1.87, 1.91, 1.95, 1.99, 2.00, 2.03, 2.06, 2.09, 2.12,
    2.15, 2.19, 2.22, 2.25, 2.28, 2.31, 2.34, 2.37, 2.40, 2.43,
    2.46, 2.49, 2.52, 2.56, 2.59, 2.62, 2.65, 2.68, 2.71, 2.74,
    2.75, 2.78, 2.80, 2.83, 2.86, 2.88, 2.91, 2.94, 2.96, 2.99,
    3.00, 3.10, 3.21, 3.32, 3.43, 3.54, 3.66, 3.77, 3.88, 3.99,
    4.00, 4.05, 4.10, 4.16, 4.21, 4.26, 4.31, 4.36, 4.42, 4.47,
    4.52, 4.57, 4.63, 4.68, 4.73, 4.78, 4.83, 4.89, 4.94, 4.99,
    5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00
  ];

  p = Math.min(100, Math.max(0, Math.round(p)));
  return tabla[p];
}

function getConceptoUTEC(n) {
  if (n < 2.0) return 'Deficiente';
  if (n < 3.0) return 'Insuficiente';
  if (n < 4.0) return 'Suficiente';
  if (n < 5.0) return 'Muy bueno';
  return 'Excelente';
}

function getColorForNotaUTEC(notaUTEC) {
  const concepto = getConceptoUTEC(notaUTEC);
  switch (concepto) {
    case 'Deficiente':
      return { bg: '#fee2e2', fg: '#b91c1c' };
    case 'Insuficiente':
      return { bg: '#ffedd5', fg: '#c2410c' };
    case 'Suficiente':
      return { bg: '#ecfdf3', fg: '#15803d' };
    case 'Muy bueno':
      return { bg: '#e0f2fe', fg: '#1d4ed8' };
    case 'Excelente':
    default:
      return { bg: '#fef9c3', fg: '#854d0e' };
  }
}

// ==========================
// Utilidades UI
// ==========================
function typesetLatexSafely(element) {
  if (window.MathJax && MathJax.typesetPromise) {
    MathJax.typesetPromise([element]).catch(err => {
      console.log('MathJax error:', err);
    });
  } else {
    setTimeout(() => typesetLatexSafely(element), 200);
  }
}

function appendMessage(role, content) {
  const div = document.createElement('div');

  let cssRole = 'tutor';
  if (role === 'student') cssRole = 'student';
  if (role === 'system') cssRole = 'tutor';

  div.classList.add('message', cssRole);

  const header = document.createElement('div');
  header.classList.add('message-header');

  if (role === 'student') {
    header.textContent = 'Estudiante';
  } else if (role === 'system') {
    header.textContent = 'Sistema';
  } else {
    header.textContent = 'Tutor IA';
  }

  const body = document.createElement('div');
  body.classList.add('message-body');

  const formattedContent = String(content)
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>');

  body.innerHTML = formattedContent;

  div.appendChild(header);
  div.appendChild(body);
  chatEl.appendChild(div);

  typesetLatexSafely(body);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function setStatus(text, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = text || '';
  statusEl.className = 'status';
  if (isError) statusEl.classList.add('error');
}

function insertSymbolInStudentMessage(symbol) {
  const textarea = studentMessageEl;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const value = textarea.value;

  const newValue = value.slice(0, start) + symbol + value.slice(end);
  textarea.value = newValue;

  const newCursorPos = start + symbol.length;
  textarea.selectionStart = textarea.selectionEnd = newCursorPos;
  textarea.focus();
}

function convertSelected(action) {
  const ta = studentMessageEl;
  const start = ta.selectionStart ?? 0;
  const end = ta.selectionEnd ?? 0;
  if (end <= start) return;

  const selected = ta.value.substring(start, end);
  if (!selected) return;

  const map = action === 'super' ? superMap : subMap;
  let converted = '';

  for (const ch of selected) {
    converted += map[ch] || ch;
  }

  ta.value = ta.value.substring(0, start) + converted + ta.value.substring(end);
  ta.selectionStart = ta.selectionEnd = start + converted.length;
  ta.focus();
}

// ==========================
// Panel visual de evaluación
// ==========================
function renderEvaluationPanel(data) {
  if (!data) return '(No hay datos)';

  const {
    nota_global,
    conceptos,
    procedimientos,
    unidades,
    autonomia,
    retroalimentacion_general,
    comentarios_detallados
  } = data;

  const studentName = getStudentName();

  const esDiagnosticaSinEvidencia =
    nota_global === 0 &&
    conceptos === 0 &&
    procedimientos === 0 &&
    unidades === 0;

  let avisoDiagnostico = '';
  if (esDiagnosticaSinEvidencia) {
    avisoDiagnostico = `
<div style="margin-top:6px; padding:6px 8px; border-radius:4px; background:#fef3c7; color:#92400e; font-size:0.8rem;">
  Esta es una <strong>evaluación diagnóstica sin evidencia suficiente</strong>:
  el estudiante aún no intentó resolver el problema. Se recomienda que realice
  al menos un paso de la resolución para poder evaluar mejor su desempeño.
</div><br>
`;
  }

  const notaUTEC = convertirPorcentajeUTEC(nota_global ?? 0);
  const conceptoUTEC = getConceptoUTEC(notaUTEC);
  const colores = getColorForNotaUTEC(notaUTEC);

  return `
<strong>Estudiante:</strong> ${studentName}<br><br>

⭐ <strong>Nota global: ${nota_global}/100</strong><br>
<div style="margin-top:4px; margin-bottom:8px; display:inline-block; padding:4px 8px; border-radius:999px; background:${colores.bg}; color:${colores.fg}; font-size:0.9rem;">
  🎓 Calificación UTEC: <strong>${notaUTEC.toFixed(2)}</strong> &nbsp;(${conceptoUTEC})
</div>
<br><br>
${avisoDiagnostico}
<strong>Conceptos:</strong> ${conceptos}/10<br>
<strong>Procedimientos:</strong> ${procedimientos}/10<br>
<strong>Unidades:</strong> ${unidades}/10<br>
<strong>Autonomía:</strong> ${autonomia}/10<br><br>

<strong>Retroalimentación general:</strong><br>
<div style="margin-left:10px; margin-top:4px;">
  ${retroalimentacion_general}
</div><br>

<strong>Comentarios detallados:</strong><br>
<ul style="margin-left:18px;">
  <li><strong>Conceptos:</strong> ${comentarios_detallados?.conceptos ?? ''}</li>
  <li><strong>Procedimientos:</strong> ${comentarios_detallados?.procedimientos ?? ''}</li>
  <li><strong>Unidades:</strong> ${comentarios_detallados?.unidades ?? ''}</li>
  <li><strong>Autonomía:</strong> ${comentarios_detallados?.autonomia ?? ''}</li>
</ul>

<hr style="margin:8px 0;">

<details>
  <summary style="cursor:pointer; color:#2563eb;">Ver JSON completo</summary>
  <pre>
${JSON.stringify(data, null, 2)}
  </pre>
</details>
`;
}

// ==========================
// Cambiar modo del tutor
// ==========================
modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    modeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode || 'guiada';
    setStatus(`Modo del tutor: ${currentMode}`, false);
  });
});

// ==========================
// Llamar al backend /api/tutor
// ==========================
async function callTutor(customMessages) {
  const exercise = exerciseEl.value.trim();
  const mode = currentMode;
  const payloadMessages = customMessages ?? messages;

  if (!exercise) {
    setStatus('Por favor ingresa el enunciado del ejercicio.', true);
    return null;
  }

  try {
    setStatus('Consultando al tutor IA...');

    const resp = await fetch('/api/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exercise,
        messages: payloadMessages,
        mode,
        studentName: getStudentName()
      })
    });

    if (!resp.ok) {
      try {
        const errorData = await resp.json();
        if (errorData.error) {
          console.error('Error API:', errorData.detail || errorData.error);
          setStatus(errorData.error, true);
          appendMessage('system', `❌ **Error:** ${errorData.error}`);
          return null;
        }
      } catch (e) {
        const textError = await resp.text();
        console.error('Error desconocido:', textError);
      }

      setStatus('Error al comunicarse con el tutor IA. Intenta de nuevo.', true);
      return null;
    }

    const data = await resp.json();
    const text = data.text || '(Sin respuesta del tutor)';
    setStatus('Respuesta recibida del tutor IA.');
    return text;
  } catch (err) {
    console.error('Error de red en /api/tutor:', err);
    setStatus('Error de conexión. Verifica tu internet o si el servidor está encendido.', true);
    return null;
  }
}

// ==========================
// Iniciar tutor
// ==========================
async function handleStartTutor() {
  const studentName = getStudentName();

  if (!studentName || studentName === 'Sin nombre') {
    setStatus('Por favor escribe tu nombre antes de iniciar el tutor.', true);
    studentNameEl?.focus();
    return;
  }

  messages = [];
  sessionFinished = false;
  chatEl.innerHTML = '';
  evaluationOutputEl.innerHTML = '(Aquí aparecerá la evaluación de la sesión)';
  hideSessionEndCard();

  sendBtn.disabled = false;
  studentMessageEl.disabled = false;
  evaluateSessionBtn.disabled = false;

  const textoTutor = await callTutor([]);
  if (!textoTutor) return;

  messages.push({ role: 'tutor', content: textoTutor });
  appendMessage('tutor', textoTutor);
}

// ==========================
// Enviar mensaje del estudiante
// ==========================
async function handleSend() {
  if (sessionFinished) {
    setStatus('La sesión ya fue evaluada y está cerrada. Inicia una nueva para continuar.', true);
    return;
  }

  const studentText = studentMessageEl.value.trim();
  if (!studentText) {
    setStatus('Escribe un mensaje antes de enviar.', true);
    return;
  }

  messages.push({ role: 'student', content: studentText });
  appendMessage('student', studentText);
  studentMessageEl.value = '';

  const textoTutor = await callTutor();
  if (!textoTutor) return;

  messages.push({ role: 'tutor', content: textoTutor });
  appendMessage('tutor', textoTutor);
}

// ==========================
// Guardar sesión en servidor
// ==========================
async function handleSaveSession() {
  const exercise = exerciseEl.value.trim();

  if (!exercise) {
    setStatus('No hay enunciado para guardar.', true);
    return;
  }

  if (messages.length === 0) {
    setStatus('No hay conversación para guardar.', true);
    return;
  }

  try {
    setStatus('Guardando sesión en el servidor...');

    const resp = await fetch('/api/save-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentName: getStudentName(),
        exercise,
        mode: currentMode,
        messages,
        timestamp: new Date().toISOString(),
        sessionFinished
      })
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error('Error en /api/save-session:', errorText);
      setStatus('Error al guardar la sesión.', true);
      return;
    }

    const data = await resp.json();
    if (data.ok) {
      setStatus('Sesión guardada en el servidor (carpeta /sessions).');
    } else {
      setStatus('El servidor respondió pero no confirmó el guardado.', true);
    }
  } catch (err) {
    console.error('Error de red en /api/save-session:', err);
    setStatus('Error de red al guardar la sesión.', true);
  }
}

// ==========================
// Evaluar sesión
// ==========================
async function handleEvaluateSession() {
  if (sessionFinished) {
    setStatus('La sesión ya fue evaluada.', true);
    return;
  }

  const exercise = exerciseEl.value.trim();

  if (!exercise) {
    setStatus('No hay enunciado para evaluar.', true);
    return;
  }

  if (messages.length === 0) {
    setStatus('No hay conversación para evaluar.', true);
    return;
  }

  const hasStudentMessage = messages.some(m => m.role === 'student');
  if (!hasStudentMessage) {
    setStatus('Todavía no hay respuestas del estudiante para evaluar.', true);
    return;
  }

  try {
    setStatus('Enviando sesión para evaluación...');

    const resp = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentName: getStudentName(),
        exercise,
        messages
      })
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error('Error en /api/evaluate:', errorText);
      setStatus('Error al evaluar la sesión.', true);
      return;
    }

    const data = await resp.json();

    if (data.ok && data.evaluation) {
      const panelHtml = renderEvaluationPanel(data.evaluation);
      evaluationOutputEl.innerHTML = panelHtml;

      sessionFinished = true;
      sendBtn.disabled = true;
      studentMessageEl.disabled = true;
      evaluateSessionBtn.disabled = true;

      appendMessage(
        'system',
        '✅ La sesión fue evaluada y quedó cerrada. Para seguir practicando, inicia una nueva sesión.'
      );

      setStatus('Evaluación recibida. La sesión quedó cerrada.');
      showSessionEndCard();
    } else if (data.raw) {
      evaluationOutputEl.textContent =
        'La IA no devolvió un JSON válido. Respuesta cruda:\n\n' + data.raw;
      setStatus('Error de formato en la evaluación.', true);
    } else {
      evaluationOutputEl.textContent = 'No se recibió una evaluación válida.';
      setStatus('Respuesta de evaluación inesperada.', true);
    }
  } catch (err) {
    console.error('Error de red en /api/evaluate:', err);
    setStatus('Error de red al evaluar la sesión.', true);
  }
}

function handleNewSession() {
  messages = [];
  sessionFinished = false;

  chatEl.innerHTML = '';
  evaluationOutputEl.innerHTML = '(Aquí aparecerá la evaluación de la sesión)';
  studentMessageEl.value = '';

  sendBtn.disabled = false;
  studentMessageEl.disabled = false;
  evaluateSessionBtn.disabled = false;

  hideSessionEndCard();
  setStatus('Sesión reiniciada. Puedes escribir un nuevo enunciado e iniciar el tutor.');
}

// ==========================
// Exportar a PDF
// ==========================
function handleExportPdf() {
  const exercise = exerciseEl.value.trim();
  const studentName = getStudentName();
const safeStudentName = studentName.replace(/[\\/:*?"<>|]/g, '-');
  const date = new Date().toLocaleString();
  const dateFile = new Date().toISOString().slice(0, 10);

  const modeMap = {
    guiada: 'Guía paso a paso',
    corta: 'Explicación corta',
    diagnostico: 'Diagnóstico inicial'
  };

  const modeLabel = modeMap[currentMode] || currentMode;
  const estado = sessionFinished ? 'Sesión finalizada y evaluada' : 'Sesión en curso';

  let htmlChat = '';

  chatEl.querySelectorAll('.message').forEach(msg => {
    let who = 'Tutor IA';
    let cssClass = 'tutor';

    if (msg.classList.contains('student')) {
      who = 'Estudiante';
      cssClass = 'student';
    }

    const headerText = msg.querySelector('.message-header')?.innerText?.trim();
    if (headerText === 'Sistema') {
      who = 'Sistema';
      cssClass = 'system';
    }

    const body = msg.querySelector('.message-body')?.innerHTML || '';

    htmlChat += `
      <div class="chat-message ${cssClass}">
        <div class="chat-message-header">${who}</div>
        <div class="chat-message-body">${body}</div>
      </div>
    `;
  });

  const evalHtml = evaluationOutputEl.innerHTML || '<p>(Sin evaluación)</p>';

  const win = window.open('', '_blank');
  if (!win) {
    setStatus('No se pudo abrir la ventana para exportar el PDF.', true);
    return;
  }

  win.document.write(`
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>Informe Tutor IA - ${safeStudentName} - ${dateFile}</title>

      <style>
        body {
          font-family: system-ui, sans-serif;
          padding: 24px;
          line-height: 1.45;
        }

        h1 { margin: 0 0 4px 0; }
        h2 {
          margin-top: 20px;
          border-bottom: 2px solid #ddd;
          padding-bottom: 4px;
        }

        .header-box {
          background: #f3f4f6;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 16px;
        }

        .header-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px 20px;
        }

        .label { font-weight: bold; }

        .chat-message {
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 8px;
          margin-bottom: 8px;
        }

        .chat-message.student { background: #ecfdf5; }
        .chat-message.tutor { background: #f9fafb; }
        .chat-message.system { background: #eff6ff; }

        .chat-message-header {
          font-weight: bold;
          margin-bottom: 4px;
        }

        .evaluation {
          border: 1px solid #ddd;
          padding: 10px;
          border-radius: 6px;
          background: #fafafa;
        }
      </style>

      <script>
        window.MathJax = {
          tex: {
            inlineMath: [['$', '$'], ['\\\\(', '\\\\)']]
          }
        };
      </script>
      <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    </head>

    <body>
      <h1>Tutor IA de Física</h1>
      <p><strong>Informe de sesión</strong></p>

      <div class="header-box">
        <div class="header-grid">
          <p><span class="label">Estudiante:</span> ${studentName}</p>
          <p><span class="label">Fecha:</span> ${date}</p>
          <p><span class="label">Modo:</span> ${modeLabel}</p>
          <p><span class="label">Estado:</span> ${estado}</p>
        </div>
      </div>

      <h2>1. Enunciado del ejercicio</h2>
      <p>${exercise ? exercise.replace(/\\n/g, '<br>') : '(Sin enunciado)'}</p>

      <h2>2. Desarrollo de la interacción</h2>
      ${htmlChat || '<p>(Sin mensajes)</p>'}

      <h2>3. Evaluación final</h2>
      <div class="evaluation">
        ${evalHtml}
      </div>

      <script>
        window.onload = () => {
          if (window.MathJax && MathJax.typesetPromise) {
            MathJax.typesetPromise().then(() => window.print());
          } else {
            window.print();
          }
        };
      </script>
    </body>
    </html>
  `);

  win.document.close();
}

// ==========================
// Modo oscuro
// ==========================
function initTheme() {
  document.body.classList.add('light-mode');
}

function toggleTheme() {
  if (document.body.classList.contains('light-mode')) {
    document.body.classList.remove('light-mode');
    document.body.classList.add('dark-mode');
    toggleThemeBtn.textContent = 'Modo claro';
  } else {
    document.body.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
    toggleThemeBtn.textContent = 'Modo oscuro';
  }
}

// ==========================
// Event listeners
// ==========================
sendBtn.addEventListener('click', handleSend);
saveSessionBtn.addEventListener('click', handleSaveSession);
evaluateSessionBtn.addEventListener('click', handleEvaluateSession);
exportPdfBtn.addEventListener('click', handleExportPdf);
toggleThemeBtn.addEventListener('click', toggleTheme);
startTutorBtn.addEventListener('click', handleStartTutor);

if (studentNameEl) {
  studentNameEl.addEventListener('input', persistStudentIdentity);
}

mathSymbolButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    const symbol = btn.dataset.symbol;

    if (symbol) {
      insertSymbolInStudentMessage(symbol);
    } else if (action === 'super') {
      convertSelected('super');
    } else if (action === 'sub') {
      convertSelected('sub');
    }
  });
});

studentMessageEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    handleSend();
  }
});

if (newSessionBtn) {
  newSessionBtn.addEventListener('click', handleNewSession);
}

if (finalExportPdfBtn) {
  finalExportPdfBtn.addEventListener('click', handleExportPdf);
}

// ==========================
// Inicialización
// ==========================
initTheme();
loadStudentIdentity();
hideSessionEndCard();