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
  const cameraBtn = document.getElementById('cameraBtn')
  const overlay = document.getElementById('overlay')
  const uploadHeader = document.querySelector('.upload-header')
  const previewHeader = document.querySelector('.preview-header')
  const videoPreviewWrapper = document.querySelector('.video-preview-wrapper')
  const fileDetails = document.querySelector('.file-details')
  const uploadBtnEl = document.getElementById('uploadBtn')
  const fileName = document.getElementById("fileName")
  const fileSize = document.getElementById("fileSize")
  const fileDuration = document.getElementById("fileDuration")
  const progressFill = document.getElementById("progressFill")
  const progressPercent = document.getElementById("progressPercent")
  const progressStatus = document.getElementById("progressStatus")
  const videoId = document.getElementById("videoId")
  const processingStatus = document.getElementById("processingStatus")

  let selectedFile = null
  let cameraStream = null
  let cameraIntervalId = null
  let isCameraActive = false
  let cameraFlip = true
  let _prevDisplay = new Map()

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

  if (cameraBtn) {
    cameraBtn.addEventListener('click', async (e) => {
      e.preventDefault()
      if (!isCameraActive) {
        startCameraDetection()
      } else {
        stopCameraDetection()
      }
    })
  }

  function enterCameraOnlyMode() {
    try {
      const elsToHide = [uploadHeader, uploadSection, progressSection, processingSection, previewHeader, fileDetails, uploadBtnEl]
      elsToHide.forEach(el => {
        if (!el) return
        _prevDisplay.set(el, el.style.display || '')
        el.style.display = 'none'
      })

      if (previewSection) previewSection.style.display = 'block'
      if (videoPreviewWrapper) videoPreviewWrapper.style.display = 'flex'

      if (videoPreview) {
        videoPreview.style.width = '100%'
        videoPreview.style.height = 'auto'
        videoPreview.controls = false
      }
      if (overlay) {
        overlay.style.pointerEvents = 'none'
        overlay.style.display = 'block'
      }
    } catch (e) { }
  }

  function exitCameraOnlyMode() {
    try {
      _prevDisplay.forEach((val, el) => {
        try { el.style.display = val } catch (e) { }
      })
      _prevDisplay.clear()

      if (previewSection && !isCameraActive) previewSection.style.display = 'none'

      if (videoPreview) {
        videoPreview.style.width = ''
        videoPreview.style.height = ''
        videoPreview.controls = true
      }
      if (overlay) overlay.style.display = ''
      if (videoPreviewWrapper) videoPreviewWrapper.style.display = ''
    } catch (e) { }
  }

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

    if (isCameraActive) stopCameraDetection()
    uploadSection.querySelector(".drop-zone").style.display = "block"
    previewSection.style.display = "none"
    fileInput.value = ""
  })

  document.getElementById("uploadBtn").addEventListener("click", async () => {
    if (!selectedFile) return

    if (cameraBtn) cameraBtn.style.display = 'none'

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
      if (cameraBtn) cameraBtn.style.display = ''
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

  function setOverlaySize() {
    if (!overlay || !videoPreview) return
    overlay.width = videoPreview.videoWidth || videoPreview.clientWidth || 640
    overlay.height = videoPreview.videoHeight || videoPreview.clientHeight || 480
    overlay.style.width = (videoPreview.clientWidth || overlay.width) + 'px'
    overlay.style.height = (videoPreview.clientHeight || overlay.height) + 'px'
  }

  function drawDetections(payload) {
    if (!overlay) return
    const ctx = overlay.getContext('2d')
    ctx.clearRect(0, 0, overlay.width, overlay.height)

    const predictions = (payload && payload.result && Array.isArray(payload.result.predictions)) ? payload.result.predictions : []
    const types = (payload && payload.result && Array.isArray(payload.result.types)) ? payload.result.types : []

    if (predictions.length) {
      ctx.font = '12px sans-serif'
      predictions.forEach(pred => {
        try {
          const pw = pred.width || 0
          const ph = pred.height || 0
          let x = Math.max(0, (pred.x || 0) - pw / 2)
          const y = Math.max(0, (pred.y || 0) - ph / 2)
          const w = Math.max(0, pw)
          const h = Math.max(0, ph)

          if (cameraFlip) {
            x = Math.max(0, overlay.width - (x + w))
          }

          ctx.strokeStyle = 'lime'
          ctx.lineWidth = 2
          ctx.strokeRect(x, y, w, h)

          const label = `${pred['class'] || pred['label'] || 'sign'} ${Math.round((pred.confidence || pred.score || 0) * 100)}%`
          ctx.fillStyle = 'rgba(0,0,0,0.6)'
          const textW = ctx.measureText(label).width
          const pad = 6
          const rectW = Math.max(textW + pad, 60)
          const rectH = 18
          const rectX = x
          const rectY = Math.max(0, y - rectH)
          ctx.fillRect(rectX, rectY, rectW, rectH)

          ctx.fillStyle = '#fff'
          ctx.fillText(label, rectX + 4, rectY + 13)
        } catch (e) {
          console.warn('drawDetections item error', e)
        }
      })
    }

    let bottomText = ''
    if (types && types.length) {
      bottomText = types.map(t => t.name_vi || t.name || '').filter(Boolean).join(' ')
    } else if (!predictions.length) {
      bottomText = 'Detecting...'
    }

    if (bottomText) {
      ctx.font = '14px sans-serif'
      const padding = 8
      const textW = ctx.measureText(bottomText).width
      const boxW = Math.min(textW + padding * 2, overlay.width - 16)
      const boxH = 28
      const boxX = 8
      const boxY = overlay.height - boxH - 8
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(boxX, boxY, boxW, boxH)
      ctx.fillStyle = '#fff'
      ctx.fillText(bottomText, boxX + padding, boxY + boxH / 2 + 5)
    }
  }

  async function captureAndDetect() {
    if (!videoPreview || !cameraStream) return
    try {
      const w = videoPreview.videoWidth || 640
      const h = videoPreview.videoHeight || 480
      const off = document.createElement('canvas')
      off.width = w
      off.height = h
      const ctx = off.getContext('2d')
      ctx.drawImage(videoPreview, 0, 0, w, h)
      const dataUrl = off.toDataURL('image/jpeg', 0.7)
      const base64 = dataUrl.split(',')[1]

      const frameEndpoint = window.CONFIG?.ENDPOINTS?.FRAME_DETECTION || '/api/frame/detection'
      try {
        const resp = await fetch(window.CONFIG.API_BASE_URL + frameEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ image: base64 })
        })
        if (resp.ok) {
          const payload = await resp.json().catch(() => null)
          drawDetections(payload)
          return
        }
      } catch (e) {
      }
    } catch (err) {
      console.warn('Frame capture failed', err)
    }
  }

  async function startCameraDetection() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      cameraStream = stream
      videoPreview.srcObject = stream
      videoPreview.autoplay = true
      videoPreview.play().catch(() => { })
      isCameraActive = true
      cameraBtn.textContent = 'Stop Camera'

      enterCameraOnlyMode()

      videoPreview.addEventListener('loadedmetadata', () => {
        setOverlaySize()
      }, { once: true })

      if (cameraFlip) {
        videoPreview.style.transform = 'scaleX(-1)'
        if (overlay) overlay.style.transform = ''
      }

      cameraIntervalId = setInterval(captureAndDetect, 800)
    } catch (e) {
      alert('Unable to access camera: ' + (e.message || e))
    }
  }

  function stopCameraDetection() {
    try {
      if (cameraIntervalId) {
        clearInterval(cameraIntervalId)
        cameraIntervalId = null
      }
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop())
        cameraStream = null
      }
      isCameraActive = false
      if (cameraBtn) cameraBtn.textContent = 'Use Camera'
      if (overlay) {
        const ctx = overlay.getContext('2d')
        ctx && ctx.clearRect(0, 0, overlay.width, overlay.height)
      }
      videoPreview.srcObject = null
      exitCameraOnlyMode()
      uploadSection.querySelector('.drop-zone').style.display = 'block'
    } catch (e) { }
  }

})
