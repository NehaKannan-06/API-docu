import { Router } from 'express';
import type { Request, Response } from 'express';
import type { DocumentationStyle } from '../models/schemas.ts';
import { analyzeSourceCode } from '../parsers/index.ts';
import {
  exportDocumentationToMarkdown,
  exportDocumentationToOpenAPI,
  runDocumentationPipeline,
} from '../services/documentation_service.ts';

export const apiRouter = Router();

const MAX_CODE_LENGTH = 500_000;

apiRouter.post('/analyze', (req: Request, res: Response) => {
  try {
    const { sourceCode, language, filename } = req.body || {};

    if (!sourceCode || typeof sourceCode !== 'string' || !sourceCode.trim()) {
      res.status(400).json({
        error: 'Empty input. Please paste API source code or upload a supported API file.',
      });
      return;
    }

    if (sourceCode.length > MAX_CODE_LENGTH) {
      res.status(413).json({
        error: 'Source code exceeds the maximum size limit (500 KB). Please provide a smaller file.',
      });
      return;
    }

    const analysis = analyzeSourceCode(sourceCode, language, filename);
    if (analysis.endpoints.length === 0) {
      res.status(422).json({
        error:
          'No API endpoints were detected in this file. Please provide source code containing API routes.',
        analysis,
      });
      return;
    }

    res.json({ analysis });
  } catch (err: any) {
    res.status(500).json({
      error: err?.message || 'Failed to parse API source code.',
    });
  }
});

apiRouter.post('/generate', async (req: Request, res: Response) => {
  try {
    const { sourceCode, language, filename, style } = req.body || {};

    if (!sourceCode || typeof sourceCode !== 'string' || !sourceCode.trim()) {
      res.status(400).json({
        error: 'Empty input. Please paste API source code or upload a file before generating documentation.',
      });
      return;
    }

    if (sourceCode.length > MAX_CODE_LENGTH) {
      res.status(413).json({
        error: 'The provided source file is too large (maximum 500 KB).',
      });
      return;
    }

    const validStyles: DocumentationStyle[] = [
      'Developer Friendly',
      'Concise',
      'Detailed',
      'OpenAPI Style',
    ];
    const selectedStyle: DocumentationStyle = validStyles.includes(style)
      ? style
      : 'Developer Friendly';

    const result = await runDocumentationPipeline(sourceCode, {
      language,
      filename,
      style: selectedStyle,
    });

    const markdown = exportDocumentationToMarkdown(result.documentation);
    const openApiJson = exportDocumentationToOpenAPI(result.documentation, 'json');
    const openApiYaml = exportDocumentationToOpenAPI(result.documentation, 'yaml');

    res.json({
      analysis: result.analysis,
      documentation: result.documentation,
      exports: {
        markdown,
        openApiJson,
        openApiYaml,
      },
    });
  } catch (err: any) {
    const status = err?.message?.includes('No API endpoints were detected') ? 422 : 500;
    res.status(status).json({
      error:
        err?.message ||
        'An unexpected error occurred while generating documentation. Please verify your source code and try again.',
    });
  }
});

apiRouter.post('/github-import', async (req: Request, res: Response) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Please provide a valid GitHub file URL.' });
      return;
    }

    let rawUrl = url.trim();
    if (rawUrl.includes('github.com/') && rawUrl.includes('/blob/')) {
      rawUrl = rawUrl
        .replace('https://github.com/', 'https://raw.githubusercontent.com/')
        .replace('/blob/', '/');
    }

    if (
      !rawUrl.startsWith('https://raw.githubusercontent.com/') &&
      !rawUrl.startsWith('https://gist.githubusercontent.com/')
    ) {
      res.status(400).json({
        error:
          'Please provide a direct GitHub file URL (e.g., https://github.com/owner/repo/blob/main/app.py).',
      });
      return;
    }

    const response = await fetch(rawUrl);
    if (!response.ok) {
      res.status(404).json({
        error: `Could not fetch file from GitHub (HTTP ${response.status}). Ensure the repository and file are public.`,
      });
      return;
    }

    const content = await response.text();
    if (content.length > MAX_CODE_LENGTH) {
      res.status(413).json({
        error: 'The GitHub file exceeds the 500 KB limit.',
      });
      return;
    }

    const filename = rawUrl.split('/').pop() || 'imported_api.py';
    res.json({
      filename,
      sourceCode: content,
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Unable to fetch the requested file from GitHub. Check the URL and try again.',
    });
  }
});
