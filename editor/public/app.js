const fileSelect = document.querySelector('#fileSelect');
const saveButton = document.querySelector('#saveButton');
const newButton = document.querySelector('#newButton');
const preview = document.querySelector('#preview');
const status = document.querySelector('#status');
const currentFile = document.querySelector('#currentFile');

let editor;
let activeFile = '';
let isDirty = false;
let previewTimer;

function setStatus(message, variant = '') {
  status.textContent = message;
  status.className = `status ${variant}`.trim();
}

async function requestJson(url, options) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed');
  }

  return payload;
}

function renderFileOptions(files) {
  fileSelect.replaceChildren(
    ...files.map((file) => {
      const option = document.createElement('option');
      option.value = file;
      option.textContent = file;
      return option;
    }),
  );
}

async function loadFiles(selectedFile = '') {
  const { files } = await requestJson('/api/files');
  renderFileOptions(files);

  if (files.length === 0) {
    setStatus('No .adoc files found', 'error');
    return;
  }

  await loadFile(files.includes(selectedFile) ? selectedFile : files[0]);
}

async function loadFile(file) {
  if (isDirty && !window.confirm('未保存の変更があります。ファイルを切り替えますか？')) {
    fileSelect.value = activeFile;
    return;
  }

  setStatus('Loading...');
  const { content } = await requestJson(`/api/file?path=${encodeURIComponent(file)}`);
  activeFile = file;
  currentFile.textContent = file;
  fileSelect.value = file;
  editor.setValue(content);
  isDirty = false;
  setStatus('Saved');
  schedulePreview();
}

async function saveFile() {
  if (!activeFile) {
    return;
  }

  setStatus('Saving...');
  await requestJson('/api/file', {
    method: 'POST',
    body: JSON.stringify({ path: activeFile, content: editor.getValue() }),
  });
  isDirty = false;
  setStatus('Saved');
  await loadFiles(activeFile);
}

async function createFile() {
  const file = window.prompt('作成する .adoc のパスを入力してください', 'ROOT/pages/new-page.adoc');
  if (!file) {
    return;
  }

  const normalizedFile = file.replace(/^\/+/, '');
  if (!normalizedFile.endsWith('.adoc')) {
    setStatus('File name must end with .adoc', 'error');
    return;
  }

  activeFile = normalizedFile;
  currentFile.textContent = normalizedFile;
  editor.setValue(`= New Page\n\nWrite your content here.\n`);
  isDirty = true;
  await saveFile();
}

async function updatePreview() {
  try {
    const { html } = await requestJson('/api/preview', {
      method: 'POST',
      body: JSON.stringify({ content: editor.getValue() }),
    });
    preview.innerHTML = html;
  } catch (error) {
    preview.innerHTML = `<pre class="error">${error.message}</pre>`;
  }
}

function schedulePreview() {
  window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(updatePreview, 250);
}

require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.49.0/min/vs' } });
require(['vs/editor/editor.main'], async () => {
  monaco.languages.register({ id: 'asciidoc' });
  monaco.languages.setMonarchTokensProvider('asciidoc', {
    tokenizer: {
      root: [
        [/^=+ .*/, 'keyword'],
        [/^\* .*/, 'type'],
        [/\bhttps?:\/\/\S+/, 'string'],
        [/\*[^*]+\*/, 'strong'],
        [/\_[^_]+\_/, 'emphasis'],
        [/`[^`]+`/, 'variable'],
      ],
    },
  });

  editor = monaco.editor.create(document.querySelector('#editor'), {
    value: '',
    language: 'asciidoc',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    wordWrap: 'on',
    theme: 'vs-dark',
  });

  editor.onDidChangeModelContent(() => {
    isDirty = true;
    setStatus('Unsaved changes', 'dirty');
    schedulePreview();
  });

  fileSelect.addEventListener('change', () => loadFile(fileSelect.value).catch(showError));
  saveButton.addEventListener('click', () => saveFile().catch(showError));
  newButton.addEventListener('click', () => createFile().catch(showError));

  try {
    await loadFiles();
  } catch (error) {
    showError(error);
  }
});

function showError(error) {
  setStatus(error.message, 'error');
}
