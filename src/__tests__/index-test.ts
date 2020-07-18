import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as ReactTestRenderer from 'react-test-renderer'
import * as sinon from 'sinon'
import xhrMock, {delay, sequence} from 'xhr-mock'

import {
  UseXhrResult,
  useXhr,
} from '../index'
import {
  SendHttpRequestData,
} from '../utils'

const sleep = (time: number): Promise<void> => {
  return new Promise((resolve) => {setTimeout(resolve, time)})
}

describe('src/index', () => {
  beforeEach(() => {
    xhrMock.setup()
  })
  afterEach(() => {
    xhrMock.teardown()
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

    describe('options.timeout', () => {
      // Omit it, because it is not easy to write and probably can be verified by other tests.
      it.todo('should be passed to sendHttpRequest')
    })

    describe('when it passes equivalent values with different references to queryId', () => {
      const queryAndQueryId1: SendHttpRequestData = {
        httpMethod: 'GET',
        url: '/foo',
        body: 'a',
      }
      const queryAndQueryId2: SendHttpRequestData = {
        httpMethod: 'GET',
        url: '/foo',
        body: 'a',
      }
      type TesterProps = {
        handleResult: any,
        queryAndQueryId: SendHttpRequestData,
      }
      const Tester: React.FC<TesterProps> = (props) => {
        const result = useXhr(props.queryAndQueryId, props.queryAndQueryId)
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
              queryAndQueryId: queryAndQueryId1,
              handleResult,
            }),
          )
        })
        await ReactTestRenderer.act(async () => {
          testRenderer.update(
            React.createElement(Tester, {
              queryAndQueryId: queryAndQueryId2,
              handleResult,
            }),
          )
        })
      })

      it('should return the first response at the last render', async () => {
        expect(handleResult.lastCall.args[0].xhr).toBeInstanceOf(XMLHttpRequest)
        expect(handleResult.lastCall.args[0].xhr.responseText).toBe('FOO1')
      })
    })

    describe('when it receives only the argument of queryId', () => {
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

    describe('when it changes only query without changing queryId', () => {
      const originalConsoleError = console.error;

      beforeEach(() => {
        // Hide React's Error Boundary output.
        console.error = () => {}

        xhrMock.use('GET', '/foo', () => new Promise(() => {}))
      })
      afterEach(() => {
        console.error = originalConsoleError
      })

      it('should throw an error', async () => {
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

    describe('when query and queryId are always undefined', () => {
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
          body: 'FOO',
        })
        handleResult = sinon.spy()
        await ReactTestRenderer.act(async () => {
          ReactTestRenderer.create(
            React.createElement(Tester, {handleResult}),
          )
        })
      })

      describe('in the first render', () => {
        let result: UseXhrResult

        beforeEach(() => {
          result = handleResult.firstCall.args[0]
        });

        it('should return isLoading=false', () => {
          expect(result.isLoading).toBe(false)
        })

        it('should return an empty events', () => {
          expect(result.events).toEqual([])
        })

        it('should not return the "xhr" property', () => {
          expect(result).not.toHaveProperty('xhr')
        })
      })

      describe('in the last render', () => {
        let result: UseXhrResult

        beforeEach(() => {
          result = handleResult.lastCall.args[0]
        });

        it('should return isLoading=false', () => {
          expect(result.isLoading).toBe(false)
        })

        it('should return an empty events', () => {
          expect(result.events).toEqual([])
        })

        it('should not return the "xhr" property', () => {
          expect(result).not.toHaveProperty('xhr')
        })
      })
    })

    describe('when query and queryId are always the same', () => {
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
          body: 'FOO',
        })
        handleResult = sinon.spy()
        await ReactTestRenderer.act(async () => {
          ReactTestRenderer.create(
            React.createElement(Tester, {handleResult}),
          )
        })
      })

      describe('in the first render', () => {
        let result: UseXhrResult

        beforeEach(() => {
          result = handleResult.firstCall.args[0]
        });

        it('should return isLoading=true', () => {
          expect(result.isLoading).toBe(true)
        })

        it('should return an empty events', () => {
          expect(result.events).toEqual([])
        })

        it('should not return the "xhr" property', () => {
          expect(result).not.toHaveProperty('xhr')
        })
      })

      describe('in the last render', () => {
        let result: UseXhrResult

        beforeEach(() => {
          result = handleResult.lastCall.args[0]
        });

        it('should return isLoading=false', () => {
          expect(result.isLoading).toBe(false)
        })

        it('should include the "loadstart" in the events at the first', () => {
          expect(result.events[0].type).toBe('loadstart')
        })

        it('should include the "loadend" in the events at the last', () => {
          expect(result.events[result.events.length - 1].type).toBe('loadend')
        })

        it('should return an xhr instance', () => {
          expect(result.xhr).toBeInstanceOf(XMLHttpRequest)
          expect(result.xhr?.status).toBe(200)
          expect(result.xhr?.responseText).toBe('FOO')
        })
      })
    })

    describe('when it sets an undefined to query after setting a value', () => {
      type TesterProps = {
        handleResult: any,
        query: SendHttpRequestData | undefined,
      }
      const Tester: React.FC<TesterProps> = (props) => {
        const result = useXhr(props.query)
        props.handleResult(result)
        return React.createElement('div')
      }
      let handleResult: TesterProps['handleResult']
      let testRenderer: any = undefined

      beforeEach(async () => {
        xhrMock.use('GET', '/foo', {
          status: 200,
          body: 'FOO',
        })
        handleResult = sinon.spy()
        await ReactTestRenderer.act(async () => {
          testRenderer = ReactTestRenderer.create(
            React.createElement(Tester, {
              query: {
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
              query: undefined,
              handleResult,
            }),
          )
        })
      })

      it('should return isLoading=false without any xhr instance at the last render', () => {
        expect(handleResult.lastCall.args[0].isLoading).toBe(false)
        expect(handleResult.lastCall.args[0]).not.toHaveProperty('xhr')
      })
    })

    describe('when it sends and receives the second request before resolving the first request', () => {
      type TesterProps = {
        handleResult: any,
        query: SendHttpRequestData,
      }
      const Tester: React.FC<TesterProps> = (props) => {
        const result = useXhr(props.query)
        props.handleResult(result)
        return React.createElement('div')
      }
      let handleResult: TesterProps['handleResult']
      let testRenderer: any = undefined

      beforeEach(async () => {
        xhrMock.use('GET', '/first', delay({
          status: 200,
          body: 'FIRST',
        }, 100))
        xhrMock.use('GET', '/second', delay({
          status: 200,
          body: 'SECOND',
        }, 50))
        handleResult = sinon.spy()
        await ReactTestRenderer.act(async () => {
          testRenderer = ReactTestRenderer.create(
            React.createElement(Tester, {
              query: {
                httpMethod: 'GET',
                url: '/first',
              },
              handleResult,
            }),
          )
        })
        await ReactTestRenderer.act(async () => {
          testRenderer.update(
            React.createElement(Tester, {
              query: {
                httpMethod: 'GET',
                url: '/second',
              },
              handleResult,
            }),
          )
          await sleep(150)
        })
      })

      it('should return a result of the second request at the last render', () => {
        expect(handleResult.lastCall.args[0].xhr).toBeInstanceOf(XMLHttpRequest)
        expect(handleResult.lastCall.args[0].xhr.responseText).toBe('SECOND')
      })

      it('should never receives any result of the first request', () => {
        for (const call of handleResult.getCalls()) {
          expect(call.args[0].xhr?.responseText).not.toBe('FIRST')
        }
      })

      it('should switch "isLoading" value from true to false only once', () => {
        let nextExpectedValue = true
        for (const call of handleResult.getCalls()) {
          const isLoading = call.args[0].isLoading
          if (nextExpectedValue === true && isLoading === false) {
            nextExpectedValue = false
          }
          expect(call.args[0].isLoading).toBe(nextExpectedValue)
        }
      })
    })

    describe('when it sends requests in the order of "a" -> "b" -> "a"', () => {
      type TesterProps = {
        handleResult: any,
        maxResultCache: number,
        query: SendHttpRequestData | undefined,
        queryId: string | undefined,
      }
      const Tester: React.FC<TesterProps> = (props) => {
        const result = useXhr(props.query, props.queryId, {maxResultCache: props.maxResultCache})
        props.handleResult(result)
        return React.createElement('div')
      }
      const startRender = async (maxResultCache: number): Promise<{handleResult: any}> => {
        const handleResult: TesterProps['handleResult'] = sinon.spy();
        let testRenderer: any = undefined
        await ReactTestRenderer.act(async () => {
          testRenderer = ReactTestRenderer.create(
            React.createElement(Tester, {
              query: {
                httpMethod: 'GET',
                url: '/foo',
              },
              queryId: 'a',
              handleResult,
              maxResultCache,
            }),
          )
        })
        await ReactTestRenderer.act(async () => {
          testRenderer.update(
            React.createElement(Tester, {
              query: {
                httpMethod: 'GET',
                url: '/bar',
              },
              queryId: 'b',
              handleResult,
              maxResultCache,
            }),
          )
        })
        await ReactTestRenderer.act(async () => {
          testRenderer.update(
            React.createElement(Tester, {
              query: {
                httpMethod: 'GET',
                url: '/foo',
              },
              queryId: 'a',
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

    describe('when it omits queryId', () => {
      type TesterProps = {
        handleResult: any,
        query: SendHttpRequestData,
      }
      const Tester: React.FC<TesterProps> = (props) => {
        const result = useXhr(props.query)
        props.handleResult(result)
        return React.createElement('div')
      }

      describe('when the value of query does not change', () => {
        const query1: SendHttpRequestData = {
          httpMethod: 'GET',
          url: '/foo',
          body: 'a',
        }
        const query2: SendHttpRequestData = {
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
                query: query1,
                handleResult,
              }),
            )
          })
          await ReactTestRenderer.act(async () => {
            testRenderer.update(
              React.createElement(Tester, {
                query: query2,
                handleResult,
              }),
            )
          })
        })

        it('should return the first response at the last renderer', () => {
          expect(handleResult.lastCall.args[0].xhr.responseText).toBe('FOO1')
        })
      })

      describe('when the value of query changes', () => {
        const query1: SendHttpRequestData = {
          httpMethod: 'GET',
          url: '/foo',
          body: 'a',
        }
        const query2: SendHttpRequestData = {
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
                query: query1,
                handleResult,
              }),
            )
          })
          await ReactTestRenderer.act(async () => {
            testRenderer.update(
              React.createElement(Tester, {
                query: query2,
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

    describe('when the request it sent times out', () => {
      const Tester: React.FC<{handleResult: any}> = (props) => {
        const result = useXhr({httpMethod: 'GET', url: '/foo'}, undefined, {timeout: 1})
        props.handleResult(result)
        return React.createElement('div')
      }
      let handleResult: any

      beforeEach(async () => {
        xhrMock.get('/foo', () => new Promise(() => {}))

        handleResult = sinon.spy()
        await ReactTestRenderer.act(async () => {
          ReactTestRenderer.create(
            React.createElement(Tester, {handleResult}),
          )
          await sleep(50)
        })
      })

      it('should include "timeout" event in the result at the last render', () => {
        expect(handleResult.lastCall.args[0].events.some((e: any) => e.type === 'timeout')).toBe(true)
      })
    })

    describe('when it gets a heavy resource', () => {
      const Tester: React.FC<{handleResult: any}> = (props) => {
        const result = useXhr({httpMethod: 'GET', url: '/heavy'})
        props.handleResult(result)
        return React.createElement('div')
      }
      const body = '1234567890'.repeat(1000000)
      let handleResult: any

      beforeEach(async () => {
        xhrMock.get('/heavy', {
          status: 200,
          headers: {
            'Content-Length': body.length.toString(),
          },
          body,
        })
        handleResult = sinon.spy()
        await ReactTestRenderer.act(async () => {
          ReactTestRenderer.create(
            React.createElement(Tester, {handleResult}),
          )
          await sleep(100)
        })
      })

      it('should include a "progress" event at the last render', () => {
        expect(handleResult.lastCall.args[0].events.some((event: ProgressEvent) => event.type === 'progress'))
          .toBe(true)
      })

      it('should return a xhr instance at the last render', () => {
        expect(handleResult.lastCall.args[0].xhr).toBeInstanceOf(XMLHttpRequest)
      })

      it.todo('can handle the "progress" event in several times')
    })

    describe('when the hook is unmounted in request', () => {
      it.todo('should do nothing')
    })
  })
})
