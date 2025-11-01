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
            showSuccess('Account created! Redirecting to login...')
            setTimeout(() => {
                window.location.href = 'login.html'
            }, 1000)
        } catch (err) {
            const msg = (err && (err.message || err.result && err.result.message)) || JSON.stringify(err) || 'Registration failed'
            showError(msg)
        } finally {
            submitBtn.disabled = false
            submitBtn.textContent = 'Sign Up'
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
