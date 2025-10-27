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

  // Update auth link
  const authLink = document.getElementById("authLink")
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
    const formData = new FormData()
    formData.append("video", selectedFile)

    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100)
        progressFill.style.width = percent + "%"
        progressPercent.textContent = percent + "%"
        progressStatus.textContent = "Uploading video..."
      }
    })

    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText)
        currentVideoId = response.videoId

        progressSection.style.display = "none"
        processingSection.style.display = "block"
        videoId.textContent = currentVideoId

        startProcessingPolling()
      } else {
        throw new Error("Upload failed")
      }
    })

    xhr.addEventListener("error", () => {
      throw new Error("Network error")
    })

    xhr.open("POST", window.CONFIG.API_BASE_URL + window.CONFIG.ENDPOINTS.UPLOAD)
    // Do not set Authorization header; backend uses HttpOnly cookie. Ensure XHR sends credentials.
    xhr.withCredentials = true
    xhr.send(formData)
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
    window.location.href = `results.html?id=${currentVideoId}`
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
        const data = await response.json()
        videos = data.videos
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
