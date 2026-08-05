(() => {
    'use strict';

    const STYLE_ID = 'jamminLightThemePolish';

    function installStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            html[data-theme="light"] .dashboard-intro,
            html[data-theme="light"] .dashboard-intro *,
            html[data-theme="light"] .date-range .small-muted,
            html[data-theme="light"] #submissionChartCard .chart-subtitle {
                color: #6f6477 !important;
                opacity: 1 !important;
            }

            html[data-theme="light"] .top-layout .top-card {
                background: #ffffff !important;
                border-color: #e5d9e8 !important;
                box-shadow: 0 10px 28px rgba(62, 37, 72, 0.09) !important;
            }

            html[data-theme="light"] .top-card-title,
            html[data-theme="light"] #submissionChartCard h2 {
                color: #d9147d !important;
                text-shadow: none !important;
            }

            html[data-theme="light"] .tabs button.tab,
            html[data-theme="light"] .tabs .tab {
                background: #f1ebf3 !important;
                color: #3b2e41 !important;
                border: 1px solid #ddd1e1 !important;
                box-shadow: none !important;
            }

            html[data-theme="light"] .tabs button.tab:hover,
            html[data-theme="light"] .tabs .tab:hover {
                background: #ffffff !important;
                color: #c81776 !important;
                border-color: rgba(233, 30, 140, 0.45) !important;
            }

            html[data-theme="light"] .tabs button.tab.active,
            html[data-theme="light"] .tabs .tab.active {
                background: linear-gradient(135deg, #e91e8c 0%, #764ba2 100%) !important;
                color: #ffffff !important;
                border-color: #d91982 !important;
                box-shadow: 0 8px 20px rgba(233, 30, 140, 0.24) !important;
            }

            html[data-theme="light"] #submissionChartLegend .legend-row {
                background: #fbf8fc !important;
                border-color: #e5d9e8 !important;
                box-shadow: none !important;
            }

            html[data-theme="light"] #submissionChartLegend .legend-label {
                color: #2f2335 !important;
                opacity: 1 !important;
            }

            html[data-theme="light"] #submissionChartLegend .legend-value {
                color: #6f6477 !important;
                opacity: 1 !important;
            }

            html[data-theme="light"] #submissionPieChart {
                filter: drop-shadow(0 14px 26px rgba(62, 37, 72, 0.14)) !important;
            }

            html[data-theme="light"] #submissionPieChart circle:first-of-type {
                fill: #f7f1f8 !important;
                stroke: #e5d9e8 !important;
            }

            html[data-theme="light"] #submissionPieChart circle:last-of-type {
                fill: #ffffff !important;
                stroke: #e5d9e8 !important;
            }

            html[data-theme="light"] #submissionPieChart path {
                stroke: #ffffff !important;
            }

            html[data-theme="light"] #submissionPieChart text:first-of-type {
                fill: #241a2a !important;
            }

            html[data-theme="light"] #submissionPieChart text:last-of-type {
                fill: #6f6477 !important;
            }

            html[data-theme="light"] #submissionChartCard .bk-dashboard-submission-action {
                border-top-color: #e9dfea !important;
            }

            html[data-theme="light"] #submissionChartCard .bk-dashboard-submission-note {
                color: #6f6477 !important;
            }

            html[data-theme="light"] #submissionChartCard #bkViewSubmissionsBtn {
                color: #ffffff !important;
            }
        `;

        document.head.appendChild(style);
    }

    installStyles();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installStyles, { once: true });
    }
})();
