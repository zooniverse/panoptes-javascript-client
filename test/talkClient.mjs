import { expect } from 'chai';
import nock from 'nock';
import talkClient from '../lib/talk-client.js';
import { talkSearch, talkSearchWithNull } from './support/mockTalkAPI.mjs';

describe('talkClient', function () {
  describe('search', function () {
    specify('should return a list of comments', async function () {
      nock('https://talk-test.zooniverse.org')
        .get('/searches?http_cache=true&types=comments&section=zooniverse&page=1&pageSize=10&query=depression')
        .reply(200, talkSearch);

      const params = {
        types: ['comments'],
        section: 'zooniverse',
        page: 1,
        pageSize: 10,
        query: 'depression'
      };
      const results = await talkClient.type('searches').get(params);
      expect(results).to.be.an('array');
      expect(results).to.have.lengthOf(10);
      results.forEach(result => {
        expect(result.type).to.equal('Comment');
        expect(result.body).to.be.a('string');
      });
    });
    specify('should ignore null comments', async function () {
      // this Talk query returns 9 comments and one null comment.
      nock('https://talk-test.zooniverse.org')
        .get('/searches?http_cache=true&types=comments&section=zooniverse&page=3&pageSize=10&query=depression')
        .reply(200, talkSearchWithNull);

      const params = {
        types: ['comments'],
        section: 'zooniverse',
        page: 3,
        pageSize: 10,
        query: 'depression'
      };
      const results = await talkClient.type('searches').get(params);
      expect(results).to.be.an('array');
      expect(results).to.have.lengthOf(9);
      results.forEach(result => {
        expect(result.type).to.equal('Comment');
        expect(result.body).to.be.a('string');
      });
    });
  });
});
