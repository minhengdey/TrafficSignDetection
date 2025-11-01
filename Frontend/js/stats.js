// Statistics page functionality
document.addEventListener("DOMContentLoaded", async () => {
  if (window.auth && typeof window.auth.init === 'function') await window.auth.init()

  // Check authentication
  if (!window.auth.isAuthenticated()) {
    window.location.href = "login.html"
    return
  }

  // Update auth link - removed; navbar is handled by nav.js
  // const authLink = document.getElementById("authLink")
  // if (typeof auth !== "undefined" && auth.isAuthenticated()) {
  //   authLink.textContent = "Logout"
  //   authLink.addEventListener("click", (e) => {
  //     e.preventDefault()
  //     auth.logout()
  //   })
  // } else {
  //   authLink.textContent = "Login"
  //   authLink.href = "login.html"
  // }

  // Elements
  const timeRangeFilter = document.getElementById("timeRangeFilter")
  const totalVideos = document.getElementById("totalVideos")
  const totalDetections = document.getElementById("totalDetections")
  const avgConfidence = document.getElementById("avgConfidence")
  const uniqueSigns = document.getElementById("uniqueSigns")
  const videosChange = document.getElementById("videosChange")
  const detectionsChange = document.getElementById("detectionsChange")
  const confidenceChange = document.getElementById("confidenceChange")
  const signsChange = document.getElementById("signsChange")
  const activityList = document.getElementById("activityList")

  // Chart instances
  let detectionsChart = null
  let signTypesChart = null
  let confidenceChart = null
  let processingChart = null

  // Load statistics
  loadStatistics()

  async function loadStatistics() {
    const timeRange = timeRangeFilter.value

    try {
      let statsData = null

      if (CONFIG.MODE === "MOCK") {
        statsData = generateMockStats(timeRange)
      } else {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.STATS}?range=${timeRange}`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload && (payload.message || payload.error) || 'Failed to load stats')
        statsData = (payload.result || payload)
      }

      updateSummaryCards(statsData.summary)
      renderCharts(statsData.charts)
      renderActivity(statsData.recentActivity)
    } catch (error) {
      console.error("Failed to load statistics:", error)
    }
  }

  // Generate mock statistics
  function generateMockStats(timeRange) {
    const days = timeRange === "all" ? 90 : Number.parseInt(timeRange)

    // Generate daily data
    const dailyData = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      dailyData.push({
        date: date.toISOString().split("T")[0],
        detections: Math.floor(Math.random() * 50) + 20,
        videos: Math.floor(Math.random() * 5) + 1,
      })
    }

    // Sign types data
    const signTypes = {
      STOP: 145,
      SPEED_LIMIT_50: 132,
      YIELD: 98,
      NO_ENTRY: 87,
      ONE_WAY: 76,
      PEDESTRIAN_CROSSING: 65,
      TURN_RIGHT: 54,
      PARKING: 43,
    }

    // Confidence distribution
    const confidenceDistribution = {
      "90-100%": 420,
      "80-90%": 280,
      "70-80%": 150,
      "60-70%": 80,
      "Below 60%": 30,
    }

    // Processing time data
    const processingTime = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      processingTime.push({
        date: date.toISOString().split("T")[0],
        avgTime: Math.random() * 30 + 15,
      })
    }

    // Recent activity
    const recentActivity = [
      {
        id: 1,
        type: "video_processed",
        filename: "highway_traffic.mp4",
        detections: 23,
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      },
      {
        id: 2,
        type: "video_processed",
        filename: "city_intersection.mp4",
        detections: 18,
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      },
      {
        id: 3,
        type: "video_processed",
        filename: "suburban_road.mp4",
        detections: 12,
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      },
      {
        id: 4,
        type: "video_processed",
        filename: "parking_lot.mp4",
        detections: 8,
        timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      },
    ]

    const totalDetections = dailyData.reduce((sum, d) => sum + d.detections, 0)
    const totalVideos = dailyData.reduce((sum, d) => sum + d.videos, 0)

    return {
      summary: {
        totalVideos: totalVideos,
        totalDetections: totalDetections,
        avgConfidence: 87,
        uniqueSigns: Object.keys(signTypes).length,
        changes: {
          videos: 12,
          detections: 18,
          confidence: 3,
        },
      },
      charts: {
        dailyData,
        signTypes,
        confidenceDistribution,
        processingTime,
      },
      recentActivity,
    }
  }

  // Update summary cards
  function updateSummaryCards(summary) {
    totalVideos.textContent = summary.totalVideos.toLocaleString()
    totalDetections.textContent = summary.totalDetections.toLocaleString()
    avgConfidence.textContent = summary.avgConfidence + "%"
    uniqueSigns.textContent = summary.uniqueSigns

    videosChange.textContent = `+${summary.changes.videos}%`
    detectionsChange.textContent = `+${summary.changes.detections}%`
    confidenceChange.textContent = `+${summary.changes.confidence}%`
  }

  // Render charts
  function renderCharts(chartsData) {
    // Destroy existing charts
    if (detectionsChart) detectionsChart.destroy()
    if (signTypesChart) signTypesChart.destroy()
    if (confidenceChart) confidenceChart.destroy()
    if (processingChart) processingChart.destroy()

    // Chart.js default config
    const chartDefaults = {
      color: getComputedStyle(document.documentElement).getPropertyValue("--text-secondary").trim(),
      borderColor: getComputedStyle(document.documentElement).getPropertyValue("--border-color").trim(),
    }

    // Detections Over Time Chart
    const detectionsCtx = document.getElementById("detectionsChart").getContext("2d")
    detectionsChart = new window.Chart(detectionsCtx, {
      type: "line",
      data: {
        labels: chartsData.dailyData.map((d) => formatChartDate(d.date)),
        datasets: [
          {
            label: "Detections",
            data: chartsData.dailyData.map((d) => d.detections),
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: chartDefaults.borderColor,
            },
          },
          x: {
            grid: {
              display: false,
            },
          },
        },
      },
    })

    // Sign Types Chart
    const signTypesCtx = document.getElementById("signTypesChart").getContext("2d")
    signTypesChart = new window.Chart(signTypesCtx, {
      type: "doughnut",
      data: {
        labels: Object.keys(chartsData.signTypes).map(formatSignType),
        datasets: [
          {
            data: Object.values(chartsData.signTypes),
            backgroundColor: ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#6366f1"],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
          },
        },
      },
    })

    // Confidence Distribution Chart
    const confidenceCtx = document.getElementById("confidenceChart").getContext("2d")
    confidenceChart = new window.Chart(confidenceCtx, {
      type: "bar",
      data: {
        labels: Object.keys(chartsData.confidenceDistribution),
        datasets: [
          {
            label: "Detections",
            data: Object.values(chartsData.confidenceDistribution),
            backgroundColor: "#10b981",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: chartDefaults.borderColor,
            },
          },
          x: {
            grid: {
              display: false,
            },
          },
        },
      },
    })

    // Processing Time Chart
    const processingCtx = document.getElementById("processingChart").getContext("2d")
    processingChart = new window.Chart(processingCtx, {
      type: "line",
      data: {
        labels: chartsData.processingTime.map((d) => formatChartDate(d.date)),
        datasets: [
          {
            label: "Avg Time (seconds)",
            data: chartsData.processingTime.map((d) => d.avgTime.toFixed(1)),
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.1)",
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: chartDefaults.borderColor,
            },
          },
          x: {
            grid: {
              display: false,
            },
          },
        },
      },
    })
  }

  // Render activity
  function renderActivity(activities) {
    if (activities.length === 0) {
      activityList.innerHTML = `
        <div class="empty-activity">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
          </svg>
          <p>No recent activity</p>
        </div>
      `
      return
    }

    activityList.innerHTML = activities
      .map(
        (activity) => `
      <div class="activity-item">
        <div class="activity-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </div>
        <div class="activity-content">
          <div class="activity-title">${activity.filename}</div>
          <div class="activity-meta">
            <span>${formatActivityTime(activity.timestamp)}</span>
            <span class="separator">•</span>
            <span class="activity-badge">${activity.detections} detections</span>
          </div>
        </div>
      </div>
    `,
      )
      .join("")
  }

  // Time range filter
  timeRangeFilter.addEventListener("change", loadStatistics)

  // Utility functions
  function formatChartDate(dateString) {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  function formatSignType(type) {
    return type
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ")
  }

  function formatActivityTime(timestamp) {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }
})
