document.addEventListener("DOMContentLoaded", async () => {
  if (window.auth?.init) await window.auth.init()

  if (!window.auth.isAuthenticated()) {
    window.location.href = "login.html"
    return
  }

  if (window.auth.isAdmin()) {
    window.location.href = "admin-dashboard.html"
    return
  }

  const authLink = document.getElementById("authLink")
  if (authLink) {
    authLink.textContent = "Logout"
    authLink.addEventListener("click", (e) => {
      e.preventDefault()
      window.auth.logout()
    })
  }

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
  const progressFill = document.getElementById("progressFill")
  const progressPercent = document.getElementById("progressPercent")
  const progressStatus = document.getElementById("progressStatus")
  const videoId = document.getElementById("videoId")
  const processingStatus = document.getElementById("processingStatus")

  let selectedFile = null

  dropZone.addEventListener("click", () => fileInput.click())
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault()
    dropZone.classList.add("drag-over")
  })
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"))
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault()
    dropZone.classList.remove("drag-over")
    if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0])
  })
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) handleFileSelect(e.target.files[0])
  })

  function handleFileSelect(file) {
    if (!(file instanceof File) || !file.type.startsWith("video/")) {
      alert("Please select a valid video file")
      return
    }

    if (file.size > 100 * 1024 * 1024) {
      alert("File size must be less than 100MB")
      return
    }

    selectedFile = file
    videoPreview.src = URL.createObjectURL(file)
    fileName.textContent = file.name

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(file.size) / Math.log(k))
    fileSize.textContent = Math.round((file.size / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]

    videoPreview.addEventListener("loadedmetadata", () => {
      const mins = Math.floor(videoPreview.duration / 60)
      const secs = Math.floor(videoPreview.duration % 60)
      fileDuration.textContent = `${mins}:${secs.toString().padStart(2, "0")}`
    }, { once: true })

    uploadSection.querySelector(".drop-zone").style.display = "none"
    previewSection.style.display = "block"
  }

  document.getElementById("cancelBtn").addEventListener("click", () => {
    selectedFile = null
    videoPreview.src = ""
    uploadSection.querySelector(".drop-zone").style.display = "block"
    previewSection.style.display = "none"
    fileInput.value = ""
  })

  document.getElementById("uploadBtn").addEventListener("click", async () => {
    if (!selectedFile) return

    previewSection.style.display = "none"
    progressSection.style.display = "block"

    try {
      const { uploadedFileUrl, uploadedVideoId } = await new Promise((resolve, reject) => {
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
              const resp = JSON.parse(xhr.responseText)
              const body = resp?.result || resp
              resolve({
                uploadedFileUrl: body.url,
                uploadedVideoId: body.videoId
              })
            } catch {
              resolve({ uploadedFileUrl: null, uploadedVideoId: null })
            }
          } else {
            reject(new Error('Upload failed: ' + xhr.status))
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Network error')))
        xhr.send(fd)
      })

      progressSection.style.display = 'none'
      processingSection.style.display = 'block'
      processingStatus.textContent = 'Analyzing traffic signs...'
      if (videoId && uploadedFileUrl) videoId.textContent = uploadedFileUrl

      if (!uploadedFileUrl || !uploadedVideoId) throw new Error('Upload failed')

      const endpoint = window.CONFIG.ENDPOINTS.VIDEO_DETECTION || '/api/video/detection'
      const payload = { videoUrl: encodeURI(uploadedFileUrl), videoId: uploadedVideoId }

      const detPayload = window.apiFetch
        ? await window.apiFetch(endpoint, { method: 'POST', body: JSON.stringify(payload) })
        : await fetch(window.CONFIG.API_BASE_URL + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'include',
          }).then(r => r.ok ? r.json().then(d => d?.result || d) : Promise.reject('Detection failed'))

      if (detPayload?.status !== 'ok') throw new Error('Processing failed')

      const resolvedVideoId = detPayload.videoId || uploadedVideoId
      window.location.href = `results.html?id=${resolvedVideoId}`
    } catch (error) {
      alert("Upload failed: " + error.message)
      selectedFile = null
      videoPreview.src = ""
      fileInput.value = ""
      uploadSection.querySelector(".drop-zone").style.display = "block"
      previewSection.style.display = "none"
      progressSection.style.display = "none"
      processingSection.style.display = "none"
    }
  })

  const totalUploadsEl = document.getElementById('totalUploads')
  const totalDetectionsEl = document.getElementById('totalDetections')

  if (totalUploadsEl && totalDetectionsEl) {
    try {
      const [totalUploads, signsDetected] = await Promise.all([
        window.apiFetch ? window.apiFetch(window.CONFIG.ENDPOINTS.TOTAL_UPLOADS).catch(() => null)
          : fetch(window.CONFIG.API_BASE_URL + window.CONFIG.ENDPOINTS.TOTAL_UPLOADS, { credentials: 'include' })
            .then(r => r.json()).then(j => j?.result ?? j).catch(() => null),
        window.apiFetch ? window.apiFetch(window.CONFIG.ENDPOINTS.SIGNS_DETECTED).catch(() => null)
          : fetch(window.CONFIG.API_BASE_URL + window.CONFIG.ENDPOINTS.SIGNS_DETECTED, { credentials: 'include' })
            .then(r => r.json()).then(j => j?.result ?? j).catch(() => null)
      ])

      totalUploadsEl.textContent = (totalUploads || 0).toLocaleString()
      totalDetectionsEl.textContent = (signsDetected || 0).toLocaleString()
    } catch { }
  }
})