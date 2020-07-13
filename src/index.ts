import * as React from 'react'

import {
  SendHttpRequestData,
  SendHttpRequestOptions,
  SendHttpRequestResult,
  appendItemAsLastInFirstOut,
  areEquivalentAAndB,
  sendHttpRequest,
} from './utils'

export type UseXhrRequirementId = number | string | SendHttpRequestData

type UseXhrResultCache = {
  requirementId: UseXhrRequirementId,
  result: {
    error?: Error,
    events: SendHttpRequestResult['events'],
    xhr: SendHttpRequestResult['xhr'],
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
  error?: Error,
  events?: SendHttpRequestResult['events'],
  isLoading: boolean,
  xhr?: SendHttpRequestResult['xhr'],
}

type UseXhrState = {
  reservedNewRequest: boolean,
  // The old element is saved at the top. So-called last-in first-out.
  resultCaches: UseXhrResultCache[],
  unresolvedRequestData?: SendHttpRequestData,
  unresolvedRequirementId?: UseXhrRequirementId | undefined,
}

export function useXhr(
  requestData: SendHttpRequestData | undefined,
  requirementId: UseXhrRequirementId | undefined = undefined,
  options: UseXhrOptions = {},
): UseXhrResult {
  const [state, setState] = React.useState<UseXhrState>({
    reservedNewRequest: false,
    resultCaches: [],
  })
  const unmountedRef = React.useRef(false)
  const maxResultCache = options.maxResultCache !== undefined
    ? options.maxResultCache : 1
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
        function(error, requestResult) {
          if (!unmountedRef.current) {
            // State Transition: 3
            setState(function(current) {
              const unresolvedRequirementId = current.unresolvedRequirementId;
              if (
                unresolvedRequirementId !== undefined &&
                state.unresolvedRequirementId === unresolvedRequirementId
              ) {
                const resultCache: UseXhrResultCache = {
                  requirementId: unresolvedRequirementId,
                  result: {
                    xhr: requestResult.xhr,
                    events: requestResult.events,
                  },
                }
                if (error) {
                  resultCache.result.error = error
                }
                return {
                  reservedNewRequest: false,
                  resultCaches: appendItemAsLastInFirstOut<UseXhrResultCache>(
                    state.resultCaches, resultCache, maxResultCache)
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
    result.events = foundResultCache.result.events
    if (foundResultCache.result.error) {
      result.error = foundResultCache.result.error
    }
  }
  return result
}
