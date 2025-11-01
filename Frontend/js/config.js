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
    UPLOAD: "/api/video/upload",
    VIDEO_STATUS: "/videos/:id/status",
    VIDEO_RESULTS: "/videos/:id/results",
    VIDEOS_LIST: "/videos",
    STATS: "/stats",
    USER_PROFILE: "/api/auth/me",
    USER_UPDATE: "/api/auth/updateMyInfo",
    USER_VIDEOS: "/api/user/videos",
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
