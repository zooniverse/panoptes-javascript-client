/* eslint
  func-names: 0,
  prefer-arrow-callback: 0
*/

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
