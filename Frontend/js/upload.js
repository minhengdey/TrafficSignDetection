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
      console.warn('auth helper error:', err)
      authLink.textContent = 'Login'
      authLink.href = 'login.html'
    }
  } else {
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
  // recentList removed: history tab will handle listing of past uploads

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
    // DEBUG: Log file object to console
    console.log('File object:', file)
    console.log('File name:', file.name)
    console.log('File type:', file.type)
    console.log('File size:', file.size)

    // Validate file is actually a File object
    if (!(file instanceof File)) {
      console.error('Invalid file object:', file)
      alert("Invalid file selected")
      return
    }

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

    // Set file name - using property access, not function call
    const fileNameText = String(file.name)
    fileName.textContent = fileNameText

    // Inline size formatting
    const bytes = file.size || 0
    if (bytes === 0) {
      fileSize.textContent = '0 Bytes'
    } else {
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      fileSize.textContent = Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
    }

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

    progressSection.style.display = "none"
    processingSection.style.display = "block"
    videoId.textContent = currentVideoId

    startProcessingPolling()
  }

  async function liveUpload() {
    let uploadedFileUrl = null
    let uploadedVideoId = null
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const fd = new FormData()
      fd.append('file', selectedFile)

      xhr.open('POST', window.CONFIG.API_BASE_URL + window.CONFIG.ENDPOINTS.UPLOAD, true)
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
            const body = resp && resp.result ? resp.result : resp
            uploadedFileUrl = body.url || body.presignedGetUrl || body.filepath || body.filePath || null
            uploadedVideoId = body.videoId || body.fileName || body.id || null
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

    progressSection.style.display = 'none'
    processingSection.style.display = 'block'
    processingStatus.textContent = 'Analyzing traffic signs...'
    try {
      const displayName = uploadedFileUrl || '<unknown>'
      if (videoId) videoId.textContent = displayName
    } catch (e) {
      // ignore display errors
    }
    let resp = null
    if (uploadedFileUrl) {
      if (!uploadedVideoId) {
        throw new Error('Uploaded video ID missing')
      }
      const payload = { videoUrl: encodeURI(uploadedFileUrl), videoId: uploadedVideoId }
      console.debug('Detection payload:', payload)

      let detPayload = null
      // Use the video detection endpoint (backend expects /api/video/detection)
      const endpoint = (window.CONFIG && window.CONFIG.ENDPOINTS && window.CONFIG.ENDPOINTS.VIDEO_DETECTION)
        ? window.CONFIG.ENDPOINTS.VIDEO_DETECTION
        : '/api/video/detection'

      if (window.apiFetch) {
        detPayload = await window.apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      } else {
        const resp = await fetch(window.CONFIG.API_BASE_URL + endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
        })
        if (!resp.ok) {
          const errText = await resp.text().catch(() => resp.statusText)
          throw new Error('Detection failed: ' + errText)
        }
        const data = await resp.json().catch(() => ({}))
        detPayload = data && data.result ? data.result : data
      }

      if (!detPayload || detPayload.status !== 'ok') {
        throw new Error('Processing failed on server')
      }

      let resolvedVideoId = uploadedVideoId || null
      // don't reassign the DOM element variable `videoId` (const) — set its text instead
      try {
        if (detPayload && detPayload.fileName && videoId) videoId.textContent = detPayload.fileName
      } catch (e) {
        // ignore
      }
      try {
        if (detPayload.videoId) resolvedVideoId = detPayload.videoId
      } catch (e) {
        console.warn('Failed to parse detection response payload', e)
      }

      if (resolvedVideoId) {
        window.location.href = `results.html?id=${resolvedVideoId}`
      } else {
        window.location.href = `results.html`
      }
    }
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
          let statusPayload = null
          if (window.apiFetch) {
            try {
              statusPayload = await window.apiFetch(window.CONFIG.ENDPOINTS.VIDEO_STATUS.replace(":id", currentVideoId))
            } catch (err) {
              console.error('Polling error (apiFetch):', err)
            }
          } else {
            const response = await fetch(
              window.CONFIG.API_BASE_URL + window.CONFIG.ENDPOINTS.VIDEO_STATUS.replace(":id", currentVideoId),
              {
                credentials: "include",
                headers: { "Content-Type": "application/json" },
              },
            )

            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error((data && (data.message || data.error)) || "Status polling failed")
            statusPayload = data && data.result ? data.result : data
          }

          if (!statusPayload) {
            return
          }

          if (statusPayload.status === "completed") {
            clearInterval(pollingInterval)
            processingComplete()
          } else if (statusPayload.status === "failed") {
            clearInterval(pollingInterval)
            alert("Processing failed: " + (statusPayload.error || "Unknown error"))
            resetUpload()
          } else {
            processingStatus.textContent = statusPayload.message || "Processing..."
          }
        } catch (error) {
          console.error("Polling error:", error)
        }
      }
    }, 3000)
  }

  function processingComplete() {
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

  // recent uploads removed from this page; history.html shows upload history

  // Populate header stat cards (Total Uploads / Signs Detected)
  // If admin, use admin stats endpoint; otherwise compute from user's videos
  async function loadHeaderStats() {
    try {
      const totalUploadsEl = document.getElementById('totalUploads')
      const totalDetectionsEl = document.getElementById('totalDetections')

      if (!totalUploadsEl || !totalDetectionsEl) return

      if (window.CONFIG.MODE === 'MOCK') {
        totalUploadsEl.textContent = MOCK_DATA.videos.length
        const totalDet = MOCK_DATA.videos.reduce((s, v) => s + (v.detectionCount || 0), 0)
        totalDetectionsEl.textContent = totalDet
        return
      }

      // If admin, prefer admin stats overview
      if (window.auth && typeof window.auth.isAdmin === 'function' && window.auth.isAdmin()) {
        try {
          const overview = window.apiFetch
            ? await window.apiFetch(window.CONFIG.ENDPOINTS.ADMIN_STATS_OVERVIEW)
            : await (async () => {
              const resp = await fetch(window.CONFIG.API_BASE_URL + window.CONFIG.ENDPOINTS.ADMIN_STATS_OVERVIEW, { credentials: 'include' })
              const j = await resp.json().catch(() => ({}))
              return j && j.result ? j.result : j
            })()

          totalUploadsEl.textContent = (overview && Number(overview.totalVideos)) ? Number(overview.totalVideos).toLocaleString() : '0'
          totalDetectionsEl.textContent = (overview && Number(overview.totalDetections)) ? Number(overview.totalDetections).toLocaleString() : '0'
          return
        } catch (err) {
          console.warn('Failed to load admin overview stats', err)
        }
      }

      // Non-admin: fetch user-level aggregate stats from dedicated endpoints
      try {
        let totalUploads = null
        let signsDetected = null

        if (window.apiFetch) {
          try {
            totalUploads = await window.apiFetch(window.CONFIG.ENDPOINTS.TOTAL_UPLOADS)
          } catch (e) {
            console.warn('apiFetch total-uploads failed', e)
          }
          try {
            signsDetected = await window.apiFetch(window.CONFIG.ENDPOINTS.SIGNS_DETECTED)
          } catch (e) {
            console.warn('apiFetch signs-detected failed', e)
          }
        } else {
          try {
            const r1 = await fetch(window.CONFIG.API_BASE_URL + window.CONFIG.ENDPOINTS.TOTAL_UPLOADS, { credentials: 'include' })
            const j1 = await r1.json().catch(() => ({}))
            totalUploads = j1 && j1.result !== undefined ? j1.result : j1
          } catch (e) {
            console.warn('fetch total-uploads failed', e)
          }

          try {
            const r2 = await fetch(window.CONFIG.API_BASE_URL + window.CONFIG.ENDPOINTS.SIGNS_DETECTED, { credentials: 'include' })
            const j2 = await r2.json().catch(() => ({}))
            signsDetected = j2 && j2.result !== undefined ? j2.result : j2
          } catch (e) {
            console.warn('fetch signs-detected failed', e)
          }
        }

        totalUploadsEl.textContent = (typeof totalUploads === 'number') ? Number(totalUploads).toLocaleString() : '0'
        totalDetectionsEl.textContent = (typeof signsDetected === 'number') ? Number(signsDetected).toLocaleString() : '0'
      } catch (err) {
        console.warn('Failed to load user stats', err)
      }
    } catch (err) {
      console.warn('loadHeaderStats error', err)
    }
  }

  // call it (non-blocking)
  loadHeaderStats()

  // recent uploads listing removed from upload page. Use history.html for past uploads.

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
});