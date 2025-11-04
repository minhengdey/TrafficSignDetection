// Configuration for API mode
const CONFIG = {
  // Set to 'MOCK' for offline testing with fake data
  // Set to 'LIVE' to connect to real backend API
  MODE: "LIVE",

  // API endpoints (used in LIVE mode)
  API_BASE_URL: "http://localhost:8080",

  ENDPOINTS: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
    UPLOAD: "/api/upload",
    // Backend detection endpoints
    // Canonical: /api/detection/{videoId}/avg-confidence
    DETECTION: "/api/detection",
    VIDEO: "/api/video/:id",
    VIDEO_STATUS: "/api/video/:id",
    VIDEO_RESULTS: "/api/video/:id/results",
    VIDEOS_LIST: "/api/admin/videos",
    // STATS kept for backward compatibility; prefer using ADMIN_STATS_* endpoints for live data.
    STATS: "/api/admin/stats/overview",
    USER_PROFILE: "/api/auth/me",
    USER_UPDATE: "/api/auth/updateMyInfo",
    USER_VIDEOS: "/api/user/videos",
    TOTAL_UPLOADS: "/api/user/total-uploads",
    SIGNS_DETECTED: "/api/user/signs-detected",
    ADMIN_STATS_OVERVIEW: "/api/admin/stats/overview",
    ADMIN_STATS_DETECTIONS_OVER_TIME: "/api/admin/stats/detections-over-time",
    ADMIN_STATS_TOP_SIGNS: "/api/admin/stats/top-signs",
    ADMIN_STATS_VIDEOS_BY_STATUS: "/api/admin/stats/videos-by-status",
    ADMIN_USERS: "/api/admin/users",
    ADMIN_VIDEOS: "/api/admin/videos",
    ADMIN_DETECTIONS: "/api/admin/detections",
    ADMIN_SIGN_TYPES: "/api/admin/sign-types",
    LOGOUT: "/api/auth/logout",
  },
}

// Expose CONFIG on the global window object for legacy code that references window.CONFIG
try {
  if (typeof window !== 'undefined') window.CONFIG = CONFIG
} catch (e) {
  // ignore
}

// Lightweight API helper to call backend and unwrap ApiResponse { code, message, result }
try {
  if (typeof window !== 'undefined') {
    window.apiFetch = async function (endpointOrUrl, opts = {}) {
      // allow passing full URL or endpoint path
      const url = String(endpointOrUrl).startsWith('http') ? endpointOrUrl : (CONFIG.API_BASE_URL + endpointOrUrl)
      // Only set Content-Type for non-GET requests or when a body is present.
      const method = (opts && opts.method) ? String(opts.method).toUpperCase() : 'GET'
      const headers = Object.assign({}, opts && opts.headers ? opts.headers : {})
      if (method !== 'GET' && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
      const init = Object.assign({ credentials: 'include', headers }, opts)
      const resp = await fetch(url, init)
      // try to parse json; if not JSON, return raw response when ok
      let payload = null
      try {
        payload = await resp.json().catch(() => null)
      } catch (e) {
        payload = null
      }
      if (!resp.ok) {
        // prefer server message when available
        const msg = payload && (payload.message || (payload.result && payload.result.message)) || resp.statusText
        const err = new Error(String(msg || 'API request failed'))
        err.status = resp.status
        err.payload = payload
        throw err
      }
      // return unwrapped result when backend uses ApiResponse wrapper
      return (payload && (payload.result !== undefined)) ? payload.result : payload
    }
  }
} catch (e) {
  // ignore in non-browser environments
}

// Helper to consistently fetch paged lists. Returns { items: Array, page: Object|null, raw }
try {
  if (typeof window !== 'undefined') {
    window.apiFetchList = async function (endpointOrUrl, opts = {}) {
      // Reuse apiFetch when available to get unwrapped payload; fall back to fetch
      let result = null
      if (window.apiFetch) {
        result = await window.apiFetch(endpointOrUrl, opts)
      } else {
        const url = String(endpointOrUrl).startsWith('http') ? endpointOrUrl : (CONFIG.API_BASE_URL + endpointOrUrl)
        const method = (opts && opts.method) ? String(opts.method).toUpperCase() : 'GET'
        const headers = Object.assign({}, opts && opts.headers ? opts.headers : {})
        if (method !== 'GET' && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
        const init = Object.assign({ credentials: 'include', headers }, opts)
        const resp = await fetch(url, init)
        const payload = await resp.json().catch(() => null)
        if (!resp.ok) {
          const msg = payload && (payload.message || (payload.result && payload.result.message)) || resp.statusText
          const err = new Error(String(msg || 'API request failed'))
          err.status = resp.status
          err.payload = payload
          throw err
        }
        result = (payload && (payload.result !== undefined)) ? payload.result : payload
      }

      // Normalize page/list shapes
      const out = { items: [], page: null, raw: result }
      if (!result) return out
      if (Array.isArray(result)) {
        out.items = result
        return out
      }
      if (Array.isArray(result.content)) {
        out.items = result.content
        out.page = {
          totalElements: result.totalElements || result.total || null,
          totalPages: result.totalPages || null,
          number: result.number != null ? result.number : (result.pageable && result.pageable.pageNumber != null ? result.pageable.pageNumber : null),
          size: result.size != null ? result.size : (result.pageable && result.pageable.pageSize != null ? result.pageable.pageSize : null),
        }
        return out
      }
      // support alternative shapes
      if (Array.isArray(result.videos)) {
        out.items = result.videos
        return out
      }
      if (Array.isArray(result.items)) {
        out.items = result.items
        return out
      }
      // last attempt: if raw has a nested page
      if (result.page && Array.isArray(result.page.content)) {
        out.items = result.page.content
        out.page = result.page
        return out
      }

      // Try to extract page metadata even when content keyed differently (totalPages/totalElements/number/size)
      try {
        if (!out.page) {
          const maybeTotalPages = (result && (result.totalPages != null)) ? result.totalPages : (result && result.page && result.page.totalPages != null ? result.page.totalPages : null)
          const maybeTotalElements = (result && (result.totalElements != null)) ? result.totalElements : (result && (result.total != null) ? result.total : (result && result.page && result.page.totalElements != null ? result.page.totalElements : null))
          const maybeNumber = (result && (result.number != null)) ? result.number : (result && result.page && result.page.number != null ? result.page.number : null)
          const maybeSize = (result && (result.size != null)) ? result.size : (result && result.page && result.page.size != null ? result.page.size : null)

          if (maybeTotalPages != null || maybeTotalElements != null || maybeNumber != null || maybeSize != null) {
            out.page = {
              totalPages: maybeTotalPages != null ? maybeTotalPages : null,
              totalElements: maybeTotalElements != null ? maybeTotalElements : null,
              number: maybeNumber != null ? maybeNumber : null,
              size: maybeSize != null ? maybeSize : null,
            }
          }
        }
      } catch (e) {
        // ignore extraction errors
      }

      return out
    }
  }
} catch (e) {
  // ignore
}
