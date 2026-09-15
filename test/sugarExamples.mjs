/*
  Runs every @example against a real server, extracted from the same source
  jsdoc2md generates from, so an example that stops being true fails CI.

  A `// =>` line asserts the line above it deep-equals that value. Everything
  else runs verbatim, in order, in one scope. Async delivery is covered in
  sugarProtocol.mjs.
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';
import {
  createClient,
  nextFrame,
  restoreNetConnect,
  startSugar,
  SugarClient,
  target
} from './support/sugarTarget.mjs';

const CLIENT_PATH = fileURLToPath(new URL('../lib/SugarClient/client.js', import.meta.url));
const source = readFileSync(CLIENT_PATH, 'utf8');

/**
 * Every @example in the source, tagged with the symbol it documents.
 * @returns {Array<{symbol: string, code: string}>}
 */
export function extractExamples() {
  const examples = [];
  const blocks = source.matchAll(
    /\/\*\*((?:(?!\*\/)[\s\S])*?)\*\/\n\s*(?:async\s+)?([A-Za-z_$][\w$]*)/g
  );

  for (const [, body, declared] of blocks) {
    const symbol = declared === 'class' ? 'SugarClient' : declared;
    const lines = body.split('\n').map((line) => line.replace(/^\s*\* ?/, ''));
    let collecting = false;
    let code = [];

    function flush() {
      if (collecting && code.join('').trim()) {
        examples.push({ symbol, code: code.join('\n').trim() });
      }
      code = [];
    }

    for (const line of lines) {
      if (line.trim().startsWith('@example')) {
        flush();
        collecting = true;
        continue;
      }
      if (line.trim().startsWith('@')) {
        flush();
        collecting = false;
        continue;
      }
      if (collecting) code.push(line);
    }
    flush();
  }

  return examples;
}

/**
 * Rewrites an example into an async function body. A line followed by a `// =>`
 * annotation becomes an assertion; every other line is passed through untouched
 * so declarations, blank lines and multi-line callbacks all still work.
 * @param {string} code
 * @returns {{body: string, assertions: number}}
 */
export function toRunnableBody(code) {
  const lines = code.split('\n');
  const out = [];
  let assertions = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1] || '';
    const annotation = next.match(/^\s*\/\/\s*=>\s*(.+?)\s*$/);

    if (annotation && line.trim()) {
      const raw = annotation[1];
      const expected = raw === 'undefined' ? 'undefined' : JSON.stringify(JSON.parse(raw));
      out.push(`__expect(${line.trim()}, ${expected}, ${JSON.stringify(line.trim())});`);
      assertions += 1;
      index += 1;
      continue;
    }
    if (/^\s*\/\/\s*=>/.test(line)) continue;
    out.push(line);
  }

  return { body: out.join('\n'), assertions };
}

// The class example is setup: requiring the module and pointing it at
// production. Syntax-checked, not executed.
const SETUP_ONLY = new Set(['SugarClient']);

describe(`Sugar @example blocks (${target})`, function () {
  this.timeout(10000);

  let sugar;
  let client;
  const examples = extractExamples();

  before(async function () {
    sugar = await startSugar();
  });

  after(async function () {
    await sugar?.close();
    restoreNetConnect();
  });

  beforeEach(async function () {
    // Logged out: every executed example works without a JWT, so this suite runs
    // identically against fixture and live.
    client = createClient(sugar);
    client.connect();
    await nextFrame(client, (d) => d.type === 'connection', 'connection');
  });

  afterEach(function () {
    client?.disconnect();
    client = null;
  });

  it('finds an example for every documented symbol', function () {
    const symbols = new Set(examples.map((example) => example.symbol));
    expect([...symbols]).to.include.members([
      'SugarClient',
      'connect',
      'createEvent',
      'disconnect',
      'emit',
      'host',
      'off',
      'on',
      'primusUrl',
      'receiveData',
      'refreshToken',
      'subscribeTo',
      'unsubscribeFrom'
    ]);
  });

  it('asserts a return value somewhere', function () {
    const total = examples.reduce(
      (sum, example) => sum + toRunnableBody(example.code).assertions,
      0
    );
    expect(total, 'no example asserts anything').to.be.above(8);
  });

  examples.forEach(function ({ symbol, code }, index) {
    const label = `${symbol} example ${index}`;

    it(`${label} is syntactically valid`, function () {
      const { body } = toRunnableBody(code);
      expect(
        () => new Function('client', 'SugarClient', '__expect', `return (async () => {\n${body}\n})()`),
        `${label} does not parse:\n${body}`
      ).to.not.throw();
    });

    if (SETUP_ONLY.has(symbol)) return;

    it(`${label} runs and returns what it documents`, async function () {
      const { body } = toRunnableBody(code);
      const run = new Function(
        'client',
        'SugarClient',
        '__expect',
        `return (async () => {\n${body}\n})()`
      );

      await run(client, SugarClient, function (actual, expected, expression) {
        expect(actual, `${label}: ${expression}`).to.deep.equal(expected);
      });
    });
  });
});
