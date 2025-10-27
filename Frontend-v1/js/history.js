// History page functionality
document.addEventListener("DOMContentLoaded", async () => {
  if (window.auth && typeof window.auth.init === 'function') await window.auth.init()
  // Check authentication and role
  if (!window.auth.isAuthenticated() || !window.auth.isUser()) {
    window.location.href = "login.html"
    return
  }

  // Setup logout
  document.getElementById("logoutLink").addEventListener("click", (e) => {
    e.preventDefault()
    window.auth.logout()
  })

  // Setup refresh button
  document.getElementById("refreshBtn").addEventListener("click", () => {
    loadHistory()
  })

  // Load upload history
  await loadHistory()
})

async function loadHistory() {
  const container = document.getElementById("videosList")
  container.innerHTML = '<div style="text-align: center; padding: 2rem;"><div class="spinner"></div></div>'

  try {
    const response = await fetch(`${window.CONFIG.API_BASE_URL}${window.CONFIG.ENDPOINTS.USER_VIDEOS}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })

    if (response.ok) {
      const data = await response.json()
      const videos = data.result || data.data || []
      renderVideos(videos)
    } else {
      throw new Error("Failed to load videos")
    }
  } catch (error) {
    console.error("Error loading history:", error)
    container.innerHTML = '<p style="text-align: center; color: #ef4444;">Failed to load upload history</p>'
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

      return `
      <div class="video-card">
        <div class="video-card-header">
          <div class="video-info">
            <h3 class="video-title">${video.filename || video.originalFilename}</h3>
            <div class="video-meta">
              <span>Uploaded: ${formatDate(video.uploadedAt)}</span>
              ${video.duration ? `<span>Duration: ${formatDuration(video.duration)}</span>` : ""}
            </div>
          </div>
          <div class="video-status" style="background-color: ${statusColor}20; color: ${statusColor};">
            ${statusText}
          </div>
        </div>
        <div class="video-card-body">
          <div class="video-stats">
            <div class="stat-item">
              <div class="stat-label">Detections</div>
              <div class="stat-value">${video.detectionCount || 0}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Avg Confidence</div>
              <div class="stat-value">${video.avgConfidence ? Math.round(video.avgConfidence) + "%" : "N/A"}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Status</div>
              <div class="stat-value">${statusText}</div>
            </div>
          </div>
          ${video.status === "completed"
          ? `
            <a href="results.html?id=${video.id}" class="btn btn-primary btn-full" style="margin-top: 1rem;">
              View Results
            </a>
          `
          : ""
        }
        </div>
      </div>
    `
    })
    .join("")
}

function getStatusColor(status) {
  const colors = {
    completed: "#10b981",
    processing: "#f59e0b",
    pending: "#6b7280",
    failed: "#ef4444",
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
