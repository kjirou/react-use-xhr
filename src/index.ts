import * as React from 'react'

import isEqual = require('lodash.isequal')

// TODO: Does not directly depend on lodash.isequal.
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

export type UseXhrRequirementId = number | string

type UseXhrState = {
  reservedNewRequest: boolean,
  resolvedRequirementId?: UseXhrRequirementId | undefined,
  response?: SendHttpRequestResult,
  unresolvedRequestData?: SendHttpRequestData,
  unresolvedRequirementId?: UseXhrRequirementId | undefined,
}

const defaultUseXhrState: UseXhrState = {
  reservedNewRequest: false,
}

export type UseXhrResult = {
  isLoading: boolean,
  xhr?: XMLHttpRequest,
}

// TODO: Make to receive body/headers types for each HttpMethod.
export function useXhr(
  requirementId: UseXhrRequirementId | undefined,
  requestData: SendHttpRequestData | undefined,
): UseXhrResult {
  const [state, setState] = React.useState<UseXhrState>(defaultUseXhrState)
  const invalidRequestData =
    requirementId === undefined && requestData !== undefined ||
    requirementId !== undefined && requestData === undefined
  const requestDataChangedIllegally =
    requirementId !== undefined &&
    requirementId === state.unresolvedRequirementId &&
    !areEqualAAndB(requestData, state.unresolvedRequestData)
  const startNewRequest =
    requirementId !== undefined &&
    requestData !== undefined &&
    requirementId !== state.unresolvedRequirementId &&
    requirementId !== state.resolvedRequirementId

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
    })
  }

  React.useEffect(function() {
    if (state.reservedNewRequest) {
      // State Transition: 2
      setState({
        reservedNewRequest: false,
        unresolvedRequirementId: state.unresolvedRequirementId,
        unresolvedRequestData: state.unresolvedRequestData,
      })

      sendHttpRequest(state.unresolvedRequestData as SendHttpRequestData, function(error_, response) {
        // State Transition: 3
        setState(function(current) {
          if (state.unresolvedRequirementId === current.unresolvedRequirementId) {
            // TODO: Receive the error object too.
            return {
              reservedNewRequest: false,
              resolvedRequirementId: current.unresolvedRequirementId,
              response,
            }
          }
          return current
        })
      })
    }
  })

  const result: UseXhrResult = {
    isLoading: startNewRequest || state.unresolvedRequirementId !== undefined,
  }
  if (state.resolvedRequirementId !== undefined && state.response) {
    result.xhr = state.response.xhr
  }
  return result
}
