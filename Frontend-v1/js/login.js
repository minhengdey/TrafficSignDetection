// Login page functionality
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("authForm")
  const emailInput = document.getElementById("email")
  const emailLabel = document.getElementById("emailLabel")
  const passwordInput = document.getElementById("password")
  const confirmPasswordGroup = document.getElementById("confirmPasswordGroup")
  const usernameGroup = document.getElementById("usernameGroup")
  const confirmPasswordInput = document.getElementById("confirmPassword")
  const usernameInput = document.getElementById("username")
  const submitBtn = document.getElementById("submitBtn")
  const toggleModeLink = document.getElementById("toggleMode")
  const authTitle = document.getElementById("authTitle")
  const authSubtitle = document.getElementById("authSubtitle")
  const toggleText = document.getElementById("toggleText")
  const toggleMsg = document.getElementById("toggleMsg")
  const errorMessage = document.getElementById("errorMessage")
  const successMessage = document.getElementById("successMessage")

  let isLoginMode = true
  const auth = (typeof window !== 'undefined' && window.auth) ? window.auth : null // May be null if auth.js didn't initialize
  const toggleMode = document.getElementById("toggleMode") // Declare the toggleMode variable

  if (usernameGroup.style.display === "none") {
    usernameInput.disabled = true
    usernameInput.removeAttribute("required")
  }
  if (confirmPasswordGroup.style.display === "none") {
    confirmPasswordInput.disabled = true
    confirmPasswordInput.removeAttribute("required")
  }

  if (auth && typeof auth.isAuthenticated === 'function' && auth.isAuthenticated()) {
    // Redirect based on stored role
    const storedRole = auth.getRole && auth.getRole()
    if (storedRole === 'ADMIN') {
      window.location.href = 'admin-dashboard.html'
    } else {
      window.location.href = 'user-dashboard.html'
    }
    return
  }

  emailLabel.textContent = "Username"
  emailInput.type = "text"
  emailInput.placeholder = "yourusername"
  emailInput.setAttribute("autocomplete", "username")

  toggleModeLink.addEventListener("click", (e) => {
    e.preventDefault()
    isLoginMode = !isLoginMode

    if (isLoginMode) {
      authTitle.textContent = "Sign In"
      authSubtitle.textContent = "Enter your credentials to access your account"
      submitBtn.textContent = "Sign In"
      confirmPasswordGroup.style.display = "none"
      usernameGroup.style.display = "none"
      confirmPasswordInput.removeAttribute("required")
      confirmPasswordInput.disabled = true
      usernameInput.removeAttribute("required")
      usernameInput.disabled = true
      toggleMsg.textContent = "Don't have an account?"
      toggleText.textContent = "Register"
      emailLabel.textContent = "Username"
      emailInput.type = "text"
      emailInput.placeholder = "yourusername"
      emailInput.setAttribute("autocomplete", "username")
      passwordInput.setAttribute("autocomplete", "current-password")
    } else {
      authTitle.textContent = "Create Account"
      authSubtitle.textContent = "Register to start analyzing traffic videos"
      submitBtn.textContent = "Register"
      confirmPasswordGroup.style.display = "block"
      usernameGroup.style.display = "block"
      confirmPasswordInput.setAttribute("required", "")
      confirmPasswordInput.disabled = false
      usernameInput.setAttribute("required", "")
      usernameInput.disabled = false
      toggleMsg.textContent = "Already have an account?"
      toggleText.textContent = "Sign in"
      emailLabel.textContent = "Email"
      emailInput.type = "email"
      emailInput.placeholder = "you@example.com"
      passwordInput.setAttribute("autocomplete", "new-password")
      confirmPasswordInput.setAttribute("autocomplete", "new-password")
    }

    hideMessages()
  })

  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    hideMessages()

    const identifier = emailInput.value.trim()
    const password = passwordInput.value

    if (!isLoginMode) {
      const confirmPassword = confirmPasswordInput.value
      if (password !== confirmPassword) {
        showError("PASSWORD_INVALID: Passwords do not match")
        return
      }
      if (password.length < 8) {
        showError("PASSWORD_INVALID: Password must be at least 8 characters")
        return
      }
    } else {
      // Login mode: enforce minimum password length to match backend
      if (password.length < 8) {
        showError("PASSWORD_INVALID: Password must be at least 8 characters")
        return
      }
      if (!identifier) {
        showError("USERNAME_INVALID: Username is required")
        return
      }
    }

    submitBtn.disabled = true
    submitBtn.textContent = isLoginMode ? "Signing in..." : "Creating account..."

    try {
      if (isLoginMode) {
        if (!auth || typeof auth.login !== 'function') {
          showError('Auth module not available. Please refresh the page.')
          submitBtn.disabled = false
          submitBtn.textContent = "Sign In"
          return
        }
        const loginResult = await auth.login(identifier, password)
        showSuccess("Login successful! Redirecting...")
        // Determine role from login result or stored role
        const role = (loginResult && loginResult.role) || (auth.getRole && auth.getRole())
        setTimeout(() => {
          if (role === 'ADMIN') {
            window.location.href = 'admin-dashboard.html'
          } else {
            window.location.href = 'user-dashboard.html'
          }
        }, 1000)
      } else {
        const email = emailInput.value.trim()
        const username = usernameInput.value.trim()
        if (!auth || typeof auth.register !== 'function') {
          showError('Auth module not available. Please refresh the page.')
          submitBtn.disabled = false
          submitBtn.textContent = "Register"
          return
        }
        await auth.register(email, password, username)
        showSuccess("Account created! Please sign in.")
        isLoginMode = true
        authTitle.textContent = "Sign In"
        authSubtitle.textContent = "Enter your credentials to access your account"
        submitBtn.textContent = "Sign In"
        confirmPasswordGroup.style.display = "none"
        usernameGroup.style.display = "none"
        confirmPasswordInput.removeAttribute("required")
        confirmPasswordInput.disabled = true
        usernameInput.removeAttribute("required")
        usernameInput.disabled = true
        toggleMsg.textContent = "Don't have an account?"
        toggleText.textContent = "Register"
        emailLabel.textContent = "Email"
        emailInput.type = "email"
        emailInput.placeholder = "you@example.com"
        setTimeout(() => {
          window.location.href = "login.html"
        }, 800)
      }
    } catch (error) {
      // If backend returns structured errors, try to map them; otherwise fallback to message
      const msg = (error && (error.message || (error.result && error.result.message))) || JSON.stringify(error) || "An error occurred. Please try again."
      showError(msg)
      submitBtn.disabled = false
      submitBtn.textContent = isLoginMode ? "Sign In" : "Register"
    }
  })

  function showError(message) {
    errorMessage.textContent = message
    errorMessage.style.display = "block"
  }

  function showSuccess(message) {
    successMessage.textContent = message
    successMessage.style.display = "block"
  }

  function hideMessages() {
    errorMessage.style.display = "none"
    successMessage.style.display = "none"
  }
})
