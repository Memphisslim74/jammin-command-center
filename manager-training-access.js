(() => {
    'use strict';

    const BUTTON_ID = 'djTrainingLaunchButton';
    let observer = null;
    let interval = null;

    function loadTheme() {
        if (!window.JamminTheme && !document.querySelector('script[data-jammin-theme]')) {
            const script = document.createElement('script');
            script.src = 'theme.js?v=20260805';
            script.dataset.jamminTheme = 'true';
            script.async = false;
            script.onerror = () => console.error('The Command Center theme could not be loaded.');
            document.head.appendChild(script);
        }

        if (!document.querySelector('script[data-jammin-theme-polish]')) {
            const polish = document.createElement('script');
            polish.src = 'theme-polish.js?v=20260805-2';
            polish.dataset.jamminThemePolish = 'true';
            polish.async = false;
            polish.onerror = () => console.error('The Command Center light-theme fixes could not be loaded.');
            document.head.appendChild(polish);
        }
    }

    function profile() {
        try { return typeof currentProfile !== 'undefined' ? currentProfile : null; }
        catch { return null; }
    }

    function role() {
        return profile()?.role || 'user';
    }

    function hasPayrollAccess() {
        const current = profile();
        return Boolean(current && (
            current.role === 'admin' ||
            current.payroll_access === true
        ));
    }

    function enforcePayrollAccess() {
        const allowed = hasPayrollAccess();
        const payrollTab = document.getElementById('payrollTab');
        const payrollPanel = document.getElementById('staffPayrollPanel');

        if (payrollTab) payrollTab.classList.toggle('hidden', !allowed);
        if (!allowed && payrollPanel) payrollPanel.classList.add('hidden');

        const activeTab = document.querySelector('.tab.active');
        if (!allowed && activeTab?.id === 'payrollTab' && typeof switchTab === 'function') {
            switchTab('dashboard');
        }

        return allowed;
    }

    function ensureTrainingButton() {
        enforcePayrollAccess();

        const tabs = document.querySelector('.tabs');
        const training = window.JamminTraining;
        if (!tabs || !training?.open) return false;

        let button = document.getElementById(BUTTON_ID);
        if (!button) {
            button = document.createElement('button');
            button.type = 'button';
            button.id = BUTTON_ID;
            button.className = 'tab training-launch-btn';
            button.addEventListener('click', event => {
                event.preventDefault();
                window.JamminTraining?.open?.();
            });

            const usersTab = document.getElementById('usersTab');
            const payrollTab = document.getElementById('payrollTab');
            tabs.insertBefore(button, usersTab || payrollTab || null);
        }

        if (button.classList.contains('hidden')) button.classList.remove('hidden');
        if (button.style.display === 'none') button.style.display = '';

        const desiredText = role() === 'user' ? 'My Training' : 'DJ Training';
        if (button.textContent !== desiredText) button.textContent = desiredText;

        const desiredLabel = role() === 'user' ? 'Open my training record' : 'Open DJ training management';
        if (button.getAttribute('aria-label') !== desiredLabel) button.setAttribute('aria-label', desiredLabel);
        return true;
    }

    function start() {
        loadTheme();
        ensureTrainingButton();

        document.addEventListener('click', event => {
            const payrollTab = event.target.closest?.('#payrollTab');
            if (!payrollTab || hasPayrollAccess()) return;

            event.preventDefault();
            event.stopImmediatePropagation();
            enforcePayrollAccess();
            if (typeof switchTab === 'function') switchTab('dashboard');
        }, true);

        observer = new MutationObserver(() => {
            ensureTrainingButton();
            enforcePayrollAccess();
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        interval = setInterval(() => {
            loadTheme();
            const ready = ensureTrainingButton();
            enforcePayrollAccess();
            if (ready && profile()) {
                clearInterval(interval);
                interval = setInterval(() => {
                    loadTheme();
                    ensureTrainingButton();
                    enforcePayrollAccess();
                }, 5000);
            }
        }, 750);
    }

    window.JamminPayrollAccess = {
        allowed: hasPayrollAccess,
        enforce: enforcePayrollAccess
    };

    loadTheme();

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
