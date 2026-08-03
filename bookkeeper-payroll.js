(() => {
    'use strict';

    const STORAGE_START = 'jammin-bookkeeper-payroll-start';
    const STORAGE_END = 'jammin-bookkeeper-payroll-end';
    const SOURCE_TABLES = {
        commission: 'commissions',
        show: 'shows',
        manager_hours: 'manager_hours',
        equipment_hours: 'equipment_hours'
    };

    const state = {
        initialized: false,
        periodsReady: false,
        periods: [],
        selectedPeriodId: '',
        selectedEntries: new Set(),
        loading: false,
        lastFingerprint: '',
        observer: null,
        interval: null
    };

    const safeNumber = (value) => {
        const number = Number(value || 0);
        return Number.isFinite(number) ? number : 0;
    };

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const normalizeName = (value) => String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

    const formatMoney = (value) => `$${safeNumber(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;

    const isoDate = (value) => String(value || '').slice(0, 10);

    const formatDate = (value) => {
        const dateValue = isoDate(value);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return value || '-';
        const [year, month, day] = dateValue.split('-').map(Number);
        return new Date(year, month - 1, day).toLocaleDateString();
    };

    function getClient() {
        try {
            return typeof supabaseClient !== 'undefined' ? supabaseClient : null;
        } catch {
            return null;
        }
    }

    function getCurrentUser() {
        try {
            return typeof currentUser !== 'undefined' ? currentUser : null;
        } catch {
            return null;
        }
    }

    function getCurrentProfile() {
        try {
            return typeof currentProfile !== 'undefined' ? currentProfile : null;
        } catch {
            return null;
        }
    }

    function getProfiles() {
        try {
            return typeof users !== 'undefined' && Array.isArray(users) ? users : [];
        } catch {
            return [];
        }
    }

    function getCommissions() {
        try {
            return typeof commissions !== 'undefined' && Array.isArray(commissions) ? commissions : [];
        } catch {
            return [];
        }
    }

    function getShows() {
        try {
            return typeof shows !== 'undefined' && Array.isArray(shows) ? shows : [];
        } catch {
            return [];
        }
    }

    function getManagerHours() {
        try {
            return typeof managerHoursEntries !== 'undefined' && Array.isArray(managerHoursEntries)
                ? managerHoursEntries
                : [];
        } catch {
            return [];
        }
    }

    function getEquipmentHours() {
        try {
            return typeof equipmentHoursEntries !== 'undefined' && Array.isArray(equipmentHoursEntries)
                ? equipmentHoursEntries
                : [];
        } catch {
            return [];
        }
    }

    function canUsePayroll() {
        const role = getCurrentProfile()?.role;
        return role === 'admin' || role === 'manager';
    }

    function canApprovePayroll() {
        return canUsePayroll();
    }

    function notifySuccess(message) {
        try {
            if (typeof showSuccess === 'function') {
                showSuccess(message);
                return;
            }
        } catch {}
        alert(message);
    }

    function notifyError(message) {
        try {
            if (typeof showError === 'function') {
                showError(message);
                return;
            }
        } catch {}
        console.error(message);
    }

    function profileForEntry(entry) {
        const profiles = getProfiles();

        if (entry.userId) {
            const idMatch = profiles.find(profile => profile.id === entry.userId);
            if (idMatch) return idMatch;
        }

        const enteredName = normalizeName(entry.staffName);
        if (!enteredName) return null;

        const exact = profiles.filter(profile => {
            const fullName = normalizeName(profile.full_name);
            const email = normalizeName(profile.email);
            return enteredName === fullName || enteredName === email;
        });
        if (exact.length === 1) return exact[0];

        if (!enteredName.includes(' ')) {
            const firstNameMatches = profiles.filter(profile => {
                const fullName = normalizeName(profile.full_name);
                return fullName === enteredName || fullName.startsWith(`${enteredName} `);
            });
            if (firstNameMatches.length === 1) return firstNameMatches[0];
        }

        return null;
    }

    function enrichEntry(entry) {
        const profile = profileForEntry(entry);
        return {
            ...entry,
            profile,
            staffKey: profile?.id ? `user:${profile.id}` : `name:${normalizeName(entry.staffName)}`,
            staffName: profile?.full_name || entry.staffName || profile?.email || 'Unknown Staff Member',
            email: profile?.email || ''
        };
    }

    function collectEntries() {
        const entries = [];

        getShows().forEach(record => {
            const amount = safeNumber(record.show_pay_amount);
            entries.push(enrichEntry({
                sourceType: 'show',
                sourceId: String(record.id),
                userId: record.user_id,
                date: isoDate(record.date),
                typeLabel: 'Show',
                staffName: record.dj_name,
                details: record.venue_name || '-',
                notes: record.notes || '',
                hours: 0,
                rate: 0,
                amount,
                showPay: amount,
                commissionPay: 0,
                managementPay: 0,
                equipmentPay: 0,
                status: record.status || 'Pending',
                raw: record
            }));
        });

        getCommissions().forEach(record => {
            const amount = safeNumber(record.amount);
            entries.push(enrichEntry({
                sourceType: 'commission',
                sourceId: String(record.id),
                userId: record.user_id,
                date: isoDate(record.date),
                typeLabel: 'Commission',
                staffName: record.dj_name,
                details: record.event_name || '-',
                notes: record.notes || '',
                hours: 0,
                rate: 0,
                amount,
                showPay: 0,
                commissionPay: amount,
                managementPay: 0,
                equipmentPay: 0,
                status: record.status || 'Pending',
                raw: record
            }));
        });

        getManagerHours().forEach(record => {
            const hours = safeNumber(record.hours);
            const rate = safeNumber(record.hourly_rate);
            const amount = hours * rate;
            entries.push(enrichEntry({
                sourceType: 'manager_hours',
                sourceId: String(record.id),
                userId: record.user_id,
                date: isoDate(record.date),
                typeLabel: 'Management Hours',
                staffName: record.manager_name,
                details: record.event_name || '-',
                notes: record.notes || '',
                hours,
                rate,
                amount,
                showPay: 0,
                commissionPay: 0,
                managementPay: amount,
                equipmentPay: 0,
                status: record.status || 'Pending',
                raw: record
            }));
        });

        getEquipmentHours().forEach(record => {
            const hours = safeNumber(record.hours);
            const rate = safeNumber(record.hourly_rate);
            const amount = hours * rate;
            entries.push(enrichEntry({
                sourceType: 'equipment_hours',
                sourceId: String(record.id),
                userId: record.user_id,
                date: isoDate(record.date),
                typeLabel: 'Equipment Hours',
                staffName: record.submitted_by,
                details: [record.equipment_name, record.event_name].filter(Boolean).join(' • ') || '-',
                notes: record.notes || '',
                hours,
                rate,
                amount,
                showPay: 0,
                commissionPay: 0,
                managementPay: 0,
                equipmentPay: amount,
                status: record.status || 'Pending',
                raw: record
            }));
        });

        return entries.sort((a, b) =>
            String(b.date).localeCompare(String(a.date)) ||
            String(a.staffName).localeCompare(String(b.staffName))
        );
    }

    function entryKey(entry) {
        return `${entry.sourceType}:${entry.sourceId}`;
    }

    function getPanel() {
        return document.getElementById('staffPayrollPanel');
    }

    function isPanelVisible() {
        const panel = getPanel();
        return Boolean(panel && !panel.classList.contains('hidden'));
    }

    function dateRangeFromInputs() {
        return {
            start: document.getElementById('payrollStartDate')?.value || '',
            end: document.getElementById('payrollEndDate')?.value || ''
        };
    }

    function defaultFourteenDayRange() {
        const savedStart = localStorage.getItem(STORAGE_START);
        const savedEnd = localStorage.getItem(STORAGE_END);
        if (savedStart && savedEnd) return { start: savedStart, end: savedEnd };

        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 13);
        return {
            start: toLocalInputDate(start),
            end: toLocalInputDate(end)
        };
    }

    function toLocalInputDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function inclusiveDayCount(start, end) {
        if (!start || !end) return 0;
        const startDate = new Date(`${start}T00:00:00`);
        const endDate = new Date(`${end}T00:00:00`);
        return Math.round((endDate - startDate) / 86400000) + 1;
    }

    function selectedPeriod() {
        return state.periods.find(period => String(period.id) === String(state.selectedPeriodId)) || null;
    }

    function setupMarkup() {
        const panel = getPanel();
        if (!panel || panel.dataset.bookkeeperReady === 'true') return;

        panel.dataset.bookkeeperReady = 'true';
        panel.classList.add('bookkeeper-payroll-panel');
        panel.innerHTML = `
            <div class="bk-payroll-header">
                <div>
                    <div class="bk-eyebrow">Accounting Workspace</div>
                    <h2>Payroll</h2>
                    <p>Set the active two-week payroll period, review every pay category, approve submissions, and export payroll from one screen.</p>
                </div>
                <div class="bk-header-actions">
                    <span id="bkPeriodStatus" class="bk-period-status">Current Period</span>
                    <button type="button" id="bkRefreshBtn" class="btn-secondary">Refresh</button>
                </div>
            </div>

            <div id="bkSetupNotice" class="bk-setup-notice hidden"></div>

            <section class="bk-period-card">
                <div class="bk-section-heading">
                    <div>
                        <h3>Payroll Period</h3>
                        <p>Setting these dates assigns all qualifying submissions to the current payroll period.</p>
                    </div>
                    <select id="bkPeriodSelect" aria-label="Payroll period history">
                        <option value="">Current Payroll Period</option>
                    </select>
                </div>

                <div class="bk-period-controls">
                    <label>
                        <span>Period Start</span>
                        <input type="date" id="payrollStartDate">
                    </label>
                    <label>
                        <span>Period End</span>
                        <input type="date" id="payrollEndDate">
                    </label>
                    <button type="button" id="bkSetPeriodBtn">Set Payroll Dates</button>
                    <button type="button" id="bkFinalizeBtn" class="btn-secondary">Finalize Period</button>
                    <button type="button" id="bkReopenBtn" class="btn-secondary hidden">Reopen Period</button>
                </div>
                <div id="bkPeriodHelp" class="bk-period-help">Payroll periods must cover exactly 14 calendar days.</div>
            </section>

            <div class="bk-primary-summary">
                <article class="bk-summary-card bk-summary-total">
                    <span>Payroll Total</span>
                    <strong id="payrollTotalOwed">$0.00</strong>
                    <small id="payrollEntryCount">0 entries</small>
                </article>
                <article class="bk-summary-card">
                    <span>Pending Review</span>
                    <strong id="payrollPendingTotal">$0.00</strong>
                    <small id="payrollPendingCount">0 submissions</small>
                </article>
                <article class="bk-summary-card">
                    <span>Approved</span>
                    <strong id="payrollApprovedTotal">$0.00</strong>
                    <small id="payrollApprovedCount">0 submissions</small>
                </article>
                <article class="bk-summary-card">
                    <span>Total Hours</span>
                    <strong id="payrollTotalHours">0.00</strong>
                    <small>Management + equipment</small>
                </article>
            </div>

            <div class="bk-breakdown-grid">
                <article><span>Show Pay</span><strong id="payrollShowPay">$0.00</strong></article>
                <article><span>Commissions</span><strong id="payrollCommissionPay">$0.00</strong></article>
                <article><span>Management Pay</span><strong id="payrollManagementPay">$0.00</strong></article>
                <article><span>Equipment Pay</span><strong id="payrollEquipmentPay">$0.00</strong></article>
                <span id="payrollHourlyPay" class="hidden">$0.00</span>
            </div>

            <section class="bk-staff-section">
                <div class="bk-section-heading">
                    <div>
                        <h3>Totals by Staff Member</h3>
                        <p>See each person’s complete payroll total without opening separate submission tabs.</p>
                    </div>
                    <div class="bk-export-actions">
                        <button type="button" id="bkExportBtn" class="btn-secondary">Export CSV</button>
                        <button type="button" id="bkPrintBtn" class="btn-secondary">Print Payroll</button>
                    </div>
                </div>
                <div class="bk-table-scroll">
                    <table class="bk-staff-table">
                        <thead>
                            <tr>
                                <th>Staff Member</th>
                                <th>Show Pay</th>
                                <th>Commissions</th>
                                <th>Management</th>
                                <th>Equipment</th>
                                <th>Total</th>
                                <th>Pending</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="bkStaffSummaryBody"></tbody>
                    </table>
                </div>
            </section>

            <section class="bk-entry-section">
                <div class="bk-section-heading bk-entry-heading">
                    <div>
                        <h3>Payroll Submissions</h3>
                        <p>Approve or deny entries without leaving Payroll.</p>
                    </div>
                    <div class="bk-entry-filters">
                        <select id="payrollStaffSelect" aria-label="Filter by staff member">
                            <option value="all">All Staff</option>
                        </select>
                        <select id="payrollStatusFilter" aria-label="Filter by status">
                            <option value="all">All Statuses</option>
                            <option value="Pending">Needs Review</option>
                            <option value="Approved">Approved</option>
                            <option value="Denied">Denied</option>
                        </select>
                        <input type="search" id="bkPayrollSearch" placeholder="Search staff or details">
                    </div>
                </div>

                <div id="bkBulkBar" class="bk-bulk-bar">
                    <label class="bk-select-all">
                        <input type="checkbox" id="bkSelectAllPending">
                        <span>Select all pending shown</span>
                    </label>
                    <span id="bkSelectedCount">0 selected</span>
                    <button type="button" id="bkBulkApproveBtn" disabled>Approve Selected</button>
                    <button type="button" id="bkBulkDenyBtn" class="bk-deny-button" disabled>Deny Selected</button>
                </div>

                <div id="payrollEmpty" class="payroll-empty">No payroll submissions found for this period.</div>
                <div class="payroll-table-wrap hidden bk-table-scroll" id="payrollTableWrap">
                    <table id="payrollTableContent" class="bk-entry-table">
                        <thead>
                            <tr>
                                <th class="bk-check-column"></th>
                                <th>Date</th>
                                <th>Staff Member</th>
                                <th>Type</th>
                                <th>Details</th>
                                <th>Hours / Rate</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="payrollBody"></tbody>
                    </table>
                </div>
            </section>
        `;

        injectStyles();
        bindEvents();

        const defaults = defaultFourteenDayRange();
        document.getElementById('payrollStartDate').value = defaults.start;
        document.getElementById('payrollEndDate').value = defaults.end;
    }

    function injectStyles() {
        if (document.getElementById('bookkeeperPayrollStyles')) return;
        const style = document.createElement('style');
        style.id = 'bookkeeperPayrollStyles';
        style.textContent = `
            .bookkeeper-payroll-panel.hidden {
                display: none !important;
            }
            .bookkeeper-payroll-panel {
                display: grid;
                gap: 18px;
                background: transparent;
            }
            .bk-payroll-header,
            .bk-section-heading,
            .bk-header-actions,
            .bk-export-actions,
            .bk-entry-filters,
            .bk-period-controls,
            .bk-bulk-bar {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .bk-payroll-header,
            .bk-section-heading {
                justify-content: space-between;
            }
            .bk-payroll-header {
                padding: 4px 2px 2px;
            }
            .bk-payroll-header h2 {
                margin: 3px 0 4px;
                font-size: clamp(28px, 3vw, 38px);
                color: #fff;
            }
            .bk-payroll-header p,
            .bk-section-heading p,
            .bk-period-help {
                margin: 0;
                color: #b9adc5;
                line-height: 1.5;
            }
            .bk-eyebrow {
                color: #ff4daf;
                font-weight: 800;
                font-size: 12px;
                letter-spacing: .11em;
                text-transform: uppercase;
            }
            .bk-dashboard-submission-action {
                display: flex;
                justify-content: flex-end;
                align-items: center;
                gap: 10px;
                margin-top: 18px;
                padding-top: 16px;
                border-top: 1px solid rgba(255,255,255,.08);
            }
            .bk-dashboard-submission-action button {
                min-height: 42px;
                padding: 10px 18px;
            }
            .bk-dashboard-submission-note {
                margin-right: auto;
                color: #998da3;
                font-size: 12px;
                line-height: 1.4;
            }
            .bk-period-status {
                padding: 8px 12px;
                border-radius: 999px;
                background: rgba(16,185,129,.13);
                border: 1px solid rgba(16,185,129,.32);
                color: #8cf0c6;
                font-size: 13px;
                font-weight: 800;
                white-space: nowrap;
            }
            .bk-period-status.finalized {
                background: rgba(148,163,184,.12);
                border-color: rgba(148,163,184,.28);
                color: #d7dce5;
            }
            .bk-period-card,
            .bk-staff-section,
            .bk-entry-section {
                background: linear-gradient(145deg, rgba(49,31,64,.98), rgba(32,23,43,.98));
                border: 1px solid rgba(233,30,140,.22);
                border-radius: 16px;
                padding: 18px;
                box-shadow: 0 16px 40px rgba(0,0,0,.22);
            }
            .bk-section-heading h3 {
                margin: 0 0 4px;
                color: #fff;
                font-size: 19px;
            }
            .bk-period-controls {
                margin-top: 16px;
                align-items: flex-end;
                flex-wrap: wrap;
            }
            .bk-period-controls label {
                display: grid;
                gap: 6px;
                min-width: 180px;
                flex: 1 1 190px;
                color: #d7cddd;
                font-size: 13px;
                font-weight: 700;
            }
            .bk-period-controls input,
            .bk-period-controls select,
            .bk-entry-filters input,
            .bk-entry-filters select,
            #bkPeriodSelect {
                min-height: 42px;
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,.13);
                background: rgba(12,8,18,.66);
                color: #fff;
                padding: 0 11px;
            }
            #bkPeriodSelect {
                min-width: 230px;
            }
            .bk-period-help {
                margin-top: 10px;
                font-size: 12px;
            }
            .bk-setup-notice {
                padding: 13px 15px;
                border-radius: 10px;
                border: 1px solid rgba(245,158,11,.35);
                background: rgba(245,158,11,.10);
                color: #fde3a7;
                line-height: 1.5;
            }
            .bk-primary-summary {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 12px;
            }
            .bk-summary-card {
                padding: 17px;
                border: 1px solid rgba(255,255,255,.09);
                border-radius: 14px;
                background: rgba(42,29,55,.84);
                min-width: 0;
            }
            .bk-summary-card span,
            .bk-breakdown-grid span {
                display: block;
                color: #b9adc5;
                font-size: 12px;
                font-weight: 800;
                letter-spacing: .03em;
                text-transform: uppercase;
            }
            .bk-summary-card strong {
                display: block;
                margin: 8px 0 4px;
                color: #fff;
                font-size: clamp(23px, 3vw, 32px);
                overflow-wrap: anywhere;
            }
            .bk-summary-card small {
                color: #988ba4;
            }
            .bk-summary-total {
                border-color: rgba(233,30,140,.42);
                background: linear-gradient(145deg, rgba(233,30,140,.16), rgba(118,75,162,.15));
            }
            .bk-breakdown-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 10px;
            }
            .bk-breakdown-grid article {
                padding: 13px 15px;
                border-radius: 11px;
                background: rgba(255,255,255,.04);
                border: 1px solid rgba(255,255,255,.08);
            }
            .bk-breakdown-grid strong {
                display: block;
                margin-top: 5px;
                color: #fff;
                font-size: 18px;
            }
            .bk-table-scroll {
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
            }
            .bk-staff-table,
            .bk-entry-table {
                width: 100%;
                border-collapse: collapse;
                min-width: 860px;
            }
            .bk-staff-table {
                margin-top: 14px;
            }
            .bk-staff-table th,
            .bk-entry-table th {
                color: #a99bb5;
                font-size: 11px;
                letter-spacing: .04em;
                text-transform: uppercase;
                text-align: left;
                padding: 11px 10px;
                border-bottom: 1px solid rgba(255,255,255,.10);
                white-space: nowrap;
            }
            .bk-staff-table td,
            .bk-entry-table td {
                color: #eee8f2;
                padding: 12px 10px;
                border-bottom: 1px solid rgba(255,255,255,.065);
                vertical-align: middle;
            }
            .bk-staff-table tbody tr:hover,
            .bk-entry-table tbody tr:hover {
                background: rgba(255,255,255,.025);
            }
            .bk-staff-name {
                font-weight: 800;
                color: #fff;
            }
            .bk-staff-email,
            .bk-entry-notes {
                display: block;
                margin-top: 3px;
                color: #998da3;
                font-size: 12px;
            }
            .bk-total-cell {
                font-weight: 900;
                color: #fff !important;
            }
            .bk-pending-count {
                display: inline-flex;
                min-width: 26px;
                height: 26px;
                align-items: center;
                justify-content: center;
                border-radius: 999px;
                background: rgba(245,158,11,.13);
                color: #ffd98a;
                font-weight: 800;
            }
            .bk-entry-heading {
                align-items: flex-end;
            }
            .bk-entry-filters {
                flex-wrap: wrap;
                justify-content: flex-end;
            }
            .bk-entry-filters input,
            .bk-entry-filters select {
                min-width: 160px;
            }
            .bk-entry-filters input {
                min-width: 220px;
            }
            .bk-bulk-bar {
                margin: 15px 0 8px;
                padding: 10px 12px;
                border-radius: 10px;
                background: rgba(255,255,255,.035);
                border: 1px solid rgba(255,255,255,.08);
                flex-wrap: wrap;
            }
            .bk-select-all {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                color: #dcd2e2;
                font-weight: 700;
            }
            #bkSelectedCount {
                color: #b9adc5;
                margin-right: auto;
            }
            .bk-deny-button,
            .bk-entry-action.deny {
                background: rgba(239,68,68,.16) !important;
                border-color: rgba(239,68,68,.36) !important;
                color: #fecaca !important;
            }
            .bk-entry-action {
                min-height: 34px;
                padding: 6px 10px;
                border-radius: 7px;
                font-size: 12px;
                margin: 2px;
            }
            .bk-rate-editor {
                display: grid;
                gap: 7px;
                min-width: 190px;
            }
            .bk-rate-hours {
                color: #d9cfdf;
                font-size: 12px;
                font-weight: 800;
            }
            .bk-rate-controls {
                display: grid;
                grid-template-columns: minmax(88px, 1fr) auto;
                gap: 7px;
                align-items: center;
            }
            .bk-rate-input-wrap {
                display: flex;
                align-items: center;
                min-height: 38px;
                overflow: hidden;
                border: 1px solid rgba(255,255,255,.16);
                border-radius: 8px;
                background: rgba(7,5,11,.64);
            }
            .bk-rate-input-wrap span {
                padding-left: 10px;
                color: #a99bb5;
                font-weight: 800;
            }
            .bk-rate-input {
                width: 100%;
                min-width: 70px;
                min-height: 36px;
                padding: 0 9px 0 4px;
                border: 0 !important;
                outline: 0;
                background: transparent !important;
                color: #fff;
                font-weight: 800;
            }
            .bk-save-rate {
                min-height: 38px;
                padding: 7px 11px;
                border-radius: 8px;
                white-space: nowrap;
            }
            .bk-rate-readonly {
                display: grid;
                gap: 4px;
                min-width: 150px;
                color: #eee8f2;
                font-weight: 800;
            }
            .bk-rate-readonly small {
                color: #998da3;
                font-weight: 700;
            }
            .bk-check-column {
                width: 36px;
            }
            .bk-status {
                display: inline-flex;
                padding: 5px 9px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 900;
            }
            .bk-status.pending {
                color: #ffd98a;
                background: rgba(245,158,11,.13);
            }
            .bk-status.approved {
                color: #8cf0c6;
                background: rgba(16,185,129,.13);
            }
            .bk-status.denied {
                color: #fecaca;
                background: rgba(239,68,68,.13);
            }
            .bk-own-note {
                color: #9f93a9;
                font-size: 11px;
            }
            .bk-denial-overlay {
                position: fixed;
                inset: 0;
                z-index: 100000;
                display: grid;
                place-items: center;
                padding: 18px;
                background: rgba(6,4,10,.78);
                backdrop-filter: blur(6px);
            }
            .bk-denial-card {
                width: min(560px, 100%);
                border-radius: 16px;
                border: 1px solid rgba(239,68,68,.35);
                background: #2b1c38;
                padding: 22px;
                box-shadow: 0 24px 70px rgba(0,0,0,.45);
            }
            .bk-denial-card h3 {
                margin: 0 0 7px;
                color: #fff;
            }
            .bk-denial-card p {
                margin: 0 0 14px;
                color: #b9adc5;
                line-height: 1.5;
            }
            .bk-denial-card textarea {
                width: 100%;
                min-height: 130px;
                resize: vertical;
                border-radius: 9px;
                border: 1px solid rgba(255,255,255,.13);
                background: rgba(8,5,12,.68);
                color: #fff;
                padding: 12px;
            }
            .bk-denial-actions {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 14px;
            }
            @media (max-width: 1000px) {
                .bk-primary-summary,
                .bk-breakdown-grid {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
                .bk-payroll-header,
                .bk-section-heading,
                .bk-entry-heading {
                    align-items: flex-start;
                    flex-direction: column;
                }
                .bk-entry-filters {
                    width: 100%;
                    justify-content: stretch;
                }
                .bk-entry-filters > * {
                    flex: 1 1 180px;
                }
            }
            @media (max-width: 620px) {
                .bk-primary-summary,
                .bk-breakdown-grid {
                    grid-template-columns: 1fr;
                }
                .bk-period-controls {
                    align-items: stretch;
                }
                .bk-period-controls > * {
                    width: 100%;
                }
                .bk-header-actions,
                .bk-export-actions {
                    width: 100%;
                    flex-wrap: wrap;
                }
                #bkPeriodSelect,
                .bk-entry-filters input,
                .bk-entry-filters select {
                    width: 100%;
                    min-width: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function bindEvents() {
        const panel = getPanel();
        if (!panel || panel.dataset.bookkeeperBound === 'true') return;
        panel.dataset.bookkeeperBound = 'true';

        panel.addEventListener('change', event => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;

            if (target.id === 'bkPeriodSelect') {
                selectPeriod(target.value);
            } else if (
                target.id === 'payrollStaffSelect' ||
                target.id === 'payrollStatusFilter' ||
                target.id === 'payrollStartDate' ||
                target.id === 'payrollEndDate'
            ) {
                state.selectedEntries.clear();
                render();
            } else if (target.id === 'bkSelectAllPending') {
                selectAllPending(target.checked);
            } else if (target.classList.contains('bk-entry-checkbox')) {
                const key = target.dataset.key;
                if (target.checked) state.selectedEntries.add(key);
                else state.selectedEntries.delete(key);
                updateBulkControls();
            }
        });

        panel.addEventListener('input', event => {
            if (event.target?.id === 'bkPayrollSearch') {
                state.selectedEntries.clear();
                render();
            }
        });

        panel.addEventListener('click', event => {
            const button = event.target.closest('button');
            if (!button) return;

            if (button.id === 'bkRefreshBtn') open(true);
            else if (button.id === 'bkSetPeriodBtn') setPayrollPeriod();
            else if (button.id === 'bkFinalizeBtn') finalizePeriod();
            else if (button.id === 'bkReopenBtn') reopenPeriod();
            else if (button.id === 'bkBulkApproveBtn') bulkApprove();
            else if (button.id === 'bkBulkDenyBtn') bulkDeny();
            else if (button.id === 'bkExportBtn') exportCsv();
            else if (button.id === 'bkPrintBtn') printPayroll();
            else if (button.dataset.action === 'approve') {
                const entry = findEntry(button.dataset.key);
                if (entry) approveEntries([entry]);
            } else if (button.dataset.action === 'deny') {
                const entry = findEntry(button.dataset.key);
                if (entry) openDenialModal([entry]);
            } else if (button.dataset.action === 'save-rate') {
                const entry = findEntry(button.dataset.key);
                if (entry) saveHourlyRate(entry, button);
            } else if (button.dataset.action === 'view-staff') {
                const select = document.getElementById('payrollStaffSelect');
                if (select) {
                    select.value = button.dataset.staffKey || 'all';
                    state.selectedEntries.clear();
                    render();
                    document.querySelector('.bk-entry-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    }

    function populatePeriodSelector() {
        const select = document.getElementById('bkPeriodSelect');
        if (!select) return;

        if (!state.periodsReady) {
            select.innerHTML = '<option value="">Current Payroll Period</option>';
            select.value = '';
            return;
        }

        select.innerHTML = state.periods.map(period => {
            const status = period.status === 'finalized' ? 'Finalized' : period.is_active ? 'Current' : 'Open';
            return `<option value="${escapeHtml(period.id)}">${escapeHtml(period.label || `${formatDate(period.start_date)} – ${formatDate(period.end_date)}`)} • ${status}</option>`;
        }).join('') || '<option value="">No saved periods</option>';

        if (state.selectedPeriodId) select.value = state.selectedPeriodId;
    }

    async function loadPeriods() {
        const client = getClient();
        if (!client || !getCurrentUser()) return;

        const { data, error } = await client
            .from('payroll_periods')
            .select('*')
            .order('start_date', { ascending: false });

        if (error) {
            state.periodsReady = false;
            state.periods = [];
            state.selectedPeriodId = '';
            const notice = document.getElementById('bkSetupNotice');
            if (notice) {
                notice.classList.remove('hidden');
                notice.innerHTML = '<strong>Payroll period setup is still required.</strong> The screen can filter dates now, but shared payroll periods, finalization, and automatic submission assignment will be available after the one-time payroll SQL is applied.';
            }
            populatePeriodSelector();
            updatePeriodUi();
            return;
        }

        state.periodsReady = true;
        state.periods = data || [];

        const notice = document.getElementById('bkSetupNotice');
        if (notice) notice.classList.add('hidden');

        const selectedStillExists = state.periods.some(period => String(period.id) === String(state.selectedPeriodId));
        if (!selectedStillExists) {
            const active = state.periods.find(period => period.is_active) || state.periods[0] || null;
            state.selectedPeriodId = active?.id || '';
        }

        const period = selectedPeriod();
        if (period) {
            document.getElementById('payrollStartDate').value = isoDate(period.start_date);
            document.getElementById('payrollEndDate').value = isoDate(period.end_date);
        }

        populatePeriodSelector();
        updatePeriodUi();
    }

    async function selectPeriod(periodId) {
        state.selectedPeriodId = periodId || '';
        const period = selectedPeriod();
        if (period) {
            document.getElementById('payrollStartDate').value = isoDate(period.start_date);
            document.getElementById('payrollEndDate').value = isoDate(period.end_date);
            if (period.status !== 'finalized') await syncSelectedPeriod();
        }
        state.selectedEntries.clear();
        updatePeriodUi();
        render();
    }

    function updatePeriodUi() {
        const period = selectedPeriod();
        const status = document.getElementById('bkPeriodStatus');
        const finalizeButton = document.getElementById('bkFinalizeBtn');
        const reopenButton = document.getElementById('bkReopenBtn');
        const setButton = document.getElementById('bkSetPeriodBtn');

        if (status) {
            const finalized = period?.status === 'finalized';
            status.textContent = finalized ? 'Finalized Period' : period?.is_active ? 'Current Period' : 'Payroll Period';
            status.classList.toggle('finalized', finalized);
        }

        const isFinalized = period?.status === 'finalized';
        if (finalizeButton) finalizeButton.classList.toggle('hidden', !period || isFinalized || !period.is_active);
        if (reopenButton) reopenButton.classList.toggle('hidden', !isFinalized || getCurrentProfile()?.role !== 'admin');
        if (setButton) setButton.textContent = isFinalized ? 'Start New Payroll Period' : 'Set Payroll Dates';
    }

    async function setPayrollPeriod() {
        const { start, end } = dateRangeFromInputs();
        if (!start || !end) {
            notifyError('Choose both the payroll start date and end date.');
            return;
        }
        if (end < start) {
            notifyError('The payroll end date must be after the start date.');
            return;
        }
        if (inclusiveDayCount(start, end) !== 14) {
            notifyError('Payroll periods must cover exactly 14 calendar days.');
            return;
        }

        localStorage.setItem(STORAGE_START, start);
        localStorage.setItem(STORAGE_END, end);

        if (!state.periodsReady) {
            notifyError('The dates are saved in this browser, but the one-time payroll database setup must be completed before the period can be shared and assigned to submissions.');
            render();
            return;
        }

        const client = getClient();
        if (!client) return;

        const label = `${formatDate(start)} – ${formatDate(end)}`;
        setBusy(true, 'Saving period...');

        try {
            const { data, error } = await client.rpc('set_active_payroll_period', {
                p_start_date: start,
                p_end_date: end,
                p_label: label
            });
            if (error) throw error;

            notifySuccess(`Payroll period set. ${safeNumber(data?.assigned_count)} submission(s) assigned to the current period.`);
            await loadPeriods();
            await refreshApplicationData();
            render();
        } catch (error) {
            console.error('Set payroll period failed:', error);
            notifyError('Could not set the payroll period: ' + (error.message || String(error)));
        } finally {
            setBusy(false);
        }
    }

    async function syncSelectedPeriod() {
        if (!state.periodsReady) return;
        const period = selectedPeriod();
        if (!period || period.status === 'finalized') return;
        const client = getClient();
        if (!client) return;

        const { error } = await client.rpc('sync_payroll_period_entries', {
            p_period_id: period.id
        });
        if (error) console.warn('Payroll period sync failed:', error);
    }

    async function finalizePeriod() {
        const period = selectedPeriod();
        if (!period || period.status === 'finalized') return;
        if (!confirm(`Finalize payroll for ${formatDate(period.start_date)} through ${formatDate(period.end_date)}? This locks the period until an administrator reopens it.`)) return;

        const client = getClient();
        if (!client) return;
        setBusy(true, 'Finalizing...');

        try {
            const { error } = await client.rpc('finalize_payroll_period', {
                p_period_id: period.id
            });
            if (error) throw error;
            notifySuccess('Payroll period finalized.');
            await loadPeriods();
            render();
        } catch (error) {
            notifyError('Could not finalize payroll: ' + (error.message || String(error)));
        } finally {
            setBusy(false);
        }
    }

    async function reopenPeriod() {
        const period = selectedPeriod();
        if (!period || period.status !== 'finalized') return;
        if (!confirm('Reopen this finalized payroll period? It will become the current active period.')) return;

        const client = getClient();
        if (!client) return;
        setBusy(true, 'Reopening...');

        try {
            const { error } = await client.rpc('reopen_payroll_period', {
                p_period_id: period.id
            });
            if (error) throw error;
            notifySuccess('Payroll period reopened.');
            await loadPeriods();
            await syncSelectedPeriod();
            render();
        } catch (error) {
            notifyError('Could not reopen payroll: ' + (error.message || String(error)));
        } finally {
            setBusy(false);
        }
    }

    function setBusy(isBusy, label = '') {
        state.loading = isBusy;
        ['bkSetPeriodBtn', 'bkFinalizeBtn', 'bkReopenBtn', 'bkBulkApproveBtn', 'bkBulkDenyBtn'].forEach(id => {
            const button = document.getElementById(id);
            if (button) button.disabled = isBusy || (id.includes('Bulk') && state.selectedEntries.size === 0);
        });
        const help = document.getElementById('bkPeriodHelp');
        if (help) help.textContent = isBusy && label ? label : 'Payroll periods must cover exactly 14 calendar days.';
    }

    function periodEntries() {
        const { start, end } = dateRangeFromInputs();
        return collectEntries().filter(entry => {
            if (start && entry.date < start) return false;
            if (end && entry.date > end) return false;
            return true;
        });
    }

    function filteredEntries() {
        const staff = document.getElementById('payrollStaffSelect')?.value || 'all';
        const status = document.getElementById('payrollStatusFilter')?.value || 'all';
        const search = normalizeName(document.getElementById('bkPayrollSearch')?.value || '');

        return periodEntries().filter(entry => {
            if (staff !== 'all' && entry.staffKey !== staff) return false;
            if (status !== 'all' && entry.status !== status) return false;
            if (search) {
                const haystack = normalizeName(`${entry.staffName} ${entry.details} ${entry.typeLabel} ${entry.notes}`);
                if (!haystack.includes(search)) return false;
            }
            return true;
        });
    }

    function populateStaffFilter(entries) {
        const select = document.getElementById('payrollStaffSelect');
        if (!select) return;

        const current = select.value || 'all';
        const staff = new Map();
        entries.forEach(entry => {
            if (!entry.staffKey || staff.has(entry.staffKey)) return;
            staff.set(entry.staffKey, entry.staffName);
        });

        select.innerHTML = '<option value="all">All Staff</option>' +
            Array.from(staff.entries())
                .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
                .map(([key, name]) => `<option value="${escapeHtml(key)}">${escapeHtml(name)}</option>`)
                .join('');

        select.value = staff.has(current) || current === 'all' ? current : 'all';
    }

    function summarize(entries) {
        return entries.reduce((summary, entry) => {
            summary.count += 1;
            summary.hours += entry.hours;
            summary.total += entry.amount;
            summary.show += entry.showPay;
            summary.commission += entry.commissionPay;
            summary.management += entry.managementPay;
            summary.equipment += entry.equipmentPay;
            if (entry.status === 'Pending') {
                summary.pendingCount += 1;
                summary.pendingTotal += entry.amount;
            }
            if (entry.status === 'Approved') {
                summary.approvedCount += 1;
                summary.approvedTotal += entry.amount;
            }
            return summary;
        }, {
            count: 0,
            hours: 0,
            total: 0,
            show: 0,
            commission: 0,
            management: 0,
            equipment: 0,
            pendingCount: 0,
            pendingTotal: 0,
            approvedCount: 0,
            approvedTotal: 0
        });
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function render() {
        if (!state.initialized || !canUsePayroll()) return;

        const allPeriodEntries = periodEntries();
        populateStaffFilter(allPeriodEntries);
        const entries = filteredEntries();
        const totals = summarize(allPeriodEntries);

        setText('payrollTotalOwed', formatMoney(totals.total));
        setText('payrollEntryCount', `${totals.count} ${totals.count === 1 ? 'entry' : 'entries'}`);
        setText('payrollPendingTotal', formatMoney(totals.pendingTotal));
        setText('payrollPendingCount', `${totals.pendingCount} ${totals.pendingCount === 1 ? 'submission' : 'submissions'}`);
        setText('payrollApprovedTotal', formatMoney(totals.approvedTotal));
        setText('payrollApprovedCount', `${totals.approvedCount} ${totals.approvedCount === 1 ? 'submission' : 'submissions'}`);
        setText('payrollTotalHours', totals.hours.toFixed(2));
        setText('payrollShowPay', formatMoney(totals.show));
        setText('payrollCommissionPay', formatMoney(totals.commission));
        setText('payrollManagementPay', formatMoney(totals.management));
        setText('payrollEquipmentPay', formatMoney(totals.equipment));
        setText('payrollHourlyPay', formatMoney(totals.management + totals.equipment));

        renderStaffSummary(allPeriodEntries);
        renderEntryRows(entries);
        updateBulkControls();
        updatePeriodUi();
        state.lastFingerprint = fingerprint();
    }

    function renderStaffSummary(entries) {
        const body = document.getElementById('bkStaffSummaryBody');
        if (!body) return;

        const groups = new Map();
        entries.forEach(entry => {
            if (!groups.has(entry.staffKey)) {
                groups.set(entry.staffKey, {
                    staffKey: entry.staffKey,
                    name: entry.staffName,
                    email: entry.email,
                    show: 0,
                    commission: 0,
                    management: 0,
                    equipment: 0,
                    total: 0,
                    pending: 0
                });
            }
            const group = groups.get(entry.staffKey);
            group.show += entry.showPay;
            group.commission += entry.commissionPay;
            group.management += entry.managementPay;
            group.equipment += entry.equipmentPay;
            group.total += entry.amount;
            if (entry.status === 'Pending') group.pending += 1;
        });

        const rows = Array.from(groups.values()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
        body.innerHTML = rows.map(row => `
            <tr>
                <td>
                    <span class="bk-staff-name">${escapeHtml(row.name)}</span>
                    ${row.email ? `<span class="bk-staff-email">${escapeHtml(row.email)}</span>` : ''}
                </td>
                <td>${formatMoney(row.show)}</td>
                <td>${formatMoney(row.commission)}</td>
                <td>${formatMoney(row.management)}</td>
                <td>${formatMoney(row.equipment)}</td>
                <td class="bk-total-cell">${formatMoney(row.total)}</td>
                <td><span class="bk-pending-count">${row.pending}</span></td>
                <td><button type="button" class="btn-secondary bk-entry-action" data-action="view-staff" data-staff-key="${escapeHtml(row.staffKey)}">View</button></td>
            </tr>
        `).join('') || '<tr><td colspan="8" style="text-align:center;color:#998da3;padding:28px;">No submissions in this payroll period.</td></tr>';
    }

    function renderRateEditor(entry, finalized) {
        const supportsHourlyRate = ['manager_hours', 'equipment_hours'].includes(entry.sourceType) && entry.hours > 0;
        if (!supportsHourlyRate) return '-';

        if (finalized) {
            return `
                <div class="bk-rate-readonly">
                    <span>${entry.hours.toFixed(2)} hours</span>
                    <small>${entry.rate ? `${formatMoney(entry.rate)} per hour` : 'Hourly rate missing'}</small>
                </div>
            `;
        }

        const key = entryKey(entry);
        const currentRate = entry.rate > 0 ? entry.rate.toFixed(2) : '';
        return `
            <div class="bk-rate-editor">
                <div class="bk-rate-hours">${entry.hours.toFixed(2)} hours worked</div>
                <div class="bk-rate-controls">
                    <label class="bk-rate-input-wrap" aria-label="Hourly rate for ${escapeHtml(entry.staffName)}">
                        <span>$</span>
                        <input
                            type="number"
                            class="bk-rate-input"
                            data-key="${escapeHtml(key)}"
                            value="${escapeHtml(currentRate)}"
                            min="0"
                            step="0.01"
                            inputmode="decimal"
                            placeholder="0.00"
                        >
                    </label>
                    <button type="button" class="bk-save-rate" data-action="save-rate" data-key="${escapeHtml(key)}">Save Rate</button>
                </div>
            </div>
        `;
    }

    function renderEntryRows(entries) {
        const body = document.getElementById('payrollBody');
        const empty = document.getElementById('payrollEmpty');
        const wrap = document.getElementById('payrollTableWrap');
        if (!body || !empty || !wrap) return;

        if (!entries.length) {
            body.innerHTML = '';
            empty.classList.remove('hidden');
            wrap.classList.add('hidden');
            return;
        }

        empty.classList.add('hidden');
        wrap.classList.remove('hidden');

        const currentUserId = getCurrentUser()?.id;
        const finalized = selectedPeriod()?.status === 'finalized';

        body.innerHTML = entries.map(entry => {
            const key = entryKey(entry);
            const ownEntry = Boolean(currentUserId && entry.userId === currentUserId);
            const pending = entry.status === 'Pending';
            const eligible = pending && !ownEntry && !finalized && canApprovePayroll();
            const checked = state.selectedEntries.has(key);
            const rateEditor = renderRateEditor(entry, finalized);
            const statusClass = String(entry.status).toLowerCase();

            return `
                <tr>
                    <td>
                        ${eligible
                            ? `<input type="checkbox" class="bk-entry-checkbox" data-key="${escapeHtml(key)}" ${checked ? 'checked' : ''} aria-label="Select ${escapeHtml(entry.typeLabel)} for ${escapeHtml(entry.staffName)}">`
                            : ''}
                    </td>
                    <td>${escapeHtml(formatDate(entry.date))}</td>
                    <td><span class="bk-staff-name">${escapeHtml(entry.staffName)}</span>${entry.email ? `<span class="bk-staff-email">${escapeHtml(entry.email)}</span>` : ''}</td>
                    <td><span class="type-badge type-${escapeHtml(entry.sourceType.replace('_hours', ''))}">${escapeHtml(entry.typeLabel)}</span></td>
                    <td>${escapeHtml(entry.details)}${entry.notes ? `<span class="bk-entry-notes">${escapeHtml(entry.notes)}</span>` : ''}</td>
                    <td>${rateEditor}</td>
                    <td class="bk-total-cell">${formatMoney(entry.amount)}</td>
                    <td><span class="bk-status ${escapeHtml(statusClass)}">${escapeHtml(entry.status)}</span></td>
                    <td>
                        ${eligible ? `
                            <button type="button" class="bk-entry-action" data-action="approve" data-key="${escapeHtml(key)}">Approve</button>
                            <button type="button" class="bk-entry-action deny" data-action="deny" data-key="${escapeHtml(key)}">Deny</button>
                        ` : ownEntry && pending
                            ? '<span class="bk-own-note">Cannot approve your own entry</span>'
                            : ''}
                    </td>
                </tr>
            `;
        }).join('');
    }

    function eligibleVisibleEntries() {
        const finalized = selectedPeriod()?.status === 'finalized';
        const currentUserId = getCurrentUser()?.id;
        if (finalized) return [];
        return filteredEntries().filter(entry =>
            entry.status === 'Pending' &&
            entry.userId !== currentUserId &&
            canApprovePayroll()
        );
    }

    function selectAllPending(checked) {
        const eligible = eligibleVisibleEntries();
        if (checked) eligible.forEach(entry => state.selectedEntries.add(entryKey(entry)));
        else eligible.forEach(entry => state.selectedEntries.delete(entryKey(entry)));
        render();
    }

    function updateBulkControls() {
        const visibleKeys = new Set(eligibleVisibleEntries().map(entryKey));
        Array.from(state.selectedEntries).forEach(key => {
            if (!visibleKeys.has(key)) state.selectedEntries.delete(key);
        });

        const count = state.selectedEntries.size;
        setText('bkSelectedCount', `${count} selected`);

        const approveButton = document.getElementById('bkBulkApproveBtn');
        const denyButton = document.getElementById('bkBulkDenyBtn');
        if (approveButton) approveButton.disabled = state.loading || count === 0;
        if (denyButton) denyButton.disabled = state.loading || count === 0;

        const selectAll = document.getElementById('bkSelectAllPending');
        if (selectAll) {
            const eligibleCount = visibleKeys.size;
            selectAll.checked = eligibleCount > 0 && count === eligibleCount;
            selectAll.indeterminate = count > 0 && count < eligibleCount;
            selectAll.disabled = eligibleCount === 0;
        }
    }

    function findEntry(key) {
        return collectEntries().find(entry => entryKey(entry) === key) || null;
    }

    async function saveHourlyRate(entry, button) {
        if (!['manager_hours', 'equipment_hours'].includes(entry.sourceType)) {
            notifyError('Hourly rates can only be edited for management or equipment hours.');
            return;
        }

        if (selectedPeriod()?.status === 'finalized') {
            notifyError('This payroll period is finalized. Reopen it before changing an hourly rate.');
            return;
        }

        const editor = button.closest('.bk-rate-editor');
        const input = editor?.querySelector('.bk-rate-input');
        const rate = Number(input?.value);

        if (!Number.isFinite(rate) || rate < 0) {
            notifyError('Enter a valid hourly rate of zero or more.');
            input?.focus();
            return;
        }

        const client = getClient();
        const table = SOURCE_TABLES[entry.sourceType];
        if (!client || !table) {
            notifyError('Payroll data is not available. Refresh and try again.');
            return;
        }

        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Saving...';
        if (input) input.disabled = true;

        try {
            const { error } = await client
                .from(table)
                .update({ hourly_rate: rate })
                .eq('id', entry.sourceId);

            if (error) throw error;

            await refreshApplicationData();
            notifySuccess(`Hourly rate saved at ${formatMoney(rate)} per hour. Payroll totals were recalculated.`);
        } catch (error) {
            console.error('Hourly rate update failed:', error);
            notifyError('Could not save the hourly rate: ' + (error.message || String(error)));
        } finally {
            if (button.isConnected) {
                button.disabled = false;
                button.textContent = originalText;
            }
            if (input?.isConnected) input.disabled = false;
        }
    }

    function selectedEntryObjects() {
        return Array.from(state.selectedEntries)
            .map(findEntry)
            .filter(Boolean);
    }

    async function bulkApprove() {
        const entries = selectedEntryObjects();
        if (!entries.length) return;
        if (!confirm(`Approve ${entries.length} selected payroll submission(s)?`)) return;
        await approveEntries(entries);
    }

    async function approveEntries(entries) {
        setBusy(true, 'Approving submissions...');
        let completed = 0;
        const failures = [];

        for (const entry of entries) {
            try {
                await runEntryAction(entry, 'approve', '');
                completed += 1;
            } catch (error) {
                failures.push(`${entry.staffName}: ${error.message || error}`);
            }
        }

        state.selectedEntries.clear();
        await refreshApplicationData();
        setBusy(false);
        render();

        if (completed) notifySuccess(`${completed} payroll submission(s) approved.`);
        if (failures.length) {
            console.error('Payroll approval failures:', failures);
            notifyError(`${failures.length} submission(s) could not be approved. Refresh and try those entries again.`);
        }
    }

    function bulkDeny() {
        const entries = selectedEntryObjects();
        if (!entries.length) return;
        openDenialModal(entries);
    }

    function openDenialModal(entries) {
        document.getElementById('bkDenialOverlay')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'bkDenialOverlay';
        overlay.className = 'bk-denial-overlay';
        overlay.innerHTML = `
            <div class="bk-denial-card" role="dialog" aria-modal="true" aria-labelledby="bkDenialTitle">
                <h3 id="bkDenialTitle">Deny ${entries.length === 1 ? 'Payroll Submission' : `${entries.length} Payroll Submissions`}</h3>
                <p>Explain what needs to be corrected. The submitter will receive the entry details and this reason so they can resubmit it successfully.</p>
                <textarea id="bkDenialReason" placeholder="Example: The hours do not match the event schedule. Please correct the start and end time and resubmit."></textarea>
                <div class="bk-denial-actions">
                    <button type="button" id="bkCancelDenial" class="btn-secondary">Cancel</button>
                    <button type="button" id="bkConfirmDenial" class="bk-deny-button">Deny and Notify</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        overlay.addEventListener('click', event => {
            if (event.target === overlay || event.target.id === 'bkCancelDenial') close();
        });
        document.getElementById('bkConfirmDenial').addEventListener('click', async () => {
            const reason = document.getElementById('bkDenialReason').value.trim();
            if (!reason) {
                notifyError('Enter a reason so the submitter knows what to correct.');
                return;
            }
            close();
            await denyEntries(entries, reason);
        });
        document.getElementById('bkDenialReason')?.focus();
    }

    async function denyEntries(entries, reason) {
        setBusy(true, 'Denying and notifying...');
        let completed = 0;
        let emailWarnings = 0;
        const failures = [];

        for (const entry of entries) {
            try {
                const result = await runEntryAction(entry, 'deny', reason);
                completed += 1;
                if (result && result.email_sent === false) emailWarnings += 1;
            } catch (error) {
                failures.push(`${entry.staffName}: ${error.message || error}`);
            }
        }

        state.selectedEntries.clear();
        await refreshApplicationData();
        setBusy(false);
        render();

        if (completed) notifySuccess(`${completed} payroll submission(s) denied.`);
        if (emailWarnings) notifyError(`${emailWarnings} denial notification email(s) could not be sent. The entries were still marked denied.`);
        if (failures.length) {
            console.error('Payroll denial failures:', failures);
            notifyError(`${failures.length} submission(s) could not be denied.`);
        }
    }

    async function runEntryAction(entry, action, reason) {
        const client = getClient();
        if (!client) throw new Error('Supabase is not available.');

        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) throw new Error('Your session expired. Sign out and sign back in.');

        const { data, error } = await client.functions.invoke('payroll-entry-action', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
            body: {
                action,
                source_type: entry.sourceType,
                source_id: entry.sourceId,
                reason
            }
        });

        if (!error && !data?.error) return data || { success: true };

        console.warn('Payroll action function unavailable; attempting direct update.', error || data?.error);
        return directEntryUpdate(entry, action, reason, error || new Error(data?.error || 'Payroll action failed.'));
    }

    async function directEntryUpdate(entry, action, reason, functionError) {
        const client = getClient();
        const table = SOURCE_TABLES[entry.sourceType];
        if (!client || !table) throw functionError;

        const status = action === 'approve' ? 'Approved' : 'Denied';
        let payload = action === 'approve'
            ? { status, denial_reason: null, denied_at: null, denied_by: null }
            : { status, denial_reason: reason, denied_at: new Date().toISOString(), denied_by: getCurrentUser()?.id || null };

        let { error } = await client.from(table).update(payload).eq('id', entry.sourceId);
        if (error && /denial_reason|denied_at|denied_by|column/i.test(error.message || '')) {
            ({ error } = await client.from(table).update({ status }).eq('id', entry.sourceId));
        }
        if (error) throw error;

        if (action === 'deny') {
            return {
                success: true,
                email_sent: false,
                fallback: true,
                warning: functionError?.message || 'Denial email service is not deployed.'
            };
        }
        return { success: true, fallback: true };
    }

    async function refreshApplicationData() {
        try {
            if (typeof loadData === 'function') {
                await loadData();
                return;
            }
        } catch (error) {
            console.warn('Main data refresh failed:', error);
        }
        render();
    }

    function csvCell(value) {
        return `"${String(value ?? '').replace(/"/g, '""')}"`;
    }

    function exportCsv() {
        const entries = filteredEntries();
        if (!entries.length) {
            notifyError('There are no payroll submissions to export for the selected filters.');
            return;
        }

        const rows = [
            ['Date', 'Staff Member', 'Email', 'Type', 'Details', 'Hours', 'Hourly Rate', 'Amount', 'Status', 'Notes'],
            ...entries.map(entry => [
                entry.date,
                entry.staffName,
                entry.email,
                entry.typeLabel,
                entry.details,
                entry.hours.toFixed(2),
                entry.rate.toFixed(2),
                entry.amount.toFixed(2),
                entry.status,
                entry.notes
            ])
        ];

        const csv = rows.map(row => row.map(csvCell).join(',')).join('\n');
        const { start, end } = dateRangeFromInputs();
        download(csv, `jammin-payroll-${start || 'start'}-to-${end || 'end'}.csv`, 'text/csv');
        notifySuccess('Payroll CSV exported.');
    }

    function download(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function printPayroll() {
        const entries = filteredEntries();
        const summary = summarize(periodEntries());
        const { start, end } = dateRangeFromInputs();
        const staffGroups = new Map();

        periodEntries().forEach(entry => {
            if (!staffGroups.has(entry.staffKey)) staffGroups.set(entry.staffKey, { name: entry.staffName, total: 0 });
            staffGroups.get(entry.staffKey).total += entry.amount;
        });

        const printWindow = window.open('', '_blank', 'width=1100,height=800');
        if (!printWindow) {
            notifyError('The browser blocked the print window. Allow pop-ups and try again.');
            return;
        }

        printWindow.document.write(`
            <!doctype html>
            <html>
            <head>
                <title>Payroll ${escapeHtml(start)} to ${escapeHtml(end)}</title>
                <style>
                    body{font-family:Arial,sans-serif;color:#18131d;padding:30px}
                    h1{margin:0 0 5px}.sub{color:#665d6b;margin-bottom:22px}
                    .totals{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}
                    .card{border:1px solid #ddd3e2;border-radius:10px;padding:13px}
                    .card span{display:block;color:#756b7b;font-size:11px;text-transform:uppercase}
                    .card strong{display:block;font-size:21px;margin-top:5px}
                    table{width:100%;border-collapse:collapse;margin-top:18px}
                    th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;font-size:12px}
                    th{background:#f4eff6;text-transform:uppercase;font-size:10px}
                    .right{text-align:right}
                </style>
            </head>
            <body>
                <h1>JAMMIN' Command Center Payroll</h1>
                <div class="sub">${escapeHtml(formatDate(start))} through ${escapeHtml(formatDate(end))}</div>
                <div class="totals">
                    <div class="card"><span>Payroll Total</span><strong>${formatMoney(summary.total)}</strong></div>
                    <div class="card"><span>Approved</span><strong>${formatMoney(summary.approvedTotal)}</strong></div>
                    <div class="card"><span>Pending</span><strong>${formatMoney(summary.pendingTotal)}</strong></div>
                    <div class="card"><span>Total Hours</span><strong>${summary.hours.toFixed(2)}</strong></div>
                </div>
                <h2>Staff Totals</h2>
                <table>
                    <thead><tr><th>Staff Member</th><th class="right">Total</th></tr></thead>
                    <tbody>${Array.from(staffGroups.values()).sort((a,b)=>a.name.localeCompare(b.name)).map(row => `<tr><td>${escapeHtml(row.name)}</td><td class="right">${formatMoney(row.total)}</td></tr>`).join('')}</tbody>
                </table>
                <h2>Submission Detail</h2>
                <table>
                    <thead><tr><th>Date</th><th>Staff</th><th>Type</th><th>Details</th><th>Hours</th><th class="right">Amount</th><th>Status</th></tr></thead>
                    <tbody>${entries.map(entry => `<tr><td>${escapeHtml(formatDate(entry.date))}</td><td>${escapeHtml(entry.staffName)}</td><td>${escapeHtml(entry.typeLabel)}</td><td>${escapeHtml(entry.details)}</td><td>${entry.hours.toFixed(2)}</td><td class="right">${formatMoney(entry.amount)}</td><td>${escapeHtml(entry.status)}</td></tr>`).join('')}</tbody>
                </table>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 250);
    }

    function fingerprint() {
        const { start, end } = dateRangeFromInputs();
        return [
            start,
            end,
            getProfiles().length,
            ...collectEntries().map(entry => `${entryKey(entry)}:${entry.status}:${entry.amount}:${entry.date}`)
        ].join('|');
    }

    async function open(force = false) {
        setupMarkup();
        state.initialized = true;
        if (!canUsePayroll()) return;
        if (state.loading) return;

        if (force || !state.periods.length) await loadPeriods();
        if (state.periodsReady) await syncSelectedPeriod();
        render();
    }

    function activeTabName() {
        const activeTab = document.querySelector('.tab.active');
        const onclickValue = activeTab?.getAttribute('onclick') || '';
        const match = onclickValue.match(/switchTab\('([^']+)'\)/);
        return match?.[1] || '';
    }

    function ensureDashboardSubmissionAction() {
        const card = document.getElementById('submissionChartCard');
        if (!card) return;

        let action = document.getElementById('bkDashboardSubmissionAction');
        if (!action) {
            action = document.createElement('div');
            action.id = 'bkDashboardSubmissionAction';
            action.className = 'bk-dashboard-submission-action';
            action.innerHTML = `
                <span class="bk-dashboard-submission-note">The dashboard is a summary. Open the submission records to review individual entries.</span>
                <button type="button" id="bkViewSubmissionsBtn">View My Submissions</button>
            `;
            card.appendChild(action);

            action.querySelector('#bkViewSubmissionsBtn')?.addEventListener('click', () => {
                if (typeof switchTab === 'function') {
                    switchTab('commissions');
                    setTimeout(() => {
                        document.getElementById('commissionsTable')?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }, 50);
                }
            });
        }

        const button = action.querySelector('#bkViewSubmissionsBtn');
        if (button) {
            button.textContent = getCurrentProfile()?.role === 'user'
                ? 'View My Submissions'
                : 'View Submission Records';
        }
    }

    function enforceDashboardPayrollSeparation() {
        const activeTab = activeTabName();
        const payrollPanel = getPanel();
        const dashboardTotals = document.getElementById('dashboardTotalsCard');

        // The detailed accounting workspace belongs only on the Staff Payroll page.
        if (payrollPanel && activeTab !== 'payroll') {
            payrollPanel.classList.add('hidden');
        }

        // The home dashboard keeps only the submission graph, not payroll amount cards.
        if (dashboardTotals) {
            dashboardTotals.classList.add('hidden');
        }

        ensureDashboardSubmissionAction();
    }

    function initialize() {
        setupMarkup();
        state.initialized = true;
        enforceDashboardPayrollSeparation();

        document.addEventListener('click', event => {
            if (event.target.closest('.tab')) {
                setTimeout(enforceDashboardPayrollSeparation, 0);
            }
        });

        const payrollTab = document.getElementById('payrollTab');
        payrollTab?.addEventListener('click', () => setTimeout(() => open(true), 0));

        const panel = getPanel();
        if (panel) {
            state.observer = new MutationObserver(() => {
                if (isPanelVisible()) open(false);
            });
            state.observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
        }

        state.interval = setInterval(() => {
            enforceDashboardPayrollSeparation();
            if (!isPanelVisible() || state.loading) return;
            const nextFingerprint = fingerprint();
            if (nextFingerprint !== state.lastFingerprint) render();
        }, 1200);
    }

    window.BookkeeperPayroll = {
        open,
        render,
        setPayrollPeriod
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
