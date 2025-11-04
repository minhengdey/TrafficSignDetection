document.addEventListener("DOMContentLoaded", async () => {
  if (window.auth && typeof window.auth.init === 'function') await window.auth.init()
  // Check authentication and role
  // In MOCK mode we skip auth redirects so the page can be used for local development
  if (!(window.CONFIG && window.CONFIG.MODE === 'MOCK')) {
    // If not authenticated, send to login
    if (!window.auth.isAuthenticated()) {
      window.location.href = "login.html"
      return
    }

    // If admin, redirect to admin dashboard (admins have separate UI)
    if (typeof window.auth.isAdmin === 'function' && window.auth.isAdmin()) {
      window.location.href = "admin-dashboard.html"
      return
    }
  }

  // Setup logout (guard in case element is missing)
  const logoutLink = document.getElementById("logoutLink")
  if (logoutLink) {
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault()
      window.auth.logout()
    })
  }

  // Pagination state for history - set BEFORE loading to avoid size=undefined
  window.historyPage = 0
  window.historyPageSize = 6
  await loadHistory(window.historyPage)

  // Wire pagination buttons
  try {
    const prevBtn = document.getElementById('videosPrev')
    const nextBtn = document.getElementById('videosNext')
    const pageInfo = document.getElementById('videosPageInfo')
    if (prevBtn) prevBtn.addEventListener('click', async () => { await loadHistory(Math.max(0, window.historyPage - 1)); if (pageInfo) pageInfo.textContent = `Page ${window.historyPage + 1}` })
    if (nextBtn) nextBtn.addEventListener('click', async () => { await loadHistory(window.historyPage + 1); if (pageInfo) pageInfo.textContent = `Page ${window.historyPage + 1}` })
  } catch (e) {
    // ignore
  }
})

async function loadHistory(page = 0) {
  const container = document.getElementById("videosList")
  container.innerHTML = '<div style="text-align: center; padding: 2rem;"><div class="spinner"></div></div>'

  // If running in mock mode, render local mock data and skip network calls
  try {
    if (window.CONFIG && window.CONFIG.MODE === 'MOCK') {
      const videos = (typeof MOCK_DATA !== 'undefined' && Array.isArray(MOCK_DATA.videos)) ? MOCK_DATA.videos : []
      // update pagination UI
      window.historyPage = 0
      const pageInfo = document.getElementById('videosPageInfo')
      const prevBtn = document.getElementById('videosPrev')
      const nextBtn = document.getElementById('videosNext')
      if (pageInfo) pageInfo.textContent = `Page ${window.historyPage + 1}`
      if (prevBtn) prevBtn.disabled = true
      if (nextBtn) nextBtn.disabled = (videos.length < window.historyPageSize)
      renderVideos(videos)
      return
    }
  } catch (err) {
    console.warn('Failed to render mock history', err)
    // fall through to regular fetch
  }

  try {
    // Try to fetch paged list using apiFetchList when available, otherwise fall back to apiFetch or raw fetch
    let listResult = null
    let payload = null
    if (window.apiFetchList) {
      try {
        listResult = await window.apiFetchList(window.CONFIG.ENDPOINTS.USER_VIDEOS + `?page=${page}&size=${window.historyPageSize}`)
      } catch (err) {
        console.warn('apiFetchList failed, will try apiFetch/fallback', err)
        listResult = null
      }
    }

    if (!listResult) {
      if (window.apiFetch) {
        payload = await window.apiFetch(window.CONFIG.ENDPOINTS.USER_VIDEOS + `?page=${page}&size=${window.historyPageSize}`)
      } else {
        const response = await fetch(`${window.CONFIG.API_BASE_URL}${window.CONFIG.ENDPOINTS.USER_VIDEOS}?page=${page}&size=${window.historyPageSize}`, {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        })
        if (!response.ok) throw new Error("Failed to load videos")
        const data = await response.json().catch(() => ({}))
        payload = data && data.result ? data.result : data
      }
    }

    let videos = []
    if (listResult) {
      videos = Array.isArray(listResult.items) ? listResult.items : []
    } else {
      // backward-compatible normalization
      let data = payload
      if (data && data.result !== undefined) data = data.result
      if (!data) videos = []
      else if (Array.isArray(data)) videos = data
      else if (Array.isArray(data.content)) videos = data.content
      else if (Array.isArray(data.videos)) videos = data.videos
      else if (Array.isArray(data.items)) videos = data.items
      else if (data.page && Array.isArray(data.page.content)) videos = data.page.content
      else {
        console.debug('Unexpected videos payload shape', data)
        videos = []
      }
    }

    // update pagination state/UI
    window.historyPage = page
    const pageInfo = document.getElementById('videosPageInfo')
    const prevBtn = document.getElementById('videosPrev')
    const nextBtn = document.getElementById('videosNext')
    if (pageInfo) pageInfo.textContent = `Page ${window.historyPage + 1}`
    if (prevBtn) prevBtn.disabled = window.historyPage <= 0
    // Determine next-button enabled state from page metadata when available
    if (listResult && listResult.page && typeof listResult.page.totalPages === 'number') {
      if (nextBtn) nextBtn.disabled = window.historyPage >= (listResult.page.totalPages - 1)
    } else if (nextBtn) {
      // heuristic: if fewer items than page size, assume last page
      if (Array.isArray(videos) && videos.length < window.historyPageSize) nextBtn.disabled = true
      else nextBtn.disabled = false
    }

    renderVideos(videos)
  } catch (error) {
    console.error("Error loading history:", error)
    container.innerHTML = '<p style="text-align: center; color: #DC2626;">Failed to load upload history</p>'
  }
}

function renderVideos(videos) {
  const container = document.getElementById("videosList")

  if (!videos || videos.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 1rem; color: #9ca3af;">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        <h3 style="color: #6b7280; margin-bottom: 0.5rem;">No videos uploaded yet</h3>
        <p style="color: #9ca3af; margin-bottom: 1.5rem;">Upload your first video to get started</p>
        <a href="upload.html" class="btn btn-primary">Upload Video</a>
      </div>
    `
    return
  }

  container.innerHTML = videos
    .map((video) => {
      const statusColor = getStatusColor(video.status)
      const statusText = getStatusText(video.status)
      // choose a thumbnail if available (support multiple common keys)
      const thumbnail = video.thumbnail || video.thumbnailUrl || video.screenshot || video.previewUrl || ""

      return `
      <div class="video-card">
        <div class="video-thumb">
          ${thumbnail ? `<img src="${thumbnail}" alt="${video.filename || ''} preview" />` : `
            <div class="thumb-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted)">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          `}
        </div>
        <div class="video-card-header">
          <div class="video-info">
            <div style="display:flex;align-items:center;gap:8px">
              <h3 class="video-title">${video.filename || video.originalFilename}</h3>
              <span class="video-status" style="display:inline-flex;align-items:center;color:${statusColor};font-weight:600">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};margin-right:6px"></span>${statusText}
              </span>
            </div>
            <div class="video-meta">
              <span>Uploaded: ${formatDate(video.uploadedAt)}</span>
              ${video.duration ? `<span>Duration: ${formatDuration(video.duration)}</span>` : ""}
            </div>
          </div>
        </div>
        <div class="video-card-body">
          <div class="video-stats">
            <div class="stat-item">
              <div class="stat-label">Detections</div>
              <div class="stat-value detections-count" data-video-id="${video.id}">${typeof video.detectionCount === 'number' ? video.detectionCount : 'Loading...'}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Avg Confidence</div>
              <div class="stat-value avg-confidence" data-video-id="${video.id}">${video.avgConfidence ? Math.round(video.avgConfidence) + "%" : "Loading..."}</div>
            </div>
          </div>
        </div>
        <div class="video-card-actions">
          <button class="btn btn-primary" onclick="window.location.href='results.html?id=${video.id}'">View Results</button>
          <button class="btn btn-secondary" data-video-url="${video.videoUrl || video.url || video.fileUrl || video.previewUrl || ''}" onclick="window.onReprocessClick('${video.id}', this)">Reprocess</button>
        </div>
      </div>
    `
    })
    .join("")

  // After rendering, fetch avg confidence for videos that don't already have it (skip in MOCK mode)
  fetchAvgConfForVideos()
  // Also fetch detection counts from backend when not present in payload
  fetchDetectionsCountForVideos()
}

async function fetchDetectionsCountForVideos() {
  try {
    if (window.CONFIG && window.CONFIG.MODE === 'MOCK') return

    const els = Array.from(document.querySelectorAll('.detections-count[data-video-id]'))
    if (!els.length) return

    const base = (window.CONFIG && window.CONFIG.API_BASE_URL) ? window.CONFIG.API_BASE_URL.replace(/\/$/, '') : ''
    const detectionPath = (window.CONFIG && window.CONFIG.ENDPOINTS && window.CONFIG.ENDPOINTS.DETECTION) ? window.CONFIG.ENDPOINTS.DETECTION.replace(/\/$/, '') : '/api/detection'

    // try to read jwt cookie similar to avg conf fetch
    let authHeader = null
    try {
      const cookieMatch = document.cookie.match(/(?:^|; )jwt=([^;]+)/)
      if (cookieMatch && cookieMatch[1]) authHeader = 'Bearer ' + decodeURIComponent(cookieMatch[1])
    } catch (e) {
      // ignore
    }

    for (const el of els) {
      const vid = el.getAttribute('data-video-id')
      if (!vid) continue

      const text = el.textContent && el.textContent.trim()
      if (text && text !== 'Loading...' && text !== 'N/A') continue

      const url = `${base}${detectionPath}/${encodeURIComponent(vid)}/detections`

      try {
        let respJson = null
        if (window.apiFetch) {
          try {
            const rel = `${detectionPath}/${encodeURIComponent(vid)}/detections`
            respJson = await window.apiFetch(rel)
          } catch (e) {
            respJson = await window.apiFetch(url)
          }
        } else {
          const headers = { 'Content-Type': 'application/json' }
          if (authHeader) headers['Authorization'] = authHeader
          const resp = await fetch(url, { method: 'GET', credentials: 'include', headers })
          if (!resp.ok) {
            el.textContent = 'N/A'
            continue
          }
          respJson = await resp.json().catch(() => ({}))
        }

        const value = respJson && (respJson.result !== undefined ? respJson.result : (respJson.data !== undefined ? respJson.data : respJson))
        if (typeof value === 'number') el.textContent = String(value)
        else el.textContent = 'N/A'
      } catch (err) {
        el.textContent = 'N/A'
      }
    }
  } catch (e) {
    // ignore overall errors
  }
}

async function fetchAvgConfForVideos() {
  try {
    if (window.CONFIG && window.CONFIG.MODE === 'MOCK') return

    const els = Array.from(document.querySelectorAll('.avg-confidence[data-video-id]'))
    if (!els.length) return

    // Determine base URL and detection path
    const base = (window.CONFIG && window.CONFIG.API_BASE_URL) ? window.CONFIG.API_BASE_URL.replace(/\/$/, '') : ''
    const detectionPath = (window.CONFIG && window.CONFIG.ENDPOINTS && window.CONFIG.ENDPOINTS.DETECTION) ? window.CONFIG.ENDPOINTS.DETECTION.replace(/\/$/, '') : '/api/detection'

    // Attempt to read jwt cookie and set Authorization header if available
    let authHeader = null
    try {
      const cookieMatch = document.cookie.match(/(?:^|; )jwt=([^;]+)/)
      if (cookieMatch && cookieMatch[1]) authHeader = 'Bearer ' + decodeURIComponent(cookieMatch[1])
    } catch (e) {
      // ignore cookie read errors
    }

    for (const el of els) {
      const vid = el.getAttribute('data-video-id')
      if (!vid) continue

      const text = el.textContent && el.textContent.trim()
      if (text && text !== 'Loading...' && text !== 'N/A') continue

      const url = `${base}${detectionPath}/${encodeURIComponent(vid)}/avg-confidence`

      try {
        let respJson = null
        if (window.apiFetch) {
          // prefer using apiFetch if available (pass relative path if possible)
          try {
            const rel = `${detectionPath}/${encodeURIComponent(vid)}/avg-confidence`
            respJson = await window.apiFetch(rel)
          } catch (e) {
            respJson = await window.apiFetch(url)
          }
        } else {
          const headers = { 'Content-Type': 'application/json' }
          if (authHeader) headers['Authorization'] = authHeader
          const resp = await fetch(url, { method: 'GET', credentials: 'include', headers })
          if (!resp.ok) {
            // show N/A for non-ok responses
            el.textContent = 'N/A'
            continue
          }
          respJson = await resp.json().catch(() => ({}))
        }

        const value = respJson && (respJson.result !== undefined ? respJson.result : (respJson.data !== undefined ? respJson.data : respJson))
        if (typeof value === 'number') el.textContent = Math.round(value) + '%'
        else el.textContent = 'N/A'
      } catch (err) {
        el.textContent = 'N/A'
      }
    }
  } catch (e) {
    // ignore overall errors
  }
}

function getStatusColor(status) {
  const colors = {
    completed: "#22c55e",
    processing: "#FACC15",
    pending: "#6b7280",
    failed: "#DC2626",
  }
  return colors[status] || "#6b7280"
}

function getStatusText(status) {
  const texts = {
    completed: "Completed",
    processing: "Processing",
    pending: "Pending",
    failed: "Failed",
  }
  return texts[status] || status
}

function formatDate(dateString) {
  if (!dateString) return "N/A"
  const date = new Date(dateString)
  return date.toLocaleString()
}

function formatDuration(seconds) {
  if (!seconds) return "N/A"
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

// Reprocess (re-run detection) for a video
window.onReprocessClick = async function (videoId, btn) {
  try {
    if (!confirm('Start re-detection for this video?')) return
    if (btn) {
      btn.disabled = true
      var originalText = btn.textContent
      btn.textContent = 'Reprocessing...'
    }
    // Read video URL from button attribute. If missing, try to fetch video metadata
    // from backend (/api/video/{id}) which includes a `filepath` we can use.
    let videoUrl = btn && btn.getAttribute ? btn.getAttribute('data-video-url') : null
    if (!videoUrl) {
      // Attempt to fetch video metadata from backend
      try {
        const vidNum = Number(videoId)
        if (Number.isNaN(vidNum)) {
          throw new Error('videoId is not numeric and no videoUrl provided')
        }

        const getEndpoint = (window.CONFIG && window.CONFIG.ENDPOINTS && window.CONFIG.ENDPOINTS.VIDEO_GET)
          ? window.CONFIG.ENDPOINTS.VIDEO_GET.replace(/\/$/, '') + `/${vidNum}`
          : `/api/video/${vidNum}`

        let metaResp = null
        if (window.apiFetch) {
          metaResp = await window.apiFetch(getEndpoint)
        } else {
          const base = (window.CONFIG && window.CONFIG.API_BASE_URL) ? window.CONFIG.API_BASE_URL.replace(/\/$/, '') : ''
          const resp = await fetch(base + getEndpoint, { method: 'GET', credentials: 'include', headers: { 'Content-Type': 'application/json' } })
          if (!resp.ok) throw new Error('Failed to fetch video metadata')
          metaResp = await resp.json().catch(() => ({}))
        }

        const meta = metaResp && (metaResp.result !== undefined ? metaResp.result : metaResp)
        if (meta && (meta.filepath || meta.videoUrl)) {
          // prefer filepath from VideoResponse; if it's a relative path, prefix API base
          videoUrl = meta.videoUrl || meta.filepath
          if (videoUrl && !/^https?:\/\//i.test(videoUrl)) {
            const base = (window.CONFIG && window.CONFIG.API_BASE_URL) ? window.CONFIG.API_BASE_URL.replace(/\/$/, '') : ''
            // ensure leading slash
            if (videoUrl.charAt(0) !== '/') videoUrl = '/' + videoUrl
            videoUrl = base + videoUrl
          }
        }
      } catch (e) {
        console.warn('Could not resolve videoUrl from backend', e)
      }
    }

    if (!videoUrl) {
      throw new Error('videoUrl is required for reprocessing')
    }

    let detResp = null
    // Prefer a configured endpoint if present, otherwise use the video-detection API path
    const endpoint = (window.CONFIG && window.CONFIG.ENDPOINTS && window.CONFIG.ENDPOINTS.VIDEO_DETECTION)
      ? window.CONFIG.ENDPOINTS.VIDEO_DETECTION
      : '/api/video/detection'

    if (window.apiFetch) {
      detResp = await window.apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ videoId, videoUrl }),
      })
    } else {
      const base = (window.CONFIG && window.CONFIG.API_BASE_URL) ? window.CONFIG.API_BASE_URL.replace(/\/$/, '') : ''
      const resp = await fetch(base + endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, videoUrl }),
      })
      if (!resp.ok) {
        const txt = await resp.text().catch(() => resp.statusText)
        throw new Error(txt || 'Reprocess request failed')
      }
      const data = await resp.json().catch(() => ({}))
      detResp = data && data.result ? data.result : data
    }

    // If backend returns a result indicating detection started/completed, navigate
    // to the results page (same behavior as live detection flow).
    let resolvedVideoId = videoId || null
    try {
      if (detResp && detResp.videoId) resolvedVideoId = detResp.videoId
    } catch (e) {
      console.warn('Failed to parse detection response', e)
    }

    if (!detResp || (detResp && detResp.status && detResp.status !== 'ok')) {
      // If server didn't accept the request as OK, throw so catch will alert user
      throw new Error('Re-detection request not accepted by server')
    }

    if (resolvedVideoId) {
      window.location.href = `results.html?id=${resolvedVideoId}`
    } else {
      window.location.href = `results.html`
    }
  } catch (err) {
    console.error('Reprocess failed', err)
    alert('Reprocess failed: ' + (err && err.message ? err.message : String(err)))
  } finally {
    if (btn) {
      btn.disabled = false
      try { btn.textContent = originalText } catch (e) { }
    }
  }
}
