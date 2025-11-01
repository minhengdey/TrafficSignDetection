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

  // Setup refresh button
  document.getElementById("refreshBtn").addEventListener("click", () => {
    location.reload()
  })

  // Load all admin data
  await loadAdminData()
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

    // Load videos by status
    const videosByStatus = await fetchAdminAPI(window.CONFIG.ENDPOINTS.ADMIN_STATS_VIDEOS_BY_STATUS)
    renderVideoStatusChart(videosByStatus)

    // Load recent users
    const users = await fetchAdminAPI(window.CONFIG.ENDPOINTS.ADMIN_USERS)
    renderRecentUsers(users)

    // Load recent videos
    const videos = await fetchAdminAPI(window.CONFIG.ENDPOINTS.ADMIN_VIDEOS)
    renderRecentVideos(videos)
  } catch (error) {
    console.error("Error loading admin data:", error)
  }
}

async function fetchAdminAPI(endpoint) {
  const response = await fetch(`${window.CONFIG.API_BASE_URL}${endpoint}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`)
  }

  const data = await response.json()
  return data.result || data.data || data
}

async function callAdminAPI(endpoint, method = "GET", body = null) {
  const opts = {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  }
  if (body) opts.body = JSON.stringify(body)

  const response = await fetch(`${window.CONFIG.API_BASE_URL}${endpoint}`, opts)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data && (data.message || (data.result && data.result.message)) || response.statusText
    throw new Error(message)
  }
  return data.result || data.data || data
}

function updateOverviewStats(overview) {
  document.getElementById("totalUsers").textContent = overview.totalUsers || 0
  document.getElementById("totalVideos").textContent = overview.totalVideos || 0
  document.getElementById("totalDetections").textContent = overview.totalDetections || 0
  document.getElementById("totalSignTypes").textContent = overview.totalSignTypes || 0
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
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
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
          backgroundColor: "#10b981",
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

function renderVideoStatusChart(data) {
  const ctx = document.getElementById("videoStatusChart").getContext("2d")
  new window.Chart(ctx, {
    type: "doughnut",
    data: {
      labels: data.labels || [],
      datasets: [
        {
          data: data.values || [],
          backgroundColor: ["#10b981", "#f59e0b", "#ef4444", "#6b7280"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  })
}

function renderRecentUsers(users) {
  const container = document.getElementById("recentUsersList")
  if (!users || users.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #6b7280;">No users found</p>'
    return
  }

  container.innerHTML = users
    .slice(0, 5)
    .map(
      (user) => `
    <div class="activity-item">
      <div class="activity-icon" style="background-color: rgba(59, 130, 246, 0.1);">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #3b82f6;">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
      <div class="activity-content">
        <div class="activity-title">${user.username || user.email}</div>
        <div class="activity-meta">${user.email} • ${user.role || "USER"}</div>
      </div>
      <div class="activity-time">${formatDate(user.createdAt)}</div>
      <div style="margin-left: 12px;">
        <button class="btn btn-danger btn-sm btn-delete-user" data-id="${user.id}">Delete</button>
      </div>
    </div>
  `,
    )
    .join("")
}

function renderRecentVideos(videos) {
  const container = document.getElementById("recentVideosList")
  if (!videos || videos.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #6b7280;">No videos found</p>'
    return
  }

  container.innerHTML = videos
    .slice(0, 10)
    .map(
      (video) => `
    <div class="activity-item">
      <div class="activity-icon" style="background-color: rgba(16, 185, 129, 0.1);">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #10b981;">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </div>
      <div class="activity-content">
        <div class="activity-title">${video.filename || video.originalFilename}</div>
  <div class="activity-meta">Status: ${video.status} • Detections: ${(video.videoStats && video.videoStats.totalDetections) || 0}</div>
      </div>
      <div class="activity-time">${formatDate(video.uploadedAt)}</div>
      <div style="margin-left: 12px; display:flex; gap:8px;">
        <button class="btn btn-primary btn-sm btn-reprocess" data-id="${video.id}">Reprocess</button>
        <button class="btn btn-danger btn-sm btn-delete-video" data-id="${video.id}">Delete</button>
      </div>
    </div>
  `,
    )
    .join("")
}

// Event delegation for admin actions
document.addEventListener("click", async (e) => {
  const target = e.target

  if (target.matches(".btn-reprocess")) {
    const id = target.getAttribute("data-id")
    if (!confirm("Reprocess this video?")) return
    try {
      await callAdminAPI(`${window.CONFIG.ENDPOINTS.ADMIN_VIDEOS}/${id}/reprocess`, "POST")
      showError("Reprocess request submitted")
      await loadAdminData()
    } catch (err) {
      console.error(err)
      showError(`Failed to reprocess video: ${err.message || err}`)
    }
  }

  if (target.matches(".btn-delete-video")) {
    const id = target.getAttribute("data-id")
    if (!confirm("Delete this video permanently?")) return
    try {
      await callAdminAPI(`${window.CONFIG.ENDPOINTS.ADMIN_VIDEOS}/${id}`, "DELETE")
      await loadAdminData()
    } catch (err) {
      console.error(err)
      showError(`Failed to delete video: ${err.message || err}`)
    }
  }

  if (target.matches(".btn-delete-user")) {
    const id = target.getAttribute("data-id")
    if (!confirm("Delete this user and all their videos?")) return
    try {
      await callAdminAPI(`${window.CONFIG.ENDPOINTS.ADMIN_USERS}/${id}`, "DELETE")
      await loadAdminData()
    } catch (err) {
      console.error(err)
      showError(`Failed to delete user: ${err.message || err}`)
    }
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

function showError(message) {
  // // Prefer non-intrusive error display: inline banner if available, else console
  // const banner = document.getElementById('adminError')
  // if (banner) {
  //   banner.textContent = message
  //   banner.style.display = 'block'
  //   return
  // }
  console.error(message)
}
