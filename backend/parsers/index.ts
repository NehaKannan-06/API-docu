import type { AnalysisResult } from '../models/schemas.ts';
import { detectLanguage } from './language_detector.ts';
import { parsePythonCode } from './python_parser.ts';
import { parseJavaScriptCode } from './javascript_parser.ts';
import { parseJavaCode } from './java_parser.ts';
import { parseJsonSpec } from './json_parser.ts';
import { parseYamlSpec } from './yaml_parser.ts';

export function analyzeSourceCode(
  sourceCode: string,
  hintLanguage?: string,
  filename?: string
): AnalysisResult {
  const { language, framework } = detectLanguage(sourceCode, hintLanguage, filename);

  switch (language) {
    case 'python':
      return parsePythonCode(sourceCode, framework);
    case 'javascript':
    case 'typescript':
      return parseJavaScriptCode(sourceCode, language, framework);
    case 'java':
      return parseJavaCode(sourceCode, framework);
    case 'json':
      return parseJsonSpec(sourceCode, framework);
    case 'yaml':
      return parseYamlSpec(sourceCode, framework);
    default:
      return parsePythonCode(sourceCode, framework);
  }
}
