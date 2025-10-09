// Login page functionality
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("authForm")
  const emailInput = document.getElementById("email") // accepts email or username
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

  // Use global auth instance from js/auth.js

  let isLoginMode = true

  // Check if already authenticated
  if (auth.isAuthenticated()) {
    window.location.href = "upload.html"
    return
  }

  // Toggle between login and register
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
      usernameInput.removeAttribute("required")
      toggleMsg.textContent = "Don't have an account?"
      toggleMode.textContent = "Sign up"
      // Login: accept email or username
      emailLabel.textContent = "Email or Username"
      emailInput.type = "text"
      emailInput.placeholder = "you@example.com or username"
    } else {
      authTitle.textContent = "Create Account"
      authSubtitle.textContent = "Sign up to start analyzing traffic videos"
      submitBtn.textContent = "Sign Up"
      confirmPasswordGroup.style.display = "block"
      usernameGroup.style.display = "block"
      confirmPasswordInput.setAttribute("required", "")
      usernameInput.setAttribute("required", "")
      toggleMsg.textContent = "Already have an account?"
      toggleMode.textContent = "Sign in"
      // Signup: email field should be an email input
      emailLabel.textContent = "Email"
      emailInput.type = "email"
      emailInput.placeholder = "you@example.com"
    }

    // Clear messages
    hideMessages()
  })

  // Form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    hideMessages()

    const identifier = emailInput.value.trim() // can be email or username
    const password = passwordInput.value

    // Validation
    if (!isLoginMode) {
      const confirmPassword = confirmPasswordInput.value
      if (password !== confirmPassword) {
        showError("Passwords do not match")
        return
      }
      if (password.length < 6) {
        showError("Password must be at least 6 characters")
        return
      }
    }

    // Disable form
    submitBtn.disabled = true
    submitBtn.textContent = isLoginMode ? "Signing in..." : "Creating account..."

    try {
      if (isLoginMode) {
        await auth.login(identifier, password)
        showSuccess("Login successful! Redirecting...")
        setTimeout(() => {
          window.location.href = "upload.html"
        }, 1000)
      } else {
        // On register, send explicit email and username
        const email = emailInput.value.trim()
        const username = usernameInput.value.trim()
        await auth.register(email, password, username)
        showSuccess("Account created! Redirecting...")
        setTimeout(() => {
          window.location.href = "upload.html"
        }, 1000)
      }
    } catch (error) {
      showError(error.message || "An error occurred. Please try again.")
      submitBtn.disabled = false
      submitBtn.textContent = isLoginMode ? "Sign In" : "Sign Up"
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
