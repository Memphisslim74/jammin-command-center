(() => {
    'use strict';

    const BRAND = {
        pink: '#e91e8c',
        pinkDark: '#a30f5e',
        purple: '#5d2a72',
        ink: '#17141b',
        muted: '#6f6875',
        line: '#ddd8e1',
        soft: '#f7f3f7',
        green: '#087f5b',
        greenSoft: '#e8f7f1',
        amber: '#9a5b00',
        amberSoft: '#fff5df'
    };

    const esc = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const getRoleSafe = () => {
        try {
            if (typeof getRole === 'function') return getRole();
            return typeof currentProfile !== 'undefined' ? currentProfile?.role || 'user' : 'user';
        } catch (_) {
            return 'user';
        }
    };

    const showPrintError = (message) => {
        if (typeof showError === 'function') showError(message);
        else alert(message);
    };

    const displayName = (profile) => profile?.full_name || profile?.email || 'Unnamed staff member';

    function formatDate(value) {
        if (!value) return '—';
        const raw = String(value).slice(0, 10);
        const date = new Date(`${raw}T12:00:00`);
        if (Number.isNaN(date.getTime())) return raw;
        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        }).format(date);
    }

    function generatedDate() {
        return new Intl.DateTimeFormat('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit'
        }).format(new Date());
    }

    function getLogoSource() {
        const logo = document.querySelector('.logo') || document.querySelector('.login-logo');
        return logo?.src || '';
    }

    async function loadPrintData() {
        const [categoryResult, trainingResult] = await Promise.all([
            supabaseClient
                .from('training_categories')
                .select('*')
                .eq('active', true)
                .order('sort_order', { ascending: true }),
            supabaseClient
                .from('staff_training')
                .select('*')
                .order('updated_at', { ascending: false })
        ]);

        if (categoryResult.error) throw categoryResult.error;
        if (trainingResult.error) throw trainingResult.error;

        return {
            categories: categoryResult.data || [],
            records: trainingResult.data || []
        };
    }

    async function loadProfiles() {
        if (typeof users !== 'undefined' && Array.isArray(users) && users.length) {
            return [...users];
        }

        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .order('full_name', { ascending: true });
        if (error) throw error;
        return data || [];
    }

    async function loadProfile(userId) {
        if (typeof users !== 'undefined' && Array.isArray(users)) {
            const found = users.find((item) => item.id === userId);
            if (found) return found;
        }

        if (typeof currentProfile !== 'undefined' && currentProfile?.id === userId) {
            return currentProfile;
        }

        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) throw error;
        return data;
    }

    function recordFor(records, userId, categoryId) {
        return records.find((record) =>
            record.dj_user_id === userId &&
            record.training_category_id === categoryId &&
            !record.custom_label
        );
    }

    function otherRecords(records, userId, categoryId) {
        return records.filter((record) =>
            record.dj_user_id === userId &&
            record.training_category_id === categoryId &&
            record.custom_label
        );
    }

    function progressFor(categories, records, userId) {
        const required = categories.filter((category) => category.is_required && category.active !== false);
        const complete = required.filter((category) => recordFor(records, userId, category.id)?.status === 'complete').length;
        const total = required.length;
        return {
            complete,
            total,
            percent: total ? Math.round((complete / total) * 100) : 0,
            isComplete: total > 0 && complete === total
        };
    }

    function statusChip(isComplete, text) {
        return `<span class="status-chip ${isComplete ? 'status-complete' : 'status-incomplete'}">${esc(text || (isComplete ? 'Complete' : 'Incomplete'))}</span>`;
    }

    function baseStyles() {
        return `
            @page { size: Letter; margin: 0.42in; }
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; }
            body {
                font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
                color: ${BRAND.ink};
                background: #fff;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                font-size: 12px;
                line-height: 1.45;
            }
            .page { width: 100%; }
            .brand-header {
                position: relative;
                display: grid;
                grid-template-columns: 150px 1fr;
                align-items: center;
                gap: 24px;
                min-height: 118px;
                padding: 22px 26px;
                border-radius: 18px;
                overflow: hidden;
                background: linear-gradient(135deg, #17141b 0%, #2a1a31 55%, #4b1c43 100%);
                color: #fff;
                box-shadow: 0 12px 32px rgba(23,20,27,.16);
            }
            .brand-header::after {
                content: "";
                position: absolute;
                right: -70px;
                bottom: -100px;
                width: 260px;
                height: 260px;
                border-radius: 50%;
                border: 44px solid rgba(233,30,140,.18);
            }
            .logo-wrap {
                position: relative;
                z-index: 2;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 74px;
            }
            .logo-wrap img { width: 145px; max-height: 76px; object-fit: contain; }
            .header-copy { position: relative; z-index: 2; }
            .eyebrow {
                display: inline-flex;
                padding: 5px 9px;
                margin-bottom: 8px;
                border: 1px solid rgba(255,255,255,.28);
                border-radius: 999px;
                color: #ffd6ec;
                font-size: 9px;
                font-weight: 800;
                letter-spacing: .14em;
                text-transform: uppercase;
            }
            h1 { margin: 0; font-size: 27px; line-height: 1.08; letter-spacing: -.02em; }
            .header-meta { margin-top: 8px; color: #d9cfdc; font-size: 10.5px; }
            .section-title {
                display: flex;
                align-items: center;
                gap: 10px;
                margin: 22px 0 10px;
                font-size: 13px;
                font-weight: 850;
                letter-spacing: .04em;
                text-transform: uppercase;
                color: ${BRAND.pinkDark};
            }
            .section-title::after { content: ""; height: 1px; flex: 1; background: ${BRAND.line}; }
            .summary-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(0,1fr));
                gap: 10px;
            }
            .summary-card {
                min-height: 72px;
                padding: 12px 13px;
                border: 1px solid ${BRAND.line};
                border-radius: 11px;
                background: linear-gradient(180deg,#fff 0%,#fbf9fb 100%);
            }
            .summary-label {
                color: ${BRAND.muted};
                font-size: 8.5px;
                font-weight: 800;
                letter-spacing: .1em;
                text-transform: uppercase;
                margin-bottom: 6px;
            }
            .summary-value { color: ${BRAND.ink}; font-size: 12px; font-weight: 760; overflow-wrap: anywhere; }
            .progress-panel {
                display: grid;
                grid-template-columns: 1fr auto;
                gap: 22px;
                align-items: center;
                margin-top: 12px;
                padding: 14px 16px;
                border-radius: 12px;
                background: ${BRAND.soft};
                border-left: 5px solid ${BRAND.pink};
            }
            .progress-copy strong { display:block; font-size: 15px; margin-bottom: 5px; }
            .progress-copy span { color: ${BRAND.muted}; font-size: 10px; }
            .progress-track { height: 9px; margin-top: 9px; border-radius: 999px; background:#e5dfe7; overflow:hidden; }
            .progress-fill { height:100%; border-radius:inherit; background:linear-gradient(90deg,${BRAND.pink},${BRAND.purple}); }
            .progress-percent { font-size: 25px; font-weight: 900; color: ${BRAND.pinkDark}; }
            table { width:100%; border-collapse: separate; border-spacing:0; border:1px solid ${BRAND.line}; border-radius:12px; overflow:hidden; }
            thead { display: table-header-group; }
            th {
                padding: 10px 11px;
                text-align:left;
                background: #231b27;
                color:#fff;
                font-size: 9px;
                font-weight: 800;
                letter-spacing:.06em;
                text-transform:uppercase;
            }
            td { padding: 10px 11px; border-bottom:1px solid #ebe7ed; vertical-align:middle; font-size:10.5px; }
            tbody tr:nth-child(even) td { background:#fbfafb; }
            tbody tr:last-child td { border-bottom:0; }
            tr { break-inside: avoid; }
            .training-name { font-weight: 760; color:${BRAND.ink}; }
            .training-note { display:block; margin-top:2px; color:${BRAND.muted}; font-size:8.7px; }
            .status-chip {
                display:inline-flex;
                align-items:center;
                justify-content:center;
                min-width:70px;
                padding:4px 8px;
                border-radius:999px;
                font-size:8.5px;
                font-weight:850;
            }
            .status-complete { color:${BRAND.green}; background:${BRAND.greenSoft}; border:1px solid #b7e7d6; }
            .status-incomplete { color:${BRAND.amber}; background:${BRAND.amberSoft}; border:1px solid #f0d69b; }
            .mini-progress { width:90px; height:6px; border-radius:999px; background:#e8e3e9; overflow:hidden; margin-top:4px; }
            .mini-progress span { display:block; height:100%; background:linear-gradient(90deg,${BRAND.pink},${BRAND.purple}); }
            .report-footer {
                display:flex;
                justify-content:space-between;
                gap:20px;
                margin-top:18px;
                padding-top:11px;
                border-top:1px solid ${BRAND.line};
                color:${BRAND.muted};
                font-size:8.5px;
            }
            .official-mark { color:${BRAND.pinkDark}; font-weight:850; letter-spacing:.07em; text-transform:uppercase; }
            .roster-summary { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:16px; }
            .roster-stat { padding:12px; border-radius:11px; color:#fff; background:linear-gradient(135deg,#2b202f,#4a2144); }
            .roster-stat.primary { background:linear-gradient(135deg,${BRAND.pinkDark},${BRAND.purple}); }
            .roster-stat span { display:block; color:#e3d8e5; font-size:8px; font-weight:800; letter-spacing:.09em; text-transform:uppercase; }
            .roster-stat strong { display:block; margin-top:5px; font-size:20px; }
            @media print {
                .brand-header { box-shadow:none; }
                .page { break-after:auto; }
            }
        `;
    }

    function reportDocument({ title, eyebrow, content }) {
        const logo = getLogoSource();
        return `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${esc(title)}</title>
    <style>${baseStyles()}</style>
</head>
<body>
    <main class="page">
        <header class="brand-header">
            <div class="logo-wrap">${logo ? `<img src="${esc(logo)}" alt="JAMMIN DJs">` : ''}</div>
            <div class="header-copy">
                <div class="eyebrow">${esc(eyebrow)}</div>
                <h1>${esc(title)}</h1>
                <div class="header-meta">JAMMIN Command Center &nbsp;•&nbsp; Generated ${esc(generatedDate())}</div>
            </div>
        </header>
        ${content}
        <footer class="report-footer">
            <span>This report reflects the training records stored in the JAMMIN Command Center when generated.</span>
            <span class="official-mark">Official Training Record</span>
        </footer>
    </main>
</body>
</html>`;
    }

    function openPrintWindow(html) {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showPrintError('The browser blocked the PDF window. Allow pop-ups for the Command Center and try again.');
            return;
        }

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();

        const printWhenReady = () => {
            const images = Array.from(printWindow.document.images || []);
            if (!images.length || images.every((img) => img.complete)) {
                setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                }, 250);
                return;
            }
            setTimeout(printWhenReady, 100);
        };
        printWhenReady();
    }

    async function premiumPrintProfile(userId) {
        try {
            if (getRoleSafe() !== 'admin') {
                showPrintError('Only administrators can generate training PDFs.');
                return;
            }

            const [profile, training] = await Promise.all([
                loadProfile(userId),
                loadPrintData()
            ]);

            const progress = progressFor(training.categories, training.records, userId);
            const location = [profile.city, profile.state].filter(Boolean).join(', ') || 'Not provided';
            const requiredCategories = training.categories.filter((category) => category.code !== 'other_event_type');
            const otherCategory = training.categories.find((category) => category.code === 'other_event_type');

            const rows = requiredCategories.map((category) => {
                const record = recordFor(training.records, userId, category.id);
                const complete = record?.status === 'complete';
                return `<tr>
                    <td><span class="training-name">${esc(category.name)}</span>${category.description ? `<span class="training-note">${esc(category.description)}</span>` : ''}</td>
                    <td>${statusChip(complete)}</td>
                    <td>${complete ? esc(formatDate(record.completion_date)) : '—'}</td>
                    <td>${complete ? esc(record.completed_by_name || 'Unknown') : '—'}</td>
                </tr>`;
            });

            if (otherCategory) {
                otherRecords(training.records, userId, otherCategory.id).forEach((record) => {
                    const complete = record.status === 'complete';
                    rows.push(`<tr>
                        <td><span class="training-name">${esc(record.custom_label || 'Other Event Type')}</span><span class="training-note">Additional event-type training</span></td>
                        <td>${statusChip(complete)}</td>
                        <td>${complete ? esc(formatDate(record.completion_date)) : '—'}</td>
                        <td>${complete ? esc(record.completed_by_name || 'Unknown') : '—'}</td>
                    </tr>`);
                });
            }

            const html = reportDocument({
                title: `${displayName(profile)} — DJ Training Profile`,
                eyebrow: 'Individual Training Record',
                content: `
                    <div class="section-title">DJ Information</div>
                    <section class="summary-grid">
                        <div class="summary-card"><div class="summary-label">Email</div><div class="summary-value">${esc(profile.email || 'Not provided')}</div></div>
                        <div class="summary-card"><div class="summary-label">Phone</div><div class="summary-value">${esc(profile.phone || 'Not provided')}</div></div>
                        <div class="summary-card"><div class="summary-label">Location</div><div class="summary-value">${esc(location)}</div></div>
                        <div class="summary-card"><div class="summary-label">Access Level</div><div class="summary-value">${esc(profile.role || 'user')}</div></div>
                    </section>
                    <section class="progress-panel">
                        <div class="progress-copy">
                            <strong>${progress.complete} of ${progress.total} required items complete</strong>
                            <span>${progress.isComplete ? 'All required JAMMIN training has been verified.' : `${progress.total - progress.complete} required item${progress.total - progress.complete === 1 ? '' : 's'} remaining.`}</span>
                            <div class="progress-track"><div class="progress-fill" style="width:${progress.percent}%"></div></div>
                        </div>
                        <div class="progress-percent">${progress.percent}%</div>
                    </section>
                    <div class="section-title">Training Verification</div>
                    <table>
                        <thead><tr><th style="width:38%">Training</th><th style="width:16%">Status</th><th style="width:19%">Completion Date</th><th>Signed Off By</th></tr></thead>
                        <tbody>${rows.join('')}</tbody>
                    </table>`
            });

            openPrintWindow(html);
        } catch (error) {
            console.error('Premium training profile PDF error:', error);
            showPrintError(`Unable to create the training PDF: ${error.message || error}`);
        }
    }

    async function premiumPrintRoster() {
        try {
            if (getRoleSafe() !== 'admin') {
                showPrintError('Only administrators can generate the training roster PDF.');
                return;
            }

            const [profiles, training] = await Promise.all([
                loadProfiles(),
                loadPrintData()
            ]);

            const active = profiles
                .filter((profile) => (profile.status || 'active') === 'active')
                .sort((a, b) => displayName(a).localeCompare(displayName(b)));

            const completeCount = active.filter((profile) => progressFor(training.categories, training.records, profile.id).isComplete).length;
            const incompleteCount = active.length - completeCount;
            const completionRate = active.length ? Math.round((completeCount / active.length) * 100) : 0;

            const rows = active.map((profile) => {
                const progress = progressFor(training.categories, training.records, profile.id);
                const location = [profile.city, profile.state].filter(Boolean).join(', ') || '—';
                return `<tr>
                    <td><span class="training-name">${esc(displayName(profile))}</span><span class="training-note">${esc(profile.email || 'No email')}</span></td>
                    <td>${esc(location)}</td>
                    <td><strong>${progress.complete}/${progress.total}</strong><div class="mini-progress"><span style="width:${progress.percent}%"></span></div></td>
                    <td>${statusChip(progress.isComplete, progress.isComplete ? 'Complete' : 'In Progress')}</td>
                </tr>`;
            }).join('');

            const html = reportDocument({
                title: 'DJ Training Roster',
                eyebrow: 'Company Training Overview',
                content: `
                    <section class="roster-summary">
                        <div class="roster-stat primary"><span>Active Staff</span><strong>${active.length}</strong></div>
                        <div class="roster-stat"><span>Training Complete</span><strong>${completeCount}</strong></div>
                        <div class="roster-stat"><span>In Progress</span><strong>${incompleteCount}</strong></div>
                        <div class="roster-stat"><span>Completion Rate</span><strong>${completionRate}%</strong></div>
                    </section>
                    <div class="section-title">Roster Details</div>
                    <table>
                        <thead><tr><th style="width:36%">DJ / Staff Member</th><th style="width:22%">Location</th><th style="width:21%">Progress</th><th>Status</th></tr></thead>
                        <tbody>${rows || '<tr><td colspan="4">No active staff profiles were found.</td></tr>'}</tbody>
                    </table>`
            });

            openPrintWindow(html);
        } catch (error) {
            console.error('Premium training roster PDF error:', error);
            showPrintError(`Unable to create the roster PDF: ${error.message || error}`);
        }
    }

    function installPremiumPrinting() {
        if (!window.JamminTraining || window.JamminTraining.__premiumPrintingInstalled) return false;

        window.JamminTraining.standardPrintProfile = window.JamminTraining.printProfile;
        window.JamminTraining.standardPrintRoster = window.JamminTraining.printRoster;
        window.JamminTraining.printProfile = premiumPrintProfile;
        window.JamminTraining.printFromCard = premiumPrintProfile;
        window.JamminTraining.printRoster = premiumPrintRoster;
        window.JamminTraining.__premiumPrintingInstalled = true;
        return true;
    }

    if (!installPremiumPrinting()) {
        const timer = setInterval(() => {
            if (installPremiumPrinting()) clearInterval(timer);
        }, 250);
        setTimeout(() => clearInterval(timer), 30000);
    }
})();
