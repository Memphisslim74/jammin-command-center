(() => {
    'use strict';

    const GENERIC_SUBTITLE = 'Connect the existing training course, match DJs, and synchronize progress.';

    function applyGenericClassroomCopy() {
        const title = document.getElementById('googleClassroomTitle');
        const subtitle = title?.parentElement?.querySelector('p');
        if (subtitle && subtitle.textContent !== GENERIC_SUBTITLE) {
            subtitle.textContent = GENERIC_SUBTITLE;
        }

        document.querySelectorAll('.classroom-connect-card h3').forEach((heading) => {
            const current = heading.textContent || '';
            if (/Connect .*Google Classroom/i.test(current) && current !== 'Connect Google Classroom') {
                heading.textContent = 'Connect Google Classroom';
            }
        });

        document.querySelectorAll('.classroom-loading').forEach((item) => {
            const current = item.textContent || '';
            const updated = current.replace(/Loading .*classrooms…/i, 'Loading classrooms…');
            if (updated !== current) item.textContent = updated;
        });
    }

    document.addEventListener('DOMContentLoaded', applyGenericClassroomCopy);

    const observer = new MutationObserver(() => applyGenericClassroomCopy());
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    setTimeout(() => observer.disconnect(), 30000);
})();

// Payroll submission review layout enhancer. This runs independently from app startup
// and only decorates the bookkeeper submission section after it exists.
(() => {
    'use strict';

    const STYLE_ID = 'bookkeeperSubmissionReviewStyles';
    const SUMMARY_ID = 'bkSubmissionReviewSummary';
    const CELL_LABELS = [
        'Select',
        'Work Date',
        'Staff Member',
        'Pay Type',
        'Submission Details',
        'Hours / Rate',
        'Amount',
        'Status',
        'Review Actions'
    ];

    let scheduled = false;

    function parseMoney(value) {
        const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''));
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function formatMoney(value) {
        return `$${Number(value || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .bk-submission-review .bk-entry-heading {
                align-items: stretch !important;
                flex-direction: column !important;
                gap: 16px !important;
            }
            .bk-submission-review .bk-entry-filters {
                display: grid !important;
                grid-template-columns: minmax(180px, 1fr) minmax(170px, .85fr) minmax(240px, 1.35fr);
                gap: 10px !important;
                width: 100%;
                padding: 12px;
                border: 1px solid rgba(255,255,255,.08);
                border-radius: 12px;
                background: rgba(10,7,15,.32);
            }
            .bk-submission-review .bk-entry-filters > * {
                width: 100% !important;
                min-width: 0 !important;
            }
            .bk-submission-summary {
                display: grid;
                grid-template-columns: repeat(5, minmax(0, 1fr));
                gap: 9px;
                margin: 14px 0 10px;
            }
            .bk-submission-summary-item {
                min-width: 0;
                padding: 11px 13px;
                border-radius: 11px;
                border: 1px solid rgba(255,255,255,.08);
                background: rgba(255,255,255,.035);
            }
            .bk-submission-summary-item span {
                display: block;
                color: #a99bb5;
                font-size: 10px;
                font-weight: 900;
                letter-spacing: .055em;
                text-transform: uppercase;
            }
            .bk-submission-summary-item strong {
                display: block;
                margin-top: 5px;
                color: #fff;
                font-size: 18px;
                overflow-wrap: anywhere;
            }
            .bk-submission-summary-item.pending {
                border-color: rgba(245,158,11,.30);
                background: rgba(245,158,11,.075);
            }
            .bk-submission-summary-item.approved {
                border-color: rgba(16,185,129,.25);
                background: rgba(16,185,129,.06);
            }
            .bk-submission-summary-item.denied {
                border-color: rgba(239,68,68,.25);
                background: rgba(239,68,68,.06);
            }
            .bk-submission-review .bk-bulk-bar {
                position: sticky;
                top: 8px;
                z-index: 25;
                margin: 10px 0 14px !important;
                padding: 12px 14px !important;
                background: rgba(35,23,46,.97) !important;
                border-color: rgba(233,30,140,.23) !important;
                box-shadow: 0 12px 28px rgba(0,0,0,.26);
                backdrop-filter: blur(10px);
            }
            .bk-submission-review .payroll-table-wrap,
            .bk-submission-review .bk-table-scroll {
                overflow: visible !important;
            }
            .bk-submission-review .bk-entry-table {
                display: block !important;
                width: 100% !important;
                min-width: 0 !important;
                border: 0 !important;
            }
            .bk-submission-review .bk-entry-table thead {
                display: none !important;
            }
            .bk-submission-review .bk-entry-table tbody {
                display: grid !important;
                gap: 12px;
                width: 100%;
            }
            .bk-submission-review .bk-entry-table tbody tr {
                position: relative;
                display: grid !important;
                grid-template-columns: 38px minmax(170px, 1.15fr) minmax(250px, 2fr) minmax(115px, .75fr) minmax(115px, .7fr) minmax(175px, 1fr);
                grid-template-areas:
                    "check staff details rate amount actions"
                    "check date details status amount actions"
                    "check type details status amount actions";
                gap: 4px 14px;
                width: 100%;
                padding: 16px;
                border: 1px solid rgba(255,255,255,.09);
                border-left: 4px solid rgba(148,163,184,.42);
                border-radius: 14px;
                background: linear-gradient(145deg, rgba(45,31,57,.92), rgba(27,19,36,.95));
                box-shadow: 0 10px 26px rgba(0,0,0,.18);
            }
            .bk-submission-review .bk-entry-table tbody tr[data-status="pending"] {
                border-left-color: #f59e0b;
                background: linear-gradient(145deg, rgba(75,51,32,.72), rgba(29,21,34,.97));
            }
            .bk-submission-review .bk-entry-table tbody tr[data-status="approved"] {
                border-left-color: #10b981;
            }
            .bk-submission-review .bk-entry-table tbody tr[data-status="denied"] {
                border-left-color: #ef4444;
            }
            .bk-submission-review .bk-entry-table tbody td {
                display: flex !important;
                min-width: 0;
                padding: 2px 0 !important;
                border: 0 !important;
                align-items: flex-start;
                flex-direction: column;
                justify-content: center;
                color: #eee8f2;
                line-height: 1.4;
            }
            .bk-submission-review .bk-entry-table tbody td::before {
                content: attr(data-label);
                display: block;
                margin-bottom: 3px;
                color: #92859d;
                font-size: 9px;
                font-weight: 900;
                letter-spacing: .07em;
                text-transform: uppercase;
            }
            .bk-submission-review .bk-entry-table tbody td:nth-child(1) {
                grid-area: check;
                align-items: center;
                justify-content: flex-start;
                padding-top: 5px !important;
            }
            .bk-submission-review .bk-entry-table tbody td:nth-child(1)::before {
                display: none;
            }
            .bk-submission-review .bk-entry-table tbody td:nth-child(2) { grid-area: date; }
            .bk-submission-review .bk-entry-table tbody td:nth-child(3) { grid-area: staff; }
            .bk-submission-review .bk-entry-table tbody td:nth-child(4) { grid-area: type; }
            .bk-submission-review .bk-entry-table tbody td:nth-child(5) { grid-area: details; justify-content: flex-start; }
            .bk-submission-review .bk-entry-table tbody td:nth-child(6) { grid-area: rate; }
            .bk-submission-review .bk-entry-table tbody td:nth-child(7) {
                grid-area: amount;
                align-items: flex-end;
                text-align: right;
                font-size: 22px;
                font-weight: 950;
                color: #fff !important;
            }
            .bk-submission-review .bk-entry-table tbody td:nth-child(8) { grid-area: status; }
            .bk-submission-review .bk-entry-table tbody td:nth-child(9) {
                grid-area: actions;
                display: grid !important;
                grid-template-columns: 1fr;
                align-content: center;
                gap: 8px;
            }
            .bk-submission-review .bk-entry-table tbody td:nth-child(9)::before {
                text-align: center;
            }
            .bk-submission-review .bk-staff-name {
                font-size: 16px;
                line-height: 1.25;
            }
            .bk-submission-review .bk-entry-notes {
                width: 100%;
                margin-top: 8px !important;
                padding-top: 8px;
                border-top: 1px solid rgba(255,255,255,.07);
                line-height: 1.45;
            }
            .bk-submission-review .bk-entry-action {
                width: 100%;
                min-height: 42px !important;
                margin: 0 !important;
                padding: 9px 12px !important;
                border-radius: 8px !important;
                font-size: 13px !important;
                font-weight: 850;
            }
            .bk-submission-review .bk-entry-table tbody tr[data-status="pending"] td:nth-child(7) {
                color: #ffe2a8 !important;
            }
            .bk-submission-review .bk-entry-checkbox {
                width: 19px;
                height: 19px;
                accent-color: #e91e8c;
            }
            .bk-submission-review .payroll-empty {
                padding: 34px 18px;
                border: 1px dashed rgba(255,255,255,.14);
                border-radius: 12px;
                background: rgba(255,255,255,.025);
                text-align: center;
            }
            @media (max-width: 1120px) {
                .bk-submission-summary {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }
                .bk-submission-review .bk-entry-table tbody tr {
                    grid-template-columns: 34px minmax(160px, 1fr) minmax(220px, 1.6fr) minmax(110px, .7fr) minmax(150px, .9fr);
                    grid-template-areas:
                        "check staff details amount actions"
                        "check date details status actions"
                        "check type rate status actions";
                }
            }
            @media (max-width: 820px) {
                .bk-submission-review .bk-entry-filters {
                    grid-template-columns: 1fr;
                }
                .bk-submission-summary {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
                .bk-submission-review .bk-entry-table tbody tr {
                    grid-template-columns: 30px minmax(0, 1fr) auto;
                    grid-template-areas:
                        "check staff amount"
                        "check date amount"
                        "check type type"
                        "details details details"
                        "rate rate rate"
                        "status status status"
                        "actions actions actions";
                    gap: 9px 12px;
                    padding: 14px;
                }
                .bk-submission-review .bk-entry-table tbody td:nth-child(7) {
                    font-size: 20px;
                }
                .bk-submission-review .bk-entry-table tbody td:nth-child(9) {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
                .bk-submission-review .bk-entry-table tbody td:nth-child(9)::before {
                    grid-column: 1 / -1;
                }
            }
            @media (max-width: 520px) {
                .bk-submission-summary {
                    grid-template-columns: 1fr;
                }
                .bk-submission-review .bk-bulk-bar {
                    position: static;
                }
                .bk-submission-review .bk-entry-table tbody tr {
                    grid-template-columns: 28px minmax(0, 1fr);
                    grid-template-areas:
                        "check staff"
                        "check amount"
                        "date date"
                        "type type"
                        "details details"
                        "rate rate"
                        "status status"
                        "actions actions";
                }
                .bk-submission-review .bk-entry-table tbody td:nth-child(7) {
                    align-items: flex-start;
                    text-align: left;
                }
                .bk-submission-review .bk-entry-table tbody td:nth-child(9) {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function summarizeRows(rows) {
        return rows.reduce((summary, row) => {
            const cells = row.children;
            if (cells.length < 9) return summary;

            const status = String(cells[7].textContent || '').trim().toLowerCase();
            summary.visible += 1;
            summary.total += parseMoney(cells[6].textContent);
            if (status === 'pending') summary.pending += 1;
            else if (status === 'approved') summary.approved += 1;
            else if (status === 'denied') summary.denied += 1;
            return summary;
        }, { visible: 0, pending: 0, approved: 0, denied: 0, total: 0 });
    }

    function updateSummary(section, rows) {
        let summary = section.querySelector(`#${SUMMARY_ID}`);
        if (!summary) {
            summary = document.createElement('div');
            summary.id = SUMMARY_ID;
            summary.className = 'bk-submission-summary';
            const bulkBar = section.querySelector('#bkBulkBar');
            if (bulkBar) bulkBar.insertAdjacentElement('beforebegin', summary);
            else section.appendChild(summary);
        }

        const totals = summarizeRows(rows);
        const markup = `
            <div class="bk-submission-summary-item">
                <span>Visible Submissions</span>
                <strong>${totals.visible}</strong>
            </div>
            <div class="bk-submission-summary-item pending">
                <span>Needs Review</span>
                <strong>${totals.pending}</strong>
            </div>
            <div class="bk-submission-summary-item approved">
                <span>Approved</span>
                <strong>${totals.approved}</strong>
            </div>
            <div class="bk-submission-summary-item denied">
                <span>Denied</span>
                <strong>${totals.denied}</strong>
            </div>
            <div class="bk-submission-summary-item">
                <span>Visible Amount</span>
                <strong>${formatMoney(totals.total)}</strong>
            </div>
        `;

        if (summary.innerHTML !== markup) summary.innerHTML = markup;
    }

    function enhanceSubmissionView() {
        const section = document.querySelector('.bk-entry-section');
        if (!section) return;

        ensureStyles();
        if (!section.classList.contains('bk-submission-review')) {
            section.classList.add('bk-submission-review');
        }

        const rows = Array.from(section.querySelectorAll('#payrollBody tr'));
        rows.forEach((row) => {
            const cells = Array.from(row.children);
            if (cells.length < 9) return;

            const status = String(cells[7].textContent || '').trim().toLowerCase();
            if (row.dataset.status !== status) row.dataset.status = status;

            cells.forEach((cell, index) => {
                const label = CELL_LABELS[index] || '';
                if (cell.dataset.label !== label) cell.dataset.label = label;
            });
        });

        updateSummary(section, rows);
    }

    function scheduleEnhancement() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            try {
                enhanceSubmissionView();
            } catch (error) {
                console.warn('Payroll submission view enhancement skipped:', error);
            }
        });
    }

    function start() {
        scheduleEnhancement();
        const root = document.body || document.documentElement;
        const observer = new MutationObserver(scheduleEnhancement);
        observer.observe(root, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
