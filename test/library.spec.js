/* "Passing arrow functions (“lambdas”) to Mocha is discouraged" */
/* - https://mochajs.org/#arrow-functions */

/* eslint prefer-arrow-callback: 0, func-names: 0 */
/* global describe, it, before */

import assert from 'assert';
import Library from '../lib/library.js';

let lib;

describe('Given an instance of my library', function () {

  before(function () {
    lib = new Library();
  });

  describe('when I need the name', function () {
    it('should return the name', function () {
      assert.strictEqual(lib.name, 'Library');
    });
  });

});
