import * as React from 'react'

import {
  SendHttpRequestData,
  SendHttpRequestOptions,
  SendHttpRequestResult,
  appendItemAsLastInFirstOut,
  areEquivalentAAndB,
  sendHttpRequest,
} from './utils'

export type Query = SendHttpRequestData
export type QueryId = number | string | Query

type UseXhrResultCache = {
  queryId: QueryId,
  result: {
    error?: Error,
    events: SendHttpRequestResult['events'],
    xhr: SendHttpRequestResult['xhr'],
  },
}

function findResultCache(
  resultCaches: UseXhrResultCache[],
  queryId: QueryId,
): UseXhrResultCache | undefined {
  for (let i = 0; i < resultCaches.length; i++) {
    const resultCache = resultCaches[i]
    if (areEquivalentAAndB(resultCache.queryId, queryId)) {
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
  unresolvedQuery?: Query,
  unresolvedQueryId?: QueryId | undefined,
}

export function useXhr(
  query: Query | undefined,
  queryId: QueryId | undefined = undefined,
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
  const fixedQueryId: QueryId | undefined = queryId !== undefined ? queryId : query
  const invalidQuery = query === undefined && queryId !== undefined
  const queryChangedIllegally =
    fixedQueryId !== undefined &&
    areEquivalentAAndB(fixedQueryId, state.unresolvedQueryId) &&
    !areEquivalentAAndB(query, state.unresolvedQuery)
  const foundResultCache = fixedQueryId !== undefined
    ? findResultCache(state.resultCaches, fixedQueryId)
    : undefined
  const startNewRequest =
    query !== undefined &&
    fixedQueryId !== undefined &&
    !areEquivalentAAndB(fixedQueryId, state.unresolvedQueryId) &&
    foundResultCache === undefined

  if (maxResultCache < 1) {
    throw new Error('`maxResultCache` is less than 1.')
  } else if (invalidQuery) {
    throw new Error('Can not specify only `queryId`.')
  } else if (queryChangedIllegally) {
    throw new Error('Can not change the `query` associated with the `queryId`.')
  }

  if (startNewRequest) {
    // State Transition: 1
    setState({
      reservedNewRequest: true,
      unresolvedQueryId: fixedQueryId,
      unresolvedQuery: query,
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
        unresolvedQueryId: state.unresolvedQueryId,
        unresolvedQuery: state.unresolvedQuery,
        resultCaches: state.resultCaches,
      })

      sendHttpRequest(
        state.unresolvedQuery as Query,
        function(error, requestResult) {
          if (!unmountedRef.current) {
            // State Transition: 3
            setState(function(current) {
              const unresolvedQueryId = current.unresolvedQueryId;
              if (
                unresolvedQueryId !== undefined &&
                state.unresolvedQueryId === unresolvedQueryId
              ) {
                const resultCache: UseXhrResultCache = {
                  queryId: unresolvedQueryId,
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
    isLoading: startNewRequest || state.unresolvedQueryId !== undefined,
  }
  if (fixedQueryId !== undefined && foundResultCache !== undefined) {
    result.xhr = foundResultCache.result.xhr
    result.events = foundResultCache.result.events
    if (foundResultCache.result.error) {
      result.error = foundResultCache.result.error
    }
  }
  return result
}
