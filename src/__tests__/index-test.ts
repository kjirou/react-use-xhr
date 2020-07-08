import * as jsdom from 'jsdom'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as ReactTestRenderer from 'react-test-renderer'
import * as sinon from 'sinon'
import xhrMock, {delay, sequence} from 'xhr-mock'

import {
  HttpMethod,
  UseXhrResult,
  SendHttpRequestData,
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
        describe(`${httpMethod}`, () => {
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
            sendHttpRequest(requestData, (error_, response) => {
              expect(response.xhr).toBeInstanceOf(XMLHttpRequest)
              expect(response.xhr.status).toBe(200)
              expect(response.xhr.responseText).toBe('BAR')
              done();
            })
          })
        })
      })
    })
  })

  describe('useXhr', () => {
    describe('should set both requirementId and requestData values at the same time', () => {
      let originalConsoleError: any;

      beforeEach(() => {
        originalConsoleError = console.error
        // Hide React's Error Boundary output.
        console.error = () => {}
      })
      afterEach(() => {
        console.error = originalConsoleError
      })

      it('should throw an error if only requirementId is undefined', async () => {
        const Tester = () => {
          useXhr(undefined, {httpMethod: 'GET', url: ''})
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
        expect(error.message).toContain(' are not set ')
      })

      it('should throw an error if only requestData is undefined', async () => {
        const Tester = () => {
          useXhr('a', undefined)
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
        expect(error.message).toContain(' are not set ')
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
          useXhr('a', {
            httpMethod: 'GET',
            url: '/foo',
            body: props.body,
          })
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
        const result = useXhr('a', {
          httpMethod: 'GET',
          url: '/foo',
        })
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
        const result = useXhr(props.requirementId, props.requestData)
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
        const result = useXhr(props.requirementId, props.requestData)
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

    describe('when sending requests in the order of "a" -> undefined -> "a"', () => {
      type TesterProps = {
        handleResult: any,
        requestData: SendHttpRequestData | undefined,
        requirementId: string | undefined,
      }
      const Tester: React.FC<TesterProps> = (props) => {
        const result = useXhr(props.requirementId, props.requestData)
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
              body: 'FOO',
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
        await ReactTestRenderer.act(async () => {
          testRenderer.update(
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
      })

      describe('when to enable the cache', () => {
        it('should return responseText="FOO" of the 1st at the last render', () => {
          expect(handleResult.lastCall.args[0].xhr.responseText).toBe('FOO')
        })
      })

      describe('when to disable the cache', () => {
      })
    })

    describe('when the hook is unmounted in request', () => {
      it.todo('should do nothing')
    })
  })
})
