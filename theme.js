(() => {
    'use strict';

    const STORAGE_KEY = 'jammin-command-center-theme';
    const STYLE_ID = 'jamminThemeStyles';
    const CONTROL_ID = 'jamminThemeControl';
    const SELECT_ID = 'jamminThemeSelect';
    const FAVICON_FALLBACK = 'jammin-j-favicon.svg';
    const allowedThemes = new Set(['system', 'light', 'dark']);
    const systemTheme = window.matchMedia('(prefers-color-scheme: light)');
    let preference = readPreference();
    let faviconCreated = false;

    function readPreference() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY) || 'system';
            return allowedThemes.has(saved) ? saved : 'system';
        } catch (_) {
            return 'system';
        }
    }

    function resolvedTheme(value = preference) {
        if (value === 'light' || value === 'dark') return value;
        return systemTheme.matches ? 'light' : 'dark';
    }

    function applyTheme(nextPreference = preference, persist = false) {
        preference = allowedThemes.has(nextPreference) ? nextPreference : 'system';
        const resolved = resolvedTheme(preference);
        const root = document.documentElement;

        root.dataset.theme = resolved;
        root.dataset.themePreference = preference;
        root.style.colorScheme = resolved;

        let colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
        if (!colorSchemeMeta) {
            colorSchemeMeta = document.createElement('meta');
            colorSchemeMeta.name = 'color-scheme';
            document.head.appendChild(colorSchemeMeta);
        }
        colorSchemeMeta.content = resolved;

        let themeColor = document.querySelector('meta[name="theme-color"]');
        if (!themeColor) {
            themeColor = document.createElement('meta');
            themeColor.name = 'theme-color';
            document.head.appendChild(themeColor);
        }
        themeColor.content = resolved === 'light' ? '#f6f1f7' : '#1a0f25';

        if (persist) {
            try { localStorage.setItem(STORAGE_KEY, preference); } catch (_) {}
        }

        const select = document.getElementById(SELECT_ID);
        if (select && select.value !== preference) select.value = preference;

        window.dispatchEvent(new CustomEvent('jammin-theme-change', {
            detail: { preference, theme: resolved }
        }));
    }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            :root {
                --jammin-pink: #e91e8c;
                --jammin-purple: #764ba2;
                --jammin-light-bg: #f6f1f7;
                --jammin-light-surface: #ffffff;
                --jammin-light-surface-soft: #fbf8fc;
                --jammin-light-text: #241a2a;
                --jammin-light-muted: #6f6477;
                --jammin-light-border: #e5d9e8;
                --jammin-light-shadow: 0 10px 30px rgba(62, 37, 72, 0.10);
            }

            .jammin-theme-control {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                min-height: 42px;
                padding: 6px 8px 6px 11px;
                border: 1px solid rgba(233, 30, 140, 0.30);
                border-radius: 10px;
                background: rgba(255, 255, 255, 0.07);
                color: #ffffff;
                box-shadow: none;
                flex: 0 0 auto;
            }

            .jammin-theme-control .theme-icon {
                font-size: 16px;
                line-height: 1;
            }

            .jammin-theme-control label {
                position: absolute;
                width: 1px;
                height: 1px;
                padding: 0;
                margin: -1px;
                overflow: hidden;
                clip: rect(0, 0, 0, 0);
                white-space: nowrap;
                border: 0;
            }

            .jammin-theme-control select {
                min-width: 92px;
                min-height: 30px;
                padding: 2px 26px 2px 5px;
                border: 0;
                outline: 0;
                background: transparent;
                color: inherit;
                font: inherit;
                font-size: 13px;
                font-weight: 800;
                cursor: pointer;
                color-scheme: dark;
            }

            .jammin-theme-control select option {
                background: #2d1b3d;
                color: #ffffff;
            }

            body > .jammin-theme-control {
                position: fixed;
                top: 14px;
                right: 14px;
                z-index: 12050;
                backdrop-filter: blur(12px);
                background: rgba(35, 22, 46, 0.90);
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
            }

            .account-bar .jammin-theme-control,
            .header .jammin-theme-control {
                position: static;
            }

            html[data-theme="light"] body {
                background:
                    radial-gradient(circle at top left, rgba(233, 30, 140, 0.09), transparent 30%),
                    linear-gradient(135deg, #fbf8fc 0%, var(--jammin-light-bg) 100%) !important;
                color: var(--jammin-light-text) !important;
            }

            html[data-theme="light"] .header,
            html[data-theme="light"] .top-card,
            html[data-theme="light"] .controls,
            html[data-theme="light"] .table-container,
            html[data-theme="light"] .dashboard-chart-card,
            html[data-theme="light"] .dashboard-total-card,
            html[data-theme="light"] .stat-card,
            html[data-theme="light"] .payroll-panel,
            html[data-theme="light"] .profile-card,
            html[data-theme="light"] .admin-performance-card,
            html[data-theme="light"] .auth-screen,
            html[data-theme="light"] .boot-card,
            html[data-theme="light"] .email-route-row,
            html[data-theme="light"] .user-card,
            html[data-theme="light"] .users-toolbar,
            html[data-theme="light"] .users-page-header,
            html[data-theme="light"] .training-shell,
            html[data-theme="light"] .training-roster-card,
            html[data-theme="light"] .training-summary-card,
            html[data-theme="light"] .training-row,
            html[data-theme="light"] .training-completion-bar,
            html[data-theme="light"] .bk-period-card,
            html[data-theme="light"] .bk-staff-section,
            html[data-theme="light"] .bk-entry-section,
            html[data-theme="light"] .bk-summary-card,
            html[data-theme="light"] .bk-breakdown-grid article,
            html[data-theme="light"] .my-submissions-header,
            html[data-theme="light"] .my-submissions-card,
            html[data-theme="light"] .my-submissions-breakdown div,
            html[data-theme="light"] .my-submission-row {
                background: var(--jammin-light-surface) !important;
                border-color: var(--jammin-light-border) !important;
                box-shadow: var(--jammin-light-shadow) !important;
                color: var(--jammin-light-text) !important;
            }

            html[data-theme="light"] .top-card,
            html[data-theme="light"] .controls,
            html[data-theme="light"] .table-container,
            html[data-theme="light"] .dashboard-chart-card,
            html[data-theme="light"] .stat-card,
            html[data-theme="light"] .payroll-panel,
            html[data-theme="light"] .profile-card,
            html[data-theme="light"] .user-card,
            html[data-theme="light"] .training-roster-card,
            html[data-theme="light"] .training-summary-card,
            html[data-theme="light"] .training-row,
            html[data-theme="light"] .bk-summary-card,
            html[data-theme="light"] .bk-breakdown-grid article,
            html[data-theme="light"] .my-submissions-card,
            html[data-theme="light"] .my-submissions-breakdown div,
            html[data-theme="light"] .my-submission-row {
                backdrop-filter: none !important;
            }

            html[data-theme="light"] .boot-screen {
                background:
                    radial-gradient(circle at top left, rgba(233, 30, 140, 0.10), transparent 32%),
                    linear-gradient(135deg, #fbf8fc 0%, #eee4f1 100%) !important;
                color: var(--jammin-light-text) !important;
            }

            html[data-theme="light"] .training-overlay,
            html[data-theme="light"] .bk-denial-overlay,
            html[data-theme="light"] .success-modal-overlay {
                background: rgba(246, 241, 247, 0.88) !important;
            }

            html[data-theme="light"] .success-modal,
            html[data-theme="light"] .bk-denial-card {
                background: var(--jammin-light-surface) !important;
                border-color: var(--jammin-light-border) !important;
                box-shadow: 0 24px 70px rgba(62, 37, 72, 0.18) !important;
                color: var(--jammin-light-text) !important;
            }

            html[data-theme="light"] h1,
            html[data-theme="light"] h2,
            html[data-theme="light"] h3,
            html[data-theme="light"] h4,
            html[data-theme="light"] .top-card-title,
            html[data-theme="light"] .stat-value,
            html[data-theme="light"] .payroll-mini-value,
            html[data-theme="light"] .dashboard-total-value,
            html[data-theme="light"] .legend-label,
            html[data-theme="light"] .email-route-label,
            html[data-theme="light"] .user-card h3,
            html[data-theme="light"] .training-roster-card h3,
            html[data-theme="light"] .training-row h4,
            html[data-theme="light"] .training-summary-card strong,
            html[data-theme="light"] .bk-payroll-header h2,
            html[data-theme="light"] .bk-section-heading h3,
            html[data-theme="light"] .bk-summary-card strong,
            html[data-theme="light"] .bk-breakdown-grid strong,
            html[data-theme="light"] .bk-staff-name,
            html[data-theme="light"] .bk-total-cell,
            html[data-theme="light"] .my-submissions-header h2,
            html[data-theme="light"] .my-submissions-card strong,
            html[data-theme="light"] .my-submissions-breakdown strong,
            html[data-theme="light"] .my-submission-value,
            html[data-theme="light"] .my-submission-amount {
                color: var(--jammin-light-text) !important;
                text-shadow: none !important;
            }

            html[data-theme="light"] .subtitle,
            html[data-theme="light"] .small-muted,
            html[data-theme="light"] .field-help,
            html[data-theme="light"] .field-help-text,
            html[data-theme="light"] .profile-note,
            html[data-theme="light"] .dashboard-intro,
            html[data-theme="light"] .chart-subtitle,
            html[data-theme="light"] .legend-value,
            html[data-theme="light"] .email-route-help,
            html[data-theme="light"] .email-routing-tip,
            html[data-theme="light"] .payroll-subtitle,
            html[data-theme="light"] .payroll-mini-label,
            html[data-theme="light"] .training-muted,
            html[data-theme="light"] .training-roster-card .training-muted,
            html[data-theme="light"] .training-row p,
            html[data-theme="light"] .training-signoff,
            html[data-theme="light"] .bk-payroll-header p,
            html[data-theme="light"] .bk-section-heading p,
            html[data-theme="light"] .bk-period-help,
            html[data-theme="light"] .bk-staff-email,
            html[data-theme="light"] .bk-entry-notes,
            html[data-theme="light"] .bk-dashboard-submission-note,
            html[data-theme="light"] .my-submissions-header p,
            html[data-theme="light"] .my-submissions-card small,
            html[data-theme="light"] .my-submission-note,
            html[data-theme="light"] .my-submission-label {
                color: var(--jammin-light-muted) !important;
            }

            html[data-theme="light"] .tab {
                background: rgba(255, 255, 255, 0.82) !important;
                color: #3a2d40 !important;
                border-color: var(--jammin-light-border) !important;
                box-shadow: 0 4px 14px rgba(62, 37, 72, 0.06) !important;
            }

            html[data-theme="light"] .tab:hover {
                background: #ffffff !important;
                border-color: rgba(233, 30, 140, 0.35) !important;
            }

            html[data-theme="light"] .tab.active {
                background: linear-gradient(135deg, #e91e8c 0%, #764ba2 100%) !important;
                color: #ffffff !important;
                border-color: #e91e8c !important;
                box-shadow: 0 8px 22px rgba(233, 30, 140, 0.22) !important;
            }

            html[data-theme="light"] input,
            html[data-theme="light"] select,
            html[data-theme="light"] textarea,
            html[data-theme="light"] .bk-rate-input-wrap,
            html[data-theme="light"] .performance-controls input,
            html[data-theme="light"] .performance-controls select,
            html[data-theme="light"] .payroll-controls input,
            html[data-theme="light"] .payroll-controls select,
            html[data-theme="light"] .payroll-rate-editor input,
            html[data-theme="light"] .training-toolbar input,
            html[data-theme="light"] .training-toolbar select,
            html[data-theme="light"] .training-row input,
            html[data-theme="light"] .training-add-other input,
            html[data-theme="light"] .bk-period-controls input,
            html[data-theme="light"] .bk-period-controls select,
            html[data-theme="light"] .bk-entry-filters input,
            html[data-theme="light"] .bk-entry-filters select,
            html[data-theme="light"] #bkPeriodSelect {
                background: #ffffff !important;
                color: var(--jammin-light-text) !important;
                border-color: #d9cadf !important;
                color-scheme: light !important;
                box-shadow: inset 0 1px 2px rgba(62, 37, 72, 0.04) !important;
            }

            html[data-theme="light"] input::placeholder,
            html[data-theme="light"] textarea::placeholder {
                color: #94879b !important;
            }

            html[data-theme="light"] select option,
            html[data-theme="light"] .jammin-theme-control select option {
                background: #ffffff !important;
                color: var(--jammin-light-text) !important;
            }

            html[data-theme="light"] input[type="date"]::-webkit-calendar-picker-indicator {
                filter: none !important;
            }

            html[data-theme="light"] .btn-secondary,
            html[data-theme="light"] .action-btn.btn-secondary,
            html[data-theme="light"] button.btn-secondary {
                background: #ffffff !important;
                color: #4a3653 !important;
                border: 1px solid #d9cadf !important;
                box-shadow: 0 4px 12px rgba(62, 37, 72, 0.07) !important;
            }

            html[data-theme="light"] .btn-secondary:hover,
            html[data-theme="light"] button.btn-secondary:hover {
                background: #fbf5fc !important;
                border-color: rgba(233, 30, 140, 0.45) !important;
            }

            html[data-theme="light"] table,
            html[data-theme="light"] th,
            html[data-theme="light"] td {
                color: #34273a !important;
            }

            html[data-theme="light"] th {
                background: #f4eaf3 !important;
                color: #4d3855 !important;
                border-color: var(--jammin-light-border) !important;
                backdrop-filter: none !important;
            }

            html[data-theme="light"] td,
            html[data-theme="light"] .bk-staff-table td,
            html[data-theme="light"] .bk-entry-table td {
                border-color: #eee5f0 !important;
            }

            html[data-theme="light"] tr:hover,
            html[data-theme="light"] .bk-staff-table tbody tr:hover,
            html[data-theme="light"] .bk-entry-table tbody tr:hover {
                background: #fcf8fd !important;
            }

            html[data-theme="light"] .legend-row,
            html[data-theme="light"] .bulk-approval-bar,
            html[data-theme="light"] .bk-bulk-bar,
            html[data-theme="light"] .users-empty-state,
            html[data-theme="light"] .training-empty,
            html[data-theme="light"] .payroll-empty,
            html[data-theme="light"] .my-submissions-empty {
                background: var(--jammin-light-surface-soft) !important;
                border-color: var(--jammin-light-border) !important;
                color: var(--jammin-light-muted) !important;
            }

            html[data-theme="light"] .performance-controls,
            html[data-theme="light"] .email-routing-tip,
            html[data-theme="light"] .bk-setup-notice,
            html[data-theme="light"] .my-submissions-notice {
                background: #fbf5fc !important;
                border-color: #e4d3e7 !important;
                color: #644d6d !important;
            }

            html[data-theme="light"] .jammin-theme-control {
                background: #ffffff !important;
                color: #3a2d40 !important;
                border-color: #d9cadf !important;
                box-shadow: 0 5px 16px rgba(62, 37, 72, 0.08) !important;
            }

            html[data-theme="light"] .jammin-theme-control select {
                color-scheme: light !important;
            }

            html[data-theme="light"] .bk-rate-input-wrap span,
            html[data-theme="light"] .money-input-wrap span {
                color: #75657d !important;
            }

            html[data-theme="light"] .training-history details {
                border-color: var(--jammin-light-border) !important;
                background: #ffffff !important;
            }

            html[data-theme="light"] .training-history summary {
                color: var(--jammin-light-text) !important;
            }

            html[data-theme="light"] .training-history-item {
                color: var(--jammin-light-muted) !important;
                border-color: #eee5f0 !important;
            }

            @media (max-width: 768px) {
                .account-bar .jammin-theme-control {
                    width: 100%;
                    justify-content: center;
                }

                body > .jammin-theme-control {
                    top: 8px;
                    right: 8px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function installControl() {
        let control = document.getElementById(CONTROL_ID);
        if (!control) {
            control = document.createElement('div');
            control.id = CONTROL_ID;
            control.className = 'jammin-theme-control';
            control.innerHTML = `
                <span class="theme-icon" aria-hidden="true">◐</span>
                <label for="${SELECT_ID}">Color theme</label>
                <select id="${SELECT_ID}" aria-label="Color theme">
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                </select>
            `;

            control.querySelector('select').addEventListener('change', event => {
                applyTheme(event.target.value, true);
            });
        }

        const accountBar = document.querySelector('.account-bar');
        const target = accountBar || document.body;
        if (target && control.parentElement !== target) target.appendChild(control);

        const select = control.querySelector('select');
        if (select && select.value !== preference) select.value = preference;
    }

    function setFavicon(href) {
        const rels = ['icon', 'shortcut icon', 'apple-touch-icon'];
        document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(link => {
            link.href = href;
            if (link.rel.includes('icon')) link.type = href.startsWith('data:image/png') ? 'image/png' : 'image/svg+xml';
        });

        rels.forEach(rel => {
            if (document.querySelector(`link[rel="${rel}"]`)) return;
            const link = document.createElement('link');
            link.rel = rel;
            link.href = href;
            if (rel.includes('icon')) link.type = href.startsWith('data:image/png') ? 'image/png' : 'image/svg+xml';
            document.head.appendChild(link);
        });
    }

    function findLogoElement() {
        return document.querySelector('.logo') ||
            document.querySelector('.login-logo') ||
            document.querySelector('.boot-card img');
    }

    function occupiedBounds(imageData, width, height, xStart, xEnd) {
        let minX = width;
        let maxX = -1;
        let minY = height;
        let maxY = -1;

        for (let y = 0; y < height; y += 1) {
            for (let x = xStart; x <= xEnd; x += 1) {
                const alpha = imageData.data[((y * width + x) * 4) + 3];
                if (alpha < 24) continue;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }

        return maxX >= minX && maxY >= minY
            ? { minX, maxX, minY, maxY }
            : null;
    }

    function detectJBounds(imageData, width, height) {
        const occupiedColumns = new Array(width).fill(false);
        for (let x = 0; x < width; x += 1) {
            for (let y = 0; y < height; y += 1) {
                if (imageData.data[((y * width + x) * 4) + 3] >= 24) {
                    occupiedColumns[x] = true;
                    break;
                }
            }
        }

        const first = occupiedColumns.findIndex(Boolean);
        if (first < 0) return null;

        const minimumSegmentWidth = Math.max(18, Math.round(width * 0.07));
        const requiredGap = Math.max(3, Math.round(width * 0.012));
        let segmentEnd = Math.min(width - 1, first + Math.round(height * 0.82));
        let gap = 0;

        for (let x = first + minimumSegmentWidth; x < width; x += 1) {
            if (!occupiedColumns[x]) gap += 1;
            else gap = 0;

            if (gap >= requiredGap) {
                segmentEnd = x - gap;
                break;
            }
        }

        return occupiedBounds(imageData, width, height, first, Math.max(first, segmentEnd));
    }

    function renderFaviconFromLogo(logo) {
        if (!logo || faviconCreated) return;

        const source = logo.currentSrc || logo.src;
        if (!source) return;

        const image = new Image();
        if (!source.startsWith('data:')) image.crossOrigin = 'anonymous';

        image.onload = () => {
            try {
                const sourceCanvas = document.createElement('canvas');
                sourceCanvas.width = image.naturalWidth || image.width;
                sourceCanvas.height = image.naturalHeight || image.height;
                const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
                sourceContext.drawImage(image, 0, 0);

                const pixels = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
                const bounds = detectJBounds(pixels, sourceCanvas.width, sourceCanvas.height);
                if (!bounds) return;

                const cropWidth = bounds.maxX - bounds.minX + 1;
                const cropHeight = bounds.maxY - bounds.minY + 1;
                const padding = Math.max(6, Math.round(Math.max(cropWidth, cropHeight) * 0.12));
                const size = 180;
                const targetCanvas = document.createElement('canvas');
                targetCanvas.width = size;
                targetCanvas.height = size;
                const context = targetCanvas.getContext('2d');
                const available = size - (padding * 2);
                const scale = Math.min(available / cropWidth, available / cropHeight);
                const drawWidth = cropWidth * scale;
                const drawHeight = cropHeight * scale;
                const drawX = (size - drawWidth) / 2;
                const drawY = (size - drawHeight) / 2;

                context.clearRect(0, 0, size, size);
                context.drawImage(
                    image,
                    bounds.minX,
                    bounds.minY,
                    cropWidth,
                    cropHeight,
                    drawX,
                    drawY,
                    drawWidth,
                    drawHeight
                );

                setFavicon(targetCanvas.toDataURL('image/png'));
                faviconCreated = true;
            } catch (error) {
                console.warn('Could not create the exact J favicon from the displayed logo:', error);
            }
        };

        image.onerror = () => console.warn('Could not load the displayed JAMMIN logo for the favicon.');
        image.src = source;
    }

    function installFavicon() {
        setFavicon(FAVICON_FALLBACK);
        const logo = findLogoElement();
        if (logo) {
            if (logo.complete) renderFaviconFromLogo(logo);
            else logo.addEventListener('load', () => renderFaviconFromLogo(logo), { once: true });
        }
    }

    function initialize() {
        injectStyles();
        applyTheme(preference, false);
        installControl();
        installFavicon();

        const observer = new MutationObserver(() => {
            installControl();
            if (!faviconCreated) installFavicon();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });

        systemTheme.addEventListener?.('change', () => {
            if (preference === 'system') applyTheme('system', false);
        });
    }

    window.JamminTheme = {
        get preference() { return preference; },
        get theme() { return resolvedTheme(preference); },
        set: value => applyTheme(value, true),
        reset: () => applyTheme('system', true)
    };

    applyTheme(preference, false);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
