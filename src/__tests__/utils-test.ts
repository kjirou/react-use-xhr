import * as sinon from 'sinon'
import xhrMock, {delay, sequence} from 'xhr-mock'

import {
  SendHttpRequestData,
  SendHttpRequestHttpMethod,
  sendHttpRequest,
} from '../utils'

describe('src/utils', () => {
  describe('sendHttpRequest', () => {
    beforeEach(() => {
      xhrMock.setup()
    })
    afterEach(() => {
      xhrMock.teardown()
    })

    it('can set http headers', (done) => {
      xhrMock.get('/foo', (req, res) => {
        expect(req.header('X-Foo')).toBe('Fooo')
        return res.status(200)
      })

      sendHttpRequest(
        {
          httpMethod: 'GET',
          url: '/foo',
          headers: {
            'X-Foo': 'Fooo',
          },
        },
        (error_, result_) => {done()}
      )
    })

    describe('can perform standard operations for each http-method', () => {
      const testCases: {
        httpMethod: SendHttpRequestHttpMethod,
      }[] = [
        {httpMethod: 'GET'},
        {httpMethod: 'POST'},
        {httpMethod: 'PATCH'},
        {httpMethod: 'PUT'},
        {httpMethod: 'DELETE'},
      ]
      testCases.forEach(({httpMethod}) => {
        describe(`when it succeeded ${httpMethod} request`, () => {
          const requestData = {
            httpMethod,
            url: '/foo',
          }

          beforeEach(() => {
            xhrMock.use(httpMethod, '/foo', {
              status: 200,
              body: 'BAR',
            })
          })

          it('can receive xhr instance', (done) => {
            sendHttpRequest(requestData, (error_, result) => {
              expect(result.xhr).toBeInstanceOf(XMLHttpRequest)
              expect(result.xhr.status).toBe(200)
              expect(result.xhr.responseText).toBe('BAR')
              done()
            })
          })

          it('should not return any error', (done) => {
            sendHttpRequest(requestData, (error, result_) => {
              expect(error).toBe(null)
              done()
            })
          })
        })
      })
    })

    describe('event handling', () => {
      describe('when it received "abort" event', () => {
        const requestData: SendHttpRequestData = {
          httpMethod: 'GET',
          url: '/foo',
        }

        beforeEach(() => {
          xhrMock.get('/foo', () => new Promise(() => {}))
        })

        it('should return an error', (done) => {
          const xhr = sendHttpRequest(requestData, (error, result_) => {
            expect(error).toBeInstanceOf(Error)
            expect(error?.message).toContain(' XHR error ')
            done()
          })
          setTimeout(() => {
            xhr.abort()
          }, 1)
        })

        it('should return at least one "abort" event', (done) => {
          const xhr = sendHttpRequest(requestData, (error_, result) => {
            expect(result.events.length).toBeGreaterThan(0)
            expect(result.events.some((event) => event.type === 'abort')).toBe(true)
            done()
          })
          setTimeout(() => {
            xhr.abort()
          }, 1)
        })
      })

      describe('when it received "timeout" event', () => {
        const requestData: SendHttpRequestData = {
          httpMethod: 'GET',
          url: '/foo',
        }
        const options = {
          timeout: 1,
        }

        beforeEach(() => {
          xhrMock.get('/foo', () => new Promise(() => {}))
        })

        it('should return an error', (done) => {
          sendHttpRequest(requestData, (error, result_) => {
            expect(error).toBeInstanceOf(Error)
            expect(error?.message).toContain(' XHR error ')
            done()
          }, options)
        })

        it('should return at least one "timeout" event', (done) => {
          sendHttpRequest(requestData, (error_, result) => {
            expect(result.events.length).toBeGreaterThan(0)
            expect(result.events.some((event) => event.type === 'timeout')).toBe(true)
            done()
          }, options)
        })
      })
    })
  })
})
