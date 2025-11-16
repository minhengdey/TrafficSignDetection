const APP_CONFIG = CONFIG

class AuthManager {
  constructor() {
    this.userKey = "user_email"
    this.roleKey = "user_role"
  }

  isAuthenticated() {
    return !!this._user;
  }

  getUser() {
    return this._user ? this._user.email || this._user.username : undefined;
  }

  getRole() {
    return this._user ? (this._user.role ? String(this._user.role).toUpperCase().replace(/^ROLE_/, '') : undefined) : undefined;
  }

  isAdmin() {
    return this.getRole() === "ADMIN";
  }

  isUser() {
    return this.getRole() === "USER";
  }

  setAuth(_tokenOrCookie, email, role) {
    // Chỉ set vào instance (this._user)
    this._user = { email: email, role: role };
  }

  clearAuth() {
    this._user = undefined;
  }

  async login(identifier, password) {
    // Always use live API
    return this.liveLogin(identifier, password);
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
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const result = data && (data.result || data.data || {});
        const token = result && (result.token || result.accessToken || result.jwt) ? (result.token || result.accessToken || result.jwt) : null;
        const profile = await this.fetchMyProfile(token).catch(() => null);
        const role = (profile && profile.role) ? String(profile.role).toUpperCase() : 'USER';
        const email = (profile && (profile.email || profile.username)) || username;
        this._token = token;
        this.setAuth(/*cookie*/ !!token, email, role);
        return { success: true, username: email, role, token };
      } else {
        const message = (data && (data.message || (data.result && data.result.message))) || "Login failed";
        throw new Error(message);
      }
    } catch (error) {
      const isTypeError = error && (error.name === "TypeError" || /Failed to fetch|NetworkError|TypeError/i.test(String(error)));
      const hint = isTypeError
        ? `Cannot reach API at ${APP_CONFIG.API_BASE_URL}. Verify server is running, CORS allows this origin, and URL is correct.`
        : error.message || String(error);
      throw { success: false, message: hint };
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
    // Clear client auth state immediately
    this.clearAuth()
    try {
      // Notify listeners (e.g., navbar) to re-render immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth:logout'))
      }
      // Call backend logout to invalidate server-side JWT (HttpOnly cookie)
      fetch(`${APP_CONFIG.API_BASE_URL}${APP_CONFIG.ENDPOINTS.LOGOUT}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      }).catch((e) => console.warn('Logout request failed', e))
    } catch (e) {
      // ignore
    }
    // Use replace to avoid returning to a cached authenticated page
    try {
      window.location.replace("index.html?logged_out=1")
    } catch (e) {
      window.location.href = "index.html?logged_out=1"
    }
  }

  // Fetch profile from server using HttpOnly cookie. Store initPromise so pages can wait for it.
  // Fetch profile from server using HttpOnly cookie or optional bearer token.
  // If `token` is provided, it will be sent as Authorization: Bearer <token> to retrieve profile when cookies aren't available.
  async fetchMyProfile(token) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(`${APP_CONFIG.API_BASE_URL}${APP_CONFIG.ENDPOINTS.USER_PROFILE}`, {
        method: 'GET',
        credentials: 'include',
        headers,
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const result = data && (data.result || data.data || {});
        const user = result;
        if (user && (user.email || user.username)) {
          const role = user.role ? String(user.role).toUpperCase() : 'USER';
          this.setAuth(true, user.email || user.username, role);
          return user;
        }
      }
      this.clearAuth();
      return null;
    } catch (e) {
      this.clearAuth();
      return null;
    }
  }

  // Initialize auth manager by fetching profile once. Exposed so other modules can await it.
  init() {
    if (!this.initPromise) {
      this.initPromise = this.fetchMyProfile()
    }
    return this.initPromise
  }

  // Decode JWT (no signature verification) to read claims client-side.
  // Returns parsed payload object or null.
  getTokenClaims(token) {
    try {
      token = token || this._token
      if (!token) return null
      const parts = token.split('.')
      if (parts.length < 2) return null
      // base64url -> base64
      let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      // pad
      while (payload.length % 4) payload += '='
      const decoded = atob(payload)
      return JSON.parse(decoded)
    } catch (e) {
      return null
    }
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
