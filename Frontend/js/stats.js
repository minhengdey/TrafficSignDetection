document.addEventListener("DOMContentLoaded", async () => {
    if (window.auth && typeof window.auth.init === 'function') await window.auth.init()

    if (!window.auth.isAuthenticated()) {
        window.location.href = "login.html"
        return
    }
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

    let detectionsChart = null
    let signTypesChart = null
    let confidenceChart = null
    let processingChart = null

    loadStatistics()

    async function loadStatistics() {
        const timeRange = timeRangeFilter.value

        try {
            let statsData = null
            if (!(window.auth && typeof window.auth.isAdmin === 'function' && window.auth.isAdmin())) {
                showStatsError('Insufficient permissions to view statistics. Admin role required.')
                return
            }

            const endpoints = CONFIG.ENDPOINTS || {}
            const overviewPath = endpoints.ADMIN_STATS_OVERVIEW || endpoints.STATS || '/api/admin/stats/overview'
            const detectionsPath = endpoints.ADMIN_STATS_DETECTIONS_OVER_TIME || '/api/admin/stats/detections-over-time'
            const topSignsPath = endpoints.ADMIN_STATS_TOP_SIGNS || '/api/admin/stats/top-signs'
            const videosByStatusPath = endpoints.ADMIN_STATS_VIDEOS_BY_STATUS || '/api/admin/stats/videos-by-status'

            const urls = [overviewPath, detectionsPath, topSignsPath, videosByStatusPath].map(p => `${CONFIG.API_BASE_URL}${p}`)

            const responses = await Promise.all(urls.map(u => fetch(u + `?range=${timeRange}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' } })))

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

            statsData = {
                summary: {
                    totalVideos: overview && Number(overview.totalVideos) ? Number(overview.totalVideos) : 0,
                    totalDetections: overview && Number(overview.totalDetections) ? Number(overview.totalDetections) : 0,
                    avgConfidence: overview && Number(overview.avgConfidence) ? Number(overview.avgConfidence) : 0,
                    uniqueSigns: overview && Number(overview.totalSignTypes) ? Number(overview.totalSignTypes) : 0,
                    changes: {
                        videos: 0,
                        detections: 0,
                        confidence: 0,
                    },
                },
                charts: {
                    dailyData: (detectionsOverTime && Array.isArray(detectionsOverTime.labels) && Array.isArray(detectionsOverTime.values))
                        ? detectionsOverTime.labels.map((label, i) => ({ date: label, detections: detectionsOverTime.values[i] || 0 }))
                        : [],
                    signTypes: (topSigns && Array.isArray(topSigns.labels) && Array.isArray(topSigns.values))
                        ? topSigns.labels.reduce((acc, lbl, i) => { acc[lbl] = topSigns.values[i] || 0; return acc }, {})
                        : {},
                    confidenceDistribution: {},
                    processingTime: [],
                    videosByStatus: (videosByStatus && Array.isArray(videosByStatus.labels) && Array.isArray(videosByStatus.values))
                        ? { labels: videosByStatus.labels, values: videosByStatus.values }
                        : { labels: [], values: [] },
                },
                recentActivity: [],
            }
            updateSummaryCards(statsData.summary)
            renderCharts(statsData.charts)
            renderActivity(statsData.recentActivity)
        } catch (error) {
            console.error("Failed to load statistics:", error)
        }
    }

    function updateSummaryCards(summary) {
        totalVideos.textContent = summary.totalVideos.toLocaleString()
        totalDetections.textContent = summary.totalDetections.toLocaleString()
        avgConfidence.textContent = summary.avgConfidence + "%"
        uniqueSigns.textContent = summary.uniqueSigns

        videosChange.textContent = `+${summary.changes.videos}%`
        detectionsChange.textContent = `+${summary.changes.detections}%`
        confidenceChange.textContent = `+${summary.changes.confidence}%`
    }

    function renderCharts(chartsData) {
        if (detectionsChart) detectionsChart.destroy()
        if (signTypesChart) signTypesChart.destroy()
        if (confidenceChart) confidenceChart.destroy()
        if (processingChart) processingChart.destroy()

        const chartDefaults = {
            color: getComputedStyle(document.documentElement).getPropertyValue("--text-secondary").trim(),
            borderColor: getComputedStyle(document.documentElement).getPropertyValue("--border-color").trim(),
        }

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
            const el = document.getElementById('confidenceChart')
            if (el && el.getContext) {
                const ctx = el.getContext('2d')
                ctx.clearRect(0, 0, el.width, el.height)
            }
        }

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
            if (container === document.body) container.innerHTML = html
            else container.innerHTML = html
        } catch (e) {
            console.error('Failed to render stats error UI', e)
        }
    }

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
