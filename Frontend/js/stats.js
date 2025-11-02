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
                // In LIVE mode, backend exposes admin stats under /api/admin/stats/* and requires ADMIN role.
                // Only call admin endpoints if user is admin; otherwise surface permission error.
                if (!(window.auth && typeof window.auth.isAdmin === 'function' && window.auth.isAdmin())) {
                    // Show friendly message instead of throwing so UI can render guidance
                    showStatsError('Insufficient permissions to view statistics. Admin role required.')
                    return
                }

                // Fetch admin stats endpoints in parallel
                const endpoints = CONFIG.ENDPOINTS || {}
                // Use configured admin endpoints when available; fall back to hardcoded admin paths
                const overviewPath = endpoints.ADMIN_STATS_OVERVIEW || endpoints.STATS || '/api/admin/stats/overview'
                const detectionsPath = endpoints.ADMIN_STATS_DETECTIONS_OVER_TIME || '/api/admin/stats/detections-over-time'
                const topSignsPath = endpoints.ADMIN_STATS_TOP_SIGNS || '/api/admin/stats/top-signs'
                const videosByStatusPath = endpoints.ADMIN_STATS_VIDEOS_BY_STATUS || '/api/admin/stats/videos-by-status'

                const urls = [overviewPath, detectionsPath, topSignsPath, videosByStatusPath].map(p => `${CONFIG.API_BASE_URL}${p}`)

                const responses = await Promise.all(urls.map(u => fetch(u + `?range=${timeRange}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' } })))

                // check for any 403/401 early
                for (const r of responses) {
                    if (!r.ok) {
                        if (r.status === 403 || r.status === 401) {
                            showStatsError('Insufficient permissions to view statistics (server returned 403). Please login as admin.')
                            return
                        }
                        showStatsError('Failed to load stats from server (status ' + r.status + ')')
                        return
                    }
                }

                const payloads = await Promise.all(responses.map(r => r.json().catch(() => ({}))))

                const overview = payloads[0] && (payloads[0].result || payloads[0])
                const detectionsOverTime = payloads[1] && (payloads[1].result || payloads[1])
                const topSigns = payloads[2] && (payloads[2].result || payloads[2])
                const videosByStatus = payloads[3] && (payloads[3].result || payloads[3])

                // Normalize into the statsData shape expected by the page
                // AdminStatsService returns simple maps. Map them into the frontend conventions.
                statsData = {
                    summary: {
                        totalVideos: overview && Number(overview.totalVideos) ? Number(overview.totalVideos) : 0,
                        totalDetections: overview && Number(overview.totalDetections) ? Number(overview.totalDetections) : 0,
                        // avgConfidence not provided by backend; show 0 as placeholder
                        avgConfidence: overview && Number(overview.avgConfidence) ? Number(overview.avgConfidence) : 0,
                        uniqueSigns: overview && Number(overview.totalSignTypes) ? Number(overview.totalSignTypes) : 0,
                        changes: {
                            videos: 0,
                            detections: 0,
                            confidence: 0,
                        },
                    },
                    charts: {
                        // detectionsOverTime -> { labels: [], values: [] }
                        dailyData: (detectionsOverTime && Array.isArray(detectionsOverTime.labels) && Array.isArray(detectionsOverTime.values))
                            ? detectionsOverTime.labels.map((label, i) => ({ date: label, detections: detectionsOverTime.values[i] || 0 }))
                            : [],
                        // topSigns -> { labels: [], values: [] } -> convert to object { LABEL: count }
                        signTypes: (topSigns && Array.isArray(topSigns.labels) && Array.isArray(topSigns.values))
                            ? topSigns.labels.reduce((acc, lbl, i) => { acc[lbl] = topSigns.values[i] || 0; return acc }, {})
                            : {},
                        // confidenceDistribution not provided by AdminStatsService
                        confidenceDistribution: {},
                        // videosByStatus -> { labels: [], values: [] } -> this is NOT processing time; keep as status chart data
                        processingTime: [],
                        videosByStatus: (videosByStatus && Array.isArray(videosByStatus.labels) && Array.isArray(videosByStatus.values))
                            ? { labels: videosByStatus.labels, values: videosByStatus.values }
                            : { labels: [], values: [] },
                    },
                    recentActivity: [],
                }
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
                        borderColor: "#1D4ED8",
                        backgroundColor: "rgba(29, 78, 216, 0.08)",
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
                        backgroundColor: ["#1D4ED8", "#22c55e", "#FACC15", "#8b5cf6", "#DC2626", "#06b6d4", "#ec4899", "#6366f1"],
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

        // Confidence Distribution Chart — render only if data present
        if (chartsData.confidenceDistribution && Object.keys(chartsData.confidenceDistribution).length > 0) {
            const confidenceCtx = document.getElementById("confidenceChart").getContext("2d")
            confidenceChart = new window.Chart(confidenceCtx, {
                type: "bar",
                data: {
                    labels: Object.keys(chartsData.confidenceDistribution),
                    datasets: [
                        {
                            label: "Detections",
                            data: Object.values(chartsData.confidenceDistribution),
                            backgroundColor: "#22c55e",
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
        } else {
            // clear placeholder or leave empty if no data
            const el = document.getElementById('confidenceChart')
            if (el && el.getContext) {
                const ctx = el.getContext('2d')
                ctx.clearRect(0, 0, el.width, el.height)
            }
        }

        // Processing Time Chart — render only if processingTime has data
        if (chartsData.processingTime && chartsData.processingTime.length > 0) {
            const processingCtx = document.getElementById("processingChart").getContext("2d")
            processingChart = new window.Chart(processingCtx, {
                type: "line",
                data: {
                    labels: chartsData.processingTime.map((d) => formatChartDate(d.date)),
                    datasets: [
                        {
                            label: "Avg Time (seconds)",
                            data: chartsData.processingTime.map((d) => Number(d.avgTime).toFixed(1)),
                            borderColor: "#FACC15",
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
        } else {
            const el = document.getElementById('processingChart')
            if (el && el.getContext) {
                const ctx = el.getContext('2d')
                ctx.clearRect(0, 0, el.width, el.height)
            }
        }
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

    function showStatsError(message) {
        try {
            const container = document.getElementById('statsContainer') || document.body
            const html = `
        <div style="padding:24px; border:1px solid #f3e6e6; background:#fff6f6; color:#b91c1c; border-radius:6px;">
          <h3 style="margin-top:0">Statistics unavailable</h3>
          <p>${message}</p>
          <p>If you are an admin, ensure you are logged in and the backend is running. Check browser DevTools → Network for failing requests.</p>
        </div>
      `
            // replace main area
            if (container === document.body) container.innerHTML = html
            else container.innerHTML = html
        } catch (e) {
            console.error('Failed to render stats error UI', e)
        }
    }

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
