# react-use-xhr

[![CircleCI](https://circleci.com/gh/kjirou/react-use-xhr.svg?style=svg)](https://circleci.com/gh/kjirou/react-use-xhr)

A simple React hook that communicates via XHR


## :eyes: Overview

```js
import {useXhr} from 'react-use-xhr'

const YourComponent = () => {
  const result = useXhr({
    httpMethod: 'GET',
    url: 'https://your-awesome-api.com',
  })
  console.log(result)
  return <YourSubComponents />
}
```

:point_down: Example of console.log output.

```
Object {isLoading: true, events: Array[0]}
Object {isLoading: true, events: Array[1]}
Object {isLoading: true, events: Array[2]}
Object {isLoading: true, events: Array[3]}
Object {isLoading: false, events: Array[4], xhr: XMLHttpRequest}
Object {isLoading: false, events: Array[4], xhr: XMLHttpRequest}
```


## :cat: Features

- Communicates using `XMLHttpRequest` object.
  - It also returns raw `XMLHttpRequest` results.
- Works on IE11(Internet Explorer 11).
  - For example, it does not depend on the `Promise` object.

**NOTE: Why use `XMLHttpRequest`?**
- Because of my work, it's difficult to polyfill `fetch`.
- If you can use `fetch`, I think there are few reasons to use XHR.


## :rocket: Installation

```
npm install react-use-xhr
```


## :book: Usage
### `useXhr` API
#### Overview

```js
const result = useXhr(query, queryId, options)
```

#### Parameters

- `query`: An object for building HTTP request.
  - `httpMethod`: One of `"GET"`, `"POST"`, `"PUT"`, `"PATCH"` and `"DELETE"`.
  - `url`: An URL string such as `"https://example.com"` and `"/foo"`.
    It is passed as an argument of [open](https://developer.mozilla.org/ja/docs/Web/API/XMLHttpRequest/open).
  - `headers` (Optional): An object such as `{"Content-Type": "application/json"}`.
    Each key/value is passed as an argument of [setRequestHeader](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/setRequestHeader).
- `queryId` (Optional): It is used when you want to send a request multiple times with the same `query` value.
  It can receive a `string`, a `number` or an `undefined`. If `undefined`, then `query` is used for this value.
  - Default value is `undefined`.
- `options` (Optional): An object such as `{maxResultCache: 100, timeout: 5000}`.
  - Default value is `{}`.
  - `maxResultCache` (Optional): The number of responses to cache.
    - Default value is `1`.
  - `timeout` (Optional): Milliseconds until the communication is terminated.
    It is passed as an argument of [timeout](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/timeout).
    - Default value is `undefined`.

#### Return value

An object that contains the communication status and the response result.

- `isLoading`: A flag indicating whether communication is in progress.
- `events`: An array that stores the occured XHR events in order.
- `xhr` (May not exist): An instance of [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest).
  This will be passed when the communication is complete. It does not always exist when `isLoading` is `true`.


## :bust_in_silhouette: Examples
### Handle communication failures

XHR tells exceptional results to the outside on the event.  
There is a method of judging the result depending on the event that occurred.

```js
const isCommunicationFailed = (events) => {
  return events.some(event => ['abort', 'error', 'timeout'].indexOf(event.type) !== -1)
}
const result = useXhr(query)
if (isCommunicationFailed(result.events)) {
  // Do stuff.
}
```

### Send the same query multiple times

If you specify and change `queryId`, it will send the request again even if `query` is the same.

```js
// When discarding the request every 1 minute.
const everyOneMunite = Math.floor(new Date().getTime() / (1000 * 60))
const result = useXhr(query, everyOneMunite)
```

### Cache many request results

`useXhr` first searches the cache for a result with the same `queryId`.  
Since the initial value is `1`, only the most recent result is saved,
  but increasing this value will save many results.

```js
const result = useXhr(query, undefined, {maxResultCache: 9999})
```
