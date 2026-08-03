(() => {
    'use strict';

    const BUTTON_ID = 'djTrainingLaunchButton';
    let observer = null;
    let interval = null;

    function profile() {
        try { return typeof currentProfile !== 'undefined' ? currentProfile : null; }
        catch { return null; }
    }

    function role() {
        return profile()?.role || 'user';
    }

    function ensureTrainingButton() {
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

        button.classList.remove('hidden');
        button.style.display = '';
        button.textContent = role() === 'user' ? 'My Training' : 'DJ Training';
        button.setAttribute('aria-label', role() === 'user' ? 'Open my training record' : 'Open DJ training management');
        return true;
    }

    function start() {
        ensureTrainingButton();

        observer = new MutationObserver(() => ensureTrainingButton());
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });

        interval = setInterval(() => {
            const ready = ensureTrainingButton();
            if (ready && profile()) {
                // Keep a slow check because role-based UI can rebuild after authentication.
                clearInterval(interval);
                interval = setInterval(ensureTrainingButton, 5000);
            }
        }, 750);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
