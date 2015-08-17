import { basicOpts, optsWithSecret, optsWithouotAppID, testConfig } from './test-setup'
import Client from '../src/client'

import { EventEmitter } from 'fbemitter'
import { Resource } from 'json-api-client'

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import spies from 'chai-spies'

chai.use(chaiAsPromised)
chai.use(spies)

let {expect, spy} = chai
let should = chai.should()

describe('Auth', function() {
  this.timeout(10000)
  let client

  beforeEach(() => {
    client = new Client(basicOpts)
  })

  it('should be created with a new client', () => {
    expect(client.auth).to.exist
    expect(client.auth).to.be.an.instanceof(EventEmitter)
  })

  describe('Password flow', () => {
    describe('#register', () => {
      it('should allow you to register', (done) => {
        let registerOpts = {
          login: testConfig.login,
          password: testConfig.password,
          email: testConfig.email
        }

        let registerSpy = spy()
        client.auth.addListener('change', registerSpy)

        return client.auth.register(registerOpts)
          .then((user) => {
            expect(user).to.be.instanceOf(Resource)
            expect(user.login).to.be.equal(testConfig.login)
            expect(registerSpy).to.have.been.called()
            done()
          })
          .catch((e) => {
            done(e)
          })
      })
    })

    describe('#signIn', () => {
      it('should allow you to sign in', (done) => {
        let signInOpts = {
          username: testConfig.username,
          password: testConfig.password
        }

        let signInSpy = spy()
        client.auth.addListener('change', signInSpy)

        return client.auth.signIn(signInOpts)
          .then((user) => {
            expect(user).to.be.instanceOf(Resource)
            expect(user.login).to.be.equal(testConfig.login)
            expect(signInSpy).to.have.been.called()
            done()
          })
          .catch((e) => {
            done(e)
          })
      })
    })

    describe('#signOut', () => {
      it('should sign out the current user', (done) => {
        let signInOpts = {
          username: testConfig.username,
          password: testConfig.password
        }
        client.auth.signIn(signInOpts)
          .then(() => {
            client.auth.signOut()
              .then(() => {
                expect(client.auth.user).to.be.false
                done()
              })
              .catch((e) => {
                done(e)
              })
          })
      })

      it('should throw an error if no user exists', () => {
        expect(client.auth.signOut).to.throw(Error)
      })
    })
  })

  describe('#_getAuthToken', () => {
    it('should fetch a CSRF token', () => {
      return client.auth._getAuthToken().should.eventually.exist
    })
  })

  describe('#_getBearerToken', () => {
    // it('should fetch a new bearer token if not set', () => {
    //   return client.auth._getBearerToken().should.eventually.exist
    // })
  })

  describe('#_handleNewBearerToken', () => {

  })

  describe('#_refreshBearerToken', () => {

  })

  describe('#_deleteBearerToken', function() {
    it('should remove references to existing bearer tokens', () => {
      client.removeAuthentication = spy(client.removeAuthentication)

      client.auth._deleteBearerToken()

      expect(client.removeAuthentication).to.have.been.called()
      expect(Number.isNaN(client.auth._bearerRefreshTimeout)).to.be.true
    })

  })

  describe('#_getSession', () => {
    // Not sure how to test this
  })
})
