(() => {
    'use strict';

    function injectStaffCardLayoutStyles() {
        if (document.getElementById('staffCardLayoutStyles')) return;

        const style = document.createElement('style');
        style.id = 'staffCardLayoutStyles';
        style.textContent = `
            /* =========================================================
               PRODUCT-GRADE DASHBOARD NAVIGATION + DATA TOOLS
               ========================================================= */
            .top-layout {
                display: grid !important;
                grid-template-columns: minmax(0, 1fr) minmax(360px, 410px) !important;
                gap: 16px !important;
                align-items: start !important;
                margin-bottom: 24px !important;
            }

            .top-layout > .top-card {
                min-width: 0;
                height: auto !important;
                min-height: 0 !important;
                align-self: start !important;
                padding: 20px !important;
                border-radius: 14px !important;
                background: linear-gradient(145deg, rgba(39,35,42,.96), rgba(31,28,35,.96)) !important;
                border: 1px solid rgba(233,30,140,.18) !important;
                box-shadow: 0 12px 30px rgba(0,0,0,.18) !important;
            }

            .top-card-title {
                margin: 0 0 7px !important;
                color: #f02a97 !important;
                font-size: .78rem !important;
                font-weight: 850 !important;
                line-height: 1.1 !important;
                letter-spacing: .13em !important;
                text-transform: uppercase !important;
            }

            .top-card .dashboard-intro {
                margin: 0 0 15px !important;
                color: #aaa1af !important;
                font-size: .88rem !important;
                line-height: 1.4 !important;
            }

            .top-card .tabs {
                display: grid !important;
                grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
                gap: 9px !important;
                margin: 0 !important;
            }

            .top-card .tab,
            .top-card .training-launch-btn {
                width: 100% !important;
                min-width: 0 !important;
                min-height: 58px !important;
                padding: 9px 8px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                text-align: center !important;
                line-height: 1.15 !important;
                white-space: normal !important;
                border-radius: 10px !important;
                border: 1px solid rgba(255,255,255,.065) !important;
                background: rgba(255,255,255,.045) !important;
                color: #f3eff5 !important;
                box-shadow: none !important;
                font-size: .82rem !important;
                font-weight: 680 !important;
                transition: background .18s ease, border-color .18s ease, transform .18s ease !important;
            }

            .top-card .tab:hover,
            .top-card .training-launch-btn:hover {
                background: rgba(255,255,255,.075) !important;
                border-color: rgba(233,30,140,.24) !important;
                transform: translateY(-1px) !important;
                box-shadow: none !important;
            }

            .top-card .tab.active {
                background: linear-gradient(135deg, rgba(233,30,140,.95), rgba(118,75,162,.94)) !important;
                border-color: rgba(255,255,255,.18) !important;
                color: #fff !important;
                box-shadow: 0 8px 22px rgba(190,30,135,.22) !important;
            }

            .top-card .export-buttons {
                margin: 0 !important;
            }

            .top-card .date-range {
                width: 100% !important;
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                gap: 9px !important;
                align-items: stretch !important;
            }

            .top-card .date-range .small-muted {
                grid-column: 1 / -1 !important;
                margin: 0 0 1px !important;
                color: #aaa1af !important;
                font-size: .78rem !important;
                font-weight: 650 !important;
            }

            .top-card .date-range input,
            .top-card .date-range button {
                width: 100% !important;
                min-width: 0 !important;
                min-height: 42px !important;
                margin: 0 !important;
                border-radius: 9px !important;
                font-size: .8rem !important;
            }

            .top-card .date-range input {
                padding: 0 11px !important;
                color-scheme: dark;
                background: rgba(12,10,14,.42) !important;
                border: 1px solid rgba(233,30,140,.38) !important;
                color: #fff !important;
            }

            .top-card .date-range button {
                padding: 8px 10px !important;
                background: rgba(255,255,255,.055) !important;
                color: #f2edf4 !important;
                border: 1px solid rgba(233,30,140,.27) !important;
                box-shadow: none !important;
            }

            .top-card .date-range button:hover {
                background: rgba(233,30,140,.11) !important;
                border-color: rgba(233,30,140,.42) !important;
                transform: translateY(-1px) !important;
                box-shadow: none !important;
            }

            .top-card .date-range button:last-child {
                grid-column: 1 / -1 !important;
            }

            @media (max-width: 1360px) {
                .top-layout {
                    grid-template-columns: 1fr !important;
                }

                .top-card .tabs {
                    grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
                }

                .top-layout > .top-card:last-child .date-range {
                    grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
                    align-items: end !important;
                }

                .top-layout > .top-card:last-child .date-range .small-muted {
                    grid-column: 1 / -1 !important;
                }

                .top-layout > .top-card:last-child .date-range button:last-child {
                    grid-column: auto !important;
                }
            }

            @media (max-width: 980px) {
                .top-card .tabs {
                    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                }

                .top-layout > .top-card:last-child .date-range {
                    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                }

                .top-layout > .top-card:last-child .date-range button:last-child {
                    grid-column: 1 / -1 !important;
                }
            }

            @media (max-width: 640px) {
                .top-layout {
                    gap: 12px !important;
                    margin-bottom: 18px !important;
                }

                .top-layout > .top-card {
                    padding: 15px !important;
                    border-radius: 12px !important;
                }

                .top-card .tabs {
                    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                    gap: 8px !important;
                }

                .top-card .tab,
                .top-card .training-launch-btn {
                    min-height: 54px !important;
                    font-size: .78rem !important;
                }
            }

            @media (max-width: 350px) {
                .top-card .tabs,
                .top-card .date-range,
                .top-layout > .top-card:last-child .date-range {
                    grid-template-columns: 1fr !important;
                }

                .top-card .date-range button:last-child {
                    grid-column: 1 !important;
                }
            }

            /* =========================================================
               COMPACT STAFF CARDS + DESTRUCTIVE ACTION LAST
               ========================================================= */
            .user-card-details {
                gap: 9px !important;
            }

            .user-card-actions {
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                gap: 8px !important;
                align-items: stretch;
                padding: 12px 16px 16px !important;
            }

            .user-card-actions > .action-btn {
                min-width: 0;
                min-height: 40px !important;
                padding: 8px 10px !important;
                line-height: 1.2;
            }

            .user-card-actions .edit-staff-btn { order: 1; }
            .user-card-actions .resend-welcome-btn { order: 2; }

            .user-card-actions .reset-toggle-btn {
                order: 3;
                grid-column: 1 / -1;
            }

            .user-card-actions .password-reset-panel {
                order: 4;
                grid-column: 1 / -1 !important;
            }

            .user-card-actions .training-card-actions {
                order: 20;
                grid-column: 1 / -1 !important;
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                gap: 8px !important;
                padding-top: 10px;
                margin-top: 2px;
                border-top: 1px solid rgba(255,255,255,.07);
            }

            .user-card-actions .training-card-actions button {
                width: 100%;
                min-width: 0;
                min-height: 40px;
                padding: 8px 9px;
                margin: 0;
                line-height: 1.2;
            }

            .user-card-actions .delete-btn {
                order: 100;
                grid-column: 1 / -1 !important;
                margin-top: 4px !important;
                min-height: 42px !important;
            }

            .user-card-actions .cancel-delete-btn {
                order: 100;
                grid-column: 1 / -1 !important;
            }

            @media (max-width: 520px) {
                .user-card-main {
                    padding: 15px !important;
                }

                .user-card-details {
                    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                    gap: 8px !important;
                    margin-top: 13px !important;
                }

                .user-detail {
                    min-width: 0;
                    padding: 9px 10px !important;
                }

                .user-detail-value {
                    overflow-wrap: anywhere;
                }

                .training-progress-detail {
                    grid-column: 1 / -1 !important;
                }

                .user-card-actions {
                    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                    padding: 11px 14px 15px !important;
                }

                .user-card-actions .password-reset-panel {
                    grid-template-columns: 1fr !important;
                }
            }

            @media (max-width: 370px) {
                .user-card-details {
                    grid-template-columns: 1fr !important;
                }

                .training-progress-detail {
                    grid-column: 1 !important;
                }
            }
        `;

        document.head.appendChild(style);
    }

    function normalizeStaffCardActions() {
        document.querySelectorAll('.user-card-actions').forEach((actions) => {
            const trainingActions = actions.querySelector('.training-card-actions');
            const deleteButton = actions.querySelector('.delete-btn');

            if (trainingActions && deleteButton && trainingActions.nextElementSibling !== deleteButton) {
                actions.insertBefore(trainingActions, deleteButton);
            }

            const resetPanel = actions.querySelector('.password-reset-panel');
            if (resetPanel && trainingActions && resetPanel.compareDocumentPosition(trainingActions) & Node.DOCUMENT_POSITION_PRECEDING) {
                actions.insertBefore(resetPanel, trainingActions);
            }
        });
    }

    function refreshLayout() {
        injectStaffCardLayoutStyles();
        normalizeStaffCardActions();
    }

    document.addEventListener('DOMContentLoaded', refreshLayout);

    const observer = new MutationObserver(() => {
        window.requestAnimationFrame(refreshLayout);
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    refreshLayout();
})();