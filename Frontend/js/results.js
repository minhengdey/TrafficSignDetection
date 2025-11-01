// Results page functionality
document.addEventListener("DOMContentLoaded", async () => {
  // Initialize auth helper if present, and guard all auth usage
  const haveAuth = window.auth && typeof window.auth.init === 'function'
  if (haveAuth) {
    await window.auth.init()
  }

  const isAuthenticated = window.auth && typeof window.auth.isAuthenticated === 'function'
    ? window.auth.isAuthenticated()
    : false

  // If the app expects auth to view results, redirect to login when not authenticated
  if (!isAuthenticated) {
    window.location.href = "login.html"
    return
  }

  // Update auth link defensively
  const authLink = document.getElementById("authLink")
  if (authLink) {
    if (isAuthenticated) {
      authLink.textContent = "Logout"
      authLink.addEventListener("click", (e) => {
        e.preventDefault()
        try { window.auth && window.auth.logout && window.auth.logout() } catch (err) { console.warn('logout failed', err) }
      })
    } else {
      authLink.textContent = "Login"
      authLink.href = "login.html"
    }
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
  let previousFrameDetections = [] // Track previous frame to detect new appearances
  
  // Track recently spoken detection ids to avoid repeating speech too often
  let lastSpokenDetections = new Set()
  let lastSpokenAt = 0
  const SPEECH_COOLDOWN = 1500 // ms: minimum time between speech announcements
  
  // Track if video is playing
  let isVideoPlaying = false
  let allowSpeech = false

  // Load voices early
  let voicesLoaded = false
  let vietnameseVoice = null
  const speechQueue = []
  
  // Map of sign type code -> display name fetched from backend (per-page, in-memory only)
  const signTypeNameMap = new Map()
  
  // Persistent sign-type cache key and TTL (ms)
  const SIGN_TYPE_LS_KEY = 'traffic_sign_type_cache_v1'
  const SIGN_TYPE_TTL = 24 * 60 * 60 * 1000 // 24 hours

  function loadVoices() {
    const voices = window.speechSynthesis.getVoices()
    console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`))

    // Tìm giọng tiếng Việt với độ ưu tiên cao hơn
    // Ưu tiên: Google > Microsoft > Native > Bất kỳ giọng vi-VN nào
    vietnameseVoice =
      // Ưu tiên giọng Google Vietnamese
      voices.find(v => v.lang === 'vi-VN' && /google/i.test(v.name)) ||
      voices.find(v => v.lang === 'vi_VN' && /google/i.test(v.name)) ||

      // Thử giọng Microsoft
      voices.find(v => v.lang === 'vi-VN' && /microsoft|azure/i.test(v.name)) ||

      // Bất kỳ giọng vi-VN nào
      voices.find(v => v.lang === 'vi-VN') ||
      voices.find(v => v.lang === 'vi_VN') ||

      // Tìm theo tên có chứa "vietnam" hoặc "vietnamese"
      voices.find(v => /vietnam|vietnamese/i.test(v.name)) ||

      // Bất kỳ giọng bắt đầu bằng 'vi'
      voices.find(v => v.lang && v.lang.toLowerCase().startsWith('vi')) ||

      // Fallback: giọng mặc định
      voices[0]

    if (vietnameseVoice) {
      console.log('✓ Selected Vietnamese voice:', vietnameseVoice.name, `(${vietnameseVoice.lang})`)
      voicesLoaded = true
    } else {
      console.warn('⚠ No Vietnamese voice found, using default voice')
      voicesLoaded = true
    }
  }

  // Load voices immediately
  if ('speechSynthesis' in window) {
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
  }

  // Immediately fetch video metadata (or use local session cache) and set video src so playback starts ASAP
  ; (async function quickSetVideoSrc() {
    try {
      if (!videoPlayer) return

      // Ask backend for the authoritative filepath and set src immediately
      if (videoId) {
        const metaResp = await fetch(CONFIG.API_BASE_URL + '/api/video/' + videoId, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
        if (metaResp.ok) {
          const metaPayload = await metaResp.json().catch(() => ({}))
          const meta = metaPayload.result || metaPayload
          // prefer presignedGetUrl when available
          const fileUrl = meta && (meta.presignedGetUrl || meta.presignedGet || meta.filepath || meta.filePath || meta.videoUrl)
          if (fileUrl) {
            const safe = encodeUrlForBrowser(fileUrl)
            videoPlayer.src = safe
            try { videoPlayer.load() } catch (e) { /* ignore */ }
          }
        }
      }
    } catch (err) {
      console.warn('quickSetVideoSrc failed', err)
    }
  })()

  // Helper: encode a URL so the browser won't request raw spaces or parentheses.
  // encodeURI doesn't encode parentheses in some engines, so replace them explicitly.
  function encodeUrlForBrowser(u) {
    if (!u) return u
    try {
      // Only fully-encode absolute http(s) URLs — leave relative paths as-is
      if (/^https?:\/\//i.test(u)) {
        return encodeURI(u).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/ /g, '%20')
      }
      // for data: or relative URLs, return as-is
      return u
    } catch (e) {
      return u
    }
  }

  // Load video data
  loadVideoData()

  // --- LocalStorage helpers for sign-type cache ---
  function loadSignTypeCacheFromStorage() {
    try {
      const raw = localStorage.getItem(SIGN_TYPE_LS_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      // purge expired entries
      const now = Date.now()
      const valid = {}
      Object.keys(parsed || {}).forEach((k) => {
        const e = parsed[k]
        if (!e) return
        if (!e.storedAt || (now - e.storedAt) > SIGN_TYPE_TTL) return
        valid[k] = e
      })
      return valid
    } catch (e) {
      return {}
    }
  }

  function saveSignTypeEntryToStorage(code, entry) {
    try {
      const raw = localStorage.getItem(SIGN_TYPE_LS_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      parsed[code] = Object.assign({}, entry, { storedAt: Date.now() })
      localStorage.setItem(SIGN_TYPE_LS_KEY, JSON.stringify(parsed))
    } catch (e) {
      // ignore quota errors
    }
  }

  async function loadVideoData() {
    try {
      // Request video metadata + detections from the backend at /api/video/{id}
      const response = await fetch(CONFIG.API_BASE_URL + '/api/video/' + videoId, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload && (payload.message || payload.error) || 'Failed to load results')
      // Support either flat or wrapped ApiResponse
      const result = payload.result || payload

      // Backend may return either 'frames' (VideoResult) or 'detections' (persisted Detection entities)
      if (result.frames && Array.isArray(result.frames)) {
        // frames: [{ frameIndex, timeSeconds, detectionJson }]
        const converted = []
        let originalImageWidth = null
        let originalImageHeight = null

        result.frames.forEach((frame) => {
          try {
            const parsed = frame.detectionJson ? JSON.parse(frame.detectionJson) : null
            if (parsed && Array.isArray(parsed.predictions)) {
              // record image size if available
              if (parsed.image && parsed.image.width) {
                originalImageWidth = parsed.image.width
                originalImageHeight = parsed.image.height
              }

              parsed.predictions.forEach((pred) => {
                // Roboflow returns center x,y in pixels for many models
                const px = Number(pred.x ?? pred.center_x ?? 0)
                const py = Number(pred.y ?? pred.center_y ?? 0)
                const pw = Number(pred.width ?? pred.w ?? pred.bbox?.width ?? 0)
                const ph = Number(pred.height ?? pred.h ?? pred.bbox?.height ?? 0)

                const topLeftX = px - pw / 2
                const topLeftY = py - ph / 2

                converted.push({
                  id: pred.detection_id || pred.id || `${frame.frameIndex}-${Math.random().toString(36).slice(2, 8)}`,
                  timestamp: Number(frame.timeSeconds ?? frame.time ?? 0),
                  signType: pred.class || pred.label || pred.name || pred.class_name || 'Unknown',
                  confidence: Number(pred.confidence ?? pred.score ?? 0),
                  bbox: {
                    x: topLeftX,
                    y: topLeftY,
                    width: pw,
                    height: ph,
                  },
                  // keep original frame image size so we can scale accurately
                  originalImageWidth,
                  originalImageHeight,
                })
              })
            }
          } catch (err) {
            console.warn('Failed to parse detectionJson for frame', frame.frameIndex, err)
          }
        })

        // Build a minimal videoData if not provided
        videoData = result.video || result.data || { id: videoId, filename: result.filename || ('video-' + videoId), duration: result.duration || 0, detectionCount: converted.length, videoUrl: result.videoUrl }
        detectionsData = converted
      } else if (result.detections && Array.isArray(result.detections)) {
        // Convert persisted Detection entities to the frontend format
        const converted = result.detections.map((d) => ({
          id: d.id || (`det-${Math.random().toString(36).slice(2, 8)}`),
          // Prefer an explicit timestamp if available (frameNumber -> approximate), otherwise 0
          timestamp: d.frameNumber != null ? Number(d.frameNumber) : 0,
          signType: (d.label) || (d.signType && (d.signType.name || d.signType.toString())) || 'Unknown',
          confidence: Number(d.confidence || 0),
          // pixel bbox values (may be zero/null if only normalized coords were stored)
          bbox: { x: Number(d.bboxX || 0), y: Number(d.bboxY || 0), width: Number(d.bboxW || 0), height: Number(d.bboxH || 0) },
          // original image size if backend provided it
          originalImageWidth: d.origImageWidth || d.orig_image_w || null,
          originalImageHeight: d.origImageHeight || d.orig_image_h || null,
        }))

        videoData = result || { id: videoId, filename: result.filename || ('video-' + videoId), duration: result.durationSeconds || result.duration || 0, detectionCount: converted.length, videoUrl: result.filepath || result.videoUrl }
        detectionsData = converted
      } else {
        // Fallback: use any available fields
        videoData = result.video || result.data || { id: videoId, filename: result.filename, duration: result.duration, detectionCount: (result.detections || []).length, videoUrl: result.videoUrl }
        detectionsData = result.detections || []
      }

      // Try to fetch authoritative video URL from backend: GET /api/video/{id}
      try {
        const metaResp = await fetch(CONFIG.API_BASE_URL + '/api/video/' + videoId, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
        if (metaResp.ok) {
          const metaPayload = await metaResp.json().catch(() => ({}))
          const meta = metaPayload.result || metaPayload || {}
          const fileUrl = meta && (meta.presignedGetUrl || meta.presignedGet || meta.filepath || meta.filePath || meta.videoUrl)
          if (fileUrl) {
            videoData.videoUrl = fileUrl
          } else {
            console.warn('GET /api/video/{id} returned no usable file URL', meta)
          }
        } else {
          console.warn('GET /api/video/{id} returned', metaResp.status)
        }
      } catch (err) {
        console.warn('Failed to fetch /api/video/{id}', err)
      }

      // Update UI
      videoFilename.textContent = videoData.filename
      detectionCount.textContent = `${videoData.detectionCount} detections`
      videoDuration.textContent = formatDuration(videoData.duration)

      // Set video source
      if (videoData && videoData.videoUrl) {
        videoPlayer.src = encodeUrlForBrowser(videoData.videoUrl)
      } else {
        console.warn('No video URL available for videoId=', videoId)
      }

      // Prefetch sign-type names for all detected sign codes
      try {
        const uniqueCodes = [...new Set(detectionsData.map((d) => d.signType))].filter(Boolean)
        await Promise.all(uniqueCodes.map((c) => fetchSignTypeInfo(c).catch(() => null)))
      } catch (e) {
        console.warn('Failed to prefetch sign-type info', e)
      }

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

  // Populate sign type filter
  function populateSignTypeFilter() {
    const signTypes = [...new Set(detectionsData.map((d) => d.signType))].sort()

    signTypes.forEach((type) => {
      const option = document.createElement("option")
      option.value = type
      option.textContent = getDisplaySignType(type)
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
        (detection) => {
          const displayType = getDisplaySignType(detection.signType)
          return `
      <div class="detection-item" data-id="${detection.id}" data-timestamp="${detection.timestamp}" data-sign-type="${detection.signType}">
        <div class="detection-thumbnail">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
          </svg>
        </div>
        <div class="detection-content">
          <div class="detection-header">
            <span class="detection-type">${displayType}</span>
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
          `
        }
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

    // Enable speech and drawing when video plays
    videoPlayer.addEventListener("play", () => {
      isVideoPlaying = true
      allowSpeech = true
      requestAnimationFrame(drawLoop)
    })

    // Stop speech when video pauses
    videoPlayer.addEventListener("pause", () => {
      isVideoPlaying = false
      // Cancel all ongoing speech when video pauses
      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel()
          speechQueue.length = 0 // Clear queue
        }
      } catch (e) {
        console.warn('Failed to cancel speech on pause', e)
      }
    })

    // Stop speech when video ends
    videoPlayer.addEventListener("ended", () => {
      isVideoPlaying = false
      allowSpeech = false
      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel()
          speechQueue.length = 0
        }
      } catch (e) {
        console.warn('Failed to cancel speech on end', e)
      }
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

    // Store previous frame detections
    previousFrameDetections = [...currentFrameDetections]

    currentFrameDetections = filteredDetections.filter((detection) => {
      return Math.abs(detection.timestamp - currentVideoTime) < timeWindow
    })

    if (currentFrameDetections.length > 0) {
      const types = currentFrameDetections
        .map((d) => getDisplaySignType(d.signType))
        .join(", ")
      currentDetections.textContent = `Detected: ${types}`
      currentDetections.style.color = "var(--accent-blue)"
    } else {
      currentDetections.textContent = "No detections at this time"
      currentDetections.style.color = "var(--text-secondary)"
    }

    // --- Speak new detections ONLY when they first appear in frame ---
    if (allowSpeech && isVideoPlaying && !videoPlayer.paused) {
      try {
        const now = Date.now()
        
        // Find truly NEW detections (not in previous frame)
        const previousIds = new Set(previousFrameDetections.map(d => d.id))
        const newDetections = currentFrameDetections.filter(d => 
          !previousIds.has(d.id) && !lastSpokenDetections.has(d.id)
        )

        if (newDetections.length > 0 && (now - lastSpokenAt) > SPEECH_COOLDOWN) {
          // Ensure sign-type info is available
          const uniqueCodes = [...new Set(newDetections.map(d => d.signType))]
          
          Promise.all(uniqueCodes.map(code => fetchSignTypeInfo(code))).then((infos) => {
            // Only proceed if video is still playing
            if (!isVideoPlaying || videoPlayer.paused) return
            
            // Build localized names for speech
            const namesForSpeech = []
            newDetections.forEach(detection => {
              const entry = signTypeNameMap.get(detection.signType)
              let name = null
              if (entry) {
                name = vietnameseVoice ? (entry.name_vi || entry.name_en) : (entry.name_en || entry.name_vi)
              }
              if (!name) {
                name = formatSignType(detection.signType)
              }
              if (name) namesForSpeech.push(name)
            })

            const message = [...new Set(namesForSpeech)].join(', ')
            if (message && message.length > 0) {
              // // Announce with preface
              // try {
              //   speakText(vietnameseVoice ? 'Phát hiện' : 'Attention')
              // } catch (e) { /* ignore */ }
              
              // Speak the sign names
              setTimeout(() => {
                if (isVideoPlaying && !videoPlayer.paused) {
                  try { speakText(message) } catch (e) { /* ignore */ }
                }
              }, 0)

              // Mark as spoken
              newDetections.forEach(d => lastSpokenDetections.add(d.id))
              lastSpokenAt = now
              
              // Clear spoken status after some time
              setTimeout(() => { 
                newDetections.forEach(d => lastSpokenDetections.delete(d.id))
              }, 8000)
            }
          }).catch(() => { /* ignore fetch errors for speech */ })
        }
      } catch (err) {
        console.warn('Speech synth failed', err)
      }
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

  // Speak text using the browser's Web Speech API — queued to avoid interruption.
  function speakText(text) {
    if (!text || !text.trim()) {
      console.log('speakText: empty text')
      return
    }

    try {
      if (!('speechSynthesis' in window)) {
        console.warn('Speech Synthesis not supported')
        return
      }

      // Split long text into sentence-sized chunks
      const sentences = text
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(Boolean)

      // Create utterances for each chunk and enqueue
      sentences.forEach((s) => {
        try {
          const u = new SpeechSynthesisUtterance(s)
          u.lang = 'vi-VN'
          u.rate = 0.9
          u.pitch = 1.0
          u.volume = 1.0
          u._triedFallback = false

          // Prefer pre-selected vietnameseVoice if available
          if (vietnameseVoice) {
            u.voice = vietnameseVoice
          } else {
            const voices = window.speechSynthesis.getVoices() || []
            const preferred = voices.find(v => /vi|vietnam|vietnamese/i.test(v.name)) || voices.find(v => v.lang === 'vi-VN') || voices[0]
            if (preferred) u.voice = preferred
          }

          u.onstart = () => { /* noop */ }
          u.onend = () => { /* handled in processSpeechQueue */ }

          u.onerror = (ev) => {
            console.warn('utterance.onerror:', ev && ev.error, 'text:', s)
            try {
              if (!u._triedFallback) {
                u._triedFallback = true
                const fallback = new SpeechSynthesisUtterance(s)
                fallback.lang = 'vi-VN'
                fallback.rate = 0.9
                fallback.pitch = 1.0
                fallback.volume = 1.0
                fallback.onend = () => { /* noop */ }
                fallback.onerror = (e2) => { console.warn('fallback utterance error', e2 && e2.error) }
                try { window.speechSynthesis.speak(fallback) } catch (e) { /* ignore */ }
              }
            } catch (e) { /* ignore fallback failures */ }
          }

          speechQueue.push(u)
        } catch (e) {
          console.warn('Failed creating utterance for sentence', s, e)
        }
      })

      // Start processing queue if idle
      processSpeechQueue()
    } catch (err) {
      console.error('speakText error:', err)
    }
  }

  // Process queued utterances sequentially
  function processSpeechQueue() {
    if (!('speechSynthesis' in window)) return
    
    // Don't process queue if video is not playing
    if (!isVideoPlaying || videoPlayer.paused) {
      // Clear queue when video stops
      speechQueue.length = 0
      return
    }
    
    try {
      // If speech is ongoing, wait until it finishes
      if (window.speechSynthesis.speaking) return

      const next = speechQueue.shift()
      if (!next) return

      next.onend = () => {
        try { setTimeout(processSpeechQueue, 50) } catch (e) { /* ignore */ }
      }

      next.onerror = (e) => {
        console.warn('queued utterance error', e && e.error, 'text:', next.text)
        try {
          if (!next._triedFallback && isVideoPlaying && !videoPlayer.paused) {
            next._triedFallback = true
            const fb = new SpeechSynthesisUtterance(next.text)
            fb.lang = next.lang || 'vi-VN'
            fb.rate = next.rate || 0.9
            fb.pitch = next.pitch || 1.0
            fb.volume = next.volume || 1.0
            fb.onend = () => { try { setTimeout(processSpeechQueue, 50) } catch (ex) { /* ignore */ } }
            fb.onerror = (e2) => { console.warn('fallback queued utterance error', e2 && e2.error); try { setTimeout(processSpeechQueue, 50) } catch (ex) { } }
            try { window.speechSynthesis.speak(fb) } catch (ex) { setTimeout(processSpeechQueue, 50) }
            return
          }
        } catch (err) { /* swallow any fallback errors */ }
        try { setTimeout(processSpeechQueue, 50) } catch (err) { /* ignore */ }
      }

      try {
        // Final check before speaking
        if (isVideoPlaying && !videoPlayer.paused) {
          window.speechSynthesis.speak(next)
        } else {
          // Video stopped, clear queue
          speechQueue.length = 0
        }
      } catch (err) {
        console.warn('speechSynthesis.speak threw', err)
        try { setTimeout(processSpeechQueue, 50) } catch (e) { /* ignore */ }
      }
    } catch (err) {
      console.warn('processSpeechQueue failed', err)
    }
  }

  // Fetch sign-type info from backend
  async function fetchSignTypeInfo(code) {
    if (!code) return null
    try {
      // First check in-memory map
      try { 
        const existing = signTypeNameMap.get(code)
        if (existing) return existing 
      } catch (e) { }

      // Next check localStorage cache
      try {
        const stored = loadSignTypeCacheFromStorage()[code]
        if (stored) {
          signTypeNameMap.set(code, { code, name_vi: stored.name_vi, name_en: stored.name_en, description: stored.description })
          return signTypeNameMap.get(code)
        }
      } catch (e) { /* ignore */ }

      const resp = await fetch(`${CONFIG.API_BASE_URL}/api/sign-type/${encodeURIComponent(code)}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      const payload = await resp.json().catch(() => ({}))
      const result = payload.result || payload || {}
      
      const name_vi = result.name_vi || result.name || null
      const name_en = result.name_en || result.name || null
      const description = result.description || result.message || ''
      
      // Store in per-page map
      try { 
        signTypeNameMap.set(code, { code, name_vi, name_en, description }) 
      } catch (e) { /* ignore */ }
      
      // Persist to localStorage
      try { 
        saveSignTypeEntryToStorage(code, { name_vi, name_en, description }) 
      } catch (e) { /* ignore */ }
      
      // Update rendered list items
      try {
        const display = (name_vi || name_en) ? (name_vi || name_en) : formatSignType(code)
        document.querySelectorAll(`.detection-item[data-sign-type="${code}"] .detection-type`).forEach((el) => {
          el.textContent = display
        })
      } catch (err) { /* ignore DOM update errors */ }
      
      return { code, name_vi, name_en, description }
    } catch (err) {
      console.warn('Failed to fetch sign-type', code, err)
      return null
    }
  }

  // Draw detections on canvas
  function drawDetections() {
    // Clear canvas
    ctx.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height)

    if (currentFrameDetections.length === 0) return

    // Calculate scale factors
    let origW = null
    let origH = null
    if (currentFrameDetections.length > 0) {
      origW = currentFrameDetections.find(d => d.originalImageWidth)?.originalImageWidth || null
      origH = currentFrameDetections.find(d => d.originalImageHeight)?.originalImageHeight || null
    }
    origW = origW || videoPlayer.videoWidth || detectionCanvas.width || 1280
    origH = origH || videoPlayer.videoHeight || detectionCanvas.height || 720

    const scaleX = detectionCanvas.width / origW
    const scaleY = detectionCanvas.height / origH

    currentFrameDetections.forEach((detection) => {
      let bbox = detection.bbox

      // Skip if pixel bbox is missing or zero-sized
      if (bbox.width == null || bbox.width === 0 || bbox.height == null || bbox.height === 0) {
        return
      }

      const x = bbox.x * scaleX
      const y = bbox.y * scaleY
      const width = bbox.width * scaleX
      const height = bbox.height * scaleY

      // Draw bounding box
      ctx.strokeStyle = "#3b82f6"
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, width, height)

      // Draw label background
      const label = getSignTypeDescription(detection.signType)
      const confidence = Math.round(detection.confidence * 100) + "%"
      const labelText = `${label} ${confidence}`

      ctx.font = "10px sans-serif"
      const textMetrics = ctx.measureText(labelText)
      const textWidth = textMetrics.width
      const textHeight = 16

      // Ensure label draws within canvas bounds
      const labelX = Math.max(x, 4)
      const labelY = Math.max(y - textHeight - 8, 4)

      ctx.fillStyle = "rgba(59, 130, 246, 0.9)"
      ctx.fillRect(labelX, labelY, textWidth + 12, textHeight + 4)

      // Draw label text
      ctx.fillStyle = "#ffffff"
      ctx.fillText(labelText, labelX + 6, labelY + 14)
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

  // Return the display name for a sign type code
  function getDisplaySignType(type) {
    if (!type) return ''
    try {
      const entry = signTypeNameMap.get(type)
      if (entry) return entry.name_vi || entry.name_en || formatSignType(type)
    } catch (e) { /* ignore */ }
    return formatSignType(type)
  }

  // Return description for a sign type code (used on-canvas)
  function getSignTypeDescription(type) {
    if (!type) return ''
    try {
      const entry = signTypeNameMap.get(type)
      if (entry) return entry.description || entry.name_vi || entry.name_en || formatSignType(type)
    } catch (e) { /* ignore */ }
    return formatSignType(type)
  }

  function getConfidenceClass(confidence) {
    if (confidence >= 0.9) return "high"
    if (confidence >= 0.7) return "medium"
    return "low"
  }
})