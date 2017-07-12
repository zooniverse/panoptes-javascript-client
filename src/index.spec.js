/* eslint func-names: 0, prefer-arrow-callback: 0 */
/* eslint-env mocha */
/* global expect */

import Library from './index.js';

let lib;

describe('Given an instance of my library', function () {
  before(function () {
    lib = new Library();
  });

  describe('when I need the name', function () {
    it('should return the name', function () {
      expect(lib.name).to.equal('Library');
    });
  });
});
