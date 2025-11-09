document.addEventListener("DOMContentLoaded", async () => {
  if (window.auth?.init) await window.auth.init()

  if (!window.auth?.isAuthenticated()) {
    window.location.href = "login.html"
    return
  }

  const authLink = document.getElementById("authLink")
  if (authLink) {
    authLink.textContent = "Logout"
    authLink.addEventListener("click", (e) => {
      e.preventDefault()
      window.auth?.logout()
    })
  }

  const urlParams = new URLSearchParams(window.location.search)
  const videoId = urlParams.get("id")

  if (!videoId) {
    alert("No video ID provided")
    window.location.href = "upload.html"
    return
  }

  const videoPlayer = document.getElementById("videoPlayer")
  const detectionCanvas = document.getElementById("detectionCanvas")
  const ctx = detectionCanvas.getContext("2d")
  const videoFilename = document.getElementById("videoFilename")
  const detectionCount = document.getElementById("detectionCount")
  const videoDuration = document.getElementById("videoDuration")
  const currentTime = document.getElementById("currentTime")
  const totalTime = document.getElementById("totalTime")
  const currentDetections = document.getElementById("currentDetections")
  const signTypeFilter = document.getElementById("signTypeFilter")
  const confidenceFilter = document.getElementById("confidenceFilter")
  const confidenceValue = document.getElementById("confidenceValue")
  const detectionsList = document.getElementById("detectionsList")

  let videoData = null
  let detectionsData = []
  let filteredDetections = []
  let currentFrameDetections = []
  let previousFrameDetections = []
  let lastSpokenDetections = new Set()
  let lastSpokenAt = 0
  let isVideoPlaying = false
  let allowSpeech = false
  let vietnameseVoice = null
  let useEnglishLabels = false
  const speechQueue = []
  const signTypeNameMap = new Map()
  const SPEECH_COOLDOWN = 1500
  const SIGN_TYPE_LS_KEY = 'traffic_sign_type_cache_v1'
  const SIGN_TYPE_TTL = 24 * 60 * 60 * 1000

  function loadVoices() {
    const voices = window.speechSynthesis.getVoices()
    vietnameseVoice = voices.find(v => v.lang === 'vi-VN' && /google/i.test(v.name)) ||
      voices.find(v => v.lang === 'vi_VN' && /google/i.test(v.name)) ||
      voices.find(v => v.lang === 'vi-VN' && /microsoft|azure/i.test(v.name)) ||
      voices.find(v => v.lang === 'vi-VN') ||
      voices.find(v => v.lang === 'vi_VN') ||
      voices.find(v => /vietnam|vietnamese/i.test(v.name)) ||
      voices.find(v => v.lang?.toLowerCase().startsWith('vi')) ||
      voices[0]

    const isVi = vietnameseVoice?.lang?.toLowerCase().startsWith('vi')
    useEnglishLabels = !isVi
  }

  if ('speechSynthesis' in window) {
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
  }

  function encodeUrlForBrowser(u) {
    if (!u || !/^https?:\/\//i.test(u)) return u
    return encodeURI(u).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/ /g, '%20')
  }

  async function loadVideoData() {
    try {
      const result = await (window.apiFetch
        ? window.apiFetch(`/api/video/${videoId}`)
        : fetch(CONFIG.API_BASE_URL + '/api/video/' + videoId, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        }).then(r => r.json().then(p => p.result || p)))

      detectionsData = result.detections.map(d => ({
        id: d.id,
        timestamp: d.frameNumber != null ? Number(d.frameNumber) : 0,
        signType: d.label || 'Unknown',
        confidence: Number(d.confidence || 0),
        bbox: { x: Number(d.bboxX || 0), y: Number(d.bboxY || 0), width: Number(d.bboxW || 0), height: Number(d.bboxH || 0) },
        originalImageWidth: d.origImageWidth,
        originalImageHeight: d.origImageHeight
      }))
      videoData = result

      if (videoFilename) videoFilename.textContent = videoData.filename || ''
      if (videoData?.filepath) videoPlayer.src = encodeUrlForBrowser(videoData.filepath)

      const uniqueCodes = [...new Set(detectionsData.map(d => d.signType))].filter(Boolean)
      await Promise.all(uniqueCodes.map(c => fetchSignTypeInfo(c).catch(() => null)))

      populateSignTypeFilter()
      filterDetections()
      setupVideoPlayer()
    } catch (error) {
      console.error("Failed to load video data:", error)
      alert("Failed to load video data")
    }
  }

  function populateSignTypeFilter() {
    [...new Set(detectionsData.map(d => d.signType))].sort().forEach(type => {
      const option = document.createElement("option")
      option.value = type
      option.textContent = getDisplaySignType(type)
      signTypeFilter.appendChild(option)
    })
  }

  function filterDetections() {
    const selectedType = signTypeFilter.value
    const minConfidence = confidenceFilter.value / 100

    filteredDetections = detectionsData.filter(d =>
      (selectedType === "all" || d.signType === selectedType) && d.confidence >= minConfidence
    )

    renderDetectionsList()
    updateCurrentDetections()
  }

  function renderDetectionsList() {
    if (filteredDetections.length === 0) {
      detectionsList.innerHTML = `<div class="empty-detections"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>No detections match the current filters</p></div>`
      return
    }

    detectionsList.innerHTML = filteredDetections.map(d => `
      <div class="detection-item" data-id="${d.id}" data-timestamp="${d.timestamp}" data-sign-type="${d.signType}">
        <div class="detection-thumbnail"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg></div>
        <div class="detection-content">
          <div class="detection-header"><span class="detection-type">${getDisplaySignType(d.signType)}</span><span class="detection-time">${formatDuration(d.timestamp)}</span></div>
          <div class="detection-details"><span class="confidence-badge ${d.confidence >= 0.9 ? 'high' : d.confidence >= 0.7 ? 'medium' : 'low'}">${Math.round(d.confidence * 100)}% confidence</span><span class="bbox-info">${Math.round(d.bbox.width)}×${Math.round(d.bbox.height)}px</span></div>
        </div>
      </div>
    `).join("")

    document.querySelectorAll(".detection-item").forEach(item => {
      item.addEventListener("click", () => {
        videoPlayer.currentTime = parseFloat(item.dataset.timestamp)
        videoPlayer.play()
      })
    })
  }

  function setupVideoPlayer() {
    function resizeCanvas() {
      detectionCanvas.width = videoPlayer.videoWidth
      detectionCanvas.height = videoPlayer.videoHeight
    }

    videoPlayer.addEventListener("loadedmetadata", () => {
      totalTime.textContent = formatDuration(videoPlayer.duration)
      resizeCanvas()
    })

    videoPlayer.addEventListener("resize", resizeCanvas)

    videoPlayer.addEventListener("timeupdate", () => {
      currentTime.textContent = formatDuration(videoPlayer.currentTime)
      updateCurrentDetections()
      drawDetections()
    })

    videoPlayer.addEventListener("play", () => {
      isVideoPlaying = true
      allowSpeech = true
      requestAnimationFrame(drawLoop)
    })

    videoPlayer.addEventListener("pause", () => {
      isVideoPlaying = false
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        speechQueue.length = 0
      }
    })

    videoPlayer.addEventListener("ended", () => {
      isVideoPlaying = false
      allowSpeech = false
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        speechQueue.length = 0
      }
    })
  }

  function drawLoop() {
    if (!videoPlayer.paused && !videoPlayer.ended) {
      drawDetections()
      requestAnimationFrame(drawLoop)
    }
  }

  function updateCurrentDetections() {
    const currentVideoTime = videoPlayer.currentTime
    previousFrameDetections = [...currentFrameDetections]
    currentFrameDetections = filteredDetections.filter(d => Math.abs(d.timestamp - currentVideoTime) < 0.5)

    if (currentFrameDetections.length > 0) {
      currentDetections.textContent = `Detected: ${currentFrameDetections.map(d => getDisplaySignType(d.signType)).join(", ")}`
      currentDetections.style.color = "var(--accent-blue)"
    } else {
      currentDetections.textContent = "No detections at this time"
      currentDetections.style.color = "var(--text-secondary)"
    }

    if (allowSpeech && isVideoPlaying && !videoPlayer.paused) {
      const now = Date.now()
      const previousIds = new Set(previousFrameDetections.map(d => d.id))
      const newDetections = currentFrameDetections.filter(d => !previousIds.has(d.id) && !lastSpokenDetections.has(d.id))

      if (newDetections.length > 0 && (now - lastSpokenAt) > SPEECH_COOLDOWN) {
        Promise.all([...new Set(newDetections.map(d => d.signType))].map(code => fetchSignTypeInfo(code))).then(() => {
          if (!isVideoPlaying || videoPlayer.paused) return

          const names = newDetections.map(d => {
            const entry = signTypeNameMap.get(d.signType)
            return entry ? (useEnglishLabels ? (entry.name_en || entry.name_vi) : (entry.name_vi || entry.name_en)) : formatSignType(d.signType)
          }).filter(Boolean)

          const message = [...new Set(names)].join(', ')
          if (message) {
            speakText(message)
            newDetections.forEach(d => lastSpokenDetections.add(d.id))
            lastSpokenAt = now
            setTimeout(() => newDetections.forEach(d => lastSpokenDetections.delete(d.id)), 8000)
          }
        }).catch(() => { })
      }
    }

    document.querySelectorAll(".detection-item").forEach(item => {
      item.classList.toggle("active", Math.abs(parseFloat(item.dataset.timestamp) - currentVideoTime) < 0.5)
    })
  }

  function speakText(text) {
    if (!text?.trim() || !('speechSynthesis' in window)) return

    text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean).forEach(s => {
      const u = new SpeechSynthesisUtterance(s)
      u.lang = useEnglishLabels ? 'en-US' : 'vi-VN'
      u.rate = 0.9
      u.pitch = 1.0
      u.volume = 1.0
      if (vietnameseVoice && !useEnglishLabels) u.voice = vietnameseVoice
      u.onend = () => { }
      u.onerror = (ev) => console.warn('utterance error:', ev?.error)
      speechQueue.push(u)
    })

    processSpeechQueue()
  }

  function processSpeechQueue() {
    if (!('speechSynthesis' in window) || !isVideoPlaying || videoPlayer.paused) {
      speechQueue.length = 0
      return
    }

    if (window.speechSynthesis.speaking) return

    const next = speechQueue.shift()
    if (!next) return

    next.onend = () => setTimeout(processSpeechQueue, 50)
    next.onerror = () => setTimeout(processSpeechQueue, 50)

    if (isVideoPlaying && !videoPlayer.paused) {
      window.speechSynthesis.speak(next)
    } else {
      speechQueue.length = 0
    }
  }

  async function fetchSignTypeInfo(code) {
    if (!code || signTypeNameMap.has(code)) return signTypeNameMap.get(code)

    try {
      const stored = JSON.parse(localStorage.getItem(SIGN_TYPE_LS_KEY) || '{}')[code]
      if (stored && Date.now() - stored.storedAt < SIGN_TYPE_TTL) {
        signTypeNameMap.set(code, stored)
        return stored
      }
    } catch { }

    const result = await (window.apiFetch
      ? window.apiFetch(`/api/sign-type/${encodeURIComponent(code)}`)
      : fetch(`${CONFIG.API_BASE_URL}/api/sign-type/${encodeURIComponent(code)}`, {
        credentials: 'include'
      }).then(r => r.json().then(p => p.result || p)))

    const entry = {
      code,
      name_vi: result.name_vi || result.name,
      name_en: result.name_en || result.name,
      description: result.description || result.message || ''
    }

    signTypeNameMap.set(code, entry)

    try {
      const cache = JSON.parse(localStorage.getItem(SIGN_TYPE_LS_KEY) || '{}')
      cache[code] = { ...entry, storedAt: Date.now() }
      localStorage.setItem(SIGN_TYPE_LS_KEY, JSON.stringify(cache))
    } catch { }

    document.querySelectorAll(`.detection-item[data-sign-type="${code}"] .detection-type`).forEach(el => {
      el.textContent = entry.name_vi || entry.name_en || formatSignType(code)
    })

    return entry
  }

  function drawDetections() {
    ctx.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height)
    if (currentFrameDetections.length === 0) return

    const origW = currentFrameDetections.find(d => d.originalImageWidth)?.originalImageWidth || videoPlayer.videoWidth || 1280
    const origH = currentFrameDetections.find(d => d.originalImageHeight)?.originalImageHeight || videoPlayer.videoHeight || 720
    const scaleX = detectionCanvas.width / origW
    const scaleY = detectionCanvas.height / origH

    currentFrameDetections.forEach(d => {
      if (!d.bbox.width || !d.bbox.height) return

      const x = d.bbox.x * scaleX
      const y = d.bbox.y * scaleY
      const width = d.bbox.width * scaleX
      const height = d.bbox.height * scaleY

      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--neon').trim() || '#00FF9C'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, width, height)

      const label = `${getDisplaySignType(d.signType)} ${Math.round(d.confidence * 100)}%`
      ctx.font = "10px sans-serif"
      const textWidth = ctx.measureText(label).width
      const labelX = Math.max(x, 4)
      const labelY = Math.max(y - 24, 4)

      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--tech-blue').trim() || '#1D4ED8'
      ctx.fillRect(labelX, labelY, textWidth + 12, 20)
      ctx.fillStyle = "#ffffff"
      ctx.fillText(label, labelX + 6, labelY + 14)
    })
  }

  signTypeFilter.addEventListener("change", filterDetections)
  confidenceFilter.addEventListener("input", e => {
    confidenceValue.textContent = e.target.value + "%"
    filterDetections()
  })

  function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  function formatSignType(type) {
    return type.split("_").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ")
  }

  function getDisplaySignType(type) {
    const entry = signTypeNameMap.get(type)
    return entry?.name_vi || entry?.name_en || formatSignType(type)
  }

  loadVideoData()
})