import isEqual = require('lodash.isequal')

export function areEquivalentAAndB(a: any, b: any): boolean {
  return isEqual(a, b)
}

export function appendItemAsLastInFirstOut<Item>(
  list: Item[], appended: Item, maxNumber: number
): Item[] {
  const newItems = list.concat([appended])
  const extraNumber = newItems.length > maxNumber
    ? newItems.length - maxNumber
    : 0
  return newItems.slice(extraNumber, extraNumber + maxNumber)
}

export type SendHttpRequestHttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'

export type SendHttpRequestData = {
  body?: string,
  headers?: {[key in string]: string},
  httpMethod: SendHttpRequestHttpMethod,
  url: string,
}

export type SendHttpRequestOptions = {
  timeout?: number,
}

export type SendHttpRequestResult = {
  events: ProgressEvent[],
  xhr?: XMLHttpRequest,
}

/**
 * The `handleEvent`'s error argument will be passed a runtime error in the event handler,
 *   but it's now always null.
 */
export function sendHttpRequest(
  data: SendHttpRequestData,
  handleEvent: (error: Error | null, result: SendHttpRequestResult) => void,
  options: SendHttpRequestOptions = {},
): XMLHttpRequest {
  const timeoutSetting: number | undefined = options.timeout !== undefined ? options.timeout : undefined
  const xhr = new XMLHttpRequest()
  const allEvents: SendHttpRequestResult['events'] = [];
  xhr.onloadend = function(event: ProgressEvent) {
    allEvents.push(event)
    const result: SendHttpRequestResult = {
      xhr,
      events: allEvents.slice(),
    };
    handleEvent(null, result)
  }
  xhr.onloadstart = function(event: ProgressEvent) {
    allEvents.push(event)
    handleEvent(null, {events: allEvents.slice()})
  }
  xhr.onabort = function(event: ProgressEvent) {
    allEvents.push(event)
    handleEvent(null, {events: allEvents.slice()})
  }
  xhr.onerror = function(event: ProgressEvent) {
    allEvents.push(event)
    handleEvent(null, {events: allEvents.slice()})
  }
  xhr.onprogress = function(event: ProgressEvent) {
    allEvents.push(event)
    handleEvent(null, {events: allEvents.slice()})
  }
  xhr.onload = function(event: ProgressEvent) {
    allEvents.push(event)
    handleEvent(null, {events: allEvents.slice()})
  }
  xhr.ontimeout = function(event: ProgressEvent) {
    allEvents.push(event)
    handleEvent(null, {events: allEvents.slice()})
  }
  xhr.open(data.httpMethod, data.url)
  const headers = data.headers || {}
  Object.keys(headers).sort().forEach(function(key) {
    xhr.setRequestHeader(key, headers[key])
  })
  if (timeoutSetting !== undefined) {
    xhr.timeout = timeoutSetting
  }
  xhr.send(data.body !== undefined ? data.body : null)
  return xhr
}
