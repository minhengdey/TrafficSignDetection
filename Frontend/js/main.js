// Main page functionality
document.addEventListener("DOMContentLoaded", async () => {
  if (window.auth && typeof window.auth.init === 'function') await window.auth.init()
  const authLink = document.getElementById("authLink")
  // Guard in case the navigation was re-rendered by `nav.js` and the element no longer exists
  if (!authLink) return

  if (typeof window.auth !== "undefined" && window.auth.isAuthenticated()) {
    authLink.textContent = "Dashboard"
    authLink.href = "dashboard.html"
  } else {
    authLink.textContent = "Login"
    authLink.href = "login.html"
  }
})
