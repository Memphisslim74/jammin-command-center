(() => {
    'use strict';

    const state = {
        categories: [],
        loading: false,
        saving: false
    };

    const esc = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const isAdmin = () => typeof currentProfile !== 'undefined' && currentProfile?.role === 'admin';
    const currentUserId = () => typeof currentUser !== 'undefined' ? currentUser?.id || null : null;

    function showErrorMessage(message) {
        if (typeof showError === 'function') showError(message);
        else alert(message);
    }

    function showSuccessMessage(message) {
        if (typeof showSuccess === 'function') showSuccess(message);
        else alert(message);
    }

    function injectStyles() {
        if (document.getElementById('trainingTypeManagerStyles')) return;
        const style = document.createElement('style');
        style.id = 'trainingTypeManagerStyles';
        style.textContent = `
            .training-header-actions {
                display:flex;
                align-items:center;
                gap:8px;
                margin-left:auto;
            }

            .training-type-manager-btn {
                min-height:38px;
                padding:8px 13px;
                border-radius:8px;
                border:1px solid rgba(233,30,140,.34);
                background:rgba(233,30,140,.10);
                color:#f7d7e9;
                font-size:.82rem;
                font-weight:750;
                box-shadow:none;
            }

            .training-type-manager-btn:hover {
                background:rgba(233,30,140,.18);
                border-color:rgba(233,30,140,.52);
                transform:translateY(-1px);
                box-shadow:none;
            }

            .training-type-overlay {
                position:fixed;
                inset:0;
                z-index:13000;
                display:flex;
                align-items:flex-start;
                justify-content:center;
                padding:28px;
                overflow:auto;
                background:rgba(5,4,8,.90);
                backdrop-filter:blur(10px);
            }

            .training-type-overlay.hidden { display:none; }

            .training-type-shell {
                width:min(1180px,100%);
                margin:auto;
                overflow:hidden;
                border-radius:16px;
                border:1px solid rgba(233,30,140,.34);
                background:linear-gradient(145deg,#2d1b3d,#1d1722);
                box-shadow:0 30px 100px rgba(0,0,0,.58);
            }

            .training-type-header {
                display:flex;
                align-items:flex-start;
                justify-content:space-between;
                gap:18px;
                padding:22px 24px;
                border-bottom:1px solid rgba(255,255,255,.08);
                background:rgba(255,255,255,.025);
            }

            .training-type-header h2 {
                margin:0 0 5px;
                color:#fff;
                font-size:1.35rem;
            }

            .training-type-header p {
                margin:0;
                color:#aa9fb2;
                line-height:1.45;
            }

            .training-type-close {
                padding:2px 10px;
                border:0;
                background:transparent;
                color:#fff;
                font-size:28px;
                box-shadow:none;
            }

            .training-type-body { padding:22px; }

            .training-type-toolbar {
                display:flex;
                justify-content:space-between;
                gap:12px;
                align-items:center;
                margin-bottom:14px;
            }

            .training-type-help {
                color:#9f94a7;
                font-size:.84rem;
                line-height:1.45;
            }

            .training-type-list {
                display:grid;
                gap:10px;
            }

            .training-type-row {
                display:grid;
                grid-template-columns:44px minmax(170px,.8fr) minmax(240px,1.4fr) 100px 120px 90px 108px;
                gap:9px;
                align-items:center;
                padding:12px;
                border-radius:11px;
                border:1px solid rgba(255,255,255,.075);
                background:rgba(255,255,255,.027);
            }

            .training-type-row.inactive { opacity:.66; }

            .training-type-order {
                display:grid;
                gap:4px;
            }

            .training-type-order button {
                min-height:25px;
                padding:2px 5px;
                font-size:.7rem;
                line-height:1;
                background:rgba(255,255,255,.055);
                border:1px solid rgba(255,255,255,.09);
                box-shadow:none;
            }

            .training-type-row input[type="text"],
            .training-type-row textarea {
                width:100%;
                min-width:0;
                border:1px solid rgba(255,255,255,.13);
                border-radius:8px;
                background:rgba(10,8,12,.54);
                color:#fff;
                padding:9px 10px;
                font:inherit;
            }

            .training-type-row textarea {
                min-height:42px;
                resize:vertical;
            }

            .training-type-toggle {
                display:flex;
                align-items:center;
                justify-content:flex-start;
                gap:7px;
                color:#d9d0dd;
                font-size:.79rem;
                line-height:1.25;
            }

            .training-type-toggle input {
                width:17px;
                height:17px;
                accent-color:#e91e8c;
                flex:0 0 auto;
            }

            .training-type-code {
                display:block;
                margin-top:5px;
                color:#7f7487;
                font-size:.68rem;
                overflow-wrap:anywhere;
            }

            .training-type-footer {
                display:flex;
                justify-content:flex-end;
                gap:9px;
                padding:16px 22px 22px;
                border-top:1px solid rgba(255,255,255,.07);
            }

            .training-type-empty {
                padding:36px 20px;
                text-align:center;
                color:#a99daf;
                border:1px dashed rgba(255,255,255,.13);
                border-radius:12px;
            }

            @media (max-width:980px) {
                .training-type-row {
                    grid-template-columns:40px minmax(160px,1fr) minmax(220px,1.3fr);
                }
                .training-type-row > .training-type-toggle,
                .training-type-row > .training-type-status {
                    grid-column:auto;
                }
            }

            @media (max-width:720px) {
                .training-header-actions { gap:5px; }
                .training-type-manager-btn { padding:7px 9px; font-size:.75rem; }
                .training-type-overlay { padding:8px; }
                .training-type-header { padding:17px; }
                .training-type-body { padding:14px; }
                .training-type-toolbar { align-items:stretch; flex-direction:column; }
                .training-type-row {
                    grid-template-columns:36px 1fr;
                    gap:8px;
                }
                .training-type-row > *:not(.training-type-order) { grid-column:2; }
                .training-type-order { grid-row:1 / span 7; grid-column:1; align-self:start; }
                .training-type-footer { flex-direction:column-reverse; padding:14px; }
                .training-type-footer button { width:100%; }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureDialog() {
        if (document.getElementById('trainingTypeOverlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'trainingTypeOverlay';
        overlay.className = 'training-type-overlay hidden';
        overlay.innerHTML = `
            <section class="training-type-shell" role="dialog" aria-modal="true" aria-labelledby="trainingTypeTitle">
                <header class="training-type-header">
                    <div>
                        <h2 id="trainingTypeTitle">Manage Training Types</h2>
                        <p>Add permanent training requirements, change sign-off rules, reorder the list, or disable a type without deleting its history.</p>
                    </div>
                    <button type="button" class="training-type-close" aria-label="Close training type manager">&times;</button>
                </header>
                <div class="training-type-body">
                    <div class="training-type-toolbar">
                        <div class="training-type-help">Required types count toward the Training Complete badge. Disabled types disappear from active profiles but their historical records remain intact.</div>
                        <button type="button" id="addTrainingTypeBtn">+ Add Training Type</button>
                    </div>
                    <div id="trainingTypeList" class="training-type-list"></div>
                </div>
                <footer class="training-type-footer">
                    <button type="button" class="btn-secondary" id="cancelTrainingTypeBtn">Close</button>
                    <button type="button" id="saveTrainingTypeBtn">Save Changes & Keep Editing</button>
                </footer>
            </section>`;

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) closeManager();
        });
        overlay.querySelector('.training-type-close')?.addEventListener('click', closeManager);
        overlay.querySelector('#cancelTrainingTypeBtn')?.addEventListener('click', closeManager);
        overlay.querySelector('#addTrainingTypeBtn')?.addEventListener('click', addTrainingType);
        overlay.querySelector('#saveTrainingTypeBtn')?.addEventListener('click', saveTrainingTypes);
        document.body.appendChild(overlay);
    }

    function installHeaderButton() {
        if (!isAdmin()) return;
        const header = document.querySelector('.training-shell-header');
        const closeButton = header?.querySelector('.training-close');
        if (!header || !closeButton || document.getElementById('manageTrainingTypesBtn')) return;

        let actions = header.querySelector('.training-header-actions');
        if (!actions) {
            actions = document.createElement('div');
            actions.className = 'training-header-actions';
            header.insertBefore(actions, closeButton);
            actions.appendChild(closeButton);
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.id = 'manageTrainingTypesBtn';
        button.className = 'training-type-manager-btn';
        button.textContent = 'Manage Training Types';
        button.addEventListener('click', openManager);
        actions.insertBefore(button, closeButton);
    }

    async function openManager() {
        if (!isAdmin()) return showErrorMessage('Only administrators can manage training types.');
        ensureDialog();
        const overlay = document.getElementById('trainingTypeOverlay');
        overlay.classList.remove('hidden');
        document.getElementById('trainingTypeList').innerHTML = '<div class="training-type-empty">Loading training types…</div>';
        await loadTrainingTypes();
    }

    function closeManager() {
        if (state.saving) return;
        document.getElementById('trainingTypeOverlay')?.classList.add('hidden');
    }

    async function loadTrainingTypes() {
        if (state.loading) return;
        state.loading = true;
        try {
            const { data, error } = await supabaseClient
                .from('training_categories')
                .select('*')
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: true });
            if (error) throw error;
            state.categories = (data || []).map((item) => ({ ...item, _new: false }));
            renderTrainingTypes();
        } catch (error) {
            console.error('Training type load error:', error);
            document.getElementById('trainingTypeList').innerHTML = '<div class="training-type-empty">Unable to load training types.</div>';
            showErrorMessage('Failed to load training types: ' + (error?.message || error));
        } finally {
            state.loading = false;
        }
    }

    function renderTrainingTypes() {
        const list = document.getElementById('trainingTypeList');
        if (!list) return;
        if (!state.categories.length) {
            list.innerHTML = '<div class="training-type-empty">No training types are configured.</div>';
            return;
        }

        list.innerHTML = state.categories.map((category, index) => `
            <div class="training-type-row ${category.active === false ? 'inactive' : ''}" data-index="${index}">
                <div class="training-type-order">
                    <button type="button" aria-label="Move ${esc(category.name)} up" onclick="window.JamminTrainingTypes.move(${index},-1)" ${index === 0 ? 'disabled' : ''}>▲</button>
                    <button type="button" aria-label="Move ${esc(category.name)} down" onclick="window.JamminTrainingTypes.move(${index},1)" ${index === state.categories.length - 1 ? 'disabled' : ''}>▼</button>
                </div>
                <div>
                    <input type="text" value="${esc(category.name)}" placeholder="Training type name" oninput="window.JamminTrainingTypes.field(${index},'name',this.value)">
                    <span class="training-type-code">${category._new ? 'Code created when saved' : esc(category.code)}</span>
                </div>
                <textarea placeholder="Short description shown on training profiles" oninput="window.JamminTrainingTypes.field(${index},'description',this.value)">${esc(category.description || '')}</textarea>
                <label class="training-type-toggle"><input type="checkbox" ${category.is_required ? 'checked' : ''} onchange="window.JamminTrainingTypes.field(${index},'is_required',this.checked)">Required</label>
                <label class="training-type-toggle"><input type="checkbox" ${category.admin_only_signoff ? 'checked' : ''} onchange="window.JamminTrainingTypes.field(${index},'admin_only_signoff',this.checked)">Admin sign-off</label>
                <label class="training-type-toggle training-type-status"><input type="checkbox" ${category.active !== false ? 'checked' : ''} onchange="window.JamminTrainingTypes.field(${index},'active',this.checked)">Active</label>
                <button type="button" class="btn-secondary" onclick="window.JamminTrainingTypes.toggleActive(${index})">${category.active === false ? 'Enable' : 'Disable'}</button>
            </div>`).join('');
    }

    function addTrainingType() {
        const maxOrder = state.categories.reduce((max, item) => Math.max(max, Number(item.sort_order) || 0), 0);
        state.categories.push({
            id: null,
            code: '',
            name: '',
            description: '',
            is_required: true,
            admin_only_signoff: false,
            allows_custom_label: false,
            active: true,
            sort_order: maxOrder + 10,
            created_by: currentUserId(),
            _new: true
        });
        renderTrainingTypes();
        requestAnimationFrame(() => {
            const rows = document.querySelectorAll('.training-type-row');
            rows[rows.length - 1]?.querySelector('input[type="text"]')?.focus();
        });
    }

    function updateField(index, field, value) {
        if (!state.categories[index]) return;
        state.categories[index][field] = value;
        if (field === 'active') renderTrainingTypes();
    }

    function toggleActive(index) {
        if (!state.categories[index]) return;
        state.categories[index].active = state.categories[index].active === false;
        renderTrainingTypes();
    }

    function move(index, direction) {
        const target = index + direction;
        if (target < 0 || target >= state.categories.length) return;
        [state.categories[index], state.categories[target]] = [state.categories[target], state.categories[index]];
        renderTrainingTypes();
    }

    function slugify(value) {
        return String(value || '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 48) || 'training_type';
    }

    function uniqueCode(name, usedCodes) {
        const base = slugify(name);
        let code = base;
        let counter = 2;
        while (usedCodes.has(code)) {
            code = `${base}_${counter++}`;
        }
        usedCodes.add(code);
        return code;
    }

    async function saveTrainingTypes() {
        if (state.saving) return;
        const invalid = state.categories.find((item) => !String(item.name || '').trim());
        if (invalid) return showErrorMessage('Every training type needs a name before saving.');

        state.saving = true;
        const saveButton = document.getElementById('saveTrainingTypeBtn');
        const originalLabel = saveButton?.textContent || 'Save Changes';
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = 'Saving…';
        }

        try {
            const usedCodes = new Set(state.categories.filter((item) => !item._new && item.code).map((item) => item.code));
            const operations = state.categories.map((category, index) => {
                const payload = {
                    name: String(category.name).trim(),
                    description: String(category.description || '').trim() || null,
                    is_required: Boolean(category.is_required),
                    admin_only_signoff: Boolean(category.admin_only_signoff),
                    active: category.active !== false,
                    sort_order: (index + 1) * 10
                };

                if (category._new) {
                    return supabaseClient.from('training_categories').insert({
                        ...payload,
                        code: uniqueCode(category.name, usedCodes),
                        allows_custom_label: false,
                        created_by: currentUserId()
                    });
                }

                return supabaseClient
                    .from('training_categories')
                    .update(payload)
                    .eq('id', category.id);
            });

            const results = await Promise.all(operations);
            const failure = results.find((result) => result.error);
            if (failure?.error) throw failure.error;

            showSuccessMessage('Training types saved. You can continue adding or editing types.');
            await loadTrainingTypes();
            if (window.JamminTraining?.refresh) await window.JamminTraining.refresh();
            if (window.JamminMyTrainingProgress?.refresh) await window.JamminMyTrainingProgress.refresh(true);
            if (typeof renderUserCards === 'function') renderUserCards();
        } catch (error) {
            console.error('Training type save error:', error);
            showErrorMessage('Failed to save training types: ' + (error?.message || error));
        } finally {
            state.saving = false;
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = originalLabel;
            }
        }
    }

    function initialize() {
        injectStyles();
        ensureDialog();
        installHeaderButton();
    }

    window.JamminTrainingTypes = {
        open: openManager,
        close: closeManager,
        add: addTrainingType,
        field: updateField,
        toggleActive,
        move,
        save: saveTrainingTypes
    };

    document.addEventListener('DOMContentLoaded', initialize);
    const observer = new MutationObserver(() => window.requestAnimationFrame(initialize));
    observer.observe(document.documentElement, { childList: true, subtree: true });
    initialize();
})();
