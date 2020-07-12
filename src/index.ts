import * as React from 'react'

import isEqual = require('lodash.isequal')

function areEquivalentAAndB(a: any, b: any): boolean {
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

export type UseXhrRequirementId = number | string | SendHttpRequestData

export type UseXhrResultCache = {
  requirementId: UseXhrRequirementId,
  result: {
    xhr: XMLHttpRequest,
  },
}

function findResultCache(
  resultCaches: UseXhrResultCache[],
  requirementId: UseXhrRequirementId,
): UseXhrResultCache | undefined {
  for (let i = 0; i < resultCaches.length; i++) {
    const resultCache = resultCaches[i]
    if (areEquivalentAAndB(resultCache.requirementId, requirementId)) {
      return resultCache
    }
  }
  return undefined
}

export function recordResultCache(
  resultCaches: UseXhrResultCache[],
  appended: UseXhrResultCache,
  maxNumber: number,
): UseXhrResultCache[] {
  let newResultCaches = resultCaches.concat([appended])
  const extraNumber = newResultCaches.length > maxNumber
    ? newResultCaches.length - maxNumber
    : 0
  return newResultCaches.slice(extraNumber, extraNumber + maxNumber)
}

type UseXhrOptions = {
  maxResultCache?: number,
  timeout?: SendHttpRequestOptions['timeout'],
}

function deriveSendHttpRequestOptions(useXhrOptions: UseXhrOptions): SendHttpRequestOptions {
  const result: SendHttpRequestOptions = {}
  if (useXhrOptions.timeout !== undefined) {
    result.timeout = useXhrOptions.timeout
  }
  return result
}

export type UseXhrResult = {
  isLoading: boolean,
  xhr?: XMLHttpRequest,
}

type UseXhrState = {
  reservedNewRequest: boolean,
  // The old element is saved at the top. So-called last-in first-out.
  resultCaches: UseXhrResultCache[],
  unresolvedRequestData?: SendHttpRequestData,
  unresolvedRequirementId?: UseXhrRequirementId | undefined,
}

const defaultUseXhrState: UseXhrState = {
  reservedNewRequest: false,
  resultCaches: [],
}

export function useXhr(
  requestData: SendHttpRequestData | undefined,
  requirementId: UseXhrRequirementId | undefined = undefined,
  options: UseXhrOptions = {},
): UseXhrResult {
  const [state, setState] = React.useState<UseXhrState>(defaultUseXhrState)
  const unmountedRef = React.useRef(false)
  const maxResultCache = options.maxResultCache !== undefined
    ? options.maxResultCache : 100
  const sendHttpRequestOptions = deriveSendHttpRequestOptions(options)
  const fixedRequirementId: UseXhrRequirementId | undefined =
    requirementId !== undefined ? requirementId : requestData
  const invalidRequestData =
    requestData === undefined && requirementId !== undefined
  const requestDataChangedIllegally =
    fixedRequirementId !== undefined &&
    areEquivalentAAndB(fixedRequirementId, state.unresolvedRequirementId) &&
    !areEquivalentAAndB(requestData, state.unresolvedRequestData)
  const foundResultCache = fixedRequirementId !== undefined
    ? findResultCache(state.resultCaches, fixedRequirementId)
    : undefined
  const startNewRequest =
    requestData !== undefined &&
    fixedRequirementId !== undefined &&
    !areEquivalentAAndB(fixedRequirementId, state.unresolvedRequirementId) &&
    foundResultCache === undefined

  if (maxResultCache < 1) {
    throw new Error('`maxResultCache` is less than 1.')
  } else if (invalidRequestData) {
    throw new Error('Can not specify only `requirementId`.')
  } else if (requestDataChangedIllegally) {
    throw new Error('Can not change the `requestData` associated with the `requirementId`.')
  }

  if (startNewRequest) {
    // State Transition: 1
    setState({
      reservedNewRequest: true,
      unresolvedRequirementId: fixedRequirementId,
      unresolvedRequestData: requestData,
      resultCaches: state.resultCaches,
    })
  }

  React.useEffect(function() {
    return function() {
      unmountedRef.current = true
    }
  }, [])

  React.useEffect(function() {
    if (!unmountedRef.current && state.reservedNewRequest) {
      // State Transition: 2
      setState({
        reservedNewRequest: false,
        unresolvedRequirementId: state.unresolvedRequirementId,
        unresolvedRequestData: state.unresolvedRequestData,
        resultCaches: state.resultCaches,
      })

      sendHttpRequest(
        state.unresolvedRequestData as SendHttpRequestData,
        function(error_, response) {
          if (!unmountedRef.current) {
            // State Transition: 3
            setState(function(current) {
              const unresolvedRequirementId = current.unresolvedRequirementId;
              if (
                unresolvedRequirementId !== undefined &&
                state.unresolvedRequirementId === unresolvedRequirementId
              ) {
                // TODO: Receive the error object too.
                return {
                  reservedNewRequest: false,
                  resultCaches: recordResultCache(
                    state.resultCaches,
                    {
                      requirementId: unresolvedRequirementId,
                      result: {
                        xhr: response.xhr,
                      },
                    },
                    maxResultCache,
                  )
                }
              }
              return current
            })
          }
        },
        sendHttpRequestOptions,
      )
    }
  })

  const result: UseXhrResult = {
    isLoading: startNewRequest || state.unresolvedRequirementId !== undefined,
  }
  if (fixedRequirementId !== undefined && foundResultCache !== undefined) {
    result.xhr = foundResultCache.result.xhr
  }
  return result
}
