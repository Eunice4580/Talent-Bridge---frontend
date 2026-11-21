// Shared helpers for submitting the public forms to Supabase.
// Requires supabase-js (UMD) and js/supabase-config.js to load first.
(function () {
    var config = window.SUPABASE_CONFIG || {};
    var isConfigured =
        typeof config.url === 'string' && config.url.indexOf('https://') === 0 &&
        typeof config.anonKey === 'string' && config.anonKey.length > 20;

    var client = null;
    if (isConfigured && window.supabase) {
        client = window.supabase.createClient(config.url, config.anonKey);
    }

    function setBusy(btn, busy) {
        if (!btn) return;
        if (busy) {
            btn.dataset.label = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
        } else {
            btn.disabled = false;
            if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
        }
    }

    function showError(elementId, message) {
        var el = document.getElementById(elementId);
        if (!el) return;
        el.textContent = message;
        el.hidden = false;
    }

    function hideError(elementId) {
        var el = document.getElementById(elementId);
        if (el) el.hidden = true;
    }

    function showSuccess(formId, successId) {
        var form = document.getElementById(formId);
        var success = document.getElementById(successId);
        if (form) form.style.display = 'none';
        if (success) success.style.display = 'block';
    }

    async function insertRow(table, payload) {
        if (!client) throw new Error('Supabase is not configured.');
        var result = await client.from(table).insert(payload);
        if (result.error) throw result.error;
    }

    window.TBForms = {
        isConfigured: isConfigured,
        insertRow: insertRow,
        setBusy: setBusy,
        showError: showError,
        hideError: hideError,
        showSuccess: showSuccess
    };
})();
