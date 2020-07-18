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
    xhr?: SendHttpRequestResult['xhr'],
  },
}

function findResultCache(resultCaches: UseXhrResultCache[], queryId: QueryId): UseXhrResultCache | undefined {
  for (let i = 0; i < resultCaches.length; i++) {
    const resultCache = resultCaches[i]
    if (areEquivalentAAndB(resultCache.queryId, queryId)) {
      return resultCache
    }
  }
  return undefined
}

function replaceResultCache(
  resultCaches: UseXhrResultCache[], replacement: UseXhrResultCache,
): UseXhrResultCache[] {
  return resultCaches.map(function(resultCache) {
    return areEquivalentAAndB(resultCache.queryId, replacement.queryId)
      ? replacement
      : resultCache
  })
}

export type UseXhrOptionsValue = {
  maxResultCache?: number,
  timeout?: SendHttpRequestOptions['timeout'],
}

function deriveSendHttpRequestOptions(useXhrOptions: UseXhrOptionsValue): SendHttpRequestOptions {
  const result: SendHttpRequestOptions = {}
  if (useXhrOptions.timeout !== undefined) {
    result.timeout = useXhrOptions.timeout
  }
  return result
}

export type UseXhrResult = {
  error?: Error,
  events: SendHttpRequestResult['events'],
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

function receiveResponseIntoState(
  state: UseXhrState,
  maxResultCacheSetting: NonNullable<UseXhrOptionsValue['maxResultCache']>,
  error: Error | null,
  response: SendHttpRequestResult,
): UseXhrState {
  const unresolvedQueryId = state.unresolvedQueryId
  if (unresolvedQueryId === undefined) {
    throw new Error('unresolvedQueryId` should be present.')
  }
  const requestCompleted = response.xhr !== undefined
  const newResultCache: UseXhrResultCache = {
    queryId: unresolvedQueryId,
    result: {
      events: response.events,
      ...(error ? {error: error} : {}),
      ...(requestCompleted ? {xhr: response.xhr} : {}),
    },
  }
  const resultCaches: UseXhrResultCache[] = findResultCache(state.resultCaches, unresolvedQueryId)
    ? replaceResultCache(state.resultCaches, newResultCache)
    : appendItemAsLastInFirstOut<UseXhrResultCache>(state.resultCaches, newResultCache, maxResultCacheSetting)
  const newState: UseXhrState = {
    reservedNewRequest: false,
    resultCaches,
  }
  if (!requestCompleted) {
    newState.unresolvedQueryId = unresolvedQueryId
    newState.unresolvedQuery = state.unresolvedQuery
  }
  return newState
}

export function useXhr(
  query: Query | undefined,
  queryId: QueryId | undefined = undefined,
  options: UseXhrOptionsValue = {},
): UseXhrResult {
  const [state, setState] = React.useState<UseXhrState>({
    reservedNewRequest: false,
    resultCaches: [],
  })
  const unmountedRef = React.useRef(false)
  const maxResultCacheSetting = options.maxResultCache !== undefined
    ? options.maxResultCache : 1
  const sendHttpRequestOptions = deriveSendHttpRequestOptions(options)
  const fixedQueryId: QueryId | undefined = queryId !== undefined ? queryId : query
  const resultRequired = fixedQueryId !== undefined
  const invalidQuery = query === undefined && queryId !== undefined
  const queryChangedIllegally =
    resultRequired &&
    areEquivalentAAndB(fixedQueryId, state.unresolvedQueryId) &&
    !areEquivalentAAndB(query, state.unresolvedQuery)
  const foundResultCache = fixedQueryId !== undefined
    ? findResultCache(state.resultCaches, fixedQueryId)
    : undefined
  const startNewRequest =
    resultRequired &&
    !areEquivalentAAndB(fixedQueryId, state.unresolvedQueryId) &&
    foundResultCache === undefined

  if (maxResultCacheSetting < 1) {
    throw new Error('Can not specify less than 1 to `maxResultCache`.')
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
        function(error, response) {
          if (!unmountedRef.current) {
            // State Transition: 3
            setState(function(currentState) {
              if (
                currentState.unresolvedQueryId !== undefined &&
                areEquivalentAAndB(currentState.unresolvedQueryId, state.unresolvedQueryId)
              ) {
                return receiveResponseIntoState(currentState, maxResultCacheSetting, error, response)
              }
              return currentState
            })
          }
        },
        sendHttpRequestOptions,
      )
    }
  })

  const result: UseXhrResult = {
    isLoading: startNewRequest || state.unresolvedQueryId !== undefined,
    events: [],
  }
  if (resultRequired && foundResultCache) {
    result.events = foundResultCache.result.events
    if (foundResultCache.result.xhr) {
      result.xhr = foundResultCache.result.xhr
    }
    if (foundResultCache.result.error) {
      result.error = foundResultCache.result.error
    }
  }
  return result
}
