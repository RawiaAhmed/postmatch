/**
 * Fails if the posting schema uses JSON Schema features Claude structured
 * outputs reject, so a harmless-looking `.min(1)` cannot break extraction at
 * request time.
 *
 * Written by hand because no library checks a schema against Claude's specific
 * limits; Zod's own toJSONSchema does the conversion, this only inspects it.
 *
 * Run: npm run schema:check
 */
import { z } from 'zod';
import { postingSchema } from '../lib/schema';

// Numeric, string and array constraints are unsupported (see Claude docs,
// "JSON Schema limitations").
const FORBIDDEN = [
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
  'minLength', 'maxLength', 'minItems', 'maxItems', 'uniqueItems',
];

const problems: string[] = [];

function walk(node: unknown, path: string): void {
  if (Array.isArray(node)) {
    node.forEach((child, i) => walk(child, `${path}[${i}]`));
    return;
  }
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;

  for (const key of FORBIDDEN) {
    if (key in obj) problems.push(`${path}: uses '${key}'`);
  }
  if (obj.type === 'object' && obj.additionalProperties !== false) {
    problems.push(`${path}: object without additionalProperties: false`);
  }
  if (obj.type === 'object' && obj.properties) {
    const required = new Set((obj.required as string[] | undefined) ?? []);
    for (const prop of Object.keys(obj.properties as object)) {
      if (!required.has(prop)) problems.push(`${path}.${prop}: optional (use .nullable() instead)`);
    }
  }
  for (const [key, value] of Object.entries(obj)) walk(value, `${path}.${key}`);
}

const jsonSchema = z.toJSONSchema(postingSchema, { io: 'output' });
walk(jsonSchema, '$');

if (process.argv.includes('--print')) console.log(JSON.stringify(jsonSchema, null, 2));
if (problems.length) {
  console.log(problems.map((p) => `FAIL  ${p}`).join('\n'));
  process.exit(1);
}
console.log(`schema OK: ${Object.keys(postingSchema.shape).length} fields, no unsupported keywords`);
