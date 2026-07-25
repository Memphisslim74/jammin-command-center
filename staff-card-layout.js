(() => {
    'use strict';

    function injectStaffCardLayoutStyles() {
        if (document.getElementById('staffCardLayoutStyles')) return;

        const style = document.createElement('style');
        style.id = 'staffCardLayoutStyles';
        style.textContent = `
            /* Keep staff cards compact and place destructive actions last. */
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
