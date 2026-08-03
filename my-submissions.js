(() => {
    'use strict';

    const PANEL_ID = 'mySubmissionsPanel';
    const STYLE_ID = 'mySubmissionsStyles';
    let initialized = false;

    const safeNumber = value => {
        const number = Number(value || 0);
        return Number.isFinite(number) ? number : 0;
    };

    const escapeHtml = value => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const normalize = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

    const money = value => `$${safeNumber(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;

    function getUser() {
        try { return typeof currentUser !== 'undefined' ? currentUser : null; }
        catch { return null; }
    }

    function getProfile() {
        try { return typeof currentProfile !== 'undefined' ? currentProfile : null; }
        catch { return null; }
    }

    function ownRecord(userId, submittedName) {
        const user = getUser();
        const profile = getProfile();
        if (!user || !profile) return false;
        if (userId) return String(userId) === String(user.id);

        const name = normalize(submittedName);
        const fullName = normalize(profile.full_name);
        const email = normalize(profile.email || user.email);
        return Boolean(name && (name === fullName || name === email));
    }

    function collectEntries() {
        const entries = [];

        try {
            if (typeof shows !== 'undefined' && Array.isArray(shows)) {
                shows.forEach(record => {
                    if (!ownRecord(record.user_id, record.dj_name)) return;
                    entries.push({
                        id: `show:${record.id}`,
                        date: String(record.date || '').slice(0, 10),
                        type: 'Show',
                        details: record.venue_name || 'Show submission',
                        notes: record.notes || '',
                        amount: safeNumber(record.show_pay_amount),
                        status: record.status || 'Pending'
                    });
                });
            }
        } catch {}

        try {
            if (typeof commissions !== 'undefined' && Array.isArray(commissions)) {
                commissions.forEach(record => {
                    if (!ownRecord(record.user_id, record.dj_name)) return;
                    entries.push({
                        id: `commission:${record.id}`,
                        date: String(record.date || '').slice(0, 10),
                        type: 'Commission',
                        details: record.event_name || 'Commission submission',
                        notes: record.notes || '',
                        amount: safeNumber(record.amount),
                        status: record.status || 'Pending'
                    });
                });
            }
        } catch {}

        try {
            if (typeof managerHoursEntries !== 'undefined' && Array.isArray(managerHoursEntries)) {
                managerHoursEntries.forEach(record => {
                    if (!ownRecord(record.user_id, record.manager_name)) return;
                    const hours = safeNumber(record.hours);
                    const rate = safeNumber(record.hourly_rate);
                    entries.push({
                        id: `manager:${record.id}`,
                        date: String(record.date || '').slice(0, 10),
                        type: 'Manager Hours',
                        details: record.event_name || 'Management hours',
                        notes: record.notes || '',
                        hours,
                        rate,
                        amount: hours * rate,
                        status: record.status || 'Pending'
                    });
                });
            }
        } catch {}

        try {
            if (typeof equipmentHoursEntries !== 'undefined' && Array.isArray(equipmentHoursEntries)) {
                equipmentHoursEntries.forEach(record => {
                    if (!ownRecord(record.user_id, record.submitted_by)) return;
                    const hours = safeNumber(record.hours);
                    const rate = safeNumber(record.hourly_rate);
                    entries.push({
                        id: `equipment:${record.id}`,
                        date: String(record.date || '').slice(0, 10),
                        type: 'Equipment Hours',
                        details: [record.equipment_name, record.event_name].filter(Boolean).join(' • ') || 'Equipment hours',
                        notes: record.notes || '',
                        hours,
                        rate,
                        amount: hours * rate,
                        status: record.status || 'Pending'
                    });
                });
            }
        } catch {}

        return entries.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    }

    function summarize(entries) {
        return entries.reduce((summary, entry) => {
            summary.total += entry.amount;
            summary.count += 1;
            const status = String(entry.status || '').toLowerCase();
            if (status === 'approved') {
                summary.approved += entry.amount;
                summary.approvedCount += 1;
            } else if (status === 'denied') {
                summary.denied += entry.amount;
                summary.deniedCount += 1;
            } else {
                summary.pending += entry.amount;
                summary.pendingCount += 1;
            }
            summary.types[entry.type] = (summary.types[entry.type] || 0) + entry.amount;
            return summary;
        }, {
            total: 0,
            pending: 0,
            approved: 0,
            denied: 0,
            count: 0,
            pendingCount: 0,
            approvedCount: 0,
            deniedCount: 0,
            types: {}
        });
    }

    function formatDate(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value || '-';
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day).toLocaleDateString();
    }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${PANEL_ID}.hidden { display:none !important; }
            #${PANEL_ID} { display:grid; gap:16px; }
            .my-submissions-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; padding:20px; border:1px solid rgba(233,30,140,.24); border-radius:16px; background:linear-gradient(145deg,rgba(49,31,64,.98),rgba(32,23,43,.98)); }
            .my-submissions-header h2 { margin:0 0 5px; color:#fff; }
            .my-submissions-header p { margin:0; color:#b9adc5; line-height:1.5; }
            .my-submissions-summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:11px; }
            .my-submissions-card { padding:16px; border-radius:13px; border:1px solid rgba(255,255,255,.09); background:rgba(42,29,55,.84); }
            .my-submissions-card span { display:block; color:#a99bb5; font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.05em; }
            .my-submissions-card strong { display:block; margin:7px 0 3px; color:#fff; font-size:25px; }
            .my-submissions-card small { color:#998da3; }
            .my-submissions-card.pending { border-color:rgba(245,158,11,.35); }
            .my-submissions-card.approved { border-color:rgba(16,185,129,.35); }
            .my-submissions-card.denied { border-color:rgba(239,68,68,.35); }
            .my-submissions-breakdown { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
            .my-submissions-breakdown div { padding:12px 14px; border:1px solid rgba(255,255,255,.08); border-radius:11px; background:rgba(255,255,255,.035); }
            .my-submissions-breakdown span { display:block; color:#a99bb5; font-size:11px; text-transform:uppercase; font-weight:900; }
            .my-submissions-breakdown strong { display:block; margin-top:5px; color:#fff; font-size:18px; }
            .my-submissions-list { display:grid; gap:10px; }
            .my-submission-row { display:grid; grid-template-columns:120px minmax(170px,.7fr) minmax(240px,1.4fr) 130px 115px; gap:14px; align-items:center; padding:15px; border:1px solid rgba(255,255,255,.08); border-radius:12px; background:rgba(255,255,255,.035); }
            .my-submission-row.pending { border-left:4px solid #f59e0b; }
            .my-submission-row.approved { border-left:4px solid #10b981; }
            .my-submission-row.denied { border-left:4px solid #ef4444; }
            .my-submission-label { display:block; color:#95899f; font-size:10px; text-transform:uppercase; font-weight:900; letter-spacing:.05em; margin-bottom:4px; }
            .my-submission-value { color:#fff; font-weight:800; overflow-wrap:anywhere; }
            .my-submission-note { display:block; color:#9e92a7; font-size:12px; margin-top:3px; }
            .my-submission-amount { color:#fff; font-size:20px; font-weight:900; text-align:right; }
            .my-submission-status { display:inline-flex; justify-content:center; padding:6px 9px; border-radius:999px; font-size:11px; font-weight:900; }
            .my-submission-status.pending { color:#ffd98a; background:rgba(245,158,11,.13); }
            .my-submission-status.approved { color:#8cf0c6; background:rgba(16,185,129,.13); }
            .my-submission-status.denied { color:#fecaca; background:rgba(239,68,68,.13); }
            .my-submissions-empty { text-align:center; color:#a99bb5; padding:42px 20px; border:1px dashed rgba(255,255,255,.13); border-radius:13px; }
            @media(max-width:900px){ .my-submissions-summary,.my-submissions-breakdown{grid-template-columns:repeat(2,minmax(0,1fr));}.my-submission-row{grid-template-columns:repeat(2,minmax(0,1fr));}.my-submission-row>div:nth-child(3){grid-column:1/-1;}.my-submission-amount{text-align:left;} }
            @media(max-width:560px){ .my-submissions-header{flex-direction:column;}.my-submissions-summary,.my-submissions-breakdown,.my-submission-row{grid-template-columns:1fr;}.my-submission-row>div:nth-child(3){grid-column:1;} }
        `;
        document.head.appendChild(style);
    }

    function ensurePanel() {
        if (document.getElementById(PANEL_ID)) return document.getElementById(PANEL_ID);
        const panel = document.createElement('section');
        panel.id = PANEL_ID;
        panel.className = 'hidden';
        const chart = document.getElementById('submissionChartCard');
        if (chart?.parentNode) chart.parentNode.insertBefore(panel, chart.nextSibling);
        else document.querySelector('.container')?.appendChild(panel);
        return panel;
    }

    function ensureButton() {
        const chart = document.getElementById('submissionChartCard');
        if (!chart) return;
        let button = document.getElementById('bkViewSubmissionsBtn');
        if (!button) {
            const wrap = document.createElement('div');
            wrap.className = 'bk-dashboard-submission-action';
            wrap.innerHTML = '<span class="bk-dashboard-submission-note">Open one page to review every submission and amount.</span><button type="button" id="bkViewSubmissionsBtn">View My Submissions</button>';
            chart.appendChild(wrap);
            button = wrap.querySelector('button');
        }
        if (button && !button.textContent.trim()) button.textContent = 'View My Submissions';
    }

    function render() {
        const panel = ensurePanel();
        if (!panel) return;
        const entries = collectEntries();
        const summary = summarize(entries);

        panel.innerHTML = `
            <div class="my-submissions-header">
                <div>
                    <h2>My Submissions</h2>
                    <p>Review your show pay, commissions, management hours, and equipment hours in one place.</p>
                </div>
                <button type="button" id="closeMySubmissions" class="btn-secondary">Back to Dashboard</button>
            </div>
            <div class="my-submissions-summary">
                <article class="my-submissions-card pending"><span>Pending Total</span><strong>${money(summary.pending)}</strong><small>${summary.pendingCount} pending</small></article>
                <article class="my-submissions-card approved"><span>Approved Total</span><strong>${money(summary.approved)}</strong><small>${summary.approvedCount} approved</small></article>
                <article class="my-submissions-card denied"><span>Denied Total</span><strong>${money(summary.denied)}</strong><small>${summary.deniedCount} denied</small></article>
                <article class="my-submissions-card"><span>Total Submitted</span><strong>${money(summary.total)}</strong><small>${summary.count} submissions</small></article>
            </div>
            <div class="my-submissions-breakdown">
                <div><span>Show Pay</span><strong>${money(summary.types.Show)}</strong></div>
                <div><span>Commissions</span><strong>${money(summary.types.Commission)}</strong></div>
                <div><span>Management Hours</span><strong>${money(summary.types['Manager Hours'])}</strong></div>
                <div><span>Equipment Hours</span><strong>${money(summary.types['Equipment Hours'])}</strong></div>
            </div>
            <div class="my-submissions-list">
                ${entries.length ? entries.map(entry => {
                    const statusClass = String(entry.status || 'Pending').toLowerCase();
                    const hoursText = entry.hours
                        ? `${entry.hours.toFixed(2)} hours${entry.rate ? ` at ${money(entry.rate)}/hr` : ' • hourly rate not set'}`
                        : '';
                    return `
                        <article class="my-submission-row ${escapeHtml(statusClass)}">
                            <div><span class="my-submission-label">Date</span><span class="my-submission-value">${escapeHtml(formatDate(entry.date))}</span></div>
                            <div><span class="my-submission-label">Type</span><span class="my-submission-value">${escapeHtml(entry.type)}</span></div>
                            <div><span class="my-submission-label">Details</span><span class="my-submission-value">${escapeHtml(entry.details)}</span>${hoursText ? `<span class="my-submission-note">${escapeHtml(hoursText)}</span>` : ''}${entry.notes ? `<span class="my-submission-note">${escapeHtml(entry.notes)}</span>` : ''}</div>
                            <div><span class="my-submission-label">Amount</span><div class="my-submission-amount">${money(entry.amount)}</div></div>
                            <div><span class="my-submission-label">Status</span><span class="my-submission-status ${escapeHtml(statusClass)}">${escapeHtml(entry.status)}</span></div>
                        </article>`;
                }).join('') : '<div class="my-submissions-empty">No submissions have been found for your account.</div>'}
            </div>`;

        panel.querySelector('#closeMySubmissions')?.addEventListener('click', close);
    }

    function open() {
        if (!getUser() || !getProfile()) return;
        ensurePanel();
        render();
        if (typeof switchTab === 'function') switchTab('dashboard');
        document.getElementById('submissionChartCard')?.classList.add('hidden');
        document.getElementById('dashboardTotalsCard')?.classList.add('hidden');
        const panel = document.getElementById(PANEL_ID);
        panel?.classList.remove('hidden');
        panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function close() {
        document.getElementById(PANEL_ID)?.classList.add('hidden');
        if (typeof switchTab === 'function') switchTab('dashboard');
    }

    function initialize() {
        if (initialized) return;
        initialized = true;
        injectStyles();
        ensurePanel();
        ensureButton();

        document.addEventListener('click', event => {
            const viewButton = event.target.closest('#bkViewSubmissionsBtn');
            if (viewButton) {
                event.preventDefault();
                event.stopImmediatePropagation();
                open();
                return;
            }

            const tab = event.target.closest('.tab');
            if (tab) document.getElementById(PANEL_ID)?.classList.add('hidden');
        }, true);

        const observer = new MutationObserver(() => ensureButton());
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    window.MySubmissions = { open, close, render };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
})();
