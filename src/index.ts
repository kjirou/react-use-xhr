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
    state.unresolvedRequirementId === undefined &&
    requirementId !== state.resolvedRequirementId

  if (invalidRequestData) {
    throw new Error('Both `requirementId` and `requestData` are not set at the same render.')
  } else if (requestDataChangedIllegally) {
    throw new Error('Can not change the `requestData` associated with the `requirementId`.')
  }

  if (startNewRequest) {
    // (State Transition: 1)
    setState({
      reservedNewRequest: true,
      unresolvedRequirementId: requirementId,
      unresolvedRequestData: requestData,
    })
  } else if (state.unresolvedRequirementId !== undefined && state.response) {
    // Matches `requirementId`s, then this hook returns `response` as a result.
    if (requirementId === state.unresolvedRequirementId) {
      // (State Transition: 4-A)
      setState({
        reservedNewRequest: false,
        resolvedRequirementId: requirementId,
        response: state.response,
      })
    // Received the response but the `requirementId`s do not match.
    // So this hook thinks the required data has changed during the last request.
    // Therefore, does not return the received response as a result.
    //
    // And probably will make the request again with the next render,
    //   if the `requirementId` is also set in the next render.
    } else {
      // (State Transition: 4-B)
      setState(defaultUseXhrState)
    }
  }

  React.useEffect(function() {
    if (state.reservedNewRequest) {
      // (State Transition: 2)
      setState({
        reservedNewRequest: false,
        unresolvedRequirementId: state.unresolvedRequirementId,
        unresolvedRequestData: state.unresolvedRequestData,
      })

      sendHttpRequest(requestData as SendHttpRequestData, function(error_, response) {
        // TODO: Receive the error object too.
        // (State Transition: 3)
        setState({
          reservedNewRequest: false,
          unresolvedRequirementId: state.unresolvedRequirementId,
          unresolvedRequestData: state.unresolvedRequestData,
          response,
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
