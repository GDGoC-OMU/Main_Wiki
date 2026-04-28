import asciidoctorFactory from '@asciidoctor/core';
import express from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const asciidoctor = asciidoctorFactory();

const port = Number(process.env.PORT ?? 3000);
const workspaceRoot = path.resolve(process.env.WORKSPACE_ROOT ?? '/workspace');
const docsRoot = path.resolve(
  process.env.DOCS_ROOT ?? path.join(workspaceRoot, 'components/main/modules'),
);

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function isInsideRoot(targetPath) {
  const relative = path.relative(docsRoot, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveDocPath(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') {
    throw new Error('path is required');
  }

  const fullPath = path.resolve(docsRoot, relativePath);
  if (!isInsideRoot(fullPath) || path.extname(fullPath) !== '.adoc') {
    throw new Error('Only .adoc files under the docs root can be edited');
  }

  return fullPath;
}

async function listAsciiDocFiles(directory, base = directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return listAsciiDocFiles(fullPath, base);
      }

      if (!entry.isFile() || path.extname(entry.name) !== '.adoc') {
        return [];
      }

      return path.relative(base, fullPath).split(path.sep).join('/');
    }),
  );

  return files.flat().sort();
}

app.get('/api/files', async (_request, response) => {
  try {
    response.json({ files: await listAsciiDocFiles(docsRoot) });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.get('/api/file', async (request, response) => {
  try {
    const filePath = resolveDocPath(request.query.path);
    response.json({ content: await fs.readFile(filePath, 'utf8') });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post('/api/file', async (request, response) => {
  try {
    const { path: relativePath, content } = request.body ?? {};
    const filePath = resolveDocPath(relativePath);

    if (typeof content !== 'string') {
      throw new Error('content must be a string');
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
    response.json({ ok: true });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post('/api/preview', async (request, response) => {
  try {
    const { content } = request.body ?? {};
    if (typeof content !== 'string') {
      throw new Error('content must be a string');
    }

    const html = asciidoctor.convert(content, {
      safe: 'safe',
      attributes: {
        showtitle: true,
        icons: 'font',
        sectanchors: true,
      },
    });

    response.json({ html });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`AsciiDoc editor running on http://0.0.0.0:${port}`);
  console.log(`Editing files under ${docsRoot}`);
});
