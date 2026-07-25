(() => {
    'use strict';

    const STATE_VERSION = 1;
    const FALLBACK_TAB = 'dashboard';
    const VALID_TABS = new Set([
        'dashboard',
        'profile',
        'commissions',
        'shows',
        'managerHours',
        'equipmentHours',
        'equipmentCheckout',
        'equipmentRepair',
        'pending',
        'users',
        'payroll',
        'emailSettings'
    ]);

    let restoredForUserId = null;
    let trainingPatched = false;
    let restoreTimer = null;

    function currentUserId() {
        try {
            return typeof currentUser !== 'undefined' && currentUser?.id
                ? currentUser.id
                : null;
        } catch (_) {
            return null;
        }
    }

    function storageKey(userId = currentUserId()) {
        return userId ? `jammin-command-center:view:${userId}` : null;
    }

    function readState(userId = currentUserId()) {
        const key = storageKey(userId);
        if (!key) return null;

        try {
            const parsed = JSON.parse(localStorage.getItem(key) || 'null');
            if (!parsed || parsed.version !== STATE_VERSION) return null;
            return parsed;
        } catch (error) {
            console.warn('Could not read saved Command Center location:', error);
            return null;
        }
    }

    function writeState(patch) {
        const userId = currentUserId();
        const key = storageKey(userId);
        if (!key) return;

        const previous = readState(userId) || {
            version: STATE_VERSION,
            mainTab: FALLBACK_TAB,
            overlay: null,
            trainingUserId: null
        };

        const next = {
            ...previous,
            ...patch,
            version: STATE_VERSION,
            updatedAt: new Date().toISOString()
        };

        try {
            localStorage.setItem(key, JSON.stringify(next));
        } catch (error) {
            console.warn('Could not save Command Center location:', error);
        }
    }

    function tabButton(tab) {
        return document.querySelector(`.tab[onclick="switchTab('${tab}')"]`);
    }

    function tabIsAvailable(tab) {
        if (!VALID_TABS.has(tab)) return false;
        if (tab === FALLBACK_TAB) return true;

        const button = tabButton(tab);
        if (!button) return false;
        if (button.classList.contains('hidden')) return false;

        const style = window.getComputedStyle(button);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    function rememberTab(tab) {
        if (!VALID_TABS.has(tab)) return;
        writeState({
            mainTab: tab,
            overlay: null,
            trainingUserId: null
        });
    }

    function parseTabFromButton(button) {
        const onclick = button?.getAttribute('onclick') || '';
        const match = onclick.match(/switchTab\(['"]([^'"]+)['"]\)/);
        return match?.[1] || null;
    }

    function installNavigationClickTracking() {
        document.addEventListener('click', (event) => {
            const button = event.target.closest('.tab[onclick*="switchTab"]');
            if (!button) return;

            const tab = parseTabFromButton(button);
            if (tab) rememberTab(tab);
        }, true);
    }

    function installTrainingTracking() {
        if (trainingPatched || !window.JamminTraining) return;

        const training = window.JamminTraining;
        const original = {
            open: typeof training.open === 'function' ? training.open.bind(training) : null,
            openFromCard: typeof training.openFromCard === 'function' ? training.openFromCard.bind(training) : null,
            openProfile: typeof training.openProfile === 'function' ? training.openProfile.bind(training) : null,
            close: typeof training.close === 'function' ? training.close.bind(training) : null,
            backToRoster: typeof training.backToRoster === 'function' ? training.backToRoster.bind(training) : null
        };

        if (original.open) {
            training.open = (...args) => {
                writeState({ overlay: 'training', trainingUserId: null });
                return original.open(...args);
            };
        }

        if (original.openFromCard) {
            training.openFromCard = (userId, ...args) => {
                writeState({ overlay: 'training', trainingUserId: userId || null });
                return original.openFromCard(userId, ...args);
            };
        }

        if (original.openProfile) {
            training.openProfile = (userId, ...args) => {
                writeState({ overlay: 'training', trainingUserId: userId || null });
                return original.openProfile(userId, ...args);
            };
        }

        if (original.close) {
            training.close = (...args) => {
                writeState({ overlay: null, trainingUserId: null });
                return original.close(...args);
            };
        }

        if (original.backToRoster) {
            training.backToRoster = (...args) => {
                writeState({ overlay: 'training', trainingUserId: null });
                return original.backToRoster(...args);
            };
        }

        trainingPatched = true;
    }

    async function restoreSavedLocation() {
        const userId = currentUserId();
        if (!userId || restoredForUserId === userId) return;
        if (typeof window.switchTab !== 'function') return;

        const state = readState(userId);
        const tab = state?.mainTab && tabIsAvailable(state.mainTab)
            ? state.mainTab
            : FALLBACK_TAB;

        restoredForUserId = userId;

        try {
            window.switchTab(tab);

            if (state?.overlay === 'training' && window.JamminTraining) {
                await new Promise((resolve) => setTimeout(resolve, 250));

                if (state.trainingUserId && typeof window.JamminTraining.openFromCard === 'function') {
                    await window.JamminTraining.openFromCard(state.trainingUserId);
                } else if (typeof window.JamminTraining.open === 'function') {
                    await window.JamminTraining.open();
                }
            }
        } catch (error) {
            console.warn('Could not restore saved Command Center location:', error);
            try {
                window.switchTab(FALLBACK_TAB);
            } catch (_) {}
        }
    }

    function resetRestoreWhenSignedOut() {
        if (!currentUserId()) {
            restoredForUserId = null;
        }
    }

    function initialize() {
        installTrainingTracking();
        resetRestoreWhenSignedOut();
        restoreSavedLocation();
    }

    installNavigationClickTracking();
    document.addEventListener('DOMContentLoaded', initialize);

    restoreTimer = window.setInterval(initialize, 350);
    window.setTimeout(() => {
        if (restoreTimer) {
            window.clearInterval(restoreTimer);
            restoreTimer = null;
        }
    }, 45000);

    initialize();
})();
