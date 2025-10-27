// nav.js - control visibility of navigation and page access based on auth
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Wait for auth to initialize (fetch profile from server-side cookie)
        if (window.auth && typeof window.auth.init === 'function') {
            await window.auth.init()
        }
        // If auth object not loaded yet, wait a tiny bit
        if (!window.auth) {
            setTimeout(() => document.dispatchEvent(new Event('DOMContentLoaded')), 50)
            return
        }

        const isAuth = window.auth.isAuthenticated()
        const role = window.auth.getRole()

        // If not authenticated: redirect protected pages to home (index.html)
        if (!isAuth) {
            // Only allow public pages: index.html, login.html, register.html
            const allowed = ['index.html', 'login.html', 'register.html']
            const path = window.location.pathname.split('/').pop() || 'index.html'
            if (!allowed.includes(path)) {
                window.location.href = 'index.html'
                return
            }
        }

        // Show/hide nav links depending on role
        const navLinks = document.querySelector('.nav-links')
        if (!navLinks) return

        // Clear existing links and re-render based on role
        // We'll keep brand and replace nav-links content
        const links = []
        if (isAuth) {
            if (role === 'ADMIN') {
                // Admin should only see Dashboard (admin), Profile and Logout
                links.push({ href: 'admin-dashboard.html', label: 'Dashboard' })
                links.push({ href: 'profile.html', label: 'Profile' })
            } else {
                // regular user: Dashboard, Profile, Upload, History
                links.push({ href: 'user-dashboard.html', label: 'Dashboard' })
                links.push({ href: 'profile.html', label: 'Profile' })
                links.push({ href: 'upload.html', label: 'Upload' })
                links.push({ href: 'history.html', label: 'History' })
            }
            // logout link
            links.push({ href: '#', label: 'Logout', id: 'logoutLink' })
        } else {
            // not authenticated: show login/register
            links.push({ href: 'index.html', label: 'Home' })
            links.push({ href: 'login.html', label: 'Login' })
            links.push({ href: 'register.html', label: 'Register' })
        }

        navLinks.innerHTML = links.map(l => {
            const idAttr = l.id ? ` id="${l.id}"` : ''
            return `<a href="${l.href}" class="nav-link"${idAttr}>${l.label}</a>`
        }).join('')

        // wire logout
        const logoutEl = document.getElementById('logoutLink')
        if (logoutEl) {
            logoutEl.addEventListener('click', (e) => {
                e.preventDefault()
                window.auth.logout()
            })
        }
    } catch (e) {
        // silent
        console.error('nav.js error', e)
    }
})
