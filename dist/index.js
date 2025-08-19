    let anyChanged = false;
    let allChanged = true;
            anyChanged = true;
            allChanged = false;
        core.setOutput('all_changed', allChanged);
        core.setOutput('any_changed', anyChanged);
        Error Message: ${error.result.message}`);
var VERSION = "9.0.6";
var urlVariableRegex = /\{[^{}}]+\}/g;
  return variableName.replace(/(?:^\W+)|(?:(?<!\W)\W+$)/g, "").split(/,/);
        const previewsFromAcceptHeader = headers.accept.match(/(?<![\w-])[\w-]+(?=-preview)/g) || [];
var VERSION = "9.2.2";
            /<([^<>]+)>;\s*rel="next"/
  "GET /orgs/{org}/organization-roles/{role_id}/teams",
  "GET /orgs/{org}/organization-roles/{role_id}/users",
          /(?<! ) .*$/,
var VERSION = "8.4.1";
  var _a, _b, _c, _d;
    redirect: (_c = requestOptions.request) == null ? void 0 : _c.redirect,
    signal: (_d = requestOptions.request) == null ? void 0 : _d.signal,
      const matches = headers.link && headers.link.match(/<([^<>]+)>; rel="deprecation"/);
  let suffix;
  if ("documentation_url" in data) {
    suffix = ` - ${data.documentation_url}`;
  } else {
    suffix = "";
  }
      return `${data.message}: ${data.errors.map(JSON.stringify).join(", ")}${suffix}`;
    return `${data.message}${suffix}`;
const { stringify } = __nccwpck_require__(3121)
  const cookies = headers.getSetCookie()
  return cookies.map((pair) => parseSetCookie(pair))
/***/ ((module) => {
/**
 * @param {string} value
 * @returns {boolean}
 */
  validateCookieName,
  validateCookiePath,
  validateCookieValue,
  toIMFDate,
  stringify
/***/ }),

/***/ 4462:
/***/ ((module) => {

"use strict";


/** @type {Record<string, string | undefined>} */
const headerNameLowerCasedRecord = {}

// https://developer.mozilla.org/docs/Web/HTTP/Headers
const wellknownHeaderNames = [
  'Accept',
  'Accept-Encoding',
  'Accept-Language',
  'Accept-Ranges',
  'Access-Control-Allow-Credentials',
  'Access-Control-Allow-Headers',
  'Access-Control-Allow-Methods',
  'Access-Control-Allow-Origin',
  'Access-Control-Expose-Headers',
  'Access-Control-Max-Age',
  'Access-Control-Request-Headers',
  'Access-Control-Request-Method',
  'Age',
  'Allow',
  'Alt-Svc',
  'Alt-Used',
  'Authorization',
  'Cache-Control',
  'Clear-Site-Data',
  'Connection',
  'Content-Disposition',
  'Content-Encoding',
  'Content-Language',
  'Content-Length',
  'Content-Location',
  'Content-Range',
  'Content-Security-Policy',
  'Content-Security-Policy-Report-Only',
  'Content-Type',
  'Cookie',
  'Cross-Origin-Embedder-Policy',
  'Cross-Origin-Opener-Policy',
  'Cross-Origin-Resource-Policy',
  'Date',
  'Device-Memory',
  'Downlink',
  'ECT',
  'ETag',
  'Expect',
  'Expect-CT',
  'Expires',
  'Forwarded',
  'From',
  'Host',
  'If-Match',
  'If-Modified-Since',
  'If-None-Match',
  'If-Range',
  'If-Unmodified-Since',
  'Keep-Alive',
  'Last-Modified',
  'Link',
  'Location',
  'Max-Forwards',
  'Origin',
  'Permissions-Policy',
  'Pragma',
  'Proxy-Authenticate',
  'Proxy-Authorization',
  'RTT',
  'Range',
  'Referer',
  'Referrer-Policy',
  'Refresh',
  'Retry-After',
  'Sec-WebSocket-Accept',
  'Sec-WebSocket-Extensions',
  'Sec-WebSocket-Key',
  'Sec-WebSocket-Protocol',
  'Sec-WebSocket-Version',
  'Server',
  'Server-Timing',
  'Service-Worker-Allowed',
  'Service-Worker-Navigation-Preload',
  'Set-Cookie',
  'SourceMap',
  'Strict-Transport-Security',
  'Supports-Loading-Mode',
  'TE',
  'Timing-Allow-Origin',
  'Trailer',
  'Transfer-Encoding',
  'Upgrade',
  'Upgrade-Insecure-Requests',
  'User-Agent',
  'Vary',
  'Via',
  'WWW-Authenticate',
  'X-Content-Type-Options',
  'X-DNS-Prefetch-Control',
  'X-Frame-Options',
  'X-Permitted-Cross-Domain-Policies',
  'X-Powered-By',
  'X-Requested-With',
  'X-XSS-Protection'
]

for (let i = 0; i < wellknownHeaderNames.length; ++i) {
  const key = wellknownHeaderNames[i]
  const lowerCasedKey = key.toLowerCase()
  headerNameLowerCasedRecord[key] = headerNameLowerCasedRecord[lowerCasedKey] =
    lowerCasedKey
}

// Note: object prototypes should not be able to be referenced. e.g. `Object#hasOwnProperty`.
Object.setPrototypeOf(headerNameLowerCasedRecord, null)

module.exports = {
  wellknownHeaderNames,
  headerNameLowerCasedRecord
}


const { headerNameLowerCasedRecord } = __nccwpck_require__(4462)
/**
 * Retrieves a header name and returns its lowercase value.
 * @param {string | Buffer} value Header name
 * @returns {string}
 */
function headerNameToString (value) {
  return headerNameLowerCasedRecord[value] || value.toLowerCase()
}

  headerNameToString,
let random
try {
  const crypto = __nccwpck_require__(6005)
  random = (max) => crypto.randomInt(0, max)
} catch {
  random = (max) => Math.floor(Math.random(max))
}

    const boundary = `----formdata-undici-0${`${random(1e11)}`.padStart(11, '0')}`
const util = __nccwpck_require__(3837)
  },
  [util.inspect.custom]: {
    enumerable: false
    // https://fetch.spec.whatwg.org/#authentication-entries
    request.headersList.delete('proxy-authorization', true)

let supportedHashes = []

  const possibleRelevantHashes = ['sha256', 'sha384', 'sha512']
  supportedHashes = crypto.getHashes().filter((hash) => possibleRelevantHashes.includes(hash))
/* c8 ignore next 3 */
  // 3. If response is not eligible for integrity validation, return false.
  // TODO

  // 4. If parsedMetadata is the empty set, return true.
  // 5. Let metadata be the result of getting the strongest
  const strongest = getStrongestMetadata(parsedMetadata)
  const metadata = filterMetadataListByAlgorithm(parsedMetadata, strongest)
  // 6. For each item in metadata:
    const expectedValue = item.hash
    if (actualValue[actualValue.length - 1] === '=') {
      if (actualValue[actualValue.length - 2] === '=') {
        actualValue = actualValue.slice(0, -2)
      } else {
        actualValue = actualValue.slice(0, -1)
      }
    if (compareBase64Mixed(actualValue, expectedValue)) {
  // 7. Return false.
const parseHashWithOptions = /(?<algo>sha256|sha384|sha512)-((?<hash>[A-Za-z0-9+/]+|[A-Za-z0-9_-]+)={0,2}(?:\s|$)( +[!-~]*)?)?/i
    if (
      parsedToken === null ||
      parsedToken.groups === undefined ||
      parsedToken.groups.algo === undefined
    ) {
    const algorithm = parsedToken.groups.algo.toLowerCase()
    if (supportedHashes.includes(algorithm)) {
/**
 * @param {{ algo: 'sha256' | 'sha384' | 'sha512' }[]} metadataList
 */
function getStrongestMetadata (metadataList) {
  // Let algorithm be the algo component of the first item in metadataList.
  // Can be sha256
  let algorithm = metadataList[0].algo
  // If the algorithm is sha512, then it is the strongest
  // and we can return immediately
  if (algorithm[3] === '5') {
    return algorithm
  }

  for (let i = 1; i < metadataList.length; ++i) {
    const metadata = metadataList[i]
    // If the algorithm is sha512, then it is the strongest
    // and we can break the loop immediately
    if (metadata.algo[3] === '5') {
      algorithm = 'sha512'
      break
    // If the algorithm is sha384, then a potential sha256 or sha384 is ignored
    } else if (algorithm[3] === '3') {
      continue
    // algorithm is sha256, check if algorithm is sha384 and if so, set it as
    // the strongest
    } else if (metadata.algo[3] === '3') {
      algorithm = 'sha384'
    }
  }
  return algorithm
}

function filterMetadataListByAlgorithm (metadataList, algorithm) {
  if (metadataList.length === 1) {
    return metadataList
  }

  let pos = 0
  for (let i = 0; i < metadataList.length; ++i) {
    if (metadataList[i].algo === algorithm) {
      metadataList[pos++] = metadataList[i]
    }
  }

  metadataList.length = pos

  return metadataList
}

/**
 * Compares two base64 strings, allowing for base64url
 * in the second string.
 *
* @param {string} actualValue always base64
 * @param {string} expectedValue base64 or base64url
 * @returns {boolean}
 */
function compareBase64Mixed (actualValue, expectedValue) {
  if (actualValue.length !== expectedValue.length) {
    return false
  }
  for (let i = 0; i < actualValue.length; ++i) {
    if (actualValue[i] !== expectedValue[i]) {
      if (
        (actualValue[i] === '+' && expectedValue[i] === '-') ||
        (actualValue[i] === '/' && expectedValue[i] === '_')
      ) {
        continue
      }
      return false
    }
  }

  return true
}

  normalizeMethodRecord,
  parseMetadata
  if (header.length === 4) {
    return util.headerNameToString(header) === 'host'
  }
  if (removeContent && util.headerNameToString(header).startsWith('content-')) {
    return true
  }
  if (unknownOrigin && (header.length === 13 || header.length === 6 || header.length === 19)) {
    const name = util.headerNameToString(header)
    return name === 'authorization' || name === 'cookie' || name === 'proxy-authorization'
  }
  return false

    this.on('connectionError', (origin, targets, error) => {
      // If a connection error occurs, we remove the client from the pool,
      // and emit a connectionError event. They will not be re-used.
      // Fixes https://github.com/nodejs/undici/issues/3895
      for (const target of targets) {
        // Do not use kRemoveClient here, as it will close the client,
        // but the client cannot be closed in this state.
        const idx = this[kClients].indexOf(target)
        if (idx !== -1) {
          this[kClients].splice(idx, 1)
        }
      }
    })
/***/ 6005:
/***/ ((module) => {

"use strict";
module.exports = require("node:crypto");

/***/ }),

