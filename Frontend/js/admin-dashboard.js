// Admin Dashboard functionality
document.addEventListener("DOMContentLoaded", async () => {
  // Wait for auth init (populates role from cookie)
  if (window.auth && typeof window.auth.init === 'function') await window.auth.init()

  // Check authentication and role
  if (!window.auth.isAuthenticated() || !window.auth.isAdmin()) {
    window.location.href = "login.html"
    return
  }

  // Setup logout
  const logoutEl = document.getElementById("logoutLink")
  if (logoutEl) {
    logoutEl.addEventListener("click", (e) => {
      e.preventDefault()
      window.auth.logout()
    })
  }

  await loadAdminData()

  try {
    const usersPrev = document.getElementById('usersPrev')
    const usersNext = document.getElementById('usersNext')
    const videosPrev = document.getElementById('videosPrev')
    const videosNext = document.getElementById('videosNext')
    const signsPrev = document.getElementById('signsPrev')
    const signsNext = document.getElementById('signsNext')
    const detectionsPrev = document.getElementById('detectionsPrev')
    const detectionsNext = document.getElementById('detectionsNext')

    if (usersPrev) usersPrev.addEventListener('click', async () => { await loadAdminUsers(Math.max(0, adminUsersPage - 1)) })
    if (usersNext) usersNext.addEventListener('click', async () => { await loadAdminUsers(Math.max(0, adminUsersPage + 1)) })
    if (videosPrev) videosPrev.addEventListener('click', async () => { await loadAdminVideos(Math.max(0, adminVideosPage - 1)) })
    if (videosNext) videosNext.addEventListener('click', async () => { await loadAdminVideos(Math.max(0, adminVideosPage + 1)) })
    if (signsPrev) signsPrev.addEventListener('click', async () => { await loadAdminSignTypes(Math.max(0, adminSignTypesPage - 1)) })
    if (signsNext) signsNext.addEventListener('click', async () => { await loadAdminSignTypes(Math.max(0, adminSignTypesPage + 1)) })
    if (detectionsPrev) detectionsPrev.addEventListener('click', async () => { await loadAdminDetections(Math.max(0, adminDetectionsPage - 1)) })
    if (detectionsNext) detectionsNext.addEventListener('click', async () => { await loadAdminDetections(Math.max(0, adminDetectionsPage + 1)) })
  } catch (e) {
    // ignore
  }
})

async function loadAdminData() {
  try {
    // Load overview stats
    const overview = await fetchAdminAPI(window.CONFIG.ENDPOINTS.ADMIN_STATS_OVERVIEW)
    updateOverviewStats(overview)

    // Load detections over time
    const detectionsOverTime = await fetchAdminAPI(window.CONFIG.ENDPOINTS.ADMIN_STATS_DETECTIONS_OVER_TIME)
    renderDetectionsChart(detectionsOverTime)

    // Load top signs
    const topSigns = await fetchAdminAPI(window.CONFIG.ENDPOINTS.ADMIN_STATS_TOP_SIGNS)
    renderTopSignsChart(topSigns)

    // Load recent users (paged)
    await loadAdminUsers(0)

    // Load recent videos (paged)
    await loadAdminVideos(0)
    // Load sign types (paged)
    await loadAdminSignTypes(0)

    // Load detections (paged)
    await loadAdminDetections(0)
  } catch (error) {
    console.error("Error loading admin data:", error)
  }
}

// Pagination state
let adminUsersPage = 0
let adminUsersPageSize = 4
let adminVideosPage = 0
let adminVideosPageSize = 4
let adminSignTypesPage = 0
let adminSignTypesPageSize = 4
let adminDetectionsPage = 0
let adminDetectionsPageSize = 8

async function loadAdminUsers(page = 0) {
  const container = document.getElementById('recentUsersList')
  const pageInfo = document.getElementById('usersPageInfo')
  try {
    let res = null
    if (window.apiFetchList) res = await window.apiFetchList(window.CONFIG.ENDPOINTS.ADMIN_USERS + `?page=${page}&size=${adminUsersPageSize}`)
    else {
      const raw = await fetchAdminAPI(window.CONFIG.ENDPOINTS.ADMIN_USERS + `?page=${page}&size=${adminUsersPageSize}`)
      res = { items: Array.isArray(raw) ? raw : (raw && Array.isArray(raw.content) ? raw.content : []) }
    }
    const list = Array.isArray(res.items) ? res.items : []
    adminUsersPage = page
    // update page UI and disable buttons when applicable
    if (pageInfo) pageInfo.textContent = `Page ${adminUsersPage + 1}`
    const prevBtn = document.getElementById('usersPrev')
    const nextBtn = document.getElementById('usersNext')
    if (prevBtn) prevBtn.disabled = adminUsersPage <= 0
    // if page metadata available, disable next when on last page
    if (res && res.page && typeof res.page.totalPages === 'number') {
      if (nextBtn) nextBtn.disabled = adminUsersPage >= (res.page.totalPages - 1)
    } else if (nextBtn) {
      // heuristic: if returned list smaller than pageSize, we are on last page
      if (Array.isArray(list) && list.length < adminUsersPageSize) nextBtn.disabled = true
      else nextBtn.disabled = false
    }
    renderRecentUsers(list)
  } catch (err) {
    console.error('Failed to load admin users page', err)
    container.innerHTML = '<p style="text-align:center; color:#DC2626;">Failed to load users</p>'
  }
}

async function loadAdminVideos(page = 0) {
  const container = document.getElementById('recentVideosList')
  const pageInfo = document.getElementById('videosPageInfo')
  try {
    let res = null
    if (window.apiFetchList) res = await window.apiFetchList(window.CONFIG.ENDPOINTS.ADMIN_VIDEOS + `?page=${page}&size=${adminVideosPageSize}`)
    else {
      const raw = await fetchAdminAPI(window.CONFIG.ENDPOINTS.ADMIN_VIDEOS + `?page=${page}&size=${adminVideosPageSize}`)
      res = { items: Array.isArray(raw) ? raw : (raw && Array.isArray(raw.content) ? raw.content : []) }
    }
    const list = Array.isArray(res.items) ? res.items : []
    adminVideosPage = page
    if (pageInfo) pageInfo.textContent = `Page ${adminVideosPage + 1}`
    const prevBtn = document.getElementById('videosPrev')
    const nextBtn = document.getElementById('videosNext')
    if (prevBtn) prevBtn.disabled = adminVideosPage <= 0
    if (res && res.page && typeof res.page.totalPages === 'number') {
      if (nextBtn) nextBtn.disabled = adminVideosPage >= (res.page.totalPages - 1)
    } else if (nextBtn) {
      if (Array.isArray(list) && list.length < adminVideosPageSize) nextBtn.disabled = true
      else nextBtn.disabled = false
    }
    renderRecentVideos(list)
  } catch (err) {
    console.error('Failed to load admin videos page', err)
    container.innerHTML = '<p style="text-align:center; color:#DC2626;">Failed to load videos</p>'
  }
}

async function loadAdminSignTypes(page = 0) {
  const container = document.getElementById('signTypesList')
  const pageInfo = document.getElementById('signsPageInfo')
  try {
    const res = await window.apiFetchList(window.CONFIG.ENDPOINTS.ADMIN_SIGN_TYPES + `?page=${page}&size=${adminSignTypesPageSize}`)
    const list = Array.isArray(res.items) ? res.items : []
    adminSignTypesPage = page
    if (pageInfo) pageInfo.textContent = `Page ${adminSignTypesPage + 1}`
    const prevBtn = document.getElementById('signsPrev')
    const nextBtn = document.getElementById('signsNext')
    if (prevBtn) prevBtn.disabled = adminSignTypesPage <= 0
    if (res.page && typeof res.page.totalPages === 'number') {
      if (nextBtn) nextBtn.disabled = adminSignTypesPage >= (res.page.totalPages - 1)
    } else if (nextBtn) {
      if (Array.isArray(list) && list.length < adminSignTypesPageSize) nextBtn.disabled = true
      else nextBtn.disabled = false
    }
    renderSignTypes(list)
  } catch (err) {
    console.error('Failed to load sign types', err)
    if (container) container.innerHTML = '<p style="text-align:center; color:#DC2626;">Failed to load sign types</p>'
  }
}

async function loadAdminDetections(page = 0) {
  const container = document.getElementById('detectionsList')
  const pageInfo = document.getElementById('detectionsPageInfo')
  try {
    const res = await window.apiFetchList(window.CONFIG.ENDPOINTS.ADMIN_DETECTIONS + `?page=${page}&size=${adminDetectionsPageSize}`)
    const list = Array.isArray(res.items) ? res.items : []
    adminDetectionsPage = page
    if (pageInfo) pageInfo.textContent = `Page ${adminDetectionsPage + 1}`
    const prevBtn = document.getElementById('detectionsPrev')
    const nextBtn = document.getElementById('detectionsNext')
    if (prevBtn) prevBtn.disabled = adminDetectionsPage <= 0
    if (res.page && typeof res.page.totalPages === 'number') {
      if (nextBtn) nextBtn.disabled = adminDetectionsPage >= (res.page.totalPages - 1)
    } else if (nextBtn) {
      if (Array.isArray(list) && list.length < adminDetectionsPageSize) nextBtn.disabled = true
      else nextBtn.disabled = false
    }
    renderDetections(list)
  } catch (err) {
    console.error('Failed to load detections', err)
    if (container) container.innerHTML = '<p style="text-align:center; color:#DC2626;">Failed to load detections</p>'
  }
}

function renderSignTypes(signTypes) {
  const container = document.getElementById('signTypesList')
  if (!container) return
  if (!signTypes || signTypes.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#6b7280;">No sign types found</p>'
    return
  }
  // Backend TrafficSignTypeResponse fields: id, code, name_vi, name_en, description
  container.innerHTML = signTypes
    .map((s) => `
      <div class="activity-item">
        <div class="activity-icon" style="background-color: rgba(139, 92, 246, 0.08);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #8b5cf6;"><path d="M12 2L2 7l10 5 10-5-10-5z"></path></svg>
        </div>
        <div class="activity-content">
          <div class="activity-title">${(s.name_en && s.name_en.trim()) ? s.name_en : (s.name_vi || 'Unnamed')}</div>
          <div class="activity-meta">Code: ${s.code || s.id} • ${s.description ? escapeHtml(s.description) : ''}</div>
          <div class="activity-submeta" style="color:#6b7280; font-size:0.9rem; margin-top:6px;">VI: ${s.name_vi || '-'} • EN: ${s.name_en || '-'}</div>
        </div>
        <div class="activity-time">${s.createdAt ? formatDate(s.createdAt) : ''}</div>
        <div style="margin-left:12px; display:flex; gap:8px;">
          <button class="btn btn-secondary btn-sm btn-view-sign" data-id="${s.id}">Details</button>
          <button class="btn btn-primary btn-sm btn-edit-sign" data-id="${s.id}" data-code="${s.code || ''}" data-name_vi="${s.name_vi || ''}" data-name_en="${s.name_en || ''}" data-desc="${s.description || ''}">Edit</button>
          <button class="btn btn-danger btn-sm btn-delete-sign" data-id="${s.id}">Delete</button>
        </div>
      </div>
    `).join('')
}

// Simple HTML escape for description render
function escapeHtml(str) {
  if (!str) return ''
  return String(str).replace(/[&<>"'`]/g, function (s) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[s]
  })
}

function renderDetections(detections) {
  const container = document.getElementById('detectionsList')
  if (!container) return
  if (!detections || detections.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#6b7280;">No detections found</p>'
    return
  }
  container.innerHTML = detections
    .map((d) => `
      <div class="activity-item">
        <div class="activity-icon" style="background-color: rgba(250, 204, 21, 0.08);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #FACC15;"><circle cx="12" cy="12" r="8"></circle></svg>
        </div>
        <div class="activity-content">
          <div class="activity-title">${d.signTypeName || d.signType || 'Unknown sign'}</div>
          <div class="activity-meta">Confidence: ${Number(d.confidence || 0).toFixed(2)} • Video ID: ${d.videoId || 'N/A'}</div>
        </div>
        <div class="activity-time">${formatDate(d.createdAt)}</div>
        <div style="margin-left:12px; display:flex; gap:8px;">
          <button class="btn btn-danger btn-sm btn-delete-detection" data-id="${d.id}">Delete</button>
        </div>
      </div>
    `).join('')
}

async function fetchAdminAPI(endpoint) {
  const response = await fetch(`${window.CONFIG.API_BASE_URL}${endpoint}`, {
    method: "GET",
    credentials: "include",
    // Do not send Content-Type for GET requests to avoid potential 400 from some servers
    headers: {}
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`)
  }
  // Some endpoints may return empty body; guard JSON parsing
  let data = {}
  try {
    data = await response.json()
  } catch (err) {
    // empty body or invalid JSON -> keep data as {}
    data = {}
  }

  // Optional debug logging when enabled in CONFIG
  try {
    if (window.CONFIG && window.CONFIG.DEBUG) console.debug('[fetchAdminAPI]', endpoint, data)
  } catch (e) {
    // ignore debug errors
  }
  const result = data.result || data.data || data

  // If backend returned a paged result (Page<T>), it will often be in result.content
  // In that case, return the content array so callers expecting an array work correctly.
  if (result && Array.isArray(result.content)) return result.content

  return result
}

async function callAdminAPI(endpoint, method = "GET", body = null) {
  const opts = {
    method,
    credentials: "include",
    headers: {},
  }
  if (body) {
    // Only set Content-Type when a body is present
    opts.headers["Content-Type"] = "application/json"
    opts.body = JSON.stringify(body)
  }

  const response = await fetch(`${window.CONFIG.API_BASE_URL}${endpoint}`, opts)
  let data = {}
  try {
    data = await response.json()
  } catch (err) {
    data = {}
  }
  try {
    if (window.CONFIG && window.CONFIG.DEBUG) console.debug('[callAdminAPI]', endpoint, method, data)
  } catch (e) {
    // ignore
  }
  if (!response.ok) {
    const message = data && (data.message || (data.result && data.result.message)) || response.statusText
    throw new Error(message)
  }
  const result = data.result || data.data || data
  if (result && Array.isArray(result.content)) return result.content
  return result
}

function updateOverviewStats(overview) {
  const elUsers = document.getElementById("totalUsers")
  const elVideos = document.getElementById("totalVideos")
  const elDetections = document.getElementById("totalDetections")
  const elSignTypes = document.getElementById("totalSignTypes")
  if (elUsers) elUsers.textContent = overview.totalUsers || 0
  if (elVideos) elVideos.textContent = overview.totalVideos || 0
  if (elDetections) elDetections.textContent = overview.totalDetections || 0
  if (elSignTypes) elSignTypes.textContent = overview.totalSignTypes || 0
}

function renderDetectionsChart(data) {
  const ctx = document.getElementById("detectionsChart").getContext("2d")
  new window.Chart(ctx, {
    type: "line",
    data: {
      labels: data.labels || [],
      datasets: [
        {
          label: "Detections",
          data: data.values || [],
          borderColor: "#1D4ED8",
          backgroundColor: "rgba(29, 78, 216, 0.08)",
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  })
}

function renderTopSignsChart(data) {
  const ctx = document.getElementById("topSignsChart").getContext("2d")
  new window.Chart(ctx, {
    type: "bar",
    data: {
      labels: data.labels || [],
      datasets: [
        {
          label: "Count",
          data: data.values || [],
          backgroundColor: "#22c55e",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  })
}

function renderRecentUsers(users) {
  const container = document.getElementById("recentUsersList")
  // support multiple shapes: array or paged result { content: [...] }
  const list = Array.isArray(users) ? users : users && Array.isArray(users.content) ? users.content : []

  if (!list || list.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #6b7280;">No users found</p>'
    return
  }

  container.innerHTML = list
    .slice(0, 5)
    .map((user) => {
      // Determine video count: frontend may receive user.videos (array) or user.videoCount (number)
      const videoCount = Array.isArray(user.videos) ? user.videos.length : (typeof user.videoCount === 'number' ? user.videoCount : 0)
      return `
    <div class="activity-item">
      <div class="activity-icon" style="background-color: rgba(29, 78, 216, 0.08);">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #1D4ED8;">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
      <div class="activity-content">
        <div class="activity-title">${user.username || user.email}</div>
        <div class="activity-meta">${user.email} • ${user.role || "USER"} • Videos: ${videoCount}</div>
      </div>
      <div class="activity-time">${formatDate(user.createdAt)}</div>
      <div style="margin-left: 12px; display:flex; gap:8px;">
        <button class="btn btn-secondary btn-sm btn-view-user" data-id="${user.id}">Details</button>
        <button class="btn btn-outline btn-sm btn-edit-user" data-id="${user.id}">Edit</button>
        <button class="btn btn-danger btn-sm btn-delete-user" data-id="${user.id}">Delete</button>
      </div>
    </div>
  `
    })
    .join("")
}

function renderRecentVideos(videos) {
  const container = document.getElementById("recentVideosList")
  const list = Array.isArray(videos) ? videos : videos && Array.isArray(videos.content) ? videos.content : []

  if (!list || list.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #6b7280;">No videos found</p>'
    return
  }
  // Render items with a placeholder for detection counts. We'll fill counts asynchronously
  container.innerHTML = list
    .slice(0, 10)
    .map(
      (video) => `
    <div class="activity-item">
      <div class="activity-icon" style="background-color: rgba(34, 197, 94, 0.08);">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #22c55e;">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </div>
      <div class="activity-content">
        <div class="activity-title">${video.filename || video.originalFilename}</div>
        <div class="activity-meta">Status: ${video.status} • Detections: <span class="video-detections" data-id="${video.id}">${(video.videoStats && typeof video.videoStats.totalDetections !== 'undefined') ? video.videoStats.totalDetections : 'Loading...'}</span></div>
      </div>
      <div class="activity-time">${formatDate(video.uploadedAt)}</div>
      <div style="margin-left: 12px; display:flex; gap:8px;">
        <button class="btn btn-secondary btn-sm btn-view-video" data-id="${video.id}">Details</button>
        <button class="btn btn-outline btn-sm btn-view-result" data-id="${video.id}">View Result</button>
        <button class="btn btn-primary btn-sm btn-reprocess" data-id="${video.id}">Reprocess</button>
        <button class="btn btn-danger btn-sm btn-delete-video" data-id="${video.id}">Delete</button>
      </div>
    </div>
  `,
    )
    .join("")

  // After rendering, fetch detections count for each video individually and update placeholders.
  // Uses the existing fetchAdminAPI helper which prefixes the API base URL.
  try {
    const detectionEls = container.querySelectorAll('.video-detections')
    detectionEls.forEach(async (el) => {
      const id = el.getAttribute('data-id')
      if (!id) return
      try {
        // Endpoint: <ADMIN_VIDEOS>/{id}/detections
        const count = await fetchAdminAPI(`${window.CONFIG.ENDPOINTS.ADMIN_VIDEOS}/${id}/detections`)
        // fetchAdminAPI should unwrap ApiResponse.result; ensure numeric fallback
        if (typeof count === 'number') el.textContent = count
        else if (count && typeof count.result === 'number') el.textContent = count.result
        else if (count && typeof count.data === 'number') el.textContent = count.data
        else el.textContent = (count || 0)
      } catch (err) {
        console.error('Failed to fetch detections for video', id, err)
        el.textContent = 'N/A'
      }
    })
  } catch (err) {
    // non-fatal: if DOM operations fail, leave placeholders as-is
    console.error('Error while updating video detection counts', err)
  }
}

function showVideoModal(video) {
  const modal = document.getElementById('videoDetailModal')
  const title = document.getElementById('modalVideoTitle')
  const meta = document.getElementById('modalVideoMeta')
  const info = document.getElementById('modalVideoInfo')
  const list = document.getElementById('modalDetectionsList')
  const listSection = document.getElementById('modalListSection')
  const listTitle = document.getElementById('modalListTitle')
  if (!modal || !title || !meta || !info || !list) return

  title.textContent = video.filename || `Video #${video.id}`
  meta.textContent = `Uploaded: ${formatDate(video.uploadedAt)} • Status: ${video.status}`

  // Video info block
  info.innerHTML = `
    <div style="display:flex; gap:12px; flex-wrap:wrap;">
      <div><strong>File:</strong> ${video.filename || '-'}</div>
      <div><strong>Path:</strong> ${video.filepath || '-'}</div>
      <div><strong>Size:</strong> ${video.filesize || '-'} bytes</div>
      <div><strong>User:</strong> ${video.user ? (video.user.username || video.user.email) : 'N/A'}</div>
    </div>
  `

  // Render detections array (may be empty)
  const detections = Array.isArray(video.detections) ? video.detections : []
  if (!detections || detections.length === 0) {
    list.innerHTML = '<p style="text-align:center; color:#6b7280;">No detections for this video</p>'
  } else {
    list.innerHTML = detections.map(d => `
      <div class="activity-item">
        <div class="activity-icon" style="background-color: rgba(250, 204, 21, 0.08);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #FACC15;"><circle cx="12" cy="12" r="8"></circle></svg>
        </div>
        <div class="activity-content">
          <div class="activity-title">${(d.signTypeNameEn || d.signTypeNameVi) ? (d.signTypeNameEn || d.signTypeNameVi) : (d.label || 'Unknown')}</div>
          <div class="activity-meta">Frame: ${d.frameNumber || '-'} • Confidence: ${d.confidence != null ? (Number(d.confidence).toFixed(2)) : '-'}%</div>
          <div class="activity-submeta" style="color:#6b7280; font-size:0.85rem; margin-top:6px;">BBox: ${d.bboxX || 0}, ${d.bboxY || 0}, ${d.bboxW || 0}x${d.bboxH || 0}</div>
        </div>
        <div class="activity-time">${formatDate(d.detectedAt)}</div>
      </div>
    `).join('')
  }

  // show modal
  // Ensure the list section is visible and correctly labeled for video
  if (listSection) listSection.style.display = 'block'
  if (listTitle) listTitle.textContent = 'Detections'
  modal.style.display = 'flex'

  // wire close
  const closeBtn = document.getElementById('modalCloseBtn')
  if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none' }
  // also close when clicking outside content
  modal.onclick = (ev) => { if (ev.target === modal) modal.style.display = 'none' }
}

function showUserModal(user) {
  const modal = document.getElementById('videoDetailModal')
  const title = document.getElementById('modalVideoTitle')
  const meta = document.getElementById('modalVideoMeta')
  const info = document.getElementById('modalVideoInfo')
  const list = document.getElementById('modalDetectionsList')
  const listSection = document.getElementById('modalListSection')
  const listTitle = document.getElementById('modalListTitle')
  if (!modal || !title || !meta || !info || !list) return

  title.textContent = user.username || `User #${user.id}`
  meta.textContent = `${user.email} • ${user.role || 'USER'}`

  info.innerHTML = `
    <div style="display:flex; gap:12px; flex-wrap:wrap;">
      <div><strong>Username:</strong> ${user.username || '-'}</div>
      <div><strong>Email:</strong> ${user.email || '-'}</div>
      <div><strong>Role:</strong> ${user.role || '-'}</div>
      <div><strong>Created:</strong> ${formatDate(user.createdAt)}</div>
    </div>
  `

  // Render user's videos if present
  const videos = Array.isArray(user.videos) ? user.videos : []
  if (!videos || videos.length === 0) {
    list.innerHTML = '<p style="text-align:center; color:#6b7280;">No videos for this user</p>'
  } else {
    list.innerHTML = videos.map(v => `
      <div class="activity-item">
        <div class="activity-icon" style="background-color: rgba(34, 197, 94, 0.08);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #22c55e;"><circle cx="12" cy="13" r="4" /></svg>
        </div>
        <div class="activity-content">
          <div class="activity-title">${v.filename || v.originalFilename}</div>
          <div class="activity-meta">Status: ${v.status} • Uploaded: ${formatDate(v.uploadedAt)}</div>
        </div>
        <div class="activity-time">${formatDate(v.uploadedAt)}</div>
        <div style="margin-left:12px; display:flex; gap:8px;">
          <button class="btn btn-secondary btn-sm btn-view-video" data-id="${v.id}">Details</button>
          <button class="btn btn-outline btn-sm btn-view-result" data-id="${v.id}">View Result</button>
        </div>
      </div>
    `).join('')
  }

  // Ensure the shared list section is visible and labeled as Videos
  if (listSection) listSection.style.display = 'block'
  if (listTitle) listTitle.textContent = 'Videos'
  modal.style.display = 'flex'
  const closeBtn = document.getElementById('modalCloseBtn')
  if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none' }
  modal.onclick = (ev) => { if (ev.target === modal) modal.style.display = 'none' }
}

function showSignModal(sign) {
  const modal = document.getElementById('videoDetailModal')
  const title = document.getElementById('modalVideoTitle')
  const meta = document.getElementById('modalVideoMeta')
  const info = document.getElementById('modalVideoInfo')
  const listSection = document.getElementById('modalListSection')
  if (!modal || !title || !meta || !info) return

  // Title and meta
  title.textContent = (sign.name_en && sign.name_en.trim()) ? sign.name_en : (sign.name_vi || `Sign #${sign.id}`)
  meta.textContent = `Code: ${sign.code || '-'} `

  // Main sign info (VI/EN/description). Use HTML-escaped description.
  info.innerHTML = `
    <div style="display:flex; gap:12px; flex-wrap:wrap;">
      <div><strong>VI:</strong> ${sign.name_vi || '-'}</div>
      <div><strong>EN:</strong> ${sign.name_en || '-'}</div>
      <div style="flex-basis:100%;"><strong>Description:</strong> ${sign.description ? escapeHtml(sign.description) : '-'}</div>
    </div>
  `

  // Hide the shared modal list section entirely for sign details (no detections or videos to show)
  if (listSection) listSection.style.display = 'none'

  modal.style.display = 'flex'
  const closeBtn = document.getElementById('modalCloseBtn')
  if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none' }
  modal.onclick = (ev) => { if (ev.target === modal) modal.style.display = 'none' }
}

// Open the user create/edit modal
function openUserFormModal(mode = 'create', user = null) {
  const modal = document.getElementById('userFormModal')
  if (!modal) return
  modal.dataset.mode = mode
  modal.dataset.userId = user && user.id ? String(user.id) : ''
  const title = document.getElementById('userFormTitle')
  const meta = document.getElementById('userFormMeta')
  const inputUsername = document.getElementById('userFormUsername')
  const inputEmail = document.getElementById('userFormEmail')
  const inputPassword = document.getElementById('userFormPassword')

  if (mode === 'create') {
    if (title) title.textContent = 'Create User'
    if (meta) meta.textContent = ''
    if (inputUsername) inputUsername.value = ''
    if (inputEmail) inputEmail.value = ''
    if (inputPassword) {
      inputPassword.value = ''
      inputPassword.placeholder = ''
    }
  } else {
    if (title) title.textContent = 'Edit User'
    if (meta) meta.textContent = `ID: ${user && user.id ? user.id : ''}`
    if (inputUsername) inputUsername.value = user && user.username ? user.username : ''
    if (inputEmail) inputEmail.value = user && user.email ? user.email : ''
    if (inputPassword) {
      // Do not prefill password. Show hint to leave blank when editing.
      inputPassword.value = ''
      inputPassword.placeholder = '(leave blank to keep current)'
    }
  }

  // show
  modal.style.display = 'flex'
  // clicking outside closes
  modal.onclick = (ev) => { if (ev.target === modal) modal.style.display = 'none' }
}

// Event delegation for admin actions
document.addEventListener("click", async (e) => {
  const target = e.target

  // Utility to find the closest matching element and its data-id
  const find = (selector) => target.closest(selector)

  // Reprocess
  const reprocessBtn = find('.btn-reprocess')
  if (reprocessBtn) {
    const id = reprocessBtn.getAttribute('data-id')
    if (!confirm('Reprocess this video?')) return
    const btn = reprocessBtn
    const originalText = btn.textContent

    // Disable all interactive buttons while reprocessing
    const allButtons = Array.from(document.querySelectorAll('button'))
    allButtons.forEach(b => { try { b.disabled = true } catch (e) { } })

    try {
      try { btn.textContent = 'Processing...' } catch (e) { }
      const resp = await callAdminAPI(`${window.CONFIG.ENDPOINTS.ADMIN_VIDEOS}/${id}/reprocess`, 'POST')
      let resolvedVideoId = id
      try { if (resp && (resp.id || resp.videoId)) resolvedVideoId = resp.id || resp.videoId } catch (e) { }
      if (resolvedVideoId) window.location.href = `results.html?id=${resolvedVideoId}`
      else window.location.href = `results.html`
    } catch (err) {
      console.error(err)
      showError(`Failed to reprocess video: ${err.message || err}`)
      allButtons.forEach(b => { try { b.disabled = false } catch (e) { } })
      try { btn.textContent = originalText } catch (e) { }
    }
    return
  }

  // Delete video
  const deleteVideoBtn = find('.btn-delete-video')
  if (deleteVideoBtn) {
    const id = deleteVideoBtn.getAttribute('data-id')
    if (!confirm('Delete this video permanently?')) return
    try {
      await callAdminAPI(`${window.CONFIG.ENDPOINTS.ADMIN_VIDEOS}/${id}`, 'DELETE')
      // notify user, then refresh data after the toast finishes
      await showSuccess('Video deleted')
      await loadAdminData()
    } catch (err) {
      console.error(err)
      showError(`Failed to delete video: ${err.message || err}`)
    }
    return
  }

  // Delete user
  const deleteUserBtn = find('.btn-delete-user')
  if (deleteUserBtn) {
    const id = deleteUserBtn.getAttribute('data-id')
    if (!confirm('Delete this user and all their videos?')) return
    try {
      await callAdminAPI(`${window.CONFIG.ENDPOINTS.ADMIN_USERS}/${id}`, 'DELETE')
      await showSuccess('User deleted')
      await loadAdminData()
    } catch (err) {
      console.error(err)
      showError(`Failed to delete user: ${err.message || err}`)
    }
    return
  }

  // View video details
  const viewVideoBtn = find('.btn-view-video')
  if (viewVideoBtn) {
    const id = viewVideoBtn.getAttribute('data-id')
    if (!id) return
    try {
      const video = await fetchAdminAPI(`${window.CONFIG.ENDPOINTS.ADMIN_VIDEOS}/${id}`)
      showVideoModal(video)
    } catch (err) {
      console.error('Failed to load video details', err)
      showError('Failed to load video details')
    }
    return
  }

  // View result (open results page)
  const viewResultBtn = find('.btn-view-result')
  if (viewResultBtn) {
    const id = viewResultBtn.getAttribute('data-id')
    if (!id) return
    window.location.href = `results.html?id=${id}`
    return
  }

  // View user details
  const viewUserBtn = find('.btn-view-user')
  if (viewUserBtn) {
    const id = viewUserBtn.getAttribute('data-id')
    if (!id) return
    try {
      const user = await fetchAdminAPI(`${window.CONFIG.ENDPOINTS.ADMIN_USERS}/${id}`)
      showUserModal(user)
    } catch (err) {
      console.error('Failed to load user details', err)
      showError('Failed to load user details')
    }
    return
  }

  // Edit user
  const editUserBtn = find('.btn-edit-user')
  if (editUserBtn) {
    const id = editUserBtn.getAttribute('data-id')
    if (!id) return
    try {
      const user = await fetchAdminAPI(`${window.CONFIG.ENDPOINTS.ADMIN_USERS}/${id}`)
      openUserFormModal('edit', user)
    } catch (err) {
      console.error('Failed to load user for edit', err)
      showError('Failed to load user for edit')
    }
    return
  }

  // Create user button handler
  const createUserBtn = find('#createUserBtn')
  if (createUserBtn) {
    openUserFormModal('create', null)
    return
  }

  // Save user from modal form
  const saveUserBtn = find('#userFormSaveBtn')
  if (saveUserBtn) {
    const modal = document.getElementById('userFormModal')
    if (!modal) return
    const mode = modal.dataset.mode || 'create'
    const userId = modal.dataset.userId
    const username = (document.getElementById('userFormUsername') || {}).value
    const email = (document.getElementById('userFormEmail') || {}).value
    const password = (document.getElementById('userFormPassword') || {}).value

    if (!username || !email) { showError('Username and email are required'); return }
    try {
      if (mode === 'create') {
        await callAdminAPI(`${window.CONFIG.ENDPOINTS.ADMIN_USERS}`, 'POST', { username, email, password })
        // close form, notify user, then reload list after notification
        modal.style.display = 'none'
        await showSuccess('User created')
        await loadAdminUsers(0)
      } else {
        const payload = { username, email }
        if (password) payload.password = password
        await callAdminAPI(`${window.CONFIG.ENDPOINTS.ADMIN_USERS}/${userId}`, 'PUT', payload)
        modal.style.display = 'none'
        await showSuccess('User updated')
        await loadAdminUsers(adminUsersPage)
      }
    } catch (err) {
      console.error('Failed to save user', err)
      showError('Failed to save user')
    }
    return
  }

  // Cancel user form
  const cancelUserBtn = find('#userFormCancelBtn')
  if (cancelUserBtn) {
    const modal = document.getElementById('userFormModal')
    if (modal) modal.style.display = 'none'
    return
  }

  // View sign type details
  const viewSignBtn = find('.btn-view-sign')
  if (viewSignBtn) {
    const id = viewSignBtn.getAttribute('data-id')
    if (!id) return
    try {
      const sign = await fetchAdminAPI(`${window.CONFIG.ENDPOINTS.ADMIN_SIGN_TYPES}/${id}`)
      showSignModal(sign)
    } catch (err) {
      console.error('Failed to load sign type details', err)
      showError('Failed to load sign type details')
    }
    return
  }

  // Edit sign
  const editSignBtn = find('.btn-edit-sign')
  if (editSignBtn) {
    const id = editSignBtn.getAttribute('data-id')
    const name = prompt('Enter new name for this sign type:')
    if (!name) return
    try {
      await callAdminAPI(`${window.CONFIG.ENDPOINTS.ADMIN_SIGN_TYPES}/${id}`, 'PUT', { name })
      await showSuccess('Sign type updated')
      await loadAdminSignTypes(adminSignTypesPage)
    } catch (err) {
      console.error(err)
      showError(`Failed to update sign type: ${err.message || err}`)
    }
    return
  }

  // Delete sign
  const deleteSignBtn = find('.btn-delete-sign')
  if (deleteSignBtn) {
    const id = deleteSignBtn.getAttribute('data-id')
    if (!confirm('Delete this sign type? This may affect historical detections.')) return
    try {
      await callAdminAPI(`${window.CONFIG.ENDPOINTS.ADMIN_SIGN_TYPES}/${id}`, 'DELETE')
      await showSuccess('Sign type deleted')
      await loadAdminSignTypes(adminSignTypesPage)
    } catch (err) {
      console.error(err)
      showError(`Failed to delete sign type: ${err.message || err}`)
    }
    return
  }

  // Delete detection
  const deleteDetectionBtn = find('.btn-delete-detection')
  if (deleteDetectionBtn) {
    const id = deleteDetectionBtn.getAttribute('data-id')
    if (!confirm('Delete this detection?')) return
    try {
      await callAdminAPI(`${window.CONFIG.ENDPOINTS.ADMIN_DETECTIONS}/${id}`, 'DELETE')
      await showSuccess('Detection deleted')
      await loadAdminDetections(adminDetectionsPage)
    } catch (err) {
      console.error(err)
      showError(`Failed to delete detection: ${err.message || err}`)
    }
    return
  }
})

function formatDate(dateString) {
  if (!dateString) return "N/A"
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString()
}

// Lightweight toast notifications (success / error)
function showToast(message, type = 'info', timeout = 4000) {
  if (!message) return
  let container = document.getElementById('toastContainer')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toastContainer'
    container.style.position = 'fixed'
    container.style.right = '16px'
    container.style.top = '16px'
    container.style.zIndex = '2000'
    container.style.display = 'flex'
    container.style.flexDirection = 'column'
    container.style.gap = '8px'
    document.body.appendChild(container)
  }

  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.style.minWidth = '200px'
  toast.style.maxWidth = '380px'
  toast.style.padding = '10px 12px'
  toast.style.borderRadius = '8px'
  toast.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)'
  toast.style.color = type === 'error' ? '#fff' : '#083344'
  toast.style.background = type === 'error' ? '#ef4444' : (type === 'success' ? '#bbf7d0' : '#e6f6ff')
  toast.style.border = '1px solid rgba(0,0,0,0.06)'
  toast.style.fontSize = '0.95rem'
  toast.textContent = message

  container.appendChild(toast)

  // Return a promise that resolves after the toast is removed
  return new Promise((resolve) => {
    setTimeout(() => {
      try { toast.remove() } catch (e) { }
      resolve()
    }, timeout)
  })
}

// showSuccess/showError return a promise that resolves when the toast auto-dismisses
function showSuccess(message, timeout = 4000) { return showToast(message, 'success', timeout) }
function showError(message, timeout = 4000) { return showToast(message, 'error', timeout) }
