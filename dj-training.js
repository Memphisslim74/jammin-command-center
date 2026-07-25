(() => {
    'use strict';

    const trainingState = {
        installed: false,
        cardsPatched: false,
        loading: null,
        categories: [],
        records: [],
        profiles: [],
        selectedUserId: null,
        rosterQuery: '',
        rosterStatus: 'all',
        filteredProfiles: []
    };

    const today = () => new Date().toISOString().slice(0, 10);
    const esc = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const role = () => (typeof currentProfile !== 'undefined' && currentProfile?.role) || 'user';
    const isAdmin = () => role() === 'admin';
    const isManager = () => role() === 'manager';
    const canSignTraining = () => isAdmin() || isManager();
    const currentId = () => (typeof currentUser !== 'undefined' ? currentUser?.id : null);

    function friendlyError(error) {
        const message = error?.message || String(error || 'Unknown error');
        if (/relation .* does not exist|Could not find the table|schema cache/i.test(message)) {
            return 'The DJ training database setup has not been applied yet. Run the included Supabase training migration, then refresh this page.';
        }
        return message;
    }

    function notifyError(message) {
        if (typeof showError === 'function') showError(message);
        else alert(message);
    }

    function notifySuccess(message) {
        if (typeof showSuccess === 'function') showSuccess(message);
        else alert(message);
    }

    function formatDate(value) {
        if (!value) return 'Not completed';
        const raw = String(value).slice(0, 10);
        const date = new Date(`${raw}T12:00:00`);
        if (Number.isNaN(date.getTime())) return raw;
        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        }).format(date);
    }

    function displayName(profile) {
        return profile?.full_name || profile?.email || 'Unnamed staff member';
    }

    function activeProfiles() {
        if (role() === 'user') {
            return currentProfile ? [currentProfile] : [];
        }
        return trainingState.profiles.filter(profile => (profile.status || 'active') !== 'disabled');
    }

    function recordsFor(userId) {
        return trainingState.records.filter(record => record.dj_user_id === userId);
    }

    function categoryRecord(userId, categoryId) {
        return trainingState.records.find(record =>
            record.dj_user_id === userId &&
            record.training_category_id === categoryId &&
            !record.custom_label
        );
    }

    function otherRecords(userId, categoryId) {
        return trainingState.records.filter(record =>
            record.dj_user_id === userId &&
            record.training_category_id === categoryId &&
            record.custom_label
        );
    }

    function progressFor(userId) {
        const required = trainingState.categories.filter(category => category.is_required && category.active !== false);
        const complete = required.filter(category => categoryRecord(userId, category.id)?.status === 'complete').length;
        return {
            complete,
            total: required.length,
            percent: required.length ? Math.round((complete / required.length) * 100) : 0,
            isComplete: required.length > 0 && complete === required.length
        };
    }

    async function loadTrainingData(force = false) {
        if (trainingState.loading && !force) return trainingState.loading;

        trainingState.loading = (async () => {
            try {
                const categoryQuery = supabaseClient
                    .from('training_categories')
                    .select('*')
                    .eq('active', true)
                    .order('sort_order', { ascending: true });

                const trainingQuery = supabaseClient
                    .from('staff_training')
                    .select('*')
                    .order('updated_at', { ascending: false });

                const [categoryResult, trainingResult] = await Promise.all([categoryQuery, trainingQuery]);
                if (categoryResult.error) throw categoryResult.error;
                if (trainingResult.error) throw trainingResult.error;

                trainingState.categories = categoryResult.data || [];
                trainingState.records = trainingResult.data || [];

                if (role() === 'user') {
                    trainingState.profiles = currentProfile ? [currentProfile] : [];
                } else if (typeof users !== 'undefined' && Array.isArray(users) && users.length) {
                    trainingState.profiles = [...users];
                } else {
                    const { data, error } = await supabaseClient
                        .from('profiles')
                        .select('*')
                        .order('full_name', { ascending: true });
                    if (error) throw error;
                    trainingState.profiles = data || [];
                }
            } catch (error) {
                console.error('DJ training load error:', error);
                throw new Error(friendlyError(error));
            } finally {
                trainingState.loading = null;
            }
        })();

        return trainingState.loading;
    }

    function injectStyles() {
        if (document.getElementById('djTrainingStyles')) return;
        const style = document.createElement('style');
        style.id = 'djTrainingStyles';
        style.textContent = `
            .training-launch-btn { white-space: nowrap; }
            .training-card-actions { grid-column: 1 / -1; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
            .training-card-actions button { width:100%; min-height:38px; margin:0; }
            .training-progress-detail { grid-column:1 / -1; }
            .training-progress-track { height:8px; border-radius:999px; background:rgba(255,255,255,.08); overflow:hidden; margin-top:7px; }
            .training-progress-fill { height:100%; background:linear-gradient(90deg,#e91e8c,#764ba2); }
            .training-overlay { position:fixed; inset:0; z-index:12000; background:rgba(5,4,8,.86); backdrop-filter:blur(8px); display:flex; align-items:flex-start; justify-content:center; padding:22px; overflow:auto; }
            .training-overlay.hidden { display:none; }
            .training-shell { width:min(1280px,100%); min-height:540px; background:linear-gradient(145deg,#2d1b3d,#1d1722); border:1px solid rgba(233,30,140,.35); border-radius:16px; box-shadow:0 28px 90px rgba(0,0,0,.55); overflow:hidden; }
            .training-shell-header { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; padding:22px 24px; border-bottom:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.025); }
            .training-shell-header h2 { margin:0 0 5px; color:#fff; }
            .training-shell-header p { margin:0; color:#aa9fb2; }
            .training-close { padding:2px 10px; background:transparent; font-size:28px; box-shadow:none; }
            .training-body { padding:22px; }
            .training-toolbar { display:grid; grid-template-columns:minmax(220px,1fr) 190px auto; gap:10px; margin-bottom:18px; }
            .training-toolbar input,.training-toolbar select,.training-row input,.training-add-other input { min-height:42px; border:1px solid rgba(255,255,255,.13); border-radius:8px; background:rgba(10,8,12,.54); color:#fff; padding:0 11px; }
            .training-toolbar select option { background:#251b2c; }
            .training-roster-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:14px; }
            .training-roster-card { border:1px solid rgba(255,255,255,.08); border-radius:13px; padding:17px; background:rgba(255,255,255,.035); }
            .training-roster-top { display:flex; justify-content:space-between; gap:12px; }
            .training-roster-card h3 { margin:0 0 4px; color:#fff; }
            .training-muted { color:#9e92a7; font-size:.88rem; }
            .training-badge { display:inline-flex; align-items:center; border-radius:999px; padding:5px 9px; font-size:.75rem; font-weight:750; }
            .training-badge.complete { background:rgba(16,185,129,.16); color:#8cf0c6; border:1px solid rgba(16,185,129,.32); }
            .training-badge.incomplete { background:rgba(245,158,11,.14); color:#fcd38d; border:1px solid rgba(245,158,11,.28); }
            .training-roster-actions { display:flex; gap:8px; margin-top:14px; }
            .training-roster-actions button { flex:1; padding:9px 10px; font-size:.84rem; }
            .training-profile-summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-bottom:18px; }
            .training-summary-card { padding:12px; border:1px solid rgba(255,255,255,.08); border-radius:10px; background:rgba(255,255,255,.035); }
            .training-summary-card span { display:block; color:#92869b; font-size:.7rem; text-transform:uppercase; letter-spacing:.06em; margin-bottom:5px; }
            .training-summary-card strong { color:#fff; font-size:.95rem; overflow-wrap:anywhere; }
            .training-list { display:grid; gap:10px; }
            .training-row { display:grid; grid-template-columns:minmax(210px,1.3fr) minmax(155px,.7fr) minmax(175px,.8fr) auto; gap:12px; align-items:center; padding:14px; border:1px solid rgba(255,255,255,.075); border-radius:11px; background:rgba(255,255,255,.025); }
            .training-row h4 { margin:0 0 4px; color:#fff; }
            .training-row p { margin:0; color:#93879d; font-size:.82rem; line-height:1.35; }
            .training-signoff { color:#c9c0cf; font-size:.84rem; line-height:1.45; }
            .training-row-actions { display:flex; flex-wrap:wrap; gap:7px; justify-content:flex-end; }
            .training-row-actions button { padding:8px 10px; font-size:.8rem; }
            .training-admin-only { color:#d8a9c7; font-size:.78rem; margin-top:4px; }
            .training-completion-bar { display:flex; flex-wrap:wrap; gap:10px; justify-content:space-between; align-items:center; margin:18px 0; padding:15px; border-radius:11px; border:1px solid rgba(233,30,140,.24); background:rgba(233,30,140,.07); }
            .training-add-other { display:grid; grid-template-columns:1fr 180px auto; gap:9px; margin-top:10px; }
            .training-empty { text-align:center; padding:45px 20px; color:#a89caf; border:1px dashed rgba(255,255,255,.13); border-radius:12px; }
            .training-back { margin-bottom:15px; }
            .training-history { margin-top:20px; }
            .training-history details { border:1px solid rgba(255,255,255,.08); border-radius:10px; padding:12px; }
            .training-history summary { color:#fff; cursor:pointer; font-weight:700; }
            .training-history-list { margin-top:10px; display:grid; gap:7px; }
            .training-history-item { color:#bdb2c3; font-size:.84rem; padding:8px 0; border-bottom:1px solid rgba(255,255,255,.05); }
            @media (max-width:900px) {
                .training-toolbar { grid-template-columns:1fr; }
                .training-profile-summary { grid-template-columns:repeat(2,minmax(0,1fr)); }
                .training-row { grid-template-columns:1fr; }
                .training-row-actions { justify-content:flex-start; }
            }
            @media (max-width:560px) {
                .training-overlay { padding:8px; }
                .training-body { padding:14px; }
                .training-shell-header { padding:17px; }
                .training-profile-summary { grid-template-columns:1fr; }
                .training-add-other { grid-template-columns:1fr; }
                .training-card-actions { grid-template-columns:1fr; }
            }
            @media print {
                .training-overlay { position:static; padding:0; background:#fff; }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureOverlay() {
        if (document.getElementById('djTrainingOverlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'djTrainingOverlay';
        overlay.className = 'training-overlay hidden';
        overlay.innerHTML = `
            <section class="training-shell" role="dialog" aria-modal="true" aria-labelledby="djTrainingTitle">
                <header class="training-shell-header">
                    <div>
                        <h2 id="djTrainingTitle">DJ Training</h2>
                        <p id="djTrainingSubtitle">Roster, sign-offs, completion tracking, and reports.</p>
                    </div>
                    <button type="button" class="training-close" aria-label="Close DJ Training" onclick="window.JamminTraining.close()">&times;</button>
                </header>
                <div class="training-body" id="djTrainingBody"></div>
            </section>`;
        overlay.addEventListener('click', event => {
            if (event.target === overlay) closeTraining();
        });
        document.body.appendChild(overlay);
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !overlay.classList.contains('hidden')) closeTraining();
        });
    }

    function closeTraining() {
        document.getElementById('djTrainingOverlay')?.classList.add('hidden');
        trainingState.selectedUserId = null;
    }

    async function openTraining() {
        try {
            ensureOverlay();
            const overlay = document.getElementById('djTrainingOverlay');
            overlay.classList.remove('hidden');
            document.getElementById('djTrainingBody').innerHTML = '<div class="training-empty">Loading DJ training records…</div>';
            await loadTrainingData(true);
            if (role() === 'user') {
                await renderProfile(currentId());
            } else {
                renderRoster();
            }
        } catch (error) {
            notifyError(friendlyError(error));
            closeTraining();
        }
    }

    function rosterMatches(profile) {
        const query = trainingState.rosterQuery.trim().toLowerCase();
        const progress = progressFor(profile.id);
        const haystack = [profile.full_name, profile.email, profile.phone, profile.city, profile.state]
            .filter(Boolean).join(' ').toLowerCase();
        const queryMatch = !query || haystack.includes(query);
        const statusMatch = trainingState.rosterStatus === 'all' ||
            (trainingState.rosterStatus === 'complete' && progress.isComplete) ||
            (trainingState.rosterStatus === 'incomplete' && !progress.isComplete);
        return queryMatch && statusMatch;
    }

    function renderRoster() {
        const body = document.getElementById('djTrainingBody');
        if (!body) return;
        const profiles = activeProfiles().filter(rosterMatches);
        trainingState.filteredProfiles = profiles;
        document.getElementById('djTrainingTitle').textContent = 'DJ Training Roster';
        document.getElementById('djTrainingSubtitle').textContent = 'Open a DJ profile, record manager sign-offs, and review completion.';

        body.innerHTML = `
            <div class="training-toolbar">
                <input type="search" value="${esc(trainingState.rosterQuery)}" placeholder="Search DJ name, email, phone, or city" oninput="window.JamminTraining.filterRoster(this.value, null)">
                <select onchange="window.JamminTraining.filterRoster(null, this.value)">
                    <option value="all" ${trainingState.rosterStatus === 'all' ? 'selected' : ''}>All training statuses</option>
                    <option value="complete" ${trainingState.rosterStatus === 'complete' ? 'selected' : ''}>Training complete</option>
                    <option value="incomplete" ${trainingState.rosterStatus === 'incomplete' ? 'selected' : ''}>Training incomplete</option>
                </select>
                ${isAdmin() ? '<button type="button" class="btn-secondary" onclick="window.JamminTraining.printRoster()">Save Roster as PDF</button>' : '<span></span>'}
            </div>
            <div class="training-roster-grid">
                ${profiles.map(profile => rosterCard(profile)).join('') || '<div class="training-empty">No DJs match the current filter.</div>'}
            </div>`;
    }

    function rosterCard(profile) {
        const progress = progressFor(profile.id);
        const location = [profile.city, profile.state].filter(Boolean).join(', ') || 'Location not provided';
        return `
            <article class="training-roster-card">
                <div class="training-roster-top">
                    <div>
                        <h3>${esc(displayName(profile))}</h3>
                        <div class="training-muted">${esc(profile.email || 'No email')}</div>
                        <div class="training-muted">${esc(location)}</div>
                    </div>
                    <span class="training-badge ${progress.isComplete ? 'complete' : 'incomplete'}">${progress.isComplete ? 'Complete' : `${progress.complete}/${progress.total}`}</span>
                </div>
                <div class="training-progress-track"><div class="training-progress-fill" style="width:${progress.percent}%"></div></div>
                <div class="training-roster-actions">
                    <button type="button" onclick="window.JamminTraining.openProfile('${profile.id}')">Open Training Profile</button>
                    ${isAdmin() ? `<button type="button" class="btn-secondary" onclick="window.JamminTraining.printProfile('${profile.id}')">Save PDF</button>` : ''}
                </div>
            </article>`;
    }

    function filterRoster(query, status) {
        if (query !== null) trainingState.rosterQuery = query;
        if (status !== null) trainingState.rosterStatus = status;
        renderRoster();
    }

    async function loadHistory(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('training_history')
                .select('*')
                .eq('dj_user_id', userId)
                .order('created_at', { ascending: false })
                .limit(30);
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.warn('Training history unavailable:', error);
            return [];
        }
    }

    async function renderProfile(userId) {
        trainingState.selectedUserId = userId;
        const profile = trainingState.profiles.find(item => item.id === userId) ||
            ((currentProfile?.id === userId) ? currentProfile : null);
        if (!profile) {
            notifyError('DJ profile not found.');
            return;
        }
        const body = document.getElementById('djTrainingBody');
        const progress = progressFor(userId);
        const history = await loadHistory(userId);
        const location = [profile.city, profile.state].filter(Boolean).join(', ') || 'Not provided';
        const requiredCategories = trainingState.categories.filter(category => category.code !== 'other_event_type');
        const otherCategory = trainingState.categories.find(category => category.code === 'other_event_type');

        document.getElementById('djTrainingTitle').textContent = displayName(profile);
        document.getElementById('djTrainingSubtitle').textContent = role() === 'user'
            ? 'Your verified JAMMIN training record.'
            : 'Contact information, training completion, dates, and manager sign-off.';

        body.innerHTML = `
            ${role() !== 'user' ? '<button type="button" class="btn-secondary training-back" onclick="window.JamminTraining.backToRoster()">← Back to Training Roster</button>' : ''}
            <div class="training-profile-summary">
                <div class="training-summary-card"><span>Email</span><strong>${esc(profile.email || 'Not provided')}</strong></div>
                <div class="training-summary-card"><span>Phone</span><strong>${esc(profile.phone || 'Not provided')}</strong></div>
                <div class="training-summary-card"><span>Location</span><strong>${esc(location)}</strong></div>
                <div class="training-summary-card"><span>Account Role</span><strong>${esc(profile.role || 'user')}</strong></div>
            </div>
            <div class="training-completion-bar">
                <div>
                    <strong style="color:#fff">Required training: ${progress.complete} of ${progress.total} complete</strong>
                    <div class="training-progress-track" style="width:min(420px,75vw)"><div class="training-progress-fill" style="width:${progress.percent}%"></div></div>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:8px">
                    ${isAdmin() ? `<button type="button" class="btn-secondary" onclick="window.JamminTraining.printProfile('${userId}')">Save Training Profile as PDF</button>` : ''}
                    ${canSignTraining() && profile.id !== currentId() && progress.isComplete ? `<button type="button" id="sendTrainingCompletionBtn" onclick="window.JamminTraining.sendCompletion('${userId}')">Email Completion to DJ & Managers</button>` : ''}
                </div>
            </div>
            <div class="training-list">
                ${requiredCategories.map(category => trainingRow(profile, category, categoryRecord(userId, category.id))).join('')}
                ${otherCategory ? otherTrainingSection(profile, otherCategory) : ''}
            </div>
            ${historySection(history)}
        `;
    }

    function trainingRow(profile, category, record, customLabel = '') {
        const complete = record?.status === 'complete';
        const managerBlocked = isManager() && category.admin_only_signoff;
        const canEdit = canSignTraining() && profile.id !== currentId() && !managerBlocked;
        const dateValue = record?.completion_date || today();
        const title = customLabel || category.name;
        return `
            <div class="training-row">
                <div>
                    <h4>${esc(title)}</h4>
                    <p>${esc(category.description || '')}</p>
                    ${category.admin_only_signoff ? '<div class="training-admin-only">Administrator sign-off required</div>' : ''}
                </div>
                <div><span class="training-badge ${complete ? 'complete' : 'incomplete'}">${complete ? 'Complete' : 'Incomplete'}</span></div>
                <div class="training-signoff">
                    ${complete
                        ? `<strong>${esc(formatDate(record.completion_date))}</strong><br>Signed off by ${esc(record.completed_by_name || 'Unknown')}`
                        : 'No completion date or sign-off recorded.'}
                </div>
                <div class="training-row-actions">
                    ${canEdit ? `
                        <input type="date" id="trainingDate_${record?.id || `${profile.id}_${category.id}_${customLabel.replace(/\W/g, '')}`}" value="${esc(dateValue)}">
                        <button type="button" onclick="window.JamminTraining.setComplete('${profile.id}','${category.id}','${record?.id || ''}','${encodeURIComponent(customLabel)}')">${complete ? 'Update Date' : 'Mark Complete'}</button>
                        ${complete ? `<button type="button" class="btn-secondary" onclick="window.JamminTraining.reopen('${profile.id}','${category.id}','${record.id}')">Reopen</button>` : ''}
                    ` : (managerBlocked ? '<span class="training-muted">Lindsay or another administrator must complete this item.</span>' : '')}
                </div>
            </div>`;
    }

    function otherTrainingSection(profile, category) {
        const records = otherRecords(profile.id, category.id);
        return `
            <div style="margin-top:8px">
                <h3 style="color:#e91e8c;margin:8px 0 10px">Other Event Type</h3>
                ${records.map(record => trainingRow(profile, category, record, record.custom_label)).join('') || '<div class="training-muted" style="padding:10px 0">No additional event-type training has been recorded.</div>'}
                ${canSignTraining() && profile.id !== currentId() ? `
                    <div class="training-add-other">
                        <input type="text" id="otherTrainingLabel" placeholder="Event type, such as Casino Night">
                        <input type="date" id="otherTrainingDate" value="${today()}">
                        <button type="button" onclick="window.JamminTraining.addOther('${profile.id}','${category.id}')">Add Completed Training</button>
                    </div>` : ''}
            </div>`;
    }

    function historySection(history) {
        if (!history.length) return '';
        return `
            <div class="training-history">
                <details>
                    <summary>Training history and audit trail (${history.length})</summary>
                    <div class="training-history-list">
                        ${history.map(item => `
                            <div class="training-history-item">
                                <strong>${esc(item.training_category_name)}${item.custom_label ? ` — ${esc(item.custom_label)}` : ''}</strong>:
                                ${esc(item.action)} by ${esc(item.performed_by_name || 'System')} on ${esc(new Date(item.created_at).toLocaleString())}
                            </div>`).join('')}
                    </div>
                </details>
            </div>`;
    }

    function dateInputId(userId, categoryId, recordId, customLabel) {
        return `trainingDate_${recordId || `${userId}_${categoryId}_${customLabel.replace(/\W/g, '')}`}`;
    }

    async function setComplete(userId, categoryId, recordId, encodedCustomLabel = '') {
        const customLabel = decodeURIComponent(encodedCustomLabel || '');
        const dateElement = document.getElementById(dateInputId(userId, categoryId, recordId, customLabel));
        const completionDate = dateElement?.value || today();
        try {
            let result;
            if (recordId) {
                result = await supabaseClient
                    .from('staff_training')
                    .update({ status: 'complete', completion_date: completionDate })
                    .eq('id', recordId)
                    .select()
                    .single();
            } else {
                result = await supabaseClient
                    .from('staff_training')
                    .insert({
                        dj_user_id: userId,
                        training_category_id: categoryId,
                        status: 'complete',
                        completion_date: completionDate,
                        custom_label: customLabel || null
                    })
                    .select()
                    .single();
            }
            if (result.error) throw result.error;
            notifySuccess('Training sign-off saved successfully.');
            await loadTrainingData(true);
            await renderProfile(userId);
            augmentUserCards();
        } catch (error) {
            console.error('Training sign-off error:', error);
            notifyError('Failed to save training: ' + friendlyError(error));
        }
    }

    async function reopen(userId, categoryId, recordId) {
        if (!confirm('Mark this training item incomplete and keep the change in the audit history?')) return;
        try {
            const { error } = await supabaseClient
                .from('staff_training')
                .update({ status: 'incomplete', completion_date: null })
                .eq('id', recordId);
            if (error) throw error;
            notifySuccess('Training item reopened successfully.');
            await loadTrainingData(true);
            await renderProfile(userId);
            augmentUserCards();
        } catch (error) {
            notifyError('Failed to reopen training: ' + friendlyError(error));
        }
    }

    async function addOther(userId, categoryId) {
        const label = document.getElementById('otherTrainingLabel')?.value.trim();
        const completionDate = document.getElementById('otherTrainingDate')?.value || today();
        if (!label) {
            notifyError('Enter a meaningful event-type label before adding the training.');
            return;
        }
        try {
            const { error } = await supabaseClient
                .from('staff_training')
                .insert({
                    dj_user_id: userId,
                    training_category_id: categoryId,
                    status: 'complete',
                    completion_date: completionDate,
                    custom_label: label
                });
            if (error) throw error;
            notifySuccess('Additional event training added successfully.');
            await loadTrainingData(true);
            await renderProfile(userId);
            augmentUserCards();
        } catch (error) {
            notifyError('Failed to add event training: ' + friendlyError(error));
        }
    }

    async function sendCompletion(userId) {
        const button = document.getElementById('sendTrainingCompletionBtn');
        const original = button?.textContent || 'Email Completion';
        if (button) { button.disabled = true; button.textContent = 'Sending…'; }
        try {
            const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
            if (sessionError) throw sessionError;
            const accessToken = sessionData?.session?.access_token;
            if (!accessToken) throw new Error('Your session has expired. Sign out and sign back in.');

            const { data, error } = await supabaseClient.functions.invoke('notify-training-completion', {
                headers: { Authorization: `Bearer ${accessToken}` },
                body: { dj_user_id: userId }
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            notifySuccess(`Training completion email sent to ${data?.sent_to || 'the DJ'} and management.`);
        } catch (error) {
            let detail = error?.message || String(error);
            if (typeof getEdgeFunctionErrorMessage === 'function') {
                try { detail = await getEdgeFunctionErrorMessage(error); } catch (_) {}
            }
            notifyError('Failed to send completion email: ' + detail);
        } finally {
            if (button) { button.disabled = false; button.textContent = original; }
        }
    }

    function profilePrintHtml(profile) {
        const progress = progressFor(profile.id);
        const records = recordsFor(profile.id);
        const rows = trainingState.categories
            .filter(category => category.code !== 'other_event_type')
            .map(category => {
                const record = categoryRecord(profile.id, category.id);
                return `<tr><td>${esc(category.name)}</td><td>${record?.status === 'complete' ? 'Complete' : 'Incomplete'}</td><td>${record?.completion_date ? esc(formatDate(record.completion_date)) : '—'}</td><td>${esc(record?.completed_by_name || '—')}</td></tr>`;
            });
        const otherCategory = trainingState.categories.find(category => category.code === 'other_event_type');
        if (otherCategory) {
            otherRecords(profile.id, otherCategory.id).forEach(record => {
                rows.push(`<tr><td>${esc(record.custom_label)}</td><td>${record.status === 'complete' ? 'Complete' : 'Incomplete'}</td><td>${esc(formatDate(record.completion_date))}</td><td>${esc(record.completed_by_name || '—')}</td></tr>`);
            });
        }
        return reportDocument(
            `${displayName(profile)} — DJ Training Profile`,
            `<div class="meta"><strong>Email:</strong> ${esc(profile.email || 'Not provided')}<br><strong>Phone:</strong> ${esc(profile.phone || 'Not provided')}<br><strong>Location:</strong> ${esc([profile.city, profile.state].filter(Boolean).join(', ') || 'Not provided')}<br><strong>Required completion:</strong> ${progress.complete} of ${progress.total} (${progress.percent}%)</div>
            <table><thead><tr><th>Training</th><th>Status</th><th>Completion Date</th><th>Signed Off By</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
        );
    }

    function reportDocument(title, content) {
        return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
            body{font-family:Arial,sans-serif;color:#222;margin:34px}h1{color:#9b145f;margin-bottom:6px}.sub{color:#666;margin-bottom:24px}.meta{border:1px solid #ddd;border-radius:8px;padding:14px;line-height:1.65;margin-bottom:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:9px;text-align:left;font-size:12px}th{background:#f3e9f0}footer{margin-top:22px;color:#777;font-size:11px}@media print{body{margin:18mm}}</style></head><body><h1>${esc(title)}</h1><div class="sub">JAMMIN Command Center • Generated ${esc(new Date().toLocaleString())}</div>${content}<footer>This report reflects the training records stored in the JAMMIN Command Center at the time it was generated.</footer><script>window.onload=()=>window.print();<\/script></body></html>`;
    }

    function openPrintWindow(html) {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            notifyError('The browser blocked the PDF window. Allow pop-ups for the Command Center and try again.');
            return;
        }
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    }

    function printProfile(userId) {
        const profile = trainingState.profiles.find(item => item.id === userId) || (currentProfile?.id === userId ? currentProfile : null);
        if (!profile) return notifyError('DJ profile not found.');
        openPrintWindow(profilePrintHtml(profile));
    }

    function printRoster() {
        const profiles = trainingState.filteredProfiles.length ? trainingState.filteredProfiles : activeProfiles().filter(rosterMatches);
        const rows = profiles.map(profile => {
            const progress = progressFor(profile.id);
            return `<tr><td>${esc(displayName(profile))}</td><td>${esc(profile.email || '—')}</td><td>${esc([profile.city, profile.state].filter(Boolean).join(', ') || '—')}</td><td>${progress.complete}/${progress.total}</td><td>${progress.isComplete ? 'Complete' : 'Incomplete'}</td></tr>`;
        }).join('');
        openPrintWindow(reportDocument('DJ Training Roster', `<table><thead><tr><th>DJ</th><th>Email</th><th>Location</th><th>Required Training</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`));
    }

    function backToRoster() {
        trainingState.selectedUserId = null;
        renderRoster();
    }

    function installLaunchButton() {
        if (document.getElementById('djTrainingLaunchButton')) return;
        const target = document.querySelector('.tabs') || document.querySelector('.header');
        if (!target) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.id = 'djTrainingLaunchButton';
        button.className = target.classList.contains('tabs') ? 'tab training-launch-btn' : 'training-launch-btn';
        button.textContent = role() === 'user' ? 'My Training' : 'DJ Training';
        button.addEventListener('click', openTraining);
        target.appendChild(button);
    }

    function visibleUserFilter() {
        if (typeof users === 'undefined' || !Array.isArray(users)) return [];
        const query = String(document.getElementById('usersSearchInput')?.value || '').trim().toLowerCase();
        const roleFilter = document.getElementById('usersRoleFilter')?.value || 'all';
        const statusFilter = document.getElementById('usersStatusFilter')?.value || 'all';
        return users.filter(profile => {
            const status = profile.status || 'active';
            const haystack = [profile.full_name, profile.email, profile.phone, profile.city, profile.state].filter(Boolean).join(' ').toLowerCase();
            return (!query || haystack.includes(query)) &&
                (roleFilter === 'all' || profile.role === roleFilter) &&
                (statusFilter === 'all' || status === statusFilter);
        });
    }

    async function augmentUserCards() {
        if (role() === 'user') return;
        const grid = document.getElementById('usersGrid');
        if (!grid || !grid.children.length) return;
        try {
            await loadTrainingData();
        } catch (error) {
            console.warn(error);
            return;
        }
        const visible = visibleUserFilter();
        [...grid.querySelectorAll('.user-card')].forEach((card, index) => {
            const profile = visible[index];
            if (!profile || card.dataset.trainingEnhanced === 'true') return;
            card.dataset.trainingEnhanced = 'true';
            card.dataset.trainingUserId = profile.id;
            const progress = progressFor(profile.id);
            const details = card.querySelector('.user-card-details');
            if (details) {
                const detail = document.createElement('div');
                detail.className = 'user-detail training-progress-detail';
                detail.innerHTML = `<span class="user-detail-label">DJ Training</span><span class="user-detail-value">${progress.complete} of ${progress.total} required items complete</span><div class="training-progress-track"><div class="training-progress-fill" style="width:${progress.percent}%"></div></div>`;
                details.appendChild(detail);
            }
            let actions = card.querySelector('.user-card-actions');
            if (!actions) {
                actions = document.createElement('div');
                actions.className = 'user-card-actions';
                card.appendChild(actions);
            }
            const wrap = document.createElement('div');
            wrap.className = 'training-card-actions';
            wrap.innerHTML = `<button type="button" class="action-btn" onclick="window.JamminTraining.openFromCard('${profile.id}')">Training Profile</button>${isAdmin() ? `<button type="button" class="action-btn btn-secondary" onclick="window.JamminTraining.printFromCard('${profile.id}')">Training PDF</button>` : ''}`;
            actions.appendChild(wrap);
        });
    }

    async function openFromCard(userId) {
        ensureOverlay();
        document.getElementById('djTrainingOverlay').classList.remove('hidden');
        document.getElementById('djTrainingBody').innerHTML = '<div class="training-empty">Loading DJ training profile…</div>';
        try {
            await loadTrainingData(true);
            await renderProfile(userId);
        } catch (error) {
            notifyError(friendlyError(error));
            closeTraining();
        }
    }

    async function printFromCard(userId) {
        try {
            await loadTrainingData(true);
            printProfile(userId);
        } catch (error) {
            notifyError(friendlyError(error));
        }
    }

    function patchUserCardRenderer() {
        if (trainingState.cardsPatched || typeof renderUserCards !== 'function') return;
        const originalRenderUserCards = renderUserCards;
        renderUserCards = function patchedRenderUserCards(...args) {
            const result = originalRenderUserCards.apply(this, args);
            setTimeout(augmentUserCards, 0);
            return result;
        };
        trainingState.cardsPatched = true;
        setTimeout(augmentUserCards, 0);
    }

    function initializeTrainingFeature() {
        injectStyles();
        ensureOverlay();
        installLaunchButton();
        patchUserCardRenderer();
        if (typeof currentUser !== 'undefined' && currentUser) {
            const button = document.getElementById('djTrainingLaunchButton');
            if (button) button.textContent = role() === 'user' ? 'My Training' : 'DJ Training';
        }
    }

    window.JamminTraining = {
        open: openTraining,
        close: closeTraining,
        openProfile: renderProfile,
        openFromCard,
        printFromCard,
        backToRoster,
        filterRoster,
        setComplete,
        reopen,
        addOther,
        sendCompletion,
        printProfile,
        printRoster,
        refresh: async () => {
            await loadTrainingData(true);
            if (trainingState.selectedUserId) await renderProfile(trainingState.selectedUserId);
            else if (role() !== 'user') renderRoster();
        }
    };

    document.addEventListener('DOMContentLoaded', initializeTrainingFeature);
    const installTimer = setInterval(() => {
        initializeTrainingFeature();
        if (document.getElementById('djTrainingLaunchButton') && trainingState.cardsPatched && currentId() && typeof currentProfile !== 'undefined' && currentProfile) {
            clearInterval(installTimer);
        }
    }, 700);
    setTimeout(() => clearInterval(installTimer), 30000);
})();
