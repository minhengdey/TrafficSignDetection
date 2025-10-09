// Configuration for API mode
const CONFIG = {
  // Set to 'MOCK' for offline testing with fake data
  // Set to 'LIVE' to connect to real backend API
  MODE: "MOCK",

  // API endpoints (used in LIVE mode)
  API_BASE_URL: "http://localhost:8000/api",

  ENDPOINTS: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    UPLOAD: "/videos/upload",
    VIDEO_STATUS: "/videos/:id/status",
    VIDEO_RESULTS: "/videos/:id/results",
    VIDEOS_LIST: "/videos",
    STATS: "/stats",
  },
}

// Mock data for testing
const MOCK_DATA = {
  users: [
    { email: "demo@example.com", username: "demouser", password: "demo123", token: "mock-token-demo" },
    { email: "test@example.com", username: "testuser", password: "test123", token: "mock-token-test" },
  ],

  videos: [
    {
      id: "video-1",
      filename: "traffic_video_1.mp4",
      status: "completed",
      uploadedAt: "2025-01-15T10:30:00Z",
      processedAt: "2025-01-15T10:32:00Z",
      duration: 45,
      detectionCount: 23,
    },
    {
      id: "video-2",
      filename: "highway_recording.mp4",
      status: "completed",
      uploadedAt: "2025-01-14T15:20:00Z",
      processedAt: "2025-01-14T15:23:00Z",
      duration: 120,
      detectionCount: 67,
    },
  ],

  detections: {
    "video-1": [
      {
        id: "det-1",
        timestamp: 2.5,
        signType: "STOP",
        confidence: 0.95,
        bbox: { x: 120, y: 80, width: 60, height: 60 },
      },
      {
        id: "det-2",
        timestamp: 5.8,
        signType: "SPEED_LIMIT_50",
        confidence: 0.92,
        bbox: { x: 200, y: 100, width: 50, height: 50 },
      },
      {
        id: "det-3",
        timestamp: 8.2,
        signType: "YIELD",
        confidence: 0.88,
        bbox: { x: 150, y: 120, width: 55, height: 55 },
      },
    ],
  },

  stats: {
    totalVideos: 15,
    totalDetections: 342,
    averageConfidence: 0.89,
    signTypeDistribution: {
      STOP: 45,
      SPEED_LIMIT_50: 38,
      YIELD: 32,
      NO_ENTRY: 28,
      ONE_WAY: 25,
      PEDESTRIAN_CROSSING: 42,
      TRAFFIC_LIGHT: 67,
      PARKING: 35,
      TURN_RIGHT: 30,
    },
    processingTimes: [12, 15, 18, 14, 16, 13, 17, 19, 15, 14, 16, 18, 15, 17, 16],
  },
}
