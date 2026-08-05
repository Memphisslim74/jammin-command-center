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

            html[data-theme="light"] .training-shell-header {
                background: #ffffff !important;
                border-bottom-color: #e5d9e8 !important;
            }

            html[data-theme="light"] .training-shell-header h2 {
                color: #241a2a !important;
                text-shadow: none !important;
            }

            html[data-theme="light"] .training-shell-header p {
                color: #6f6477 !important;
                opacity: 1 !important;
            }

            html[data-theme="light"] .training-header-actions {
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
                flex-wrap: nowrap !important;
            }

            html[data-theme="light"] .training-close,
            html[data-theme="light"] .training-type-close,
            html[data-theme="light"] .classroom-close {
                display: inline-grid !important;
                place-items: center !important;
                flex: 0 0 40px !important;
                width: 40px !important;
                height: 40px !important;
                min-width: 40px !important;
                min-height: 40px !important;
                padding: 0 !important;
                border: 1px solid #d9cadf !important;
                border-radius: 10px !important;
                background: #f7f2f8 !important;
                color: #34273a !important;
                font-size: 26px !important;
                line-height: 1 !important;
                font-weight: 600 !important;
                opacity: 1 !important;
                box-shadow: 0 4px 12px rgba(62, 37, 72, 0.08) !important;
                cursor: pointer !important;
            }

            html[data-theme="light"] .training-close:hover,
            html[data-theme="light"] .training-type-close:hover,
            html[data-theme="light"] .classroom-close:hover {
                background: #ffffff !important;
                color: #c81776 !important;
                border-color: rgba(233, 30, 140, 0.48) !important;
                transform: none !important;
            }

            html[data-theme="light"] .training-type-manager-btn {
                background: #fff0f8 !important;
                color: #b51268 !important;
                border-color: #f2a8cf !important;
                opacity: 1 !important;
                box-shadow: none !important;
            }

            html[data-theme="light"] .training-type-manager-btn:hover {
                background: #ffe4f3 !important;
                color: #981052 !important;
                border-color: #e91e8c !important;
            }

            html[data-theme="light"] .classroom-header-btn {
                background: #eef5ff !important;
                color: #245da8 !important;
                border-color: #a9c8f7 !important;
                opacity: 1 !important;
                box-shadow: none !important;
            }

            html[data-theme="light"] .classroom-header-btn:hover {
                background: #e0edff !important;
                color: #174b91 !important;
                border-color: #4285f4 !important;
            }

            html[data-theme="light"] .training-header-actions button:disabled {
                opacity: 0.55 !important;
                cursor: not-allowed !important;
            }

            @media (max-width: 720px) {
                html[data-theme="light"] .training-shell-header {
                    align-items: flex-start !important;
                }

                html[data-theme="light"] .training-header-actions {
                    flex-wrap: wrap !important;
                    justify-content: flex-end !important;
                }
            }
        `;

        document.head.appendChild(style);
    }

    installStyles();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installStyles, { once: true });
    }
})();
