/* "Passing arrow functions (“lambdas”) to Mocha is discouraged" */
/* - https://mochajs.org/#arrow-functions */

/* eslint prefer-arrow-callback: 0, func-names: 0 */
/* global describe, it, before */

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import Library from '../lib/index.js';

chai.use(chaiAsPromised);
const expect = chai.expect;

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
