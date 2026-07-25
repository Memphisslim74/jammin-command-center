(() => {
    'use strict';

    const state = {
        loading: false,
        lastUserId: null,
        categories: [],
        records: [],
        wrappersInstalled: false
    };

    const GOOGLE_CLASSROOM_URL = 'https://classroom.google.com/u/5/w/NzQyMTEyMzE1NDgz/t/all';

    const esc = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    function currentUserId() {
        return typeof currentUser !== 'undefined' ? currentUser?.id : null;
    }

    function injectStyles() {
        if (document.getElementById('myTrainingProgressStyles')) return;

        const style = document.createElement('style');
        style.id = 'myTrainingProgressStyles';
        style.textContent = `
            .my-training-panel {
                margin: 18px 0 22px;
                padding: 20px;
                border-radius: 15px;
                border: 1px solid rgba(233,30,140,.24);
                background: linear-gradient(145deg, rgba(52,38,61,.86), rgba(30,25,35,.92));
                box-shadow: 0 14px 34px rgba(0,0,0,.18);
            }

            .my-training-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 18px;
                margin-bottom: 16px;
            }

            .my-training-eyebrow {
                color: #f02a97;
                font-size: .74rem;
                font-weight: 850;
                letter-spacing: .12em;
                text-transform: uppercase;
                margin-bottom: 5px;
            }

            .my-training-header h3 {
                margin: 0 0 5px;
                color: #fff;
                font-size: 1.18rem;
            }

            .my-training-header p {
                margin: 0;
                color: #aaa0b0;
                font-size: .9rem;
                line-height: 1.45;
            }

            .my-training-status {
                flex: 0 0 auto;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border-radius: 999px;
                padding: 7px 11px;
                font-size: .76rem;
                font-weight: 850;
                white-space: nowrap;
            }

            .my-training-status.complete {
                color: #8cf0c6;
                background: rgba(16,185,129,.14);
                border: 1px solid rgba(16,185,129,.34);
            }

            .my-training-status.incomplete {
                color: #ffd48b;
                background: rgba(245,158,11,.13);
                border: 1px solid rgba(245,158,11,.3);
            }

            .my-training-progress-row {
                display: grid;
                grid-template-columns: 1fr auto;
                gap: 14px;
                align-items: center;
                margin-bottom: 16px;
            }

            .my-training-progress-copy {
                color: #f4eff6;
                font-weight: 750;
                font-size: .92rem;
            }

            .my-training-percent {
                color: #fff;
                font-weight: 900;
                font-size: 1rem;
            }

            .my-training-track {
                grid-column: 1 / -1;
                height: 9px;
                border-radius: 999px;
                overflow: hidden;
                background: rgba(255,255,255,.08);
            }

            .my-training-fill {
                height: 100%;
                border-radius: inherit;
                background: linear-gradient(90deg,#e91e8c,#764ba2);
            }

            .my-training-missing-title {
                color: #fff;
                font-size: .84rem;
                font-weight: 850;
                margin: 0 0 9px;
            }

            .my-training-missing-list {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
                gap: 9px;
                margin-bottom: 16px;
            }

            .my-training-missing-item {
                padding: 11px 12px;
                border-radius: 10px;
                border: 1px solid rgba(245,158,11,.22);
                background: rgba(245,158,11,.065);
            }

            .my-training-missing-item strong {
                display: block;
                color: #fff;
                font-size: .88rem;
                margin-bottom: 3px;
            }

            .my-training-missing-item span {
                color: #aca2b2;
                font-size: .78rem;
                line-height: 1.35;
            }

            .my-training-complete-message {
                margin-bottom: 16px;
                padding: 13px 14px;
                border-radius: 10px;
                color: #c7f8e3;
                background: rgba(16,185,129,.08);
                border: 1px solid rgba(16,185,129,.2);
                font-size: .88rem;
                line-height: 1.45;
            }

            .my-training-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 9px;
            }

            .my-training-actions button,
            .my-training-actions a {
                min-height: 41px;
                margin: 0;
                padding: 9px 14px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                font-weight: 750;
                text-decoration: none;
            }

            .my-training-classroom-btn {
                color: #f8edf4;
                background: rgba(255,255,255,.055);
                border: 1px solid rgba(233,30,140,.30);
                transition: background .18s ease, border-color .18s ease, transform .18s ease;
            }

            .my-training-classroom-btn:hover {
                color: #fff;
                background: rgba(233,30,140,.13);
                border-color: rgba(233,30,140,.52);
                transform: translateY(-1px);
            }

            .my-training-loading,
            .my-training-error {
                color: #aaa0b0;
                padding: 4px 0;
                line-height: 1.45;
            }

            .my-training-error { color: #f4b6c8; }

            @media (max-width: 620px) {
                .my-training-panel { padding: 16px; }
                .my-training-header { flex-direction: column; gap: 10px; }
                .my-training-missing-list { grid-template-columns: 1fr; }
                .my-training-actions button, .my-training-actions a { width: 100%; }
            }
        `;
        document.head.appendChild(style);
    }

    function ensurePanel() {
        const profileForm = document.getElementById('profileForm');
        if (!profileForm) return null;

        let panel = document.getElementById('myTrainingProgressPanel');
        if (panel) return panel;

        panel = document.createElement('section');
        panel.id = 'myTrainingProgressPanel';
        panel.className = 'my-training-panel';
        panel.setAttribute('aria-live', 'polite');
        panel.innerHTML = '<div class="my-training-loading">Loading your training progress…</div>';

        const profileGrid = profileForm.querySelector('.profile-grid');
        if (profileGrid) profileForm.insertBefore(panel, profileGrid);
        else profileForm.appendChild(panel);
        return panel;
    }

    function showTrainingRecord() {
        const userId = currentUserId();
        if (!userId) return;

        if (window.JamminTraining?.openFromCard) {
            window.JamminTraining.openFromCard(userId);
        } else if (window.JamminTraining?.open) {
            window.JamminTraining.open();
        }
    }

    function render() {
        const panel = ensurePanel();
        if (!panel) return;

        const required = state.categories.filter((category) => category.active !== false && category.is_required);
        const completedIds = new Set(
            state.records
                .filter((record) => record.status === 'complete' && !record.custom_label)
                .map((record) => record.training_category_id)
        );
        const missing = required.filter((category) => !completedIds.has(category.id));
        const completeCount = required.length - missing.length;
        const percent = required.length ? Math.round((completeCount / required.length) * 100) : 0;
        const isComplete = required.length > 0 && missing.length === 0;

        panel.innerHTML = `
            <div class="my-training-header">
                <div>
                    <div class="my-training-eyebrow">Professional Development</div>
                    <h3>My DJ Training</h3>
                    <p>See what you have completed and what skills are still available for you to learn.</p>
                </div>
                <span class="my-training-status ${isComplete ? 'complete' : 'incomplete'}">
                    ${isComplete ? '✓ Training Complete' : `${missing.length} Remaining`}
                </span>
            </div>

            <div class="my-training-progress-row">
                <div class="my-training-progress-copy">${completeCount} of ${required.length} required training types complete</div>
                <div class="my-training-percent">${percent}%</div>
                <div class="my-training-track"><div class="my-training-fill" style="width:${percent}%"></div></div>
            </div>

            ${isComplete ? `
                <div class="my-training-complete-message">
                    All required JAMMIN training types are verified. You can still open your training record to review completed skills and any optional event training.
                </div>
            ` : `
                <div class="my-training-missing-title">Training still available to complete</div>
                <div class="my-training-missing-list">
                    ${missing.map((category) => `
                        <div class="my-training-missing-item">
                            <strong>${esc(category.name)}</strong>
                            <span>${esc(category.description || 'Open your training record for details and sign-off requirements.')}</span>
                        </div>
                    `).join('')}
                </div>
            `}

            <div class="my-training-actions">
                <button type="button" id="viewMyTrainingBtn">View My Training Record</button>
                <a class="my-training-classroom-btn" href="${GOOGLE_CLASSROOM_URL}" target="_blank" rel="noopener noreferrer">Open Google Classroom ↗</a>
            </div>`;

        panel.querySelector('#viewMyTrainingBtn')?.addEventListener('click', showTrainingRecord);
    }

    async function refresh(force = false) {
        const userId = currentUserId();
        if (!userId || state.loading) return;
        if (!force && state.lastUserId === userId && state.categories.length) {
            render();
            return;
        }

        const panel = ensurePanel();
        if (!panel) return;
        state.loading = true;
        panel.innerHTML = '<div class="my-training-loading">Loading your training progress…</div>';

        try {
            const [categoryResult, recordResult] = await Promise.all([
                supabaseClient
                    .from('training_categories')
                    .select('id, name, description, is_required, active, sort_order')
                    .eq('active', true)
                    .order('sort_order', { ascending: true }),
                supabaseClient
                    .from('staff_training')
                    .select('training_category_id, status, custom_label, completion_date')
                    .eq('dj_user_id', userId)
            ]);

            if (categoryResult.error) throw categoryResult.error;
            if (recordResult.error) throw recordResult.error;

            state.categories = categoryResult.data || [];
            state.records = recordResult.data || [];
            state.lastUserId = userId;
            render();
        } catch (error) {
            console.error('My training progress error:', error);
            panel.innerHTML = `<div class="my-training-error">Your training progress could not be loaded. Open My Training to review the full record.</div>`;
        } finally {
            state.loading = false;
        }
    }

    function profileIsVisible() {
        const profileForm = document.getElementById('profileForm');
        return Boolean(profileForm && !profileForm.classList.contains('hidden'));
    }

    function wrapTrainingActions() {
        if (state.wrappersInstalled || !window.JamminTraining) return;

        ['setComplete', 'reopen', 'addOther', 'refresh'].forEach((method) => {
            const original = window.JamminTraining[method];
            if (typeof original !== 'function' || original.__myProgressWrapped) return;

            const wrapped = async function (...args) {
                const result = await original.apply(this, args);
                await refresh(true);
                return result;
            };
            wrapped.__myProgressWrapped = true;
            window.JamminTraining[method] = wrapped;
        });

        state.wrappersInstalled = true;
    }

    function initialize() {
        injectStyles();
        ensurePanel();
        wrapTrainingActions();
        if (profileIsVisible()) refresh(true);
    }

    document.addEventListener('DOMContentLoaded', initialize);

    const observer = new MutationObserver((mutations) => {
        let shouldRefresh = false;
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.target.id === 'profileForm') {
                shouldRefresh = profileIsVisible();
            }
        }
        ensurePanel();
        wrapTrainingActions();
        if (shouldRefresh) refresh(true);
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
    });

    setInterval(() => {
        wrapTrainingActions();
        if (profileIsVisible()) refresh(true);
    }, 30000);

    window.JamminMyTrainingProgress = { refresh };
    initialize();
})();
