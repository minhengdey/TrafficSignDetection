# Traffic Sign Detection Frontend

A role-based web application for traffic sign detection using AI. Built with pure HTML, CSS, and JavaScript.

## Features

### User Roles

#### ADMIN Role
- Access to comprehensive statistics dashboard
- View system overview (total users, videos, detections, sign types)
- Monitor detections over time with charts
- View top detected traffic signs
- Track videos by processing status
- Manage users and videos
- View recent system activity

#### USER Role
- Personal dashboard with upload statistics
- Profile management (view and update personal information)
- Video upload functionality with AI-powered traffic sign detection
- Upload history with detailed results
- View detection results with bounding boxes and confidence scores

## Project Structure

\`\`\`
Frontend/
├── index.html              # Landing page
├── login.html              # Login/Register page
├── dashboard.html          # Role-based routing page
├── admin-dashboard.html    # Admin statistics dashboard
├── user-dashboard.html     # User main dashboard
├── profile.html            # User profile management
├── upload.html             # Video upload page (USER only)
├── history.html            # Upload history (USER only)
├── results.html            # Detection results viewer
├── css/
│   ├── theme.css          # Theme variables and colors
│   ├── main.css           # Main styles
│   ├── upload.css         # Upload page styles
│   ├── stats.css          # Statistics/dashboard styles
│   └── results.css        # Results page styles
└── js/
    ├── config.js          # API configuration and endpoints
    ├── auth.js            # Authentication manager
    ├── login.js           # Login/register functionality
    ├── main.js            # Landing page functionality
    ├── admin-dashboard.js # Admin dashboard logic
    ├── user-dashboard.js  # User dashboard logic
    ├── profile.js         # Profile management
    ├── upload.js          # Video upload logic
    ├── history.js         # Upload history
    └── stats.js           # Statistics visualization
\`\`\`

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### User Endpoints
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `POST /api/user/change-password` - Change password
- `GET /api/user/videos` - Get user's uploaded videos
- `POST /api/videos/upload` - Upload video for detection
- `GET /api/videos/:id/status` - Check video processing status
- `GET /api/videos/:id/results` - Get detection results

### Admin Endpoints
- `GET /api/admin/stats/overview` - System overview statistics
- `GET /api/admin/stats/detections-over-time` - Detection trends
- `GET /api/admin/stats/top-signs` - Most detected signs
- `GET /api/admin/stats/videos-by-status` - Video status distribution
- `GET /api/admin/users` - List all users
- `GET /api/admin/videos` - List all videos
- `GET /api/admin/detections` - List all detections
- `GET /api/admin/sign-types` - List traffic sign types

## Configuration

Edit `js/config.js` to configure the application:

\`\`\`javascript
const CONFIG = {
  MODE: "LIVE",  // "MOCK" for testing, "LIVE" for production
  API_BASE_URL: "http://localhost:8080/api",
  ENDPOINTS: { /* ... */ }
}
\`\`\`

## Usage

### For Development
1. Update `CONFIG.MODE` to `"MOCK"` in `js/config.js` for offline testing
2. Open `index.html` in a web browser
3. Use mock credentials:
   - Admin: username: `admin`, password: `admin123`
   - User: username: `user`, password: `user123`

### For Production
1. Update `CONFIG.MODE` to `"LIVE"` in `js/config.js`
2. Set `CONFIG.API_BASE_URL` to your backend API URL
3. Deploy the frontend files to your web server
4. Ensure CORS is properly configured on your backend

## Authentication Flow

1. User logs in via `login.html`
2. Backend returns user role (ADMIN or USER) with authentication token
3. User is redirected to `dashboard.html`
4. Dashboard routes to appropriate interface:
   - ADMIN → `admin-dashboard.html`
   - USER → `user-dashboard.html`

## Role-Based Access Control

- **ADMIN users** can only access:
  - Admin dashboard with statistics
  - System management features

- **USER users** can access:
  - Personal dashboard
  - Profile management
  - Video upload
  - Upload history
  - Detection results

## Technologies Used

- Pure HTML5
- CSS3 (with CSS variables for theming)
- Vanilla JavaScript (ES6+)
- Chart.js for data visualization
- Fetch API for HTTP requests
- LocalStorage for authentication state

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT License
