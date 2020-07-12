import * as jsdom from 'jsdom'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as ReactTestRenderer from 'react-test-renderer'
import * as sinon from 'sinon'
import xhrMock, {delay, sequence} from 'xhr-mock'

import {
  HttpMethod,
  UseXhrRequirementId,
  UseXhrResult,
  UseXhrResultCache,
  SendHttpRequestData,
  recordResultCache,
  sendHttpRequest,
  useXhr,
} from '../index'

const sleep = (time: number): Promise<void> => {
  return new Promise((resolve) => {setTimeout(resolve, time)})
}

describe('src/index', () => {
  beforeEach(() => {
    xhrMock.setup()
    global.window = new jsdom.JSDOM('<html><body></body></html>').window as any
    global.document = global.window.document as any
  })
  afterEach(() => {
    delete global.window
    delete global.document
    xhrMock.teardown()
  })

  describe('sendHttpRequest', () => {
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
        httpMethod: HttpMethod,
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

  describe('recordResultCache', () => {
    it('should append a new item to the last', function() {
      const newCaches = recordResultCache(
        [
          {
            requirementId: 'a',
            result: {
              xhr: new XMLHttpRequest(),
            },
          },
        ],
        {
          requirementId: 'b',
          result: {
            xhr: new XMLHttpRequest(),
          },
        },
        100
      )
      expect(newCaches[1].requirementId).toBe('b')
    })

    it('should remove an excess item from the first', function() {
      const newCaches = recordResultCache(
        [
          {
            requirementId: 'a',
            result: {
              xhr: new XMLHttpRequest(),
            },
          },
          {
            requirementId: 'b',
            result: {
              xhr: new XMLHttpRequest(),
            },
          },
        ],
        {
          requirementId: 'c',
          result: {
            xhr: new XMLHttpRequest(),
          },
        },
        2
      )
      expect(newCaches[0].requirementId).toBe('b')
      expect(newCaches[1].requirementId).toBe('c')
    })

    it('can not append any items if maxResultCache is 0', function() {
      const newCaches = recordResultCache(
        [],
        {
          requirementId: 'a',
          result: {
            xhr: new XMLHttpRequest(),
          },
        },
        0,
      )
      expect(newCaches.length).toBe(0)
    })
  })

  describe('useXhr', () => {
    describe('options.maxResultCache', () => {
      let originalConsoleError: any;

      beforeEach(() => {
        originalConsoleError = console.error
        // Hide React's Error Boundary output.
        console.error = () => {}
      })
      afterEach(() => {
        console.error = originalConsoleError
      })

      it('should throw an error if the value is less than 1', async () => {
        const Tester: React.FC = () => {
          useXhr(undefined, undefined, {maxResultCache: 0})
          return React.createElement('div')
        }
        let error: any = undefined
        try {
          await ReactTestRenderer.act(async () => {
            ReactTestRenderer.create(React.createElement(Tester))
          })
        } catch (err) {
          error = err
        }
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toContain('`maxResultCache`')
      })
    })

    describe('when it passes the same value with different references to requirementId', () => {
      const requestDataAndRequirementId1: SendHttpRequestData = {
        httpMethod: 'GET',
        url: '/foo',
        body: 'a',
      }
      const requestDataAndRequirementId2: SendHttpRequestData = {
        httpMethod: 'GET',
        url: '/foo',
        body: 'a',
      }
      type TesterProps = {
        handleResult: any,
        requestDataAndRequirementId: SendHttpRequestData,
      }
      const Tester: React.FC<TesterProps> = (props) => {
        const result = useXhr(props.requestDataAndRequirementId, props.requestDataAndRequirementId)
        props.handleResult(result)
        return React.createElement('div')
      }
      let handleResult: TesterProps['handleResult']
      let testRenderer: any = undefined

      beforeEach(async () => {
        xhrMock.get(
          '/foo',
          sequence([
            {
              status: 200,
              body: 'FOO1',
            },
            {
              status: 200,
              body: 'FOO2',
            },
          ])
        )
        handleResult = sinon.spy()
        await ReactTestRenderer.act(async () => {
          testRenderer = ReactTestRenderer.create(
            React.createElement(Tester, {
              requestDataAndRequirementId: requestDataAndRequirementId1,
              handleResult,
            }),
          )
        })
        await ReactTestRenderer.act(async () => {
          testRenderer.update(
            React.createElement(Tester, {
              requestDataAndRequirementId: requestDataAndRequirementId2,
              handleResult,
            }),
          )
          sleep(50)
        })
      })

      it('should return the first response at the last render', async () => {
        expect(handleResult.lastCall.args[0].xhr).toBeInstanceOf(XMLHttpRequest)
        expect(handleResult.lastCall.args[0].xhr.responseText).toBe('FOO1')
      })
    })

    describe('when it receives only the argument of requirementId', () => {
      const Tester = () => {
        useXhr(undefined, {httpMethod: 'GET', url: ''})
        return React.createElement('div')
      }
      let originalConsoleError: any;

      beforeEach(() => {
        originalConsoleError = console.error
        // Hide React's Error Boundary output.
        console.error = () => {}
      })
      afterEach(() => {
        console.error = originalConsoleError
      })

      it('should throw an error', async () => {
        let error: any = undefined
        try {
          await ReactTestRenderer.act(async () => {
            ReactTestRenderer.create(React.createElement(Tester))
          })
        } catch (err) {
          error = err
        }
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toContain(' specify only ')
      })
    })

    describe('can not change requestData if requirementId is not changed', () => {
      const originalConsoleError = console.error;

      beforeEach(() => {
        // Hide React's Error Boundary output.
        console.error = () => {}

        xhrMock.use('GET', '/foo', () => new Promise(() => {}))
      })
      afterEach(() => {
        console.error = originalConsoleError
      })

      it('should throw an error if requestData is changed in the same requirementId', async () => {
        const Tester: React.FC<{body: string}> = (props) => {
          useXhr({
            httpMethod: 'GET',
            url: '/foo',
            body: props.body,
          }, 'a')
          return React.createElement('div')
        }

        let testRenderer: any;
        await ReactTestRenderer.act(async () => {
          testRenderer = ReactTestRenderer.create(
            React.createElement(Tester, {body: 'a'}),
          )
        })

        let error: any = undefined
        try {
          await ReactTestRenderer.act(async () => {
            testRenderer.update(
              React.createElement(Tester, {body: 'b'}),
            )
          })
        } catch (err) {
          error = err
        }

        expect(error).toBeInstanceOf(Error)
        expect(error.message).toContain(' associated with ')
      })
    })

    describe('when requirementId and requestData are always undefined', () => {
      type TesterProps = {
        handleResult: (result: UseXhrResult) => void,
      }
      const Tester: React.FC<TesterProps> = (props) => {
        const result = useXhr(undefined, undefined)
        props.handleResult(result)
        return React.createElement('div')
      }
      let handleResult: any

      beforeEach(async () => {
        xhrMock.use('GET', '/foo', {
          status: 200,
          body: 'BAR',
        })
        handleResult = sinon.spy()
        await ReactTestRenderer.act(async () => {
          ReactTestRenderer.create(
            React.createElement(Tester, {handleResult}),
          )
        })
        await sleep(50)
      })

      it('should return isLoading=false without any xhr instance at the first render', () => {
        expect(handleResult.firstCall.args[0].isLoading).toBe(false)
        expect(handleResult.firstCall.args[0].xhr).toBe(undefined)
      })

      it('should return isLoading=false without any xhr instance at the last render', () => {
        expect(handleResult.lastCall.args[0].isLoading).toBe(false)
        expect(handleResult.lastCall.args[0].xhr).toBe(undefined)
      })
    })

    describe('when requirementId and requestData are always the same', () => {
      type TesterProps = {
        handleResult: (result: UseXhrResult) => void,
      }
      const Tester: React.FC<TesterProps> = (props) => {
        const result = useXhr({
          httpMethod: 'GET',
          url: '/foo',
        }, 'a')
        props.handleResult(result)
        return React.createElement('div')
      }
      let handleResult: any

      beforeEach(async () => {
        xhrMock.use('GET', '/foo', {
          status: 200,
          body: 'BAR',
        })
        handleResult = sinon.spy()
        await ReactTestRenderer.act(async () => {
          ReactTestRenderer.create(
            React.createElement(Tester, {handleResult}),
          )
        })
        await sleep(50)
      })

      it('should return isLoading=true without any xhr instance at the first render', () => {
        expect(handleResult.firstCall.args[0].isLoading).toBe(true)
        expect(handleResult.firstCall.args[0].xhr).toBe(undefined)
      })

      it('should return isLoading=false with a xhr instance at the last render', () => {
        expect(handleResult.lastCall.args[0].isLoading).toBe(false)
        expect(handleResult.lastCall.args[0].xhr).toBeInstanceOf(XMLHttpRequest)
        expect(handleResult.lastCall.args[0].xhr.status).toBe(200)
        expect(handleResult.lastCall.args[0].xhr.responseText).toBe('BAR')
      })
    })

    describe('when it sets an undefined after setting a value to requirementId', () => {
      type TesterProps = {
        handleResult: any,
        requestData: SendHttpRequestData | undefined,
        requirementId: string | undefined,
      }
      const Tester: React.FC<TesterProps> = (props) => {
        const result = useXhr(props.requestData, props.requirementId)
        props.handleResult(result)
        return React.createElement('div')
      }
      let handleResult: TesterProps['handleResult']
      let testRenderer: any = undefined

      beforeEach(async () => {
        xhrMock.use('GET', '/foo', {
          status: 200,
          body: 'BAR',
        })
        handleResult = sinon.spy()
        await ReactTestRenderer.act(async () => {
          testRenderer = ReactTestRenderer.create(
            React.createElement(Tester, {
              requirementId: 'a',
              requestData: {
                httpMethod: 'GET',
                url: '/foo',
              },
              handleResult,
            }),
          )
        })
        await ReactTestRenderer.act(async () => {
          testRenderer.update(
            React.createElement(Tester, {
              requirementId: undefined,
              requestData: undefined,
              handleResult,
            }),
          )
        })
        await sleep(50)
      })

      it('should return isLoading=false and xhr=undefined at the last render', () => {
        expect(handleResult.lastCall.args[0].isLoading).toBe(false)
        expect(handleResult.lastCall.args[0].xhr).toBe(undefined)
      })
    })

    describe('when it sends and receives the 2nd request(="b") before resolving the 1st request(="a")', () => {
      type TesterProps = {
        handleResult: any,
        requestData: SendHttpRequestData,
        requirementId: string,
      }
      const Tester: React.FC<TesterProps> = (props) => {
        const result = useXhr(props.requestData, props.requirementId)
        props.handleResult(props.requirementId, result)
        return React.createElement('div')
      }
      let handleResult: TesterProps['handleResult']
      let testRenderer: any = undefined

      beforeEach(async () => {
        xhrMock.use('GET', '/foo', delay({
          status: 200,
          body: 'FOO',
        }, 100))
        xhrMock.use('GET', '/bar', delay({
          status: 200,
          body: 'BAR',
        }, 50))
        handleResult = sinon.spy()
        await ReactTestRenderer.act(async () => {
          testRenderer = ReactTestRenderer.create(
            React.createElement(Tester, {
              requirementId: 'a',
              requestData: {
                httpMethod: 'GET',
                url: '/foo',
              },
              handleResult,
            }),
          )
        })
        await ReactTestRenderer.act(async () => {
          testRenderer.update(
            React.createElement(Tester, {
              requirementId: 'b',
              requestData: {
                httpMethod: 'GET',
                url: '/bar',
              },
              handleResult,
            }),
          )
          await sleep(150)
        })
      })

      it('should return the result of "b" at the last render', () => {
        expect(handleResult.lastCall.args[0]).toBe('b')
        expect(handleResult.lastCall.args[1].xhr).toBeInstanceOf(XMLHttpRequest)
        expect(handleResult.lastCall.args[1].xhr.responseText).toBe('BAR')
      })

      it('should never receives the result of "a"', () => {
        const aCalls = handleResult.getCalls()
          .filter((call: any) => call.args[0] === 'a')
        expect(aCalls.length).toBeGreaterThan(0)
        for (const call of aCalls) {
          expect(call.args[1].isLoading).toBe(true)
          expect(call.args[1].xhr).toBe(undefined)
        }
      })

      it('should switch isLoading value from true to false only once', () => {
        let nextExpectedValue = true
        for (const call of handleResult.getCalls()) {
          const isLoading = call.args[1].isLoading
          if (nextExpectedValue === true && isLoading === false) {
            nextExpectedValue = false
          }
          expect(call.args[1].isLoading).toBe(nextExpectedValue)
        }
      })
    })

    describe('when it sends requests in the order of "a" -> "b" -> "a"', () => {
      type TesterProps = {
        handleResult: any,
        maxResultCache: number,
        requestData: SendHttpRequestData | undefined,
        requirementId: string | undefined,
      }
      const Tester: React.FC<TesterProps> = (props) => {
        const result = useXhr(props.requestData, props.requirementId, {maxResultCache: props.maxResultCache})
        props.handleResult(result)
        return React.createElement('div')
      }
      const startRender = async (maxResultCache: number): Promise<{handleResult: any}> => {
        const handleResult: TesterProps['handleResult'] = sinon.spy();
        let testRenderer: any = undefined
        await ReactTestRenderer.act(async () => {
          testRenderer = ReactTestRenderer.create(
            React.createElement(Tester, {
              requestData: {
                httpMethod: 'GET',
                url: '/foo',
              },
              requirementId: 'a',
              handleResult,
              maxResultCache,
            }),
          )
        })
        await ReactTestRenderer.act(async () => {
          testRenderer.update(
            React.createElement(Tester, {
              requestData: {
                httpMethod: 'GET',
                url: '/bar',
              },
              requirementId: 'b',
              handleResult,
              maxResultCache,
            }),
          )
        })
        await ReactTestRenderer.act(async () => {
          testRenderer.update(
            React.createElement(Tester, {
              requestData: {
                httpMethod: 'GET',
                url: '/foo',
              },
              requirementId: 'a',
              handleResult,
              maxResultCache,
            }),
          )
        })
        return {handleResult}
      }

      beforeEach(async () => {
        xhrMock.get(
          '/foo',
          sequence([
            {
              status: 200,
              body: 'FOO1',
            },
            {
              status: 200,
              body: 'FOO2',
            },
          ])
        )
        xhrMock.get(
          '/bar',
          {
            status: 200,
            body: 'BAR',
          },
        )
      })

      describe('when it can save two responses', () => {
        let handleResult: any;

        beforeEach(async () => {
          const result = await startRender(2)
          handleResult = result.handleResult
        })

        it('should return responseText="FOO1" of the first response at the last render', () => {
          expect(handleResult.lastCall.args[0].xhr.responseText).toBe('FOO1')
        })
      })

      describe('when it can not save two responses', () => {
        let handleResult: any;

        beforeEach(async () => {
          const result = await startRender(1)
          handleResult = result.handleResult
        })

        it('should return responseText="FOO2" of the last response at the last render', () => {
          expect(handleResult.lastCall.args[0].xhr.responseText).toBe('FOO2')
        })
      })
    })

    describe('when it omits requirementId', () => {
      type TesterProps = {
        handleResult: any,
        requestData: SendHttpRequestData,
      }
      const Tester: React.FC<TesterProps> = (props) => {
        const result = useXhr(props.requestData)
        props.handleResult(result)
        return React.createElement('div')
      }

      describe('when the value of requestData does not change', () => {
        const requestData1: SendHttpRequestData = {
          httpMethod: 'GET',
          url: '/foo',
          body: 'a',
        }
        const requestData2: SendHttpRequestData = {
          httpMethod: 'GET',
          url: '/foo',
          body: 'a',
        }
        let handleResult: TesterProps['handleResult']
        let testRenderer: any = undefined

        beforeEach(async () => {
          xhrMock.get(
            '/foo',
            sequence([
              {
                status: 200,
                body: 'FOO1',
              },
              {
                status: 200,
                body: 'FOO2',
              },
            ])
          )
          handleResult = sinon.spy()
          await ReactTestRenderer.act(async () => {
            testRenderer = ReactTestRenderer.create(
              React.createElement(Tester, {
                requestData: requestData1,
                handleResult,
              }),
            )
          })
          await ReactTestRenderer.act(async () => {
            testRenderer.update(
              React.createElement(Tester, {
                requestData: requestData2,
                handleResult,
              }),
            )
          })
        })

        it('should return the first response at the last renderer', () => {
          expect(handleResult.lastCall.args[0].xhr.responseText).toBe('FOO1')
        })
      })

      describe('when the value of requestData changes', () => {
        const requestData1: SendHttpRequestData = {
          httpMethod: 'GET',
          url: '/foo',
          body: 'a',
        }
        const requestData2: SendHttpRequestData = {
          httpMethod: 'GET',
          url: '/foo',
          body: 'b',
        }
        let handleResult: TesterProps['handleResult']
        let testRenderer: any = undefined

        beforeEach(async () => {
          xhrMock.get(
            '/foo',
            sequence([
              {
                status: 200,
                body: 'FOO1',
              },
              {
                status: 200,
                body: 'FOO2',
              },
            ])
          )
          handleResult = sinon.spy()
          await ReactTestRenderer.act(async () => {
            testRenderer = ReactTestRenderer.create(
              React.createElement(Tester, {
                requestData: requestData1,
                handleResult,
              }),
            )
          })
          await ReactTestRenderer.act(async () => {
            testRenderer.update(
              React.createElement(Tester, {
                requestData: requestData2,
                handleResult,
              }),
            )
          })
        })

        it('should return the last response at the last renderer', () => {
          expect(handleResult.lastCall.args[0].xhr.responseText).toBe('FOO2')
        })
      })
    })

    describe('when the hook is unmounted in request', () => {
      it.todo('should do nothing')
    })
  })
})
