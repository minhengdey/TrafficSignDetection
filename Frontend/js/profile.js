// Profile page functionality
document.addEventListener("DOMContentLoaded", async () => {
  if (window.auth && typeof window.auth.init === 'function') await window.auth.init()
  // Check authentication and role
  if (!window.auth.isAuthenticated()) {
    window.location.href = "login.html"
    return
  }

  // Setup logout
  const logoutEl = document.getElementById("logoutLink")
  if (logoutEl) {
    logoutEl.addEventListener("click", (e) => {
      e.preventDefault()
      window.auth.logout()
    })
  }

  // Setup tabs
  const tabProfileBtn = document.getElementById('tabProfileBtn')
  const tabPasswordBtn = document.getElementById('tabPasswordBtn')
  const profileTab = document.getElementById('profileTab')
  const passwordTab = document.getElementById('passwordTab')

  function setActiveTab(tab) {
    if (tab === 'profile') {
      profileTab.style.display = ''
      passwordTab.style.display = 'none'
      tabProfileBtn.classList.add('active')
      tabProfileBtn.setAttribute('aria-selected', 'true')
      tabPasswordBtn.classList.remove('active')
      tabPasswordBtn.setAttribute('aria-selected', 'false')
      tabProfileBtn.focus()
    } else {
      profileTab.style.display = 'none'
      passwordTab.style.display = ''
      tabProfileBtn.classList.remove('active')
      tabProfileBtn.setAttribute('aria-selected', 'false')
      tabPasswordBtn.classList.add('active')
      tabPasswordBtn.setAttribute('aria-selected', 'true')
      tabPasswordBtn.focus()
    }
    hideMessages()
  }

  tabProfileBtn.addEventListener('click', (e) => {
    e.preventDefault()
    setActiveTab('profile')
  })
  tabPasswordBtn.addEventListener('click', (e) => {
    e.preventDefault()
    setActiveTab('password')
  })

  // default tab
  setActiveTab('profile')

  // Load user profile
  await loadProfile()

  // Setup profile form
  document.getElementById("profileForm").addEventListener("submit", handleProfileUpdate)

  // Setup password form
  document.getElementById("passwordForm").addEventListener("submit", handlePasswordChange)
})

async function loadProfile() {
  try {
    const response = await fetch(`${window.CONFIG.API_BASE_URL}${window.CONFIG.ENDPOINTS.USER_PROFILE}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })

    if (response.ok) {
      const data = await response.json()
      const profile = data.result || data.data || {}

      document.getElementById("username").value = profile.username || window.auth.getUser()
      document.getElementById("email").value = profile.email || ""
    }
  } catch (error) {
    console.error("Error loading profile:", error)
    showError("Failed to load profile data")
  }
}

async function handleProfileUpdate(e) {
  e.preventDefault()
  hideMessages()

  const updateBtn = document.getElementById("updateBtn")
  updateBtn.disabled = true
  updateBtn.textContent = "Updating..."

  try {
    // Using cookie-based auth (HttpOnly cookie will be sent via credentials: 'include')
    const formData = {
      username: document.getElementById("username").value,
      email: document.getElementById("email").value
    }

    const response = await fetch(`${window.CONFIG.API_BASE_URL}${window.CONFIG.ENDPOINTS.USER_UPDATE}`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    })

    console.log(response);
    const data = await response.json();

    if (data.code === 1000) {
      showSuccess("Profile updated successfully!")
    } else {
      throw new Error(data.message || "Failed to update profile")
    }
  } catch (error) {
    showError(error.message || "An error occurred")
  } finally {
    updateBtn.disabled = false
    updateBtn.textContent = "Update Profile"
  }
}

async function handlePasswordChange(e) {
  e.preventDefault()
  hideMessages()

  const currentPassword = document.getElementById("currentPassword").value
  const newPassword = document.getElementById("newPassword").value
  const confirmPassword = document.getElementById("confirmPassword").value

  if (newPassword !== confirmPassword) {
    showError("New passwords do not match")
    return
  }

  if (newPassword.length < 8) {
    showError("Password must be at least 8 characters")
    return
  }

  const passwordBtn = document.getElementById("passwordBtn")
  passwordBtn.disabled = true
  passwordBtn.textContent = "Changing..."

  try {
    // Using cookie-based auth
    const response = await fetch(`${window.CONFIG.API_BASE_URL}${window.CONFIG.ENDPOINTS.USER_UPDATE}`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ newPassword }),
    })

    if (response.ok) {
      showSuccess("Password changed successfully!")
      document.getElementById("passwordForm").reset()
    } else {
      const data = await response.json()
      throw new Error(data.message || "Failed to change password")
    }
  } catch (error) {
    showError(error.message || "An error occurred")
  } finally {
    passwordBtn.disabled = false
    passwordBtn.textContent = "Change Password"
  }
}

function showError(message) {
  const errorMessage = document.getElementById("errorMessage")
  errorMessage.textContent = message
  errorMessage.style.display = "block"
  window.scrollTo({ top: 0, behavior: "smooth" })
}

function showSuccess(message) {
  const successMessage = document.getElementById("successMessage")
  successMessage.textContent = message
  successMessage.style.display = "block"
  window.scrollTo({ top: 0, behavior: "smooth" })
}

function hideMessages() {
  document.getElementById("errorMessage").style.display = "none"
  document.getElementById("successMessage").style.display = "none"
}
