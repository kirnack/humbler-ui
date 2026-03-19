'use strict';

const POLL_INTERVAL_MS = 2000;

let downloadModal = null;
let currentTaskId = null;
let pollTimer = null;
let allBundles = [];
let activeCategory = 'all';

document.addEventListener('DOMContentLoaded', () => {
    downloadModal = new bootstrap.Modal(document.getElementById('download-modal'));

    document.getElementById('auth-btn').addEventListener('click', doAuth);
    document.getElementById('session-key-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') doAuth();
    });
    document.getElementById('refresh-btn').addEventListener('click', loadBundles);
    document.getElementById('show-downloaded-toggle').addEventListener('change', renderBundles);
    document.getElementById('logout-btn').addEventListener('click', showAuthSection);

    document.getElementById('category-filters').addEventListener('click', e => {
        const btn = e.target.closest('[data-category]');
        if (!btn) return;
        document.querySelectorAll('#category-filters [data-category]').forEach(b => {
            b.classList.remove('btn-primary', 'active');
            b.classList.add('btn-outline-primary');
        });
        btn.classList.remove('btn-outline-primary');
        btn.classList.add('btn-primary', 'active');
        activeCategory = btn.dataset.category;
        renderBundles();
    });

    document.getElementById('download-modal').addEventListener('hidden.bs.modal', () => {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        currentTaskId = null;
    });

    checkAuth();
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function checkAuth() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        const badge = document.getElementById('auth-badge');

        if (data.authenticated) {
            badge.className = 'badge bg-success';
            badge.textContent = 'Authenticated';
            document.getElementById('logout-btn').classList.remove('d-none');
            showSection('bundle');
            loadBundles();
        } else {
            badge.className = 'badge bg-danger';
            badge.textContent = 'Not Authenticated';
            document.getElementById('logout-btn').classList.add('d-none');
            showSection('auth');
        }
    } catch (err) {
        console.error('Auth check failed:', err);
    }
}

function showAuthSection() {
    showSection('auth');
}

async function doAuth() {
    const key = document.getElementById('session-key-input').value.trim();
    const errEl = document.getElementById('auth-error');

    if (!key) {
        errEl.textContent = 'Please enter a session key.';
        errEl.classList.remove('d-none');
        return;
    }

    const btn = document.getElementById('auth-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span>Authenticating…';

    try {
        const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ session_key: key }),
        });

        if (res.ok) {
            document.getElementById('session-key-input').value = '';
            errEl.classList.add('d-none');
            await checkAuth();
        } else {
            const data = await res.json();
            errEl.textContent = data.error || 'Authentication failed.';
            errEl.classList.remove('d-none');
        }
    } catch (err) {
        errEl.textContent = 'Network error. Please try again.';
        errEl.classList.remove('d-none');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket me-1"></i>Authenticate';
    }
}

// ---------------------------------------------------------------------------
// Bundle list
// ---------------------------------------------------------------------------

async function loadBundles() {
    const grid = document.getElementById('bundle-grid');
    const loading = document.getElementById('bundle-loading');
    const errorEl = document.getElementById('bundle-error');
    const stats = document.getElementById('bundle-stats');

    loading.classList.remove('d-none');
    errorEl.classList.add('d-none');
    stats.classList.add('d-none');
    grid.innerHTML = '';

    try {
        const res = await fetch('/api/bundles');
        const data = await res.json();

        if (!res.ok) {
            if (data.error === 'not_authenticated') { await checkAuth(); return; }
            throw new Error(data.error || 'Failed to load bundles');
        }

        allBundles = data.bundles || [];
        renderBundles();
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('d-none');
    } finally {
        loading.classList.add('d-none');
    }
}

function renderBundles() {
    const grid = document.getElementById('bundle-grid');
    const showDownloaded = document.getElementById('show-downloaded-toggle').checked;
    const statsEl = document.getElementById('bundle-stats');

    const total = allBundles.length;
    const downloadedCount = allBundles.filter(b => b.downloaded).length;
    const notDownloaded = total - downloadedCount;

    statsEl.textContent =
        `${total} bundle(s) total · ${downloadedCount} downloaded · ${notDownloaded} not downloaded`;
    statsEl.classList.remove('d-none');

    let visible = showDownloaded ? allBundles : allBundles.filter(b => !b.downloaded);
    if (activeCategory !== 'all') {
        visible = visible.filter(b => b.category === activeCategory);
    }

    if (visible.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-center text-muted py-5">
                <i class="fa-solid fa-box-open fa-3x mb-3 d-block"></i>
                ${showDownloaded ? 'No bundles found.' : 'All bundles have been downloaded!'}
            </div>`;
        return;
    }

    grid.innerHTML = visible.map(bundleCardHTML).join('');

    grid.querySelectorAll('[data-download-key]').forEach(btn => {
        btn.addEventListener('click', () =>
            startDownload(btn.dataset.downloadKey, btn.dataset.downloadName));
    });
}

const CATEGORY_LABELS = {
    games:    { icon: 'fa-gamepad',     label: 'Games',         bg: 'bg-primary'   },
    choice:   { icon: 'fa-star',        label: 'Humble Choice', bg: 'bg-warning text-dark' },
    books:    { icon: 'fa-book',        label: 'Books',         bg: 'bg-info text-dark'    },
    software: { icon: 'fa-laptop-code', label: 'Software',      bg: 'bg-secondary'    }
};

function bundleCardHTML(bundle) {
    const isDownloaded = bundle.downloaded;
    const isClaimed = (bundle.claimed || '').toLowerCase() === 'yes';
    const cardClass = isDownloaded ? 'downloaded' : 'not-downloaded';
    const cat = CATEGORY_LABELS[bundle.category] || CATEGORY_LABELS.games;

    return `
    <div class="col-sm-6 col-lg-4 col-xl-3">
        <div class="card h-100 bundle-card ${cardClass}">
            <div class="card-body d-flex flex-column">
                <h6 class="card-title">${escapeHtml(bundle.name)}</h6>
                <div class="mt-auto pt-2">
                    <div class="d-flex gap-1 flex-wrap mb-2">
                        <span class="badge bg-secondary">${escapeHtml(bundle.size)}</span>
                        <span class="badge ${cat.bg}"><i class="fa-solid ${cat.icon} me-1"></i>${cat.label}</span>
                        ${isClaimed ? '<span class="badge bg-info text-dark">Keys Claimed</span>' : ''}
                        ${isDownloaded
                            ? '<span class="badge bg-success"><i class="fa-solid fa-check me-1"></i>Downloaded</span>'
                            : '<span class="badge bg-warning text-dark"><i class="fa-solid fa-cloud-arrow-down me-1"></i>Not Downloaded</span>'}
                    </div>
                    ${!isDownloaded ? `
                    <button class="btn btn-sm btn-primary w-100"
                            data-download-key="${escapeHtml(bundle.key)}"
                            data-download-name="${escapeHtml(bundle.name)}">
                        <i class="fa-solid fa-download me-1"></i>Download
                    </button>` : ''}
                </div>
            </div>
        </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

async function startDownload(bundleKey, bundleName) {
    document.getElementById('download-modal-title').textContent = `Downloading: ${bundleName}`;
    document.getElementById('download-output').textContent = '';
    document.getElementById('download-progress').classList.remove('d-none');
    document.getElementById('download-status-badge').innerHTML = '';
    downloadModal.show();

    try {
        const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
        const res = await fetch('/api/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ key: bundleKey }),
        });

        if (!res.ok) {
            const data = await res.json();
            showDownloadResult('failed', data.error || 'Failed to start download');
            return;
        }

        const { task_id } = await res.json();
        currentTaskId = task_id;
        pollTimer = setInterval(pollDownloadStatus, POLL_INTERVAL_MS);
    } catch (err) {
        showDownloadResult('failed', err.message);
    }
}

async function pollDownloadStatus() {
    if (!currentTaskId) return;

    try {
        const res = await fetch(`/api/download/status/${currentTaskId}`);
        if (!res.ok) return;

        const task = await res.json();

        const outputEl = document.getElementById('download-output');
        outputEl.textContent = (task.lines || []).join('\n');
        outputEl.scrollTop = outputEl.scrollHeight;

        if (task.status === 'completed') {
            clearInterval(pollTimer); pollTimer = null;
            showDownloadResult('completed');
            showToast('Download completed!', 'success');
            loadBundles();
        } else if (task.status === 'failed') {
            clearInterval(pollTimer); pollTimer = null;
            showDownloadResult('failed', task.error);
        }
    } catch (err) {
        console.error('Poll error:', err);
    }
}

function showDownloadResult(status, errorMsg) {
    document.getElementById('download-progress').classList.add('d-none');

    if (status === 'completed') {
        document.getElementById('download-status-badge').innerHTML =
            '<span class="badge bg-success fs-6"><i class="fa-solid fa-check me-1"></i>Completed</span>';
    } else {
        document.getElementById('download-status-badge').innerHTML =
            '<span class="badge bg-danger fs-6"><i class="fa-solid fa-xmark me-1"></i>Failed</span>';
        if (errorMsg) {
            const outputEl = document.getElementById('download-output');
            if (!outputEl.textContent) outputEl.textContent = errorMsg;
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function showSection(name) {
    document.getElementById('auth-section').classList.toggle('d-none', name !== 'auth');
    document.getElementById('bundle-section').classList.toggle('d-none', name !== 'bundle');
}

function showToast(message, type) {
    const toastEl = document.getElementById('app-toast');
    const toastBody = document.getElementById('toast-body');

    toastEl.className = `toast align-items-center text-bg-${type} border-0`;
    toastBody.textContent = message;

    bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 4000 }).show();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text || ''));
    return div.innerHTML;
}
