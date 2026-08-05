(() => {
    'use strict';

    const STYLE_ID = 'jamminUserCardLightFix';

    function install() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            html[data-theme="light"] .user-card {
                background: #ffffff !important;
                border-color: #e4d8e7 !important;
                box-shadow: 0 10px 28px rgba(62,37,72,.09) !important;
            }

            html[data-theme="light"] .user-card:hover {
                border-color: rgba(233,30,140,.34) !important;
                box-shadow: 0 16px 36px rgba(62,37,72,.13) !important;
            }

            html[data-theme="light"] .user-card-name {
                color: #2d2232 !important;
                opacity: 1 !important;
            }

            html[data-theme="light"] .user-card-email {
                color: #6d6174 !important;
                opacity: 1 !important;
            }

            html[data-theme="light"] .user-detail {
                background: #fbf8fc !important;
                border-color: #eadfeb !important;
            }

            html[data-theme="light"] .user-detail-label {
                color: #75697d !important;
                opacity: 1 !important;
                font-weight: 800 !important;
            }

            html[data-theme="light"] .user-detail-value {
                color: #403447 !important;
                opacity: 1 !important;
            }

            html[data-theme="light"] .user-role-select {
                background: #ffffff !important;
                color: #2d2232 !important;
                border-color: #d7cadb !important;
                color-scheme: light !important;
            }

            html[data-theme="light"] .user-card .training-progress-detail,
            html[data-theme="light"] .user-card .training-card,
            html[data-theme="light"] .user-card [class*="training-progress"] {
                color: #4d3f55 !important;
            }

            html[data-theme="light"] .user-card .training-progress-detail {
                background: #fffaf1 !important;
                border-color: #f0c98d !important;
            }

            html[data-theme="light"] .user-card .training-progress-detail strong,
            html[data-theme="light"] .user-card .training-progress-detail .training-muted,
            html[data-theme="light"] .user-card .training-progress-detail div,
            html[data-theme="light"] .user-card .training-progress-detail span:not(.training-badge) {
                color: #69542f !important;
                opacity: 1 !important;
            }

            html[data-theme="light"] .user-card .training-badge.incomplete {
                color: #9a5b00 !important;
                background: #fff3dc !important;
                border-color: #efc477 !important;
            }

            html[data-theme="light"] .user-card-actions {
                background: #f8f4f9 !important;
                border-top-color: #e8ddea !important;
            }

            html[data-theme="light"] .user-card-actions .edit-staff-btn {
                background: #ffffff !important;
                color: #3d3044 !important;
                border-color: #d7cadb !important;
            }

            html[data-theme="light"] .user-card-actions .edit-staff-btn:disabled {
                background: #f0ecef !important;
                color: #827687 !important;
                border-color: #ddd5df !important;
                opacity: .72 !important;
            }

            html[data-theme="light"] .user-card-actions .reset-toggle-btn {
                background: #e9f8f2 !important;
                color: #146348 !important;
                border-color: #8fd6bb !important;
                opacity: 1 !important;
            }

            html[data-theme="light"] .user-card-actions .reset-toggle-btn:hover {
                background: #dcf3ea !important;
                color: #0f503b !important;
            }

            html[data-theme="light"] .user-card-actions .delete-btn {
                background: #fff0f3 !important;
                color: #a52046 !important;
                border-color: #eba4b6 !important;
                opacity: 1 !important;
            }

            html[data-theme="light"] .user-card-actions .delete-btn:hover {
                background: #ffe4ea !important;
                color: #891735 !important;
            }

            html[data-theme="light"] .user-card-actions button:not(.btn-secondary):not(.reset-toggle-btn):not(.delete-btn):not(.edit-staff-btn) {
                color: #ffffff !important;
            }

            html[data-theme="light"] .password-reset-panel input {
                background: #ffffff !important;
                color: #2d2232 !important;
                border-color: #d7cadb !important;
            }
        `;

        document.head.appendChild(style);
    }

    install();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, { once: true });
    }
})();
