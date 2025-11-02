// Register page functionality
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("authForm")
    const emailInput = document.getElementById("email")
    const usernameInput = document.getElementById("username")
    const passwordInput = document.getElementById("password")
    const confirmPasswordInput = document.getElementById("confirmPassword")
    const submitBtn = document.getElementById("submitBtn")
    const errorMessage = document.getElementById("errorMessage")
    const successMessage = document.getElementById("successMessage")

    const auth = (typeof window !== 'undefined' && window.auth) ? window.auth : null

    if (!auth) {
        showError('Auth module not available. Please refresh the page.')
        return
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault()
        hideMessages()

        const email = emailInput.value.trim()
        const username = usernameInput.value.trim()
        const password = passwordInput.value
        const confirmPassword = confirmPasswordInput.value

        if (!email) {
            showError('Email is required')
            return
        }
        if (!username) {
            showError('Username is required')
            return
        }
        if (password.length < 8) {
            showError('PASSWORD_INVALID: Password must be at least 8 characters')
            return
        }
        if (password !== confirmPassword) {
            showError('PASSWORD_INVALID: Passwords do not match')
            return
        }

        submitBtn.disabled = true
        submitBtn.textContent = 'Creating account...'

        try {
            await auth.register(email, password, username)
            // Show success briefly then redirect immediately to the login page
            showSuccess('Account created! Redirecting to login...')
            // Ensure the footer link points to the login page (in case user clicks)
            const toggleLink = document.getElementById('toggleMode')
            const toggleMsg = document.getElementById('toggleMsg')
            const toggleText = document.getElementById('toggleText')
            if (toggleLink) toggleLink.setAttribute('href', 'login.html')
            if (toggleMsg) toggleMsg.textContent = 'Already have an account?'
            if (toggleText) toggleText.textContent = 'Login'
            // Redirect after a short delay so the user sees the success message
            setTimeout(() => { window.location.href = 'login.html' }, 800)
        } catch (err) {
            const msg = (err && (err.message || err.result && err.result.message)) || JSON.stringify(err) || 'Registration failed'
            showError(msg)
        } finally {
            submitBtn.disabled = false
            submitBtn.textContent = 'Register'
        }
    })

    function showError(message) {
        errorMessage.textContent = message
        errorMessage.style.display = 'block'
    }

    function showSuccess(message) {
        successMessage.textContent = message
        successMessage.style.display = 'block'
    }

    function hideMessages() {
        errorMessage.style.display = 'none'
        successMessage.style.display = 'none'
    }
})
