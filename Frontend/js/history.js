document.addEventListener("DOMContentLoaded", async () => {
  if (window.auth?.init) await window.auth.init()
    
  if (!window.auth.isAuthenticated()) {
    window.location.href = "login.html"
    return
  }

  if (window.auth.isAdmin?.()) {
    window.location.href = "admin-dashboard.html"
    return
  }

  const logoutLink = document.getElementById("logoutLink")
  if (logoutLink) {
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault()
      window.auth.logout()
    })
  }

  window.historyPage = 0
  window.historyPageSize = 6
  await loadHistory(0)

  const prevBtn = document.getElementById('videosPrev')
  const nextBtn = document.getElementById('videosNext')
  const pageInfo = document.getElementById('videosPageInfo')
  
  if (prevBtn) prevBtn.addEventListener('click', async () => {
    await loadHistory(Math.max(0, window.historyPage - 1))
    if (pageInfo) pageInfo.textContent = `Page ${window.historyPage + 1}`
  })
  
  if (nextBtn) nextBtn.addEventListener('click', async () => {
    await loadHistory(window.historyPage + 1)
    if (pageInfo) pageInfo.textContent = `Page ${window.historyPage + 1}`
  })
})

async function loadHistory(page = 0) {
  const container = document.getElementById("videosList")
  container.innerHTML = '<div style="text-align: center; padding: 2rem;"><div class="spinner"></div></div>'
  
  try {
    let listResult = null
    let payload = null

    if (window.apiFetchList) {
      listResult = await window.apiFetchList(window.CONFIG.ENDPOINTS.USER_VIDEOS + `?page=${page}&size=${window.historyPageSize}`).catch(() => null)
    }

    if (!listResult) {
      payload = window.apiFetch
        ? await window.apiFetch(window.CONFIG.ENDPOINTS.USER_VIDEOS + `?page=${page}&size=${window.historyPageSize}`)
        : await fetch(`${window.CONFIG.API_BASE_URL}${window.CONFIG.ENDPOINTS.USER_VIDEOS}?page=${page}&size=${window.historyPageSize}`, {
            method: "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json" }
          }).then(r => r.json().then(d => d.result || d))
    }

    let videos = []
    if (listResult) {
      videos = Array.isArray(listResult.items) ? listResult.items : []
    } else {
      let data = payload?.result || payload
      videos = Array.isArray(data) ? data : 
               Array.isArray(data?.content) ? data.content :
               Array.isArray(data?.videos) ? data.videos :
               Array.isArray(data?.items) ? data.items :
               Array.isArray(data?.page?.content) ? data.page.content : []
    }

    window.historyPage = page
    const pageInfo = document.getElementById('videosPageInfo')
    const prevBtn = document.getElementById('videosPrev')
    const nextBtn = document.getElementById('videosNext')
    
    if (pageInfo) pageInfo.textContent = `Page ${window.historyPage + 1}`
    if (prevBtn) prevBtn.disabled = window.historyPage <= 0
    
    if (listResult?.page?.totalPages) {
      if (nextBtn) nextBtn.disabled = window.historyPage >= (listResult.page.totalPages - 1)
    } else if (nextBtn) {
      nextBtn.disabled = videos.length < window.historyPageSize
    }

    renderVideos(videos)
  } catch (error) {
    console.error("Error loading history:", error)
    container.innerHTML = '<p style="text-align: center; color: #DC2626;">Failed to load upload history</p>'
  }
}

function renderVideos(videos) {
  const container = document.getElementById("videosList")

  if (!videos?.length) {
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

  const statusColors = { completed: "#22c55e", processing: "#FACC15", pending: "#6b7280", failed: "#DC2626" }
  const statusTexts = { completed: "Completed", processing: "Processing", pending: "Pending", failed: "Failed" }

  container.innerHTML = videos.map(v => {
    const statusColor = statusColors[v.status] || "#6b7280"
    const statusText = statusTexts[v.status] || v.status
    const thumbnail = v.thumbnail || v.thumbnailUrl || v.screenshot || v.previewUrl || ""

    return `
      <div class="video-card">
        <div class="video-thumb">
          ${thumbnail ? `<img src="${thumbnail}" alt="${v.filename || ''} preview" />` : `
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
              <h3 class="video-title">${v.filename || v.originalFilename}</h3>
              <span class="video-status" style="display:inline-flex;align-items:center;color:${statusColor};font-weight:600">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};margin-right:6px"></span>${statusText}
              </span>
            </div>
            <div class="video-meta">
              <span>Uploaded: ${v.uploadedAt ? new Date(v.uploadedAt).toLocaleString() : 'N/A'}</span>
              ${v.duration ? `<span>Duration: ${Math.floor(v.duration / 60)}:${(v.duration % 60).toString().padStart(2, "0")}</span>` : ""}
            </div>
          </div>
        </div>
        <div class="video-card-body">
          <div class="video-stats">
            <div class="stat-item">
              <div class="stat-label">Detections</div>
              <div class="stat-value detections-count" data-video-id="${v.id}">${typeof v.detectionCount === 'number' ? v.detectionCount : 'Loading...'}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Avg Confidence</div>
              <div class="stat-value avg-confidence" data-video-id="${v.id}">${v.avgConfidence ? Math.round(v.avgConfidence) + "%" : "Loading..."}</div>
            </div>
          </div>
        </div>
        <div class="video-card-actions">
          <button class="btn btn-primary" onclick="window.location.href='results.html?id=${v.id}'">View Results</button>
          <button class="btn btn-secondary" data-video-url="${v.videoUrl || v.url || v.fileUrl || v.previewUrl || ''}" onclick="window.onReprocessClick('${v.id}', this)">Reprocess</button>
        </div>
      </div>
    `
  }).join("")

  fetchAvgConfForVideos()
  fetchDetectionsCountForVideos()
}

async function fetchDetectionsCountForVideos() {
  const els = Array.from(document.querySelectorAll('.detections-count[data-video-id]'))
  if (!els.length) return

  const base = window.CONFIG?.API_BASE_URL?.replace(/\/$/, '') || ''
  const detectionPath = window.CONFIG?.ENDPOINTS?.DETECTION?.replace(/\/$/, '') || '/api/detection'
  let authHeader = null
  
  try {
    const cookieMatch = document.cookie.match(/(?:^|; )jwt=([^;]+)/)
    if (cookieMatch?.[1]) authHeader = 'Bearer ' + decodeURIComponent(cookieMatch[1])
  } catch {}

  for (const el of els) {
    const vid = el.getAttribute('data-video-id')
    if (!vid || (el.textContent?.trim() && el.textContent.trim() !== 'Loading...')) continue

    const url = `${base}${detectionPath}/${encodeURIComponent(vid)}/detections`

    try {
      let respJson = window.apiFetch
        ? await window.apiFetch(`${detectionPath}/${encodeURIComponent(vid)}/detections`).catch(() => window.apiFetch(url))
        : await fetch(url, { 
            method: 'GET', 
            credentials: 'include', 
            headers: { 'Content-Type': 'application/json', ...(authHeader && { Authorization: authHeader }) }
          }).then(r => r.ok ? r.json() : Promise.reject())

      const value = respJson?.result ?? respJson?.data ?? respJson
      el.textContent = typeof value === 'number' ? String(value) : 'N/A'
    } catch {
      el.textContent = 'N/A'
    }
  }
}

async function fetchAvgConfForVideos() {
  const els = Array.from(document.querySelectorAll('.avg-confidence[data-video-id]'))
  if (!els.length) return

  const base = window.CONFIG?.API_BASE_URL?.replace(/\/$/, '') || ''
  const detectionPath = window.CONFIG?.ENDPOINTS?.DETECTION?.replace(/\/$/, '') || '/api/detection'
  let authHeader = null
  
  try {
    const cookieMatch = document.cookie.match(/(?:^|; )jwt=([^;]+)/)
    if (cookieMatch?.[1]) authHeader = 'Bearer ' + decodeURIComponent(cookieMatch[1])
  } catch {}

  for (const el of els) {
    const vid = el.getAttribute('data-video-id')
    if (!vid || (el.textContent?.trim() && el.textContent.trim() !== 'Loading...')) continue

    const url = `${base}${detectionPath}/${encodeURIComponent(vid)}/avg-confidence`

    try {
      let respJson = window.apiFetch
        ? await window.apiFetch(`${detectionPath}/${encodeURIComponent(vid)}/avg-confidence`).catch(() => window.apiFetch(url))
        : await fetch(url, { 
            method: 'GET', 
            credentials: 'include', 
            headers: { 'Content-Type': 'application/json', ...(authHeader && { Authorization: authHeader }) }
          }).then(r => r.ok ? r.json() : Promise.reject())

      const value = respJson?.result ?? respJson?.data ?? respJson
      el.textContent = typeof value === 'number' ? Math.round(value) + '%' : 'N/A'
    } catch {
      el.textContent = 'N/A'
    }
  }
}

window.onReprocessClick = async function (videoId, btn) {
  if (!confirm('Start re-detection for this video?')) return
  
  if (btn) {
    btn.disabled = true
    var originalText = btn.textContent
    btn.textContent = 'Reprocessing...'
  }

  try {
    let videoUrl = btn?.getAttribute?.('data-video-url')
    
    if (!videoUrl) {
      const vidNum = Number(videoId)
      if (Number.isNaN(vidNum)) throw new Error('videoId is not numeric and no videoUrl provided')

      const getEndpoint = window.CONFIG?.ENDPOINTS?.VIDEO_GET?.replace(/\/$/, '') + `/${vidNum}` || `/api/video/${vidNum}`
      
      const metaResp = window.apiFetch
        ? await window.apiFetch(getEndpoint)
        : await fetch((window.CONFIG?.API_BASE_URL?.replace(/\/$/, '') || '') + getEndpoint, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          }).then(r => r.json())

      const meta = metaResp?.result || metaResp
      videoUrl = meta?.videoUrl || meta?.filepath
      
      if (videoUrl && !/^https?:\/\//i.test(videoUrl)) {
        const base = window.CONFIG?.API_BASE_URL?.replace(/\/$/, '') || ''
        videoUrl = base + (videoUrl.charAt(0) === '/' ? videoUrl : '/' + videoUrl)
      }
    }

    if (!videoUrl) throw new Error('videoUrl is required for reprocessing')

    const endpoint = window.CONFIG?.ENDPOINTS?.VIDEO_DETECTION || '/api/video/detection'
    
    const detResp = window.apiFetch
      ? await window.apiFetch(endpoint, { method: 'POST', body: JSON.stringify({ videoId, videoUrl }) })
      : await fetch((window.CONFIG?.API_BASE_URL?.replace(/\/$/, '') || '') + endpoint, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId, videoUrl })
        }).then(r => r.ok ? r.json().then(d => d.result || d) : Promise.reject('Reprocess request failed'))

    if (!detResp || detResp.status !== 'ok') throw new Error('Re-detection request not accepted by server')

    const resolvedVideoId = detResp.videoId || videoId
    window.location.href = resolvedVideoId ? `results.html?id=${resolvedVideoId}` : 'results.html'
  } catch (err) {
    console.error('Reprocess failed', err)
    alert('Reprocess failed: ' + (err?.message || String(err)))
  } finally {
    if (btn) {
      btn.disabled = false
      btn.textContent = originalText
    }
  }
}