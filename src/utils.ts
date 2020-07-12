import isEqual = require('lodash.isequal')

export function areEquivalentAAndB(a: any, b: any): boolean {
  return isEqual(a, b)
}

export type HttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'

export type SendHttpRequestData = {
  body?: string,
  headers?: {[key in string]: string},
  httpMethod: HttpMethod,
  url: string,
}

export type SendHttpRequestOptions = {
  timeout?: number,
}

export type SendHttpRequestResult = {
  events: ProgressEvent[],
  xhr: XMLHttpRequest,
}

export function sendHttpRequest(
  data: SendHttpRequestData,
  handleFinishLoadend: (error: Error | null, result: SendHttpRequestResult) => void,
  options: SendHttpRequestOptions = {},
): XMLHttpRequest {
  const timeout: number | undefined = options.timeout !== undefined ? options.timeout : undefined
  const xhr = new XMLHttpRequest()
  const result: SendHttpRequestResult = {
    xhr,
    events: [],
  }
  xhr.onloadend = function(event: ProgressEvent) {
    result.events.push(event)
    const error: Error | null =
      result.events.some(function(event) {
        return ['abort', 'error', 'timeout'].indexOf(event.type) !== -1
      })
      ? new Error('Some XHR error has occurred.')
      : null
    handleFinishLoadend(error, result)
  }
  xhr.onloadstart = function(event: ProgressEvent) {
    result.events.push(event)
  }
  xhr.onabort = function(event: ProgressEvent) {
    result.events.push(event)
  }
  xhr.onerror = function(event: ProgressEvent) {
    result.events.push(event)
  }
  xhr.onprogress = function(event: ProgressEvent) {
    result.events.push(event)
  }
  xhr.onload = function(event: ProgressEvent) {
    result.events.push(event)
  }
  xhr.ontimeout = function(event: ProgressEvent) {
    result.events.push(event)
  }
  xhr.open(data.httpMethod, data.url)
  const headers = data.headers || {}
  Object.keys(headers).sort().forEach(function(key) {
    xhr.setRequestHeader(key, headers[key])
  })
  if (timeout !== undefined) {
    xhr.timeout = timeout
  }
  xhr.send(data.body !== undefined ? data.body : null)
  return xhr
}
