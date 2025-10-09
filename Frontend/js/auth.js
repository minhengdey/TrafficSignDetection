class AuthManager {
  constructor() {
    this.tokenKey = "auth_token"
    this.userKey = "user_email"
  }

  isAuthenticated() {
    return !!localStorage.getItem(this.tokenKey)
  }

  getToken() {
    return localStorage.getItem(this.tokenKey)
  }

  getUser() {
    return localStorage.getItem(this.userKey)
  }

  setAuth(token, email) {
    localStorage.setItem(this.tokenKey, token)
    localStorage.setItem(this.userKey, email)
  }

  clearAuth() {
    localStorage.removeItem(this.tokenKey)
    localStorage.removeItem(this.userKey)
  }

  async login(identifier, password) {
    if (CONFIG.MODE === "MOCK") {
      return this.mockLogin(identifier, password)
    } else {
      return this.liveLogin(identifier, password)
    }
  }

  async register(email, password, username) {
    if (CONFIG.MODE === "MOCK") {
      return this.mockRegister(email, password, username)
    } else {
      return this.liveRegister(email, password, username)
    }
  }

  mockLogin(identifier, password) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const user = MOCK_DATA.users.find((u) => (u.email === identifier || u.username === identifier) && u.password === password)
        if (user) {
          this.setAuth(user.token, user.email || user.username)
          resolve({ success: true, token: user.token, email: user.email, username: user.username })
        } else {
          reject({ success: false, message: "Invalid email/username or password" })
        }
      }, 500)
    })
  }

  mockRegister(email, password, username) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const existingUser = MOCK_DATA.users.find((u) => (email && u.email === email) || (username && u.username === username))
        if (existingUser) {
          reject({ success: false, message: "Email or username already registered" })
        } else {
          const token = `mock-token-${Date.now()}`
          const newUser = { email, username, password, token }
          MOCK_DATA.users.push(newUser)
          this.setAuth(token, newUser.email || newUser.username)
          resolve({ success: true, token, email: newUser.email, username: newUser.username })
        }
      }, 500)
    })
  }

  async liveLogin(email, password) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.LOGIN}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        this.setAuth(data.token, email)
        return { success: true, token: data.token, email }
      } else {
        throw new Error(data.message || "Login failed")
      }
    } catch (error) {
      throw { success: false, message: error.message }
    }
  }

  async liveRegister(email, password, username) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.REGISTER}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, username }),
      })

      const data = await response.json()

      if (response.ok) {
        this.setAuth(data.token, email)
        return { success: true, token: data.token, email }
      } else {
        throw new Error(data.message || "Registration failed")
      }
    } catch (error) {
      throw { success: false, message: error.message }
    }
  }

  logout() {
    this.clearAuth()
    window.location.href = "index.html"
  }
}

// Global auth instance
const auth = new AuthManager()
