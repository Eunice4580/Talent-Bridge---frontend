// Public jobs listing and application form backed by Supabase.
(function () {
    var config = window.SUPABASE_CONFIG || {};
    var configured =
        typeof config.url === 'string' && config.url.indexOf('https://') === 0 &&
        typeof config.anonKey === 'string' && config.anonKey.length > 20;

    var client = configured && window.supabase
        ? window.supabase.createClient(config.url, config.anonKey)
        : null;

    var ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx'];
    var MAX_CV_BYTES = 5 * 1024 * 1024;
    var MIME_BY_EXTENSION = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
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

    function iconFor(vacancy) {
        var text = (vacancy.title + ' ' + (vacancy.tags || []).join(' ')).toLowerCase();
        if (text.indexOf('payroll') !== -1) return 'fa-calculator';
        if (text.indexOf('training') !== -1 || text.indexOf('l&d') !== -1 || text.indexOf('learning') !== -1) return 'fa-graduation-cap';
        if (text.indexOf('compliance') !== -1 || text.indexOf('labour law') !== -1) return 'fa-scale-balanced';
        if (text.indexOf('recruit') !== -1 || text.indexOf('talent') !== -1) return 'fa-magnifying-glass';
        if (text.indexOf('bank') !== -1) return 'fa-landmark';
        if (text.indexOf('tech') !== -1 || text.indexOf('software') !== -1 || text.indexOf('developer') !== -1) return 'fa-mobile-screen';
        return 'fa-briefcase';
    }

    function badgeFor(vacancy) {
        if (vacancy.badge) {
            return { text: vacancy.badge, cls: vacancy.badge.toLowerCase() };
        }
        if (vacancy.employment_type === 'Remote') {
            return { text: 'Remote', cls: 'remote' };
        }
        var ageDays = (Date.now() - new Date(vacancy.created_at).getTime()) / 86400000;
        if (ageDays <= 14) {
            return { text: 'New', cls: 'new' };
        }
        return null;
    }

    function renderState(icon, html) {
        el('jobs-grid').innerHTML =
            '<div class="jobs-state"><i class="fa-solid ' + icon + '"></i>' + html + '</div>';
    }

    function renderVacancies(vacancies) {
        if (!vacancies.length) {
            renderState('fa-briefcase',
                'No open positions right now. Check back soon or send your CV to ' +
                '<a href="mailto:tbridgehrsolutions@gmail.com">tbridgehrsolutions@gmail.com</a>.');
            return;
        }

        el('jobs-grid').innerHTML = vacancies.map(function (vacancy) {
            var badge = badgeFor(vacancy);
            var tags = (vacancy.tags || []).map(function (tag) {
                return '<span class="tag">' + escapeHtml(tag) + '</span>';
            }).join('');

            return '<div class="job-card" id="job-' + escapeHtml(vacancy.id) + '">' +
                (badge
                    ? '<div class="job-badge ' + (badge.cls === 'featured' ? '' : badge.cls) + '">' +
                      escapeHtml(badge.text) + '</div>'
                    : '') +
                '<div class="job-top">' +
                    '<div class="job-icon"><i class="fa-solid ' + iconFor(vacancy) + '"></i></div>' +
                    '<div><p class="job-title">' + escapeHtml(vacancy.title) + '</p>' +
                    '<p class="job-company">' + escapeHtml(vacancy.company) + '</p></div>' +
                '</div>' +
                '<div class="job-meta">' +
                    '<span class="job-meta-item"><i class="fa-solid fa-location-dot"></i> ' +
                        escapeHtml(vacancy.location) + '</span>' +
                    (vacancy.salary_range
                        ? '<span class="job-meta-item"><i class="fa-solid fa-money-bill-wave"></i> ' +
                          escapeHtml(vacancy.salary_range) + '</span>'
                        : '') +
                    '<span class="job-meta-item"><i class="fa-regular fa-clock"></i> ' +
                        escapeHtml(vacancy.employment_type) + '</span>' +
                '</div>' +
                (vacancy.description
                    ? '<p class="job-desc">' + escapeHtml(vacancy.description) + '</p>'
                    : '') +
                '<div class="job-tags">' + tags + '</div>' +
                '<button type="button" class="btn btn-outline btn-sm apply-btn"' +
                    ' data-id="' + escapeHtml(vacancy.id) + '"' +
                    ' data-title="' + escapeHtml(vacancy.title) + '"' +
                    ' data-company="' + escapeHtml(vacancy.company) + '"' +
                    ' data-location="' + escapeHtml(vacancy.location) + '">' +
                    '<i class="fa-solid fa-paper-plane"></i> Apply Now</button>' +
            '</div>';
        }).join('');
    }

    async function loadVacancies() {
        if (!client) {
            renderState('fa-triangle-exclamation',
                'Job listings are temporarily unavailable. Please email ' +
                '<a href="mailto:tbridgehrsolutions@gmail.com">tbridgehrsolutions@gmail.com</a>.');
            return;
        }

        var result = await client
            .from('job_vacancies')
            .select('*')
            .eq('status', 'published')
            .order('created_at', { ascending: false });

        if (result.error) {
            console.error('Could not load vacancies:', result.error);
            renderState('fa-triangle-exclamation',
                'Job listings could not be loaded. Please refresh or email ' +
                '<a href="mailto:tbridgehrsolutions@gmail.com">tbridgehrsolutions@gmail.com</a>.');
            return;
        }

        renderVacancies(result.data || []);
    }

    function showError(message) {
        var error = el('apply-error');
        error.textContent = message;
        error.hidden = false;
    }

    function setBusy(busy) {
        var btn = el('apply-submit-btn');
        if (busy) {
            btn.dataset.label = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
        } else {
            btn.disabled = false;
            if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
        }
    }

    function openModal(button) {
        var modal = el('apply-modal');
        el('apply-form').reset();
        el('apply-form').style.display = '';
        el('apply-success').style.display = 'none';
        el('apply-error').hidden = true;
        setBusy(false);

        el('apply-vacancy-id').value = button.dataset.id;
        el('apply-modal-title').textContent = 'Apply: ' + button.dataset.title;
        el('apply-modal-sub').textContent =
            button.dataset.company + ' · ' + button.dataset.location;

        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        setTimeout(function () { el('apply-name').focus(); }, 50);
    }

    function closeModal() {
        var modal = el('apply-modal');
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
    }

    function friendlyUploadError(error) {
        var message = (error && error.message) || '';
        if (message.toLowerCase().indexOf('mime') !== -1 ||
            message.toLowerCase().indexOf('size') !== -1) {
            return 'Your CV must be a PDF, DOC or DOCX file no larger than 5MB.';
        }
        return 'Could not upload your CV. Please try again.';
    }

    function bindModal() {
        document.addEventListener('click', function (event) {
            var applyBtn = event.target.closest('.apply-btn');
            if (applyBtn) {
                openModal(applyBtn);
                return;
            }
            if (event.target === el('apply-modal')) {
                closeModal();
            }
        });

        el('apply-close').addEventListener('click', closeModal);

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && el('apply-modal').classList.contains('open')) {
                closeModal();
            }
        });

        el('apply-form').addEventListener('submit', async function (event) {
            event.preventDefault();
            el('apply-error').hidden = true;

            var vacancyId = el('apply-vacancy-id').value;
            var file = el('apply-cv').files[0];
            var honeypot = el('apply-website').value.trim();

            if (honeypot) {
                el('apply-form').style.display = 'none';
                el('apply-success').style.display = 'block';
                return;
            }

            if (!file) {
                showError('Please attach your CV.');
                return;
            }

            var extension = file.name.split('.').pop().toLowerCase();
            if (ALLOWED_EXTENSIONS.indexOf(extension) === -1) {
                showError('Please upload a PDF, DOC or DOCX file.');
                return;
            }
            if (file.size > MAX_CV_BYTES) {
                showError('Your CV must be 5MB or smaller.');
                return;
            }

            if (!client) {
                showError('Applications are temporarily unavailable. Please email tbridgehrsolutions@gmail.com.');
                return;
            }

            setBusy(true);

            try {
                var unique = (window.crypto && crypto.randomUUID)
                    ? crypto.randomUUID()
                    : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
                var path = 'applications/' + unique + '.' + extension;
                var contentType = file.type || MIME_BY_EXTENSION[extension];

                var upload = await client.storage.from('cvs').upload(path, file, {
                    contentType: contentType,
                    upsert: false
                });
                if (upload.error) {
                    console.error('CV upload failed:', upload.error);
                    setBusy(false);
                    showError(friendlyUploadError(upload.error));
                    return;
                }

                var insert = await client.from('job_applications').insert({
                    vacancy_id: vacancyId,
                    full_name: el('apply-name').value.trim(),
                    email: el('apply-email').value.trim(),
                    phone: el('apply-phone').value.trim(),
                    cover_note: el('apply-cover').value.trim() || null,
                    cv_path: path
                });
                if (insert.error) throw insert.error;

                el('apply-form').style.display = 'none';
                el('apply-success').style.display = 'block';
            } catch (error) {
                console.error('Application submission failed:', error);
                setBusy(false);
                showError('We could not submit your application. Please try again or email tbridgehrsolutions@gmail.com.');
            }
        });
    }

    bindModal();
    loadVacancies();
})();
