// Use global CONFIG if provided by `js/config.js`, otherwise fall back to these defaults
const APP_CONFIG = (typeof CONFIG !== 'undefined' && CONFIG) ? CONFIG : {
  MODE: "MOCK",
  API_BASE_URL: "https://api.example.com",
  ENDPOINTS: {
    LOGIN: "/login",
    REGISTER: "/register",
  },
}

// No mock data: always use live API. APP_CONFIG should be provided by js/config.js

class AuthManager {
  constructor() {
    this.userKey = "user_email"
    this.roleKey = "user_role"
  }

  isAuthenticated() {
    // Authentication is determined by presence of a stored user; the actual token is held in an HttpOnly cookie by the backend
    return !!localStorage.getItem(this.userKey)
  }

  getUser() {
    return localStorage.getItem(this.userKey)
  }

  getRole() {
    return localStorage.getItem(this.roleKey)
  }

  isAdmin() {
    return this.getRole() === "ADMIN"
  }

  isUser() {
    return this.getRole() === "USER"
  }

  setAuth(_tokenOrCookie, email, role) {
    // Do NOT persist tokens in localStorage when the backend sets an HttpOnly cookie.
    // Store only the identifying user info and role locally.
    if (email) localStorage.setItem(this.userKey, email)
    if (role) localStorage.setItem(this.roleKey, role || "USER")
  }

  clearAuth() {
    localStorage.removeItem(this.userKey)
    localStorage.removeItem(this.roleKey)
  }

  async login(identifier, password) {
    // Always use live API
    return this.liveLogin(identifier, password)
  }

  async register(email, password, username) {
    // Always use live API
    return this.liveRegister(email, password, username)
  }

  // mockLogin/mockRegister removed — frontend uses live API only

  async liveLogin(username, password) {
    try {
      const response = await fetch(`${APP_CONFIG.API_BASE_URL}${APP_CONFIG.ENDPOINTS.LOGIN}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        // Backend sets HttpOnly cookie. Fetch profile from server (which will read cookie) to get role and email.
        const profile = await this.fetchMyProfile().catch(() => null)
        const role = (profile && profile.role) || "USER"
        const email = (profile && profile.email) || username
        this.setAuth(/*cookie*/ true, email, role)
        return { success: true, username: email, role }
      } else {
        const message = (data && (data.message || (data.result && data.result.message))) || "Login failed"
        throw new Error(message)
      }
    } catch (error) {
      const isTypeError =
        error && (error.name === "TypeError" || /Failed to fetch|NetworkError|TypeError/i.test(String(error)))
      const hint = isTypeError
        ? `Cannot reach API at ${APP_CONFIG.API_BASE_URL}. Verify server is running, CORS allows this origin, and URL is correct.`
        : error.message || String(error)
      throw { success: false, message: hint }
    }
  }

  async liveRegister(email, password, username) {
    try {
      const response = await fetch(`${APP_CONFIG.API_BASE_URL}${APP_CONFIG.ENDPOINTS.REGISTER}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, username }),
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        const result = data && (data.result || data.data || {})
        return { success: true, user: result }
      } else {
        const message = (data && (data.message || (data.result && data.result.message))) || "Registration failed"
        throw new Error(message)
      }
    } catch (error) {
      const isTypeError =
        error && (error.name === "TypeError" || /Failed to fetch|NetworkError|TypeError/i.test(String(error)))
      const hint = isTypeError
        ? `Cannot reach API at ${APP_CONFIG.API_BASE_URL}. Verify server is running, CORS allows this origin, and URL is correct.`
        : error.message || String(error)
      throw { success: false, message: hint }
    }
  }

  logout() {
    // Call backend logout to invalidate server-side JWT (HttpOnly cookie)
    try {
      fetch(`${APP_CONFIG.API_BASE_URL}${APP_CONFIG.ENDPOINTS.LOGOUT}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      }).catch((e) => console.warn('Logout request failed', e))
    } catch (e) {
      // ignore
    }
    this.clearAuth()
    window.location.href = "index.html"
  }

  // Fetch profile from server using HttpOnly cookie. Store initPromise so pages can wait for it.
  async fetchMyProfile() {
    try {
      const response = await fetch(`${APP_CONFIG.API_BASE_URL}${APP_CONFIG.ENDPOINTS.USER_PROFILE}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        const result = data && (data.result || data.data || {})
        const user = result
        if (user && (user.email || user.username)) {
          this.setAuth(true, user.email || user.username, (user.role || 'USER'))
          return user
        }
      }
      this.clearAuth()
      return null
    } catch (e) {
      this.clearAuth()
      return null
    }
  }

  // Initialize auth manager by fetching profile once. Exposed so other modules can await it.
  init() {
    if (!this.initPromise) {
      this.initPromise = this.fetchMyProfile()
    }
    return this.initPromise
  }
}

// Global auth instance
const auth = new AuthManager()
// Make accessible on window so other scripts can read it using `window.auth`
try {
  window.auth = auth
  // Start initial profile fetch so role is populated from server-side cookie
  auth.init()
} catch (e) {
  // ignore if window is not available
}
