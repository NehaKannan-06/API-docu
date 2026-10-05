import YAML from 'yaml';
import type { AnalysisResult } from '../models/schemas.ts';
import { parseStructuredSpecObject } from './json_parser.ts';

export function parseYamlSpec(sourceCode: string, framework: string): AnalysisResult {
  try {
    const parsed = YAML.parse(sourceCode);
    return parseStructuredSpecObject(parsed, 'yaml', framework);
  } catch (err: any) {
    return {
      detectedLanguage: 'yaml',
      framework,
      endpoints: [],
      models: {},
      parseWarnings: [`Invalid YAML syntax: ${err?.message || 'Unable to parse YAML'}`],
    };
  }
}
