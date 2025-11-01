// nav.js - control visibility of navigation and page access based on auth
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Wait for auth to initialize (fetch profile from server-side cookie)
        // Only do this on protected pages to avoid 403s on public pages
        const path = window.location.pathname.split('/').pop() || 'index.html'
        const publicPages = ['index.html', 'login.html', 'register.html']
        if (!publicPages.includes(path)) {
            if (window.auth && typeof window.auth.init === 'function') {
                await window.auth.init()
            }
        }
        // If auth object not loaded yet, wait a tiny bit
        if (!window.auth) {
            setTimeout(() => document.dispatchEvent(new Event('DOMContentLoaded')), 50)
            return
        }

        const isAuth = window.auth.isAuthenticated()
        // Normalize role for comparisons
        const rawRole = window.auth.getRole()
        const role = rawRole ? String(rawRole).toUpperCase() : null

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

        const navLinks = document.querySelector('.nav-links')
        if (!navLinks) return

        function renderNav() {
            const authed = window.auth.isAuthenticated()
            const currentRoleRaw = window.auth.getRole()
            const currentRole = currentRoleRaw ? String(currentRoleRaw).toUpperCase() : null
            const links = []
            if (authed) {
                if (currentRole === 'ADMIN') {
                    // Admin: Dashboard, Stats, Profile, Logout
                    links.push({ href: 'admin-dashboard.html', label: 'Dashboard' })
                    links.push({ href: 'stats.html', label: 'Stats' })
                    links.push({ href: 'profile.html', label: 'Profile' })
                    links.push({ href: '#', label: 'Logout', id: 'logoutLink' })
                } else {
                    // regular user: Profile, Upload, History, Logout
                    links.push({ href: 'profile.html', label: 'Profile' })
                    links.push({ href: 'upload.html', label: 'Upload' })
                    links.push({ href: 'history.html', label: 'History' })
                    links.push({ href: '#', label: 'Logout', id: 'logoutLink' })
                }
            } else {
                links.push({ href: 'index.html', label: 'Home' })
                links.push({ href: 'login.html', label: 'Login' })
                links.push({ href: 'register.html', label: 'Register' })
            }
            navLinks.innerHTML = links.map(l => {
                const idAttr = l.id ? ` id="${l.id}"` : ''
                return `<a href="${l.href}" class="nav-link"${idAttr}>${l.label}</a>`
            }).join('')

            // Assign active class based on current page
            const currentPath = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase()
            const anchors = Array.from(navLinks.querySelectorAll('a.nav-link'))
            anchors.forEach(a => {
                const targetPath = (a.getAttribute('href') || '').split('?')[0].toLowerCase()
                if (targetPath && targetPath !== '#' && targetPath === currentPath) {
                    a.classList.add('active')
                }
            })

            // Optimistic active state on click for instant feedback
            anchors.forEach(a => {
                a.addEventListener('click', () => {
                    anchors.forEach(x => x.classList.remove('active'))
                    a.classList.add('active')
                })
            })

            // wire logout
            const logoutEl = document.getElementById('logoutLink')
            if (logoutEl) {
                logoutEl.addEventListener('click', (e) => {
                    e.preventDefault()
                    window.auth.logout()
                })
            }
        }

        // Initial render
        renderNav()

        // React to logout/login across tabs or same tab
        window.addEventListener('storage', (e) => {
            if (e.key === window.auth.userKey || e.key === window.auth.roleKey) {
                renderNav()
            }
        })
        window.addEventListener('auth:logout', () => {
            renderNav()
        })
    } catch (e) {
        // silent
        console.error('nav.js error', e)
    }
})
