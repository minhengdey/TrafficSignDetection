// Upload page functionality
document.addEventListener("DOMContentLoaded", async () => {
  if (window.auth && typeof window.auth.init === 'function') await window.auth.init()
  const MOCK_DATA = {
    videos: [
      {
        id: "video-1",
        filename: "example.mp4",
        status: "completed",
        uploadedAt: "2023-10-01T12:00:00Z",
        detectionCount: 10,
        duration: 60,
      },
      {
        id: "video-2",
        filename: "test.mp4",
        status: "processing",
        uploadedAt: "2023-10-02T12:00:00Z",
        detectionCount: 5,
        duration: 30,
      },
    ],
  }

  // Check authentication and role
  if (!window.auth.isAuthenticated()) {
    window.location.href = "login.html"
    return
  }

  if (window.auth.isAdmin()) {
    window.location.href = "admin-dashboard.html"
    return
  }

  // Update auth link (defensive: element may be absent on some pages)
  const authLink = document.getElementById("authLink")
  if (authLink) {
    try {
      if (window.auth.isAuthenticated()) {
        authLink.textContent = "Logout"
        authLink.addEventListener("click", (e) => {
          e.preventDefault()
          window.auth.logout()
        })
      } else {
        authLink.textContent = "Login"
        authLink.href = "login.html"
      }
    } catch (err) {
      // If auth helper is missing or errors, fallback to a Login link
      console.warn('auth helper error:', err)
      authLink.textContent = 'Login'
      authLink.href = 'login.html'
    }
  } else {
    // Not fatal - some pages may not include the nav link
    console.warn('authLink element not found in DOM')
  }

  // Elements
  const dropZone = document.getElementById("dropZone")
  const fileInput = document.getElementById("fileInput")
  const uploadSection = document.getElementById("uploadSection")
  const previewSection = document.getElementById("previewSection")
  const progressSection = document.getElementById("progressSection")
  const processingSection = document.getElementById("processingSection")
  const videoPreview = document.getElementById("videoPreview")
  const fileName = document.getElementById("fileName")
  const fileSize = document.getElementById("fileSize")
  const fileDuration = document.getElementById("fileDuration")
  const cancelBtn = document.getElementById("cancelBtn")
  const uploadBtn = document.getElementById("uploadBtn")
  const progressFill = document.getElementById("progressFill")
  const progressPercent = document.getElementById("progressPercent")
  const progressStatus = document.getElementById("progressStatus")
  const videoId = document.getElementById("videoId")
  const processingStatus = document.getElementById("processingStatus")
  const processingStatusText = document.getElementById("processingStatusText")
  const recentList = document.getElementById("recentList")

  let selectedFile = null
  let currentVideoId = null
  let pollingInterval = null

  // Drop zone events
  dropZone.addEventListener("click", () => fileInput.click())

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault()
    dropZone.classList.add("drag-over")
  })

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over")
  })

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault()
    dropZone.classList.remove("drag-over")
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  })

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0])
    }
  })

  // Handle file selection
  function handleFileSelect(file) {
    if (!file.type.startsWith("video/")) {
      alert("Please select a valid video file")
      return
    }

    const maxSize = 500 * 1024 * 1024
    if (file.size > maxSize) {
      alert("File size must be less than 500MB")
      return
    }

    selectedFile = file

    const url = URL.createObjectURL(file)
    videoPreview.src = url
    fileName.textContent = file.name
    fileSize.textContent = formatFileSize(file.size)

    videoPreview.addEventListener(
      "loadedmetadata",
      () => {
        fileDuration.textContent = formatDuration(videoPreview.duration)
      },
      { once: true },
    )

    uploadSection.querySelector(".drop-zone").style.display = "none"
    previewSection.style.display = "block"
  }

  cancelBtn.addEventListener("click", () => {
    selectedFile = null
    videoPreview.src = ""
    uploadSection.querySelector(".drop-zone").style.display = "block"
    previewSection.style.display = "none"
    fileInput.value = ""
  })

  uploadBtn.addEventListener("click", async () => {
    if (!selectedFile) return

    previewSection.style.display = "none"
    progressSection.style.display = "block"

    try {
      if (window.CONFIG.MODE === "MOCK") {
        await mockUpload()
      } else {
        await liveUpload()
      }
    } catch (error) {
      alert("Upload failed: " + error.message)
      resetUpload()
    }
  })

  async function mockUpload() {
    for (let i = 0; i <= 100; i += 5) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      progressFill.style.width = i + "%"
      progressPercent.textContent = i + "%"

      if (i < 30) {
        progressStatus.textContent = "Uploading video..."
      } else if (i < 70) {
        progressStatus.textContent = "Processing upload..."
      } else {
        progressStatus.textContent = "Finalizing..."
      }
    }

    currentVideoId = "video-" + Date.now()

    progressSection.style.display = "none"
    processingSection.style.display = "block"
    videoId.textContent = currentVideoId

    startProcessingPolling()
  }

  async function liveUpload() {
    // Step 1: Upload the file to the server at /api/upload with visible progress
    // We'll capture the server-returned URL (if any) so the results page can use it instead of a local blob
    let uploadedFileUrl = null
    let uploadedVideoId = null
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const fd = new FormData()
      fd.append('file', selectedFile)

      xhr.open('POST', window.CONFIG.API_BASE_URL + '/api/upload', true)
      xhr.withCredentials = true

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100)
          progressFill.style.width = percent + '%'
          progressPercent.textContent = percent + '%'
          progressStatus.textContent = 'Uploading video...'
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const resp = xhr.responseText ? JSON.parse(xhr.responseText) : {}
            console.info('Upload response', resp)
            // prefer explicit fields returned by backend
            uploadedFileUrl = resp.url || resp.presignedGetUrl || resp.filepath || resp.filePath || null
            // backend may return the canonical video id as `videoId`; fall back to fileName or id
            uploadedVideoId = resp.videoId || resp.fileName || resp.id || null
          } catch (err) {
            console.warn('Could not parse upload response JSON', err)
          }
          resolve()
        } else {
          reject(new Error('Upload failed: ' + xhr.status + ' ' + xhr.statusText))
        }
      })

      xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))

      xhr.send(fd)
    })

    // Step 2: Show processing screen while running detection
    progressSection.style.display = 'none'
    processingSection.style.display = 'block'
    processingStatus.textContent = 'Analyzing traffic signs...'

    // Step 3: Call detection endpoint
    let resp = null
    if (uploadedFileUrl) {
      // send the server-side URL to the detection API (JSON)
      const payload = { videoUrl: encodeURI(uploadedFileUrl) }
      if (uploadedVideoId) payload.videoId = uploadedVideoId
      console.debug('Detection payload (sent to /api/video/detection):', payload)

      resp = await fetch(window.CONFIG.API_BASE_URL + '/api/video/detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      })
    } else {
      // fallback: upload the file again as multipart (server may accept)
      const formData = new FormData()
      formData.append('file', selectedFile)

      resp = await fetch(window.CONFIG.API_BASE_URL + '/api/video/detection', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText)
      throw new Error('Detection failed: ' + errText)
    }

    const data = await resp.json().catch(() => ({}))
    if (data.status !== 'ok') {
      throw new Error('Processing failed on server')
    }

    // Redirect to results page using canonical videoId returned by upload or detection
    // prefer videoId from upload, otherwise use videoId from detection response
    let resolvedVideoId = uploadedVideoId || null
    try {
      const detPayload = data || {}
      if (detPayload.videoId) resolvedVideoId = detPayload.videoId
    } catch (e) {
      console.warn('Failed to parse detection response payload', e)
    }

    if (resolvedVideoId) {
      window.location.href = `results.html?id=${resolvedVideoId}`
    } else {
      // Fallback: try to redirect to a generic results page (may show error)
      window.location.href = `results.html`
    }
  }

  // Draw detection boxes on the overlay canvas based on frames returned by backend
  function drawResults(frames) {
    const overlay = document.getElementById('overlay')
    if (!overlay) return
    const ctx = overlay.getContext('2d')

    // frames: array of { frameIndex, timeSeconds, detectionJson }
    const parsed = frames.map(f => ({
      time: f.timeSeconds ?? 0,
      detections: f.detectionJson ? JSON.parse(f.detectionJson) : null,
    }))

    let lastIdx = -1
    videoPreview.addEventListener('timeupdate', () => {
      const t = videoPreview.currentTime

      // find latest frame with time <= t
      let idx = -1
      for (let i = 0; i < parsed.length; i++) {
        if (parsed[i].time <= t) idx = i
        else break
      }

      if (idx === -1 || idx === lastIdx) return
      lastIdx = idx

      ctx.clearRect(0, 0, overlay.width, overlay.height)
      const item = parsed[idx]
      if (!item || !item.detections) return

      const detection = item.detections
      if (!detection.predictions || !Array.isArray(detection.predictions)) return

      detection.predictions.forEach(pred => {
        let x = pred.x
        let y = pred.y
        let w = pred.width
        let h = pred.height

        // if normalized coords between 0..1
        if (x <= 1 && y <= 1 && w <= 1 && h <= 1) {
          x = x * overlay.width
          y = y * overlay.height
          w = w * overlay.width
          h = h * overlay.height
        } else {
          // assume Roboflow returns center x,y in pixels
          x = x - w / 2
          y = y - h / 2
        }

        ctx.strokeStyle = 'red'
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, w, h)
        ctx.fillStyle = 'red'
        ctx.font = '14px sans-serif'
        const label = `${pred.class} (${Math.round((pred.confidence || 0) * 100)}%)`
        ctx.fillText(label, x + 4, Math.max(12, y - 6))
      })
    })
  }

  function startProcessingPolling() {
    let pollCount = 0

    pollingInterval = setInterval(async () => {
      pollCount++

      if (window.CONFIG.MODE === "MOCK") {
        if (pollCount >= 6) {
          clearInterval(pollingInterval)
          processingComplete()
        } else {
          const messages = [
            "Extracting frames...",
            "Running detection model...",
            "Analyzing traffic signs...",
            "Processing detections...",
            "Generating results...",
          ]
          processingStatus.textContent = messages[Math.min(pollCount - 1, messages.length - 1)]
        }
      } else {
        try {
          const response = await fetch(
            window.CONFIG.API_BASE_URL + window.CONFIG.ENDPOINTS.VIDEO_STATUS.replace(":id", currentVideoId),
            {
              credentials: "include",
              headers: { "Content-Type": "application/json" },
            },
          )

          const data = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error((data && (data.message || data.error)) || "Status polling failed")

          if (data.status === "completed") {
            clearInterval(pollingInterval)
            processingComplete()
          } else if (data.status === "failed") {
            clearInterval(pollingInterval)
            alert("Processing failed: " + (data.error || "Unknown error"))
            resetUpload()
          } else {
            processingStatus.textContent = data.message || "Processing..."
          }
        } catch (error) {
          console.error("Polling error:", error)
        }
      }
    }, 3000)
  }

  function processingComplete() {
    // fallback behavior: redirect to results page if your backend provides it
    if (currentVideoId) window.location.href = `results.html?id=${currentVideoId}`
  }

  function resetUpload() {
    selectedFile = null
    currentVideoId = null
    videoPreview.src = ""
    fileInput.value = ""
    uploadSection.querySelector(".drop-zone").style.display = "block"
    previewSection.style.display = "none"
    progressSection.style.display = "none"
    processingSection.style.display = "none"
    progressFill.style.width = "0%"
    progressPercent.textContent = "0%"
  }

  loadRecentUploads()

  async function loadRecentUploads() {
    try {
      let videos = []

      if (window.CONFIG.MODE === "MOCK") {
        videos = MOCK_DATA.videos
      } else {
        const response = await fetch(window.CONFIG.API_BASE_URL + window.CONFIG.ENDPOINTS.VIDEOS_LIST, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })

        // Some backends may return an empty body or plain text; guard against invalid JSON
        const text = await response.text().catch(() => '')
        if (!text || text.trim() === '') {
          console.warn('Videos list endpoint returned empty body')
          videos = []
        } else {
          try {
            const data = JSON.parse(text)
            videos = data.videos || []
          } catch (err) {
            console.warn('Failed to parse videos list JSON, falling back to empty list', err)
            videos = []
          }
        }
      }

      if (videos.length === 0) {
        recentList.innerHTML = `
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
            </svg>
            <p>No videos uploaded yet</p>
          </div>
        `
      } else {
        recentList.innerHTML = videos
          .map(
            (video) => `
          <div class="recent-item" onclick="window.location.href='results.html?id=${video.id}'">
            <div class="recent-item-info">
              <div class="recent-item-name">
                ${video.filename}
                <span class="status-badge ${video.status}">${video.status}</span>
              </div>
              <div class="recent-item-meta">
                <span>${formatDate(video.uploadedAt)}</span>
                <span>${video.detectionCount || 0} detections</span>
                <span>${video.duration}s</span>
              </div>
            </div>
            <div class="recent-item-actions">
              <button class="btn btn-secondary" onclick="event.stopPropagation(); window.location.href='results.html?id=${video.id}'">
                View Results
              </button>
            </div>
          </div>
        `,
          )
          .join("")
      }
    } catch (error) {
      console.error("Failed to load recent uploads:", error)
    }
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
  }

  function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  function formatDate(dateString) {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return "Today"
    if (days === 1) return "Yesterday"
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }
})
