import { basicOpts, optsWithoutAppID, testConfig } from './test-setup'
import Client from '../src/client'

import chai from 'chai'

let expect = chai.expect
let should = chai.should()

describe('Client', function() {
  this.timeout(10000)
  let client

  it('should exist', () => {
    expect(Client).to.be.ok
  })

  it('should throw an error if an app ID is not provided', () => {
    expect(Client.bind(optsWithoutAppID)).to.throw(Error)
  })

  beforeEach(() => {
    client = new Client(basicOpts)
  })

  it('can make an unauthenticated request', (done) => {
    return client.type('projects').get(testConfig.testProjectID)
      .then( (project) => done() )
      .catch( (e) => done(e) )
  })

  describe('#authenticate', () => {
    it('correctly sets the access token', () => {
      client.authenticate(123456)
      client.should.have.property('token').and.equal(123456)
      client.headers.should.have.property('Authorization').and.equal('Bearer ' + 123456)
    })
  })

  describe('#removeAuthentication', () => {
    beforeEach(() => {
      client.authenticate(123456)
    })

    it('correctly removes the access token', () => {
      client.removeAuthentication()
      client.should.not.have.property('token')
      client.headers.should.not.have.property('Authorization')
    })
  })
})
