import { expect } from 'chai';
import talkClient from '../lib/talk-client.js'

describe('talkClient', function() {
    describe('search', function() {
        specify('should return a list of comments', async function() {
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
        });
        specify('should ignore null comments', async function() {
            // this Talk query returns 9 comments and one null comment.
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
        });
    });
});