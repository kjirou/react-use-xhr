export type HttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'

export function sendHttpRequestWithXhr(
  httpMethod: HttpMethod,
  url: string,
  options: {
    body?: string,
    headers?: {[key in string]: string},
  } = {},
): Promise<{
    xhr: XMLHttpRequest,
  }> {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest()
    xhr.onload = () => {
      resolve({xhr})
    }
    xhr.open(httpMethod, url)
    const headers = options.headers || {}
    Object.keys(headers).sort().forEach((key) => {
      xhr.setRequestHeader(key, headers[key])
    })
    xhr.send(options.body !== undefined ? options.body : null)
  })
}
