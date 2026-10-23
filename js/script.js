// ── Mobile Menu Toggle ───────────────────────────────
const menuBtn = document.getElementById('menu-btn');
const navLinks = document.getElementById('nav-links');

if (menuBtn) {
    menuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        menuBtn.classList.toggle('open');
    });

    // Close menu when a link is clicked
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            menuBtn.classList.remove('open');
        });
    });

    // Close menu on outside click
    document.addEventListener('click', (e) => {
        if (!menuBtn.contains(e.target) && !navLinks.contains(e.target)) {
            navLinks.classList.remove('active');
        }
    });
}

// ── Mobile Dropdown Toggle ───────────────────────────
document.querySelectorAll('.has-dropdown').forEach(item => {
    item.addEventListener('click', (e) => {
        if (window.innerWidth < 900) {
            e.stopPropagation();
            item.classList.toggle('open');
        }
    });
});

// ── Sticky Header Shadow ─────────────────────────────
const header = document.getElementById('site-header');
if (header) {
    window.addEventListener('scroll', () => {
        header.style.boxShadow = window.scrollY > 20
            ? '0 4px 24px rgba(0,0,0,0.4)'
            : 'none';
    });
}

// ── Scroll Reveal Animation ──────────────────────────
const revealElements = document.querySelectorAll(
    '.service-card, .job-card, .blog-card, .why-item, .hero-card'
);

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

revealElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    revealObserver.observe(el);
});

// ── Active Nav Link Highlighting ─────────────────────
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
        link.classList.add('active');
    } else {
        link.classList.remove('active');
    }
});
