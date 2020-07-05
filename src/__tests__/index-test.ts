import * as jsdom from 'jsdom'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as ReactTestRenderer from 'react-test-renderer'
import xhrMock from 'xhr-mock'

import {
  HttpMethod,
  sendHttpRequest,
  useXhr,
} from '../index'

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
          useXhr('', undefined)
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
          useXhr('', {
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
  })
})
