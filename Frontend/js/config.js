const CONFIG = {
  API_BASE_URL: "http://localhost:8080",
  ENDPOINTS: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
    UPLOAD: "/api/upload",
    DETECTION: "/api/detection",
    VIDEO: "/api/video/:id",
    VIDEO_STATUS: "/api/video/:id",
    VIDEO_RESULTS: "/api/video/:id/results",
    VIDEO_DETECTION: "/api/video/detection",
    VIDEO_GET: "/api/video",
    VIDEOS_LIST: "/api/admin/videos",
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
    LOGOUT: "/api/auth/logout"
  }
}

if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG

  window.apiFetch = async function (endpointOrUrl, opts = {}) {
    const url = endpointOrUrl.startsWith('http') ? endpointOrUrl : CONFIG.API_BASE_URL + endpointOrUrl
    const method = opts.method?.toUpperCase() || 'GET'
    const headers = { ...opts.headers }
    if (method !== 'GET' && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
    
    const resp = await fetch(url, { credentials: 'include', headers, ...opts })
    const payload = await resp.json().catch(() => null)
    
    if (!resp.ok) {
      const msg = payload?.message || payload?.result?.message || resp.statusText
      const err = new Error(msg || 'API request failed')
      err.status = resp.status
      err.payload = payload
      throw err
    }
    
    return payload?.result !== undefined ? payload.result : payload
  }

  window.apiFetchList = async function (endpointOrUrl, opts = {}) {
    const result = await window.apiFetch(endpointOrUrl, opts)
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
        number: result.number ?? result.pageable?.pageNumber ?? null,
        size: result.size ?? result.pageable?.pageSize ?? null
      }
      return out
    }
    if (Array.isArray(result.videos)) {
      out.items = result.videos
      return out
    }
    if (Array.isArray(result.items)) {
      out.items = result.items
      return out
    }
    if (result.page?.content) {
      out.items = result.page.content
      out.page = result.page
      return out
    }

    const maybeTotalPages = result?.totalPages ?? result?.page?.totalPages ?? null
    const maybeTotalElements = result?.totalElements ?? result?.total ?? result?.page?.totalElements ?? null
    const maybeNumber = result?.number ?? result?.page?.number ?? null
    const maybeSize = result?.size ?? result?.page?.size ?? null

    if (maybeTotalPages != null || maybeTotalElements != null || maybeNumber != null || maybeSize != null) {
      out.page = { totalPages: maybeTotalPages, totalElements: maybeTotalElements, number: maybeNumber, size: maybeSize }
    }

    return out
  }
}