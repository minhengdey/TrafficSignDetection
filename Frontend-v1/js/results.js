// Results page functionality
document.addEventListener("DOMContentLoaded", async () => {
  if (window.auth && typeof window.auth.init === 'function') await window.auth.init()

  // Check authentication
  if (!auth.isAuthenticated()) {
    window.location.href = "login.html"
    return
  }

  // Update auth link
  const authLink = document.getElementById("authLink")
  if (typeof auth !== "undefined" && auth.isAuthenticated()) {
    authLink.textContent = "Logout"
    authLink.addEventListener("click", (e) => {
      e.preventDefault()
      auth.logout()
    })
  } else {
    authLink.textContent = "Login"
    authLink.href = "login.html"
  }

  // Get video ID from URL
  const urlParams = new URLSearchParams(window.location.search)
  const videoId = urlParams.get("id")

  if (!videoId) {
    alert("No video ID provided")
    window.location.href = "upload.html"
    return
  }

  // Elements
  const videoTitle = document.getElementById("videoTitle")
  const videoFilename = document.getElementById("videoFilename")
  const detectionCount = document.getElementById("detectionCount")
  const videoDuration = document.getElementById("videoDuration")
  const videoPlayer = document.getElementById("videoPlayer")
  const detectionCanvas = document.getElementById("detectionCanvas")
  const currentTime = document.getElementById("currentTime")
  const totalTime = document.getElementById("totalTime")
  const currentDetections = document.getElementById("currentDetections")
  const signTypeFilter = document.getElementById("signTypeFilter")
  const confidenceFilter = document.getElementById("confidenceFilter")
  const confidenceValue = document.getElementById("confidenceValue")
  const detectionsList = document.getElementById("detectionsList")
  const downloadBtn = document.getElementById("downloadBtn")

  const ctx = detectionCanvas.getContext("2d")

  let videoData = null
  let detectionsData = []
  let filteredDetections = []
  let currentFrameDetections = []

  // Load video data
  loadVideoData()

  async function loadVideoData() {
    try {
      if (CONFIG.MODE === "MOCK") {
        // Mock data
        videoData = {
          id: videoId,
          filename: "traffic_video_demo.mp4",
          duration: 45,
          detectionCount: 23,
          videoUrl: "/traffic-road-video.jpg",
        }

        // Generate mock detections
        detectionsData = generateMockDetections(45, 23)
      } else {
        // Live API call
        const response = await fetch(CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.VIDEO_RESULTS.replace(":id", videoId), {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })

        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload && (payload.message || payload.error) || 'Failed to load results')
        // Support either flat or wrapped ApiResponse
        const result = payload.result || payload
        videoData = result.video || result.data || { id: videoId, filename: result.filename, duration: result.duration, detectionCount: (result.detections || []).length, videoUrl: result.videoUrl }
        detectionsData = result.detections || []
      }

      // Update UI
      videoFilename.textContent = videoData.filename
      detectionCount.textContent = `${videoData.detectionCount} detections`
      videoDuration.textContent = formatDuration(videoData.duration)

      // Set video source
      videoPlayer.src = videoData.videoUrl

      // Populate sign type filter
      populateSignTypeFilter()

      // Initial filter
      filterDetections()

      // Setup video player events
      setupVideoPlayer()
    } catch (error) {
      console.error("Failed to load video data:", error)
      alert("Failed to load video data")
    }
  }

  // Generate mock detections
  function generateMockDetections(duration, count) {
    const signTypes = [
      "STOP",
      "SPEED_LIMIT_50",
      "YIELD",
      "NO_ENTRY",
      "ONE_WAY",
      "PEDESTRIAN_CROSSING",
      "TURN_RIGHT",
      "PARKING",
    ]

    const detections = []
    for (let i = 0; i < count; i++) {
      const timestamp = (duration / count) * i + Math.random() * 2
      detections.push({
        id: `det-${i + 1}`,
        timestamp: timestamp,
        signType: signTypes[Math.floor(Math.random() * signTypes.length)],
        confidence: 0.7 + Math.random() * 0.3,
        bbox: {
          x: 100 + Math.random() * 500,
          y: 50 + Math.random() * 300,
          width: 40 + Math.random() * 80,
          height: 40 + Math.random() * 80,
        },
      })
    }

    return detections.sort((a, b) => a.timestamp - b.timestamp)
  }

  // Populate sign type filter
  function populateSignTypeFilter() {
    const signTypes = [...new Set(detectionsData.map((d) => d.signType))].sort()

    signTypes.forEach((type) => {
      const option = document.createElement("option")
      option.value = type
      option.textContent = formatSignType(type)
      signTypeFilter.appendChild(option)
    })
  }

  // Filter detections
  function filterDetections() {
    const selectedType = signTypeFilter.value
    const minConfidence = confidenceFilter.value / 100

    filteredDetections = detectionsData.filter((detection) => {
      const typeMatch = selectedType === "all" || detection.signType === selectedType
      const confidenceMatch = detection.confidence >= minConfidence
      return typeMatch && confidenceMatch
    })

    renderDetectionsList()
    updateCurrentDetections()
  }

  // Render detections list
  function renderDetectionsList() {
    if (filteredDetections.length === 0) {
      detectionsList.innerHTML = `
        <div class="empty-detections">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>No detections match the current filters</p>
        </div>
      `
      return
    }

    detectionsList.innerHTML = filteredDetections
      .map(
        (detection) => `
      <div class="detection-item" data-id="${detection.id}" data-timestamp="${detection.timestamp}">
        <div class="detection-thumbnail">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
          </svg>
        </div>
        <div class="detection-content">
          <div class="detection-header">
            <span class="detection-type">${formatSignType(detection.signType)}</span>
            <span class="detection-time">${formatTimestamp(detection.timestamp)}</span>
          </div>
          <div class="detection-details">
            <span class="confidence-badge ${getConfidenceClass(detection.confidence)}">
              ${Math.round(detection.confidence * 100)}% confidence
            </span>
            <span class="bbox-info">
              ${Math.round(detection.bbox.width)}×${Math.round(detection.bbox.height)}px
            </span>
          </div>
        </div>
      </div>
    `,
      )
      .join("")

    // Add click handlers
    document.querySelectorAll(".detection-item").forEach((item) => {
      item.addEventListener("click", () => {
        const timestamp = Number.parseFloat(item.dataset.timestamp)
        videoPlayer.currentTime = timestamp
        videoPlayer.play()
      })
    })
  }

  // Setup video player
  function setupVideoPlayer() {
    // Update canvas size
    function resizeCanvas() {
      detectionCanvas.width = videoPlayer.videoWidth
      detectionCanvas.height = videoPlayer.videoHeight
    }

    videoPlayer.addEventListener("loadedmetadata", () => {
      totalTime.textContent = formatDuration(videoPlayer.duration)
      resizeCanvas()
    })

    videoPlayer.addEventListener("resize", resizeCanvas)

    // Update on time change
    videoPlayer.addEventListener("timeupdate", () => {
      currentTime.textContent = formatDuration(videoPlayer.currentTime)
      updateCurrentDetections()
      drawDetections()
    })

    // Draw detections on play
    videoPlayer.addEventListener("play", () => {
      requestAnimationFrame(drawLoop)
    })
  }

  // Draw loop
  function drawLoop() {
    if (!videoPlayer.paused && !videoPlayer.ended) {
      drawDetections()
      requestAnimationFrame(drawLoop)
    }
  }

  // Update current detections
  function updateCurrentDetections() {
    const currentVideoTime = videoPlayer.currentTime
    const timeWindow = 0.5 // Show detections within 0.5 seconds

    currentFrameDetections = filteredDetections.filter((detection) => {
      return Math.abs(detection.timestamp - currentVideoTime) < timeWindow
    })

    if (currentFrameDetections.length > 0) {
      const types = currentFrameDetections.map((d) => formatSignType(d.signType)).join(", ")
      currentDetections.textContent = `Detected: ${types}`
      currentDetections.style.color = "var(--accent-blue)"
    } else {
      currentDetections.textContent = "No detections at this time"
      currentDetections.style.color = "var(--text-secondary)"
    }

    // Highlight active detection items
    document.querySelectorAll(".detection-item").forEach((item) => {
      const timestamp = Number.parseFloat(item.dataset.timestamp)
      if (Math.abs(timestamp - currentVideoTime) < timeWindow) {
        item.classList.add("active")
      } else {
        item.classList.remove("active")
      }
    })
  }

  // Draw detections on canvas
  function drawDetections() {
    // Clear canvas
    ctx.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height)

    if (currentFrameDetections.length === 0) return

    // Calculate scale factors
    const scaleX = detectionCanvas.width / 1280 // Assuming original video width
    const scaleY = detectionCanvas.height / 720 // Assuming original video height

    currentFrameDetections.forEach((detection) => {
      const bbox = detection.bbox
      const x = bbox.x * scaleX
      const y = bbox.y * scaleY
      const width = bbox.width * scaleX
      const height = bbox.height * scaleY

      // Draw bounding box
      ctx.strokeStyle = "#3b82f6"
      ctx.lineWidth = 3
      ctx.strokeRect(x, y, width, height)

      // Draw label background
      const label = formatSignType(detection.signType)
      const confidence = Math.round(detection.confidence * 100) + "%"
      const labelText = `${label} ${confidence}`

      ctx.font = "14px sans-serif"
      const textMetrics = ctx.measureText(labelText)
      const textWidth = textMetrics.width
      const textHeight = 20

      ctx.fillStyle = "rgba(59, 130, 246, 0.9)"
      ctx.fillRect(x, y - textHeight - 4, textWidth + 12, textHeight + 4)

      // Draw label text
      ctx.fillStyle = "#ffffff"
      ctx.fillText(labelText, x + 6, y - 8)
    })
  }

  // Filter event listeners
  signTypeFilter.addEventListener("change", filterDetections)

  confidenceFilter.addEventListener("input", (e) => {
    confidenceValue.textContent = e.target.value + "%"
    filterDetections()
  })

  // Download results
  downloadBtn.addEventListener("click", () => {
    const results = {
      video: videoData,
      detections: detectionsData,
      summary: {
        totalDetections: detectionsData.length,
        signTypes: [...new Set(detectionsData.map((d) => d.signType))],
        averageConfidence: detectionsData.reduce((sum, d) => sum + d.confidence, 0) / detectionsData.length,
      },
    }

    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `results_${videoId}.json`
    a.click()
    URL.revokeObjectURL(url)
  })

  // Utility functions
  function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  function formatTimestamp(seconds) {
    return formatDuration(seconds)
  }

  function formatSignType(type) {
    return type
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ")
  }

  function getConfidenceClass(confidence) {
    if (confidence >= 0.9) return "high"
    if (confidence >= 0.7) return "medium"
    return "low"
  }
})
