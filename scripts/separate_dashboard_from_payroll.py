from pathlib import Path

path = Path('bookkeeper-payroll.js')
text = path.read_text(encoding='utf-8')

style_anchor = """            .bookkeeper-payroll-panel {
                display: grid;
"""
style_replacement = """            .bookkeeper-payroll-panel.hidden {
                display: none !important;
            }
            .bookkeeper-payroll-panel {
                display: grid;
"""

chart_style_anchor = """            .bk-period-status {
                padding: 8px 12px;
"""
chart_style_replacement = """            .bk-dashboard-submission-action {
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
"""

initialize_anchor = """    function initialize() {
        setupMarkup();
        state.initialized = true;
"""
initialize_replacement = """    function activeTabName() {
        const activeTab = document.querySelector('.tab.active');
        const onclickValue = activeTab?.getAttribute('onclick') || '';
        const match = onclickValue.match(/switchTab\\('([^']+)'\\)/);
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
"""

interval_anchor = """        state.interval = setInterval(() => {
            if (!isPanelVisible() || state.loading) return;
"""
interval_replacement = """        state.interval = setInterval(() => {
            enforceDashboardPayrollSeparation();
            if (!isPanelVisible() || state.loading) return;
"""

replacements = [
    (style_anchor, style_replacement, 'hidden payroll panel style'),
    (chart_style_anchor, chart_style_replacement, 'dashboard action styles'),
    (initialize_anchor, initialize_replacement, 'dashboard separation functions'),
    (interval_anchor, interval_replacement, 'visibility enforcement interval'),
]

for anchor, replacement, label in replacements:
    count = text.count(anchor)
    if count != 1:
        raise RuntimeError(f'Expected exactly one {label} anchor, found {count}.')
    text = text.replace(anchor, replacement, 1)

path.write_text(text, encoding='utf-8')
print('Separated dashboard summary from the Staff Payroll workspace.')
