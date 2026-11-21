// Admin dashboard: Supabase Auth + RLS-protected data access.
(function () {
    var config = window.SUPABASE_CONFIG || {};
    var configured =
        typeof config.url === 'string' && config.url.indexOf('https://') === 0 &&
        typeof config.anonKey === 'string' && config.anonKey.length > 20;

    var client = configured && window.supabase
        ? window.supabase.createClient(config.url, config.anonKey)
        : null;

    var currentUser = null;
    var state = {
        contacts: [],
        consultations: [],
        vacancies: [],
        applications: []
    };
    var toastTimer = null;

    var CONTACT_STATUSES = ['new', 'read', 'replied', 'archived'];
    var CONSULT_STATUSES = ['new', 'contacted', 'scheduled', 'closed'];
    var VACANCY_STATUSES = ['draft', 'published', 'closed'];
    var APPLICATION_STATUSES = ['new', 'shortlisted', 'interviewed', 'rejected', 'hired'];

    var TABLE_STATE_KEY = {
        contact_messages: 'contacts',
        consultation_requests: 'consultations',
        job_vacancies: 'vacancies',
        job_applications: 'applications'
    };

    function el(id) { return document.getElementById(id); }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDate(value) {
        if (!value) return '';
        return new Date(value).toLocaleString('en-KE', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    function capitalize(value) {
        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    function showView(name) {
        ['loading', 'login', 'unauthorized', 'dashboard'].forEach(function (view) {
            var node = el(view + '-view');
            if (node) node.hidden = view !== name;
        });
        el('signout-btn').hidden = name !== 'dashboard';
        if (name !== 'dashboard' && name !== 'unauthorized') {
            el('admin-user').textContent = '';
        }
    }

    function showLoginError(message) {
        var error = el('login-error');
        error.textContent = message;
        error.hidden = false;
    }

    function hideLoginError() {
        el('login-error').hidden = true;
    }

    function showToast(message, isError) {
        var toast = el('admin-toast');
        toast.textContent = message;
        toast.classList.toggle('error', !!isError);
        toast.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.hidden = true; }, 2500);
    }

    function setButtonBusy(btn, busy, label) {
        if (!btn) return;
        if (busy) {
            btn.dataset.label = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + (label || 'Loading...');
        } else {
            btn.disabled = false;
            if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
        }
    }

    function statusOptions(statuses, current) {
        return statuses.map(function (status) {
            return '<option value="' + status + '"' +
                (status === current ? ' selected' : '') + '>' +
                capitalize(status) + '</option>';
        }).join('');
    }

    function emptyState(icon, text) {
        return '<div class="record-empty"><i class="fa-solid ' + icon + '"></i>' +
            escapeHtml(text) + '</div>';
    }

    function updateStats() {
        el('stat-contact-new').textContent = state.contacts.filter(function (item) {
            return item.status === 'new';
        }).length;
        el('stat-consult-new').textContent = state.consultations.filter(function (item) {
            return item.status === 'new';
        }).length;
        el('stat-app-new').textContent = state.applications.filter(function (item) {
            return item.status === 'new';
        }).length;
        el('stat-total').textContent =
            state.contacts.length + state.consultations.length +
            state.vacancies.length + state.applications.length;
    }

    function renderContacts() {
        var html = state.contacts.map(function (item) {
            return '<article class="record-card">' +
                '<div class="record-head">' +
                    '<div>' +
                        '<h3>' + escapeHtml(item.name) + '</h3>' +
                        '<a href="mailto:' + escapeHtml(item.email) + '">' + escapeHtml(item.email) + '</a>' +
                    '</div>' +
                    '<div class="record-side">' +
                        '<span class="record-date">' + escapeHtml(formatDate(item.created_at)) + '</span>' +
                        '<select class="status-select" data-table="contact_messages" data-id="' + escapeHtml(item.id) + '">' +
                            statusOptions(CONTACT_STATUSES, item.status) +
                        '</select>' +
                    '</div>' +
                '</div>' +
                (item.subject
                    ? '<p class="record-subject">' + escapeHtml(item.subject) + '</p>'
                    : '') +
                '<p class="record-message">' + escapeHtml(item.message) + '</p>' +
            '</article>';
        }).join('');

        el('tab-contacts').innerHTML = html || emptyState('fa-envelope-open-text', 'No contact messages yet.');
    }

    function renderConsultations() {
        var html = state.consultations.map(function (item) {
            var name = [item.first_name, item.last_name].filter(Boolean).join(' ');
            return '<article class="record-card">' +
                '<div class="record-head">' +
                    '<div>' +
                        '<h3>' + escapeHtml(name) + '</h3>' +
                        '<a href="mailto:' + escapeHtml(item.email) + '">' + escapeHtml(item.email) + '</a>' +
                    '</div>' +
                    '<div class="record-side">' +
                        '<span class="record-date">' + escapeHtml(formatDate(item.created_at)) + '</span>' +
                        '<select class="status-select" data-table="consultation_requests" data-id="' + escapeHtml(item.id) + '">' +
                            statusOptions(CONSULT_STATUSES, item.status) +
                        '</select>' +
                    '</div>' +
                '</div>' +
                '<div class="record-meta">' +
                    '<span><i class="fa-solid fa-phone"></i>' + escapeHtml(item.phone) + '</span>' +
                    (item.service
                        ? '<span><i class="fa-solid fa-briefcase"></i>' + escapeHtml(item.service) + '</span>'
                        : '') +
                '</div>' +
                (item.message
                    ? '<p class="record-message">' + escapeHtml(item.message) + '</p>'
                    : '') +
            '</article>';
        }).join('');

        el('tab-consultations').innerHTML = html || emptyState('fa-calendar-check', 'No consultation requests yet.');
    }

    function renderVacancies() {
        var html = state.vacancies.map(function (item) {
            var tags = Array.isArray(item.tags) ? item.tags : [];
            return '<article class="record-card">' +
                '<div class="record-head">' +
                    '<div>' +
                        '<h3>' + escapeHtml(item.title) + '</h3>' +
                        '<span class="record-company">' + escapeHtml(item.company) + '</span>' +
                    '</div>' +
                    '<div class="record-side">' +
                        '<span class="record-date">' + escapeHtml(formatDate(item.created_at)) + '</span>' +
                        '<select class="status-select" data-table="job_vacancies" data-id="' + escapeHtml(item.id) + '">' +
                            statusOptions(VACANCY_STATUSES, item.status) +
                        '</select>' +
                    '</div>' +
                '</div>' +
                '<div class="record-meta">' +
                    '<span><i class="fa-solid fa-location-dot"></i>' + escapeHtml(item.location) + '</span>' +
                    '<span><i class="fa-solid fa-briefcase"></i>' + escapeHtml(item.employment_type) + '</span>' +
                    (item.salary_range
                        ? '<span><i class="fa-solid fa-money-bill-wave"></i>' + escapeHtml(item.salary_range) + '</span>'
                        : '') +
                    (item.badge
                        ? '<span><i class="fa-solid fa-tag"></i>' + escapeHtml(item.badge) + '</span>'
                        : '') +
                '</div>' +
                (tags.length
                    ? '<div class="record-meta">' + tags.map(function (tag) {
                        return '<span><i class="fa-solid fa-circle"></i>' + escapeHtml(tag) + '</span>';
                    }).join('') + '</div>'
                    : '') +
                (item.description
                    ? '<p class="record-message">' + escapeHtml(item.description) + '</p>'
                    : '') +
            '</article>';
        }).join('');

        el('vacancies-list').innerHTML = html || emptyState('fa-briefcase', 'No vacancies yet. Post your first one.');
    }

    function renderApplications() {
        var html = state.applications.map(function (item) {
            var vacancy = item.job_vacancies || {};
            return '<article class="record-card">' +
                '<div class="record-head">' +
                    '<div>' +
                        '<h3>' + escapeHtml(item.full_name) + '</h3>' +
                        '<a href="mailto:' + escapeHtml(item.email) + '">' + escapeHtml(item.email) + '</a>' +
                        (vacancy.title
                            ? '<p class="record-company">Applied for ' + escapeHtml(vacancy.title) +
                              (vacancy.company ? ' · ' + escapeHtml(vacancy.company) : '') + '</p>'
                            : '') +
                    '</div>' +
                    '<div class="record-side">' +
                        '<span class="record-date">' + escapeHtml(formatDate(item.created_at)) + '</span>' +
                        '<select class="status-select" data-table="job_applications" data-id="' + escapeHtml(item.id) + '">' +
                            statusOptions(APPLICATION_STATUSES, item.status) +
                        '</select>' +
                    '</div>' +
                '</div>' +
                '<div class="record-meta">' +
                    '<span><i class="fa-solid fa-phone"></i>' + escapeHtml(item.phone) + '</span>' +
                '</div>' +
                (item.cover_note
                    ? '<p class="record-message">' + escapeHtml(item.cover_note) + '</p>'
                    : '') +
                '<div class="record-actions">' +
                    '<button type="button" class="btn btn-outline btn-sm" data-cv-path="' + escapeHtml(item.cv_path) + '">' +
                        '<i class="fa-solid fa-file-lines"></i> View CV' +
                    '</button>' +
                    '<a class="btn btn-outline btn-sm" href="mailto:' + escapeHtml(item.email) + '?subject=' +
                        encodeURIComponent('Your application for ' + (vacancy.title || 'a vacancy')) + '">' +
                        '<i class="fa-solid fa-reply"></i> Email Candidate' +
                    '</a>' +
                '</div>' +
            '</article>';
        }).join('');

        el('tab-applications').innerHTML = html || emptyState('fa-file-lines', 'No applications yet.');
    }

    async function loadData() {
        var refreshBtn = el('refresh-btn');
        setButtonBusy(refreshBtn, true);

        var results = await Promise.all([
            client.from('contact_messages').select('*').order('created_at', { ascending: false }),
            client.from('consultation_requests').select('*').order('created_at', { ascending: false }),
            client.from('job_vacancies').select('*').order('created_at', { ascending: false }),
            client.from('job_applications')
                .select('*, job_vacancies(title, company)')
                .order('created_at', { ascending: false })
        ]);

        setButtonBusy(refreshBtn, false);

        if (results[0].error || results[1].error) {
            console.error('Could not load messages:', results[0].error || results[1].error);
            showToast('Could not load messages.', true);
        }
        var jobsError = results[2].error || results[3].error;
        if (jobsError) {
            console.error('Could not load jobs data:', jobsError);
            showToast('Jobs tables not found. Run 0002_jobs.sql in Supabase.', true);
        }

        state.contacts = results[0].data || [];
        state.consultations = results[1].data || [];
        state.vacancies = results[2].data || [];
        state.applications = results[3].data || [];
        renderContacts();
        renderConsultations();
        renderVacancies();
        renderApplications();
        updateStats();
    }

    async function updateStatus(select) {
        var table = select.dataset.table;
        var id = select.dataset.id;
        var newStatus = select.value;

        select.disabled = true;
        var result = await client.from(table).update({ status: newStatus }).eq('id', id);
        select.disabled = false;

        if (result.error) {
            console.error('Could not update status:', result.error);
            showToast('Could not save status.', true);
            return;
        }

        var list = state[TABLE_STATE_KEY[table]] || [];
        list.forEach(function (item) {
            if (item.id === id) item.status = newStatus;
        });
        updateStats();
        showToast('Status updated.');
    }

    async function openCv(button) {
        var path = button.dataset.cvPath;
        if (!path) return;

        setButtonBusy(button, true, 'Opening...');
        var result = await client.storage.from('cvs').createSignedUrl(path, 120);
        setButtonBusy(button, false);

        if (result.error) {
            console.error('Could not open CV:', result.error);
            showToast('Could not open CV.', true);
            return;
        }
        window.open(result.data.signedUrl, '_blank', 'noopener');
    }

    function showVacancyForm(show) {
        el('vacancy-form').hidden = !show;
        el('new-vacancy-btn').hidden = show;
        el('vacancy-error').hidden = true;
        if (show) el('vac-title').focus();
    }

    async function handleVacancySubmit(event) {
        event.preventDefault();
        var btn = el('vacancy-submit-btn');
        var errorNode = el('vacancy-error');
        errorNode.hidden = true;

        var tags = el('vac-tags').value.split(',')
            .map(function (tag) { return tag.trim(); })
            .filter(Boolean);

        var payload = {
            title: el('vac-title').value.trim(),
            company: el('vac-company').value.trim(),
            location: el('vac-location').value.trim(),
            salary_range: el('vac-salary').value.trim() || null,
            employment_type: el('vac-type').value,
            status: el('vac-status').value,
            badge: el('vac-badge').value || null,
            tags: tags,
            description: el('vac-description').value.trim() || null
        };

        setButtonBusy(btn, true, 'Saving...');
        var result = await client.from('job_vacancies').insert(payload).select().single();
        setButtonBusy(btn, false);

        if (result.error) {
            console.error('Could not save vacancy:', result.error);
            errorNode.textContent = 'Could not save the vacancy. Please check the fields and try again.';
            errorNode.hidden = false;
            return;
        }

        state.vacancies.unshift(result.data);
        renderVacancies();
        updateStats();
        el('vacancy-form-el').reset();
        showVacancyForm(false);
        showToast('Vacancy saved.');
    }

    function switchTab(name) {
        document.querySelectorAll('.admin-tab').forEach(function (tab) {
            tab.classList.toggle('active', tab.dataset.tab === name);
        });
        ['contacts', 'consultations', 'vacancies', 'applications'].forEach(function (tabName) {
            var panel = el('tab-' + tabName);
            if (panel) panel.hidden = tabName !== name;
        });
    }

    async function handleAuthenticatedUser(user) {
        currentUser = user;
        el('admin-user').textContent = user.email || '';

        var result = await client.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
        if (result.error) {
            console.error('Could not verify admin access:', result.error);
        }
        if (result.error || !result.data) {
            showView('unauthorized');
            return;
        }

        showView('dashboard');
        await loadData();
    }

    async function signOut() {
        if (client) await client.auth.signOut();
        currentUser = null;
        state = { contacts: [], consultations: [], vacancies: [], applications: [] };
        showView('login');
    }

    function bindEvents() {
        el('login-form').addEventListener('submit', async function (event) {
            event.preventDefault();
            hideLoginError();

            var email = el('admin-email').value.trim();
            var password = el('admin-password').value;
            var btn = el('login-btn');

            if (!client) return;
            setButtonBusy(btn, true, 'Signing in...');
            var result = await client.auth.signInWithPassword({ email: email, password: password });
            setButtonBusy(btn, false);

            if (result.error) {
                showLoginError(result.error.message === 'Invalid login credentials'
                    ? 'Incorrect email or password.'
                    : result.error.message);
                return;
            }

            await handleAuthenticatedUser(result.data.user);
        });

        el('signout-btn').addEventListener('click', signOut);
        el('unauth-signout-btn').addEventListener('click', signOut);
        el('refresh-btn').addEventListener('click', loadData);

        el('new-vacancy-btn').addEventListener('click', function () { showVacancyForm(true); });
        el('vacancy-cancel-btn').addEventListener('click', function () { showVacancyForm(false); });
        el('vacancy-form-el').addEventListener('submit', handleVacancySubmit);

        document.addEventListener('change', function (event) {
            var select = event.target.closest('.status-select');
            if (select) updateStatus(select);
        });

        document.addEventListener('click', function (event) {
            var cvButton = event.target.closest('[data-cv-path]');
            if (cvButton) openCv(cvButton);
        });

        document.querySelectorAll('.admin-tab').forEach(function (tab) {
            tab.addEventListener('click', function () { switchTab(tab.dataset.tab); });
        });
    }

    async function init() {
        bindEvents();

        if (!window.supabase) {
            showView('login');
            showLoginError('Could not load Supabase. Check your internet connection and refresh.');
            el('login-btn').disabled = true;
            return;
        }

        if (!client) {
            showView('login');
            showLoginError('Supabase is not configured. Add your project URL and publishable key.');
            el('login-btn').disabled = true;
            return;
        }

        client.auth.onAuthStateChange(function (event) {
            if (event === 'SIGNED_OUT') {
                currentUser = null;
                showView('login');
            }
        });

        var session = await client.auth.getSession();
        if (session.error) {
            console.error('Could not read session:', session.error);
            showView('login');
            return;
        }

        if (!session.data.session) {
            showView('login');
            return;
        }

        await handleAuthenticatedUser(session.data.session.user);
    }

    init();
})();
