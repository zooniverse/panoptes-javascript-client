// Asserts the JSDoc the docs are generated from exists and is complete, so an
// undocumented public method turns CI red. sugarExamples.mjs proves the
// examples in it actually run.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';

const CLIENT_PATH = fileURLToPath(new URL('../lib/SugarClient/client.js', import.meta.url));
const source = readFileSync(CLIENT_PATH, 'utf8');

// The documented surface. `__`-prefixed helpers and initializePrimus are internal.
const PUBLIC_METHODS = [
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
];

/**
 * Pulls the JSDoc block immediately preceding a method definition.
 * @param {string} name
 * @returns {string|null}
 */
function docBlockFor(name) {
  // Anchored to a method definition so an @example call site is not mistaken for
  // one, and no `*/` inside the capture so it cannot borrow an earlier block.
  const pattern = new RegExp(
    `/\\*\\*((?:(?!\\*/)[\\s\\S])*?)\\*/\\n\\s{2}(?:async\\s+)?${name}\\s*\\(`
  );
  const match = source.match(pattern);
  return match ? match[1] : null;
}

/**
 * The declared parameter names of a method, read from its definition.
 * @param {string} name
 * @returns {string[]|null}
 */
function parametersOf(name) {
  const pattern = new RegExp(`^\\s{2}(?:async\\s+)?${name}\\s*\\(([^)]*)\\)\\s*\\{`, 'm');
  const match = source.match(pattern);
  if (!match) return null;
  return match[1]
    .split(',')
    .map((param) => param.trim().split(/[=\s]/)[0])
    .filter(Boolean);
}

describe('Sugar documentation', function () {
  describe('every public method is documented', function () {
    PUBLIC_METHODS.forEach(function (name) {
      describe(`#${name}`, function () {
        it('has a JSDoc block', function () {
          expect(docBlockFor(name), `${name} has no JSDoc block`).to.be.a('string');
        });

        it('has a description', function () {
          const block = docBlockFor(name) || '';
          const description = block
            .split('\n')
            .map((line) => line.replace(/^\s*\*\s?/, '').trim())
            .filter((line) => line && !line.startsWith('@'))
            .join(' ');
          expect(description, `${name} has no prose description`).to.have.length.above(10);
        });

        it('documents its return value', function () {
          const block = docBlockFor(name) || '';
          expect(block, `${name} is missing @returns`).to.match(/@returns\s+\{/);
        });

        it('carries a runnable @example', function () {
          const block = docBlockFor(name) || '';
          expect(block, `${name} is missing @example`).to.include('@example');
        });
      });
    });
  });

  describe('methods that take arguments document them', function () {
    PUBLIC_METHODS.forEach(function (name) {
      it(`#${name} documents each parameter`, function () {
        const params = parametersOf(name);
        expect(params, `no ${name}() definition found`).to.be.an('array');
        if (params.length === 0) return;

        const block = docBlockFor(name) || '';
        params.forEach(function (param) {
          expect(block, `${name} is missing @param for ${param}`).to.match(
            new RegExp(`@param\\s+\\{[^}]+\\}\\s+\\[?${param}\\b`)
          );
        });
      });
    });
  });

  describe('the wire protocol is documented as types', function () {
    const FRAMES = [
      'SugarConnectionFrame',
      'SugarResponseFrame',
      'SugarMessageFrame'
    ];

    FRAMES.forEach(function (name) {
      it(`defines @typedef ${name}`, function () {
        expect(source, `${name} is not defined`).to.match(
          new RegExp(`@typedef\\s+\\{[^}]*\\}\\s+${name}`)
        );
      });
    });
  });

  // The narrative tables in docs/sugar.hbs derive from no JS symbol, so they can
  // drift. Check their facts against what the suite exercises.
  describe('the narrative sections match what is tested', function () {
    const template = readFileSync(
      fileURLToPath(new URL('../docs/sugar.hbs', import.meta.url)),
      'utf8'
    );
    const httpSuite = readFileSync(
      fileURLToPath(new URL('./sugarHttp.mjs', import.meta.url)),
      'utf8'
    );
    const protocolSuite = readFileSync(
      fileURLToPath(new URL('./sugarProtocol.mjs', import.meta.url)),
      'utf8'
    );

    ['/presence', '/active_users', '/notify', '/announce', '/experiment'].forEach(
      function (path) {
        it(`documents ${path} and tests it`, function () {
          expect(template, `${path} missing from the HTTP table`).to.include(path);
          expect(httpSuite, `${path} is documented but never tested`).to.include(path);
        });
      }
    );

    it('documents no endpoint the tests do not cover', function () {
      const documented = [...template.matchAll(/`(\/[a-z_]+)[`?]/g)].map((match) => match[1]);
      const unique = [...new Set(documented)];
      expect(unique).to.have.members([
        '/presence',
        '/active_users',
        '/notify',
        '/announce',
        '/experiment'
      ]);
    });

    ['notification', 'announcement', 'experiment', 'connection', 'response'].forEach(
      function (type) {
        it(`documents the ${type} frame type`, function () {
          expect(template, `${type} missing from the frame table`).to.include(`\`${type}\``);
        });
      }
    );

    it('claims the silent no-op, which the protocol suite proves', function () {
      expect(template).to.match(/silent no-op/i);
      expect(protocolSuite).to.include('silently ignores');
    });

    it('claims the manual connection lifecycle, which the source confirms', function () {
      expect(template).to.include('manual: true');
      expect(source).to.include('manual: true');
    });

    it('warns that active_users unwraps, which the HTTP suite proves', function () {
      expect(template).to.match(/returns a bare array/i);
      expect(httpSuite).to.include('unwraps to a bare array');
    });
  });

  describe('the class itself is documented', function () {
    it('documents the SugarClient class', function () {
      expect(source).to.match(/\/\*\*[\s\S]*?\*\/\s*class SugarClient/);
    });

    it('documents the host static', function () {
      expect(source, 'SugarClient.host is undocumented').to.include('@property {string} host');
    });

    it('documents the Primus static', function () {
      expect(source, 'SugarClient.Primus is undocumented').to.include('@property {object} Primus');
    });
  });
});
