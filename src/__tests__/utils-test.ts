import * as sinon from 'sinon'
import xhrMock, {delay, sequence} from 'xhr-mock'

import {
  SendHttpRequestData,
  SendHttpRequestHttpMethod,
  appendItemAsLastInFirstOut,
  sendHttpRequest,
} from '../utils'

describe('src/utils', () => {
  describe('appendItemAsLastInFirstOut', () => {
    it('should append a new item to the last', function() {
      const items = appendItemAsLastInFirstOut<string>(['a'], 'b', 100)
      expect(items[1]).toBe('b')
    })

    it('should remove an excess item from the first', function() {
      const items = appendItemAsLastInFirstOut<number>([11, 22], 33, 2)
      expect(items[0]).toBe(22)
      expect(items[1]).toBe(33)
    })

    it('can not append any items if maxResultCache is 0', function() {
      const items = appendItemAsLastInFirstOut<string>([], 'a', 0)
      expect(items.length).toBe(0)
    })
  })

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
        describe(`when the ${httpMethod} resource exists`, () => {
          const requestData = {
            httpMethod,
            url: '/foo',
          }
          let handleEvent: any

          beforeEach(() => {
            xhrMock.use(httpMethod, '/foo', {
              status: 200,
              body: 'FOO',
            })
            handleEvent = sinon.spy()
          })

          it('should return "loadstart" event at the first call', (done) => {
            sendHttpRequest(requestData, handleEvent)
            setTimeout(() => {
              const result = handleEvent.lastCall.args[1]
              try {
                expect(result.events[0].type).toBe('loadstart')
                done()
              } catch (error) {
                done(error)
              }
            }, 25)
          })

          it('should return "loadend" event with an xhr instance without an error at the last call', (done) => {
            sendHttpRequest(requestData, handleEvent)
            setTimeout(() => {
              const [error, result] = handleEvent.lastCall.args
              try {
                expect(result.events[result.events.length - 1].type).toBe('loadend')
                expect(result.xhr).toBeInstanceOf(XMLHttpRequest)
                expect(error).toBe(null)
                done()
              } catch (error) {
                done(error)
              }
            }, 25)
          })
        })
      })
    })

    describe('event handling for each', () => {
      describe('when it received any "abort" event', () => {
        let sendHttpRequestForTest: any;

        beforeEach(() => {
          xhrMock.get('/foo', () => new Promise(() => {}))
          sendHttpRequestForTest = (): any => {
            const handleEvent: any = sinon.spy()
            const xhr = sendHttpRequest(
              {
                httpMethod: 'GET',
                url: '/foo',
              },
              handleEvent,
            )
            setTimeout(() => {
              xhr.abort()
            }, 1)
            return handleEvent;
          }
        })

        it('should return an error at the last call', (done) => {
          const handleEvent = sendHttpRequestForTest()
          setTimeout(() => {
            const [error, result] = handleEvent.lastCall.args
            try {
              expect(error).toBeInstanceOf(Error)
              expect(error.message).toContain(' XHR error ')
              done()
            } catch (exception) {
              done(exception)
            }
          }, 25)
        })

        it('should include an "abort" event before the "loadend" event at the last call', (done) => {
          const handleEvent = sendHttpRequestForTest()
          setTimeout(() => {
            const result = handleEvent.lastCall.args[1]
            try {
              expect(result.events[result.events.length - 2].type).toBe('abort')
              expect(result.events[result.events.length - 1].type).toBe('loadend')
              done()
            } catch (exception) {
              done(exception)
            }
          }, 25)
        })
      })

      describe('when it received any "timeout" event', () => {
        let sendHttpRequestForTest: any;

        beforeEach(() => {
          xhrMock.get('/foo', () => new Promise(() => {}))
          sendHttpRequestForTest = (): any => {
            const handleEvent: any = sinon.spy()
            sendHttpRequest(
              {
                httpMethod: 'GET',
                url: '/foo',
              },
              handleEvent,
              {timeout: 1},
            )
            return handleEvent;
          }
        })

        it('should return an error at the last call', (done) => {
          const handleEvent = sendHttpRequestForTest()
          setTimeout(() => {
            const [error, result] = handleEvent.lastCall.args
            try {
              expect(error).toBeInstanceOf(Error)
              expect(error.message).toContain(' XHR error ')
              done()
            } catch (exception) {
              done(exception)
            }
          }, 25)
        })

        it('should include a "timeout" event before the "loadend" event at the last call', (done) => {
          const handleEvent = sendHttpRequestForTest()
          setTimeout(() => {
            const result = handleEvent.lastCall.args[1]
            try {
              expect(result.events[result.events.length - 2].type).toBe('timeout')
              expect(result.events[result.events.length - 1].type).toBe('loadend')
              done()
            } catch (exception) {
              done(exception)
            }
          }, 25)
        })
      })
    })
  })
})
