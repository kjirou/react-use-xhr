import xhrMock from 'xhr-mock'

import {
  HttpMethod,
  sendHttpRequest,
} from '../index'

describe('src/index', () => {
  beforeEach(() => {
    xhrMock.setup()
  })
  afterEach(() => {
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
})
