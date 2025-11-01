// User Dashboard functionality
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

  // Display user name
  const userName = window.auth.getUser()
  document.getElementById("userName").textContent = userName || "User"

  // Load user statistics
  await loadUserStats()
})

async function loadUserStats() {
  try {
    const response = await fetch(`${window.CONFIG.API_BASE_URL}${window.CONFIG.ENDPOINTS.USER_VIDEOS}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })

    if (response.ok) {
      const data = await response.json()
      const videos = data.result || data.data || []

      // Calculate statistics
      const totalVideos = videos.length
      const totalDetections = videos.reduce((sum, v) => sum + (v.detectionCount || 0), 0)
      const avgConfidence =
        videos.length > 0 ? Math.round(videos.reduce((sum, v) => sum + (v.avgConfidence || 0), 0) / videos.length) : 0

      document.getElementById("userVideos").textContent = totalVideos
      document.getElementById("userDetections").textContent = totalDetections
      document.getElementById("userAccuracy").textContent = `${avgConfidence}%`
    }
  } catch (error) {
    console.error("Error loading user stats:", error)
  }
}
