import * as React from 'react'

import isEqual = require('lodash.isequal')

function areEqualAAndB(a: any, b: any): boolean {
  return isEqual(a, b)
}

export type HttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'

export type SendHttpRequestData = {
  body?: string,
  headers?: {[key in string]: string},
  httpMethod: HttpMethod,
  url: string,
}

export type SendHttpRequestResult = {
  xhr: XMLHttpRequest,
}

export function sendHttpRequest(
  data: SendHttpRequestData,
  callback: (error: Error | null, result: SendHttpRequestResult) => void,
): void {
  const xhr = new XMLHttpRequest()
  xhr.onload = function() {
    // TODO: Error handling.
    callback(null, {xhr})
  }
  xhr.open(data.httpMethod, data.url)
  const headers = data.headers || {}
  Object.keys(headers).sort().forEach(function(key) {
    xhr.setRequestHeader(key, headers[key])
  })
  xhr.send(data.body !== undefined ? data.body : null)
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
    if (areEqualAAndB(resultCache.requirementId, requirementId)) {
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

export type UseXhrResult = {
  isLoading: boolean,
  xhr?: XMLHttpRequest,
}

type UseXhrState = {
  reservedNewRequest: boolean,
  resolvedRequirementId?: UseXhrRequirementId | undefined,
  response?: SendHttpRequestResult,
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
  requirementId: UseXhrRequirementId | undefined,
): UseXhrResult {
  const [state, setState] = React.useState<UseXhrState>(defaultUseXhrState)
  const unmountedRef = React.useRef(false)
  const invalidRequestData =
    requirementId === undefined && requestData !== undefined ||
    requirementId !== undefined && requestData === undefined
  const requestDataChangedIllegally =
    requirementId !== undefined &&
    areEqualAAndB(requirementId, state.unresolvedRequirementId) &&
    !areEqualAAndB(requestData, state.unresolvedRequestData)
  const foundResultCache = requirementId !== undefined
    ? findResultCache(state.resultCaches, requirementId)
    : undefined
  const startNewRequest =
    requirementId !== undefined &&
    requestData !== undefined &&
    !areEqualAAndB(requirementId, state.unresolvedRequirementId) &&
    !areEqualAAndB(requirementId, state.resolvedRequirementId) &&
    foundResultCache === undefined

  if (invalidRequestData) {
    throw new Error('Both `requirementId` and `requestData` are not set at the same render.')
  } else if (requestDataChangedIllegally) {
    throw new Error('Can not change the `requestData` associated with the `requirementId`.')
  }

  if (startNewRequest) {
    // State Transition: 1
    setState({
      reservedNewRequest: true,
      unresolvedRequirementId: requirementId,
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

      sendHttpRequest(state.unresolvedRequestData as SendHttpRequestData, function(error_, response) {
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
                resolvedRequirementId: unresolvedRequirementId,
                response,
                resultCaches: recordResultCache(
                  state.resultCaches,
                  {
                    requirementId: unresolvedRequirementId,
                    result: {
                      xhr: response.xhr,
                    },
                  },
                  // TODO: Parameterize
                  100,
                )
              }
            }
            return current
          })
        }
      })
    }
  })

  const result: UseXhrResult = {
    isLoading: startNewRequest || state.unresolvedRequirementId !== undefined,
  }
  if (requirementId !== undefined) {
    if (state.resolvedRequirementId !== undefined && state.response) {
      result.xhr = state.response.xhr
    } else if (foundResultCache !== undefined) {
      result.xhr = foundResultCache.result.xhr
    }
  }
  return result
}
