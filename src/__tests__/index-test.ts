import * as jsdom from 'jsdom'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as ReactTestRenderer from 'react-test-renderer'
import * as sinon from 'sinon'
import xhrMock, {delay, sequence} from 'xhr-mock'

import {
  UseXhrRequirementId,
  UseXhrResult,
  UseXhrResultCache,
  recordResultCache,
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
    global.window = new jsdom.JSDOM('<html><body></body></html>').window as any
    global.document = global.window.document as any
  })
  afterEach(() => {
    delete global.window
    delete global.document
    xhrMock.teardown()
  })

  describe('recordResultCache', () => {
    it('should append a new item to the last', function() {
      const newCaches = recordResultCache(
        [
          {
            requirementId: 'a',
            result: {
              xhr: new XMLHttpRequest(),
              events: [],
            },
          },
        ],
        {
          requirementId: 'b',
          result: {
            xhr: new XMLHttpRequest(),
            events: [],
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
              events: [],
            },
          },
          {
            requirementId: 'b',
            result: {
              xhr: new XMLHttpRequest(),
              events: [],
            },
          },
        ],
        {
          requirementId: 'c',
          result: {
            xhr: new XMLHttpRequest(),
            events: [],
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
            events: [],
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

    describe('options.timeout', () => {
      // Omit it, because it is not easy to write and probably can be verified by other tests.
      it.todo('should be passed to sendHttpRequest')
    })

    describe('when it passes equivalent values with different references to requirementId', () => {
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

    describe('when requestData and requirementId are always undefined', () => {
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

    describe('when requestData and requirementId are always the same', () => {
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

      it('should return isLoading=true without any property at the first render', () => {
        expect(handleResult.firstCall.args[0].isLoading).toBe(true)
        expect(handleResult.firstCall.args[0]).not.toHaveProperty('xhr')
        expect(handleResult.firstCall.args[0]).not.toHaveProperty('events')
        expect(handleResult.firstCall.args[0]).not.toHaveProperty('error')
      })

      it('should return isLoading=false at the last render', () => {
        expect(handleResult.lastCall.args[0].isLoading).toBe(false)
      })

      it('should return a xhr instance at the last render', () => {
        expect(handleResult.lastCall.args[0].xhr).toBeInstanceOf(XMLHttpRequest)
        expect(handleResult.lastCall.args[0].xhr.status).toBe(200)
        expect(handleResult.lastCall.args[0].xhr.responseText).toBe('BAR')
      })

      it('should include "loadend" event to the end of the events at the last render', () => {
        const events = handleResult.lastCall.args[0].events
        const lastEvent = events[events.length - 1]
        expect(lastEvent.type).toBe('loadend')
      })

      it('should return without any error at the last render', () => {
        expect(handleResult.lastCall.args[0]).not.toHaveProperty('error')
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

      it('should have an error in the result at the last render', () => {
        expect(handleResult.lastCall.args[0].error).toBeInstanceOf(Error)
      })
    })

    describe('when the hook is unmounted in request', () => {
      it.todo('should do nothing')
    })
  })
})
