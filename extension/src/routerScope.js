// Scope routing helpers for popup/new-window style navigations.
// Uses manifest/config scope automatically when possible, without extra per-site config.

const SPECIAL_SCHEME_ROUTE = {
  'mailto:': 'main',
  'tel:': 'main',
  'data:': 'main',
  'blob:': 'isolated',
  'about:': 'isolated'
}

export function normalizeHostname (value = '') {
  return value.toLowerCase().replace(/^www\./, '')
}

function escapeRegex (value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeScopePath (pathname = '/') {
  if (!pathname || pathname === '') return '/'
  return pathname.endsWith('/') ? pathname : `${pathname}/`
}

export function inferScopeUrl (site = {}) {
  const candidates = [
    site?.manifest?.scope,
    site?.config?.start_url,
    site?.manifest?.start_url,
    site?.config?.document_url,
    site?.config?.manifest_url
  ].filter(Boolean)

  for (const candidate of candidates) {
    try {
      return new URL(candidate)
    } catch {}
  }

  return null
}

export function isInScopeUrl (urlString, scopeCandidate) {
  try {
    const target = new URL(urlString)
    const scope = scopeCandidate instanceof URL ? scopeCandidate : new URL(scopeCandidate)

    if (target.protocol !== 'http:' && target.protocol !== 'https:') return false
    if (target.protocol !== scope.protocol) return false
    if (normalizeHostname(target.hostname) !== normalizeHostname(scope.hostname)) return false
    if (target.port !== scope.port) return false

    const scopePath = normalizeScopePath(scope.pathname)
    return target.pathname === scope.pathname || target.pathname.startsWith(scopePath)
  } catch {
    return false
  }
}

export function matchesUrlHandlerPattern (urlString, pattern) {
  try {
    const target = new URL(urlString)
    const value = pattern?.trim()
    if (!value) return false

    const protocolMatch = value.match(/^(https?:\/\/)/i)
    const targetProtocol = target.protocol === 'http:' || target.protocol === 'https:' ? `${target.protocol}//` : null
    if (protocolMatch && targetProtocol !== protocolMatch[1].toLowerCase()) return false

    const withoutProtocol = value.replace(/^(https?:\/\/)/i, '')
    const firstSlash = withoutProtocol.indexOf('/')
    const hostPattern = firstSlash === -1 ? withoutProtocol : withoutProtocol.slice(0, firstSlash)
    const pathPattern = firstSlash === -1 ? '/' : withoutProtocol.slice(firstSlash)

    const hostRegex = new RegExp(`^${escapeRegex(normalizeHostname(hostPattern)).replace(/\\\*/g, '.*')}$`)
    if (!hostRegex.test(normalizeHostname(target.hostname))) return false

    const normalizedPath = pathPattern.endsWith('*') ? pathPattern.slice(0, -1) : pathPattern
    if (pathPattern.includes('*')) {
      const pathRegex = new RegExp(`^${escapeRegex(normalizedPath).replace(/\\\*/g, '.*')}`)
      return pathRegex.test(target.pathname)
    }

    const normalizedPrefix = normalizeScopePath(normalizedPath)
    return target.pathname === normalizedPath || target.pathname.startsWith(normalizedPrefix)
  } catch {
    return false
  }
}

export function routePopupTarget ({ targetUrl, site }) {
  // Default-safe behavior: external links go to main Firefox profile.
  let parsed
  try {
    parsed = new URL(targetUrl)
  } catch {
    return 'main'
  }

  if (SPECIAL_SCHEME_ROUTE[parsed.protocol]) {
    return SPECIAL_SCHEME_ROUTE[parsed.protocol]
  }

  const enabledHandlers = site?.config?.enabled_url_handlers || []
  if (enabledHandlers.some(pattern => matchesUrlHandlerPattern(parsed.toString(), pattern))) {
    return 'isolated'
  }

  const inferredScope = inferScopeUrl(site)
  if (!inferredScope) return 'main'

  if (isInScopeUrl(parsed.toString(), inferredScope)) {
    return 'isolated'
  }

  return 'main'
}
