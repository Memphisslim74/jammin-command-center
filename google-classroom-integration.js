(() => {
    'use strict';

    const AUTH_FUNCTION = 'google-classroom-auth';
    const SYNC_FUNCTION = 'google-classroom-sync';
    const CLASSROOM_HOME = 'https://classroom.google.com/';

    const state = {
        status: null,
        courses: [],
        students: [],
        profiles: [],
        view: 'status',
        busy: false,
        installed: false,
        callbackHandled: false,
        learnerLoading: false,
        learnerData: null,
        lastLearnerUserId: null
    };

    const esc = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const role = () => (typeof currentProfile !== 'undefined' && currentProfile?.role) || 'user';
    const canManage = () => ['admin', 'manager'].includes(role());
    const isAdmin = () => role() === 'admin';
    const currentUserId = () => (typeof currentUser !== 'undefined' ? currentUser?.id || null : null);

    function notifySuccess(message) {
        if (typeof showSuccess === 'function') showSuccess(message);
        else alert(message);
    }

    function notifyError(message) {
        if (typeof showError === 'function') showError(message);
        else alert(message);
    }

    async function errorMessage(error) {
        let detail = error?.message || String(error || 'Unknown error');
        if (typeof getEdgeFunctionErrorMessage === 'function') {
            try { detail = await getEdgeFunctionErrorMessage(error); } catch (_) {}
        }
        return detail;
    }

    function formatDateTime(value) {
        if (!value) return 'Not synchronized yet';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
        }).format(date);
    }

    function formatDueDate(value) {
        if (!value) return '';
        const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
        if (Number.isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
    }

    async function invoke(functionName, body) {
        const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) throw sessionError;
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error('Your session has expired. Sign out and sign back in.');

        const { data, error } = await supabaseClient.functions.invoke(functionName, {
            headers: { Authorization: `Bearer ${token}` },
            body
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data;
    }

    function injectStyles() {
        if (document.getElementById('googleClassroomIntegrationStyles')) return;
        const style = document.createElement('style');
        style.id = 'googleClassroomIntegrationStyles';
        style.textContent = `
            .classroom-header-btn {
                min-height:38px;
                padding:8px 13px;
                border-radius:8px;
                border:1px solid rgba(66,133,244,.38);
                background:rgba(66,133,244,.11);
                color:#dfeaff;
                font-size:.82rem;
                font-weight:750;
                box-shadow:none;
                white-space:nowrap;
            }
            .classroom-header-btn:hover { background:rgba(66,133,244,.19); border-color:rgba(66,133,244,.58); box-shadow:none; }
            .classroom-overlay {
                position:fixed;
                inset:0;
                z-index:14500;
                display:flex;
                align-items:flex-start;
                justify-content:center;
                padding:24px;
                overflow:auto;
                background:rgba(5,4,8,.91);
                backdrop-filter:blur(10px);
            }
            .classroom-overlay.hidden { display:none; }
            .classroom-shell {
                width:min(1120px,100%);
                margin:auto;
                border-radius:16px;
                overflow:hidden;
                border:1px solid rgba(66,133,244,.34);
                background:linear-gradient(145deg,#251d31,#17131c);
                box-shadow:0 30px 100px rgba(0,0,0,.62);
            }
            .classroom-shell-header {
                display:flex;
                justify-content:space-between;
                align-items:flex-start;
                gap:18px;
                padding:22px 24px;
                border-bottom:1px solid rgba(255,255,255,.08);
                background:rgba(255,255,255,.025);
            }
            .classroom-shell-header h2 { margin:0 0 5px; color:#fff; font-size:1.35rem; }
            .classroom-shell-header p { margin:0; color:#aaa0b0; line-height:1.45; }
            .classroom-close { padding:2px 10px; border:0; background:transparent; color:#fff; font-size:28px; box-shadow:none; }
            .classroom-body { padding:22px; }
            .classroom-loading,.classroom-empty {
                padding:40px 20px;
                text-align:center;
                color:#aaa0b0;
                border:1px dashed rgba(255,255,255,.13);
                border-radius:12px;
            }
            .classroom-connect-card {
                max-width:720px;
                margin:18px auto;
                padding:28px;
                text-align:center;
                border-radius:15px;
                border:1px solid rgba(66,133,244,.28);
                background:linear-gradient(145deg,rgba(66,133,244,.10),rgba(255,255,255,.025));
            }
            .classroom-logo {
                width:58px;
                height:58px;
                margin:0 auto 14px;
                display:grid;
                place-items:center;
                border-radius:15px;
                background:#1f6f43;
                color:#fff;
                font-size:28px;
                font-weight:900;
                box-shadow:0 12px 30px rgba(0,0,0,.25);
            }
            .classroom-connect-card h3 { margin:0 0 8px; color:#fff; font-size:1.3rem; }
            .classroom-connect-card p { margin:0 auto 18px; color:#afa5b5; line-height:1.55; max-width:600px; }
            .classroom-status-top {
                display:flex;
                flex-wrap:wrap;
                justify-content:space-between;
                align-items:flex-start;
                gap:14px;
                margin-bottom:16px;
            }
            .classroom-status-title h3 { margin:0 0 4px; color:#fff; }
            .classroom-status-title p { margin:0; color:#a99faf; }
            .classroom-health {
                display:inline-flex;
                align-items:center;
                gap:6px;
                border-radius:999px;
                padding:7px 11px;
                font-size:.78rem;
                font-weight:800;
            }
            .classroom-health.good { color:#8cf0c6; background:rgba(16,185,129,.13); border:1px solid rgba(16,185,129,.3); }
            .classroom-health.error { color:#ffc0d2; background:rgba(239,68,68,.11); border:1px solid rgba(239,68,68,.28); }
            .classroom-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin:14px 0 18px; }
            .classroom-stat { padding:13px; border-radius:11px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.035); }
            .classroom-stat span { display:block; color:#92879b; font-size:.7rem; text-transform:uppercase; letter-spacing:.06em; margin-bottom:5px; }
            .classroom-stat strong { display:block; color:#fff; font-size:.96rem; overflow-wrap:anywhere; }
            .classroom-actions { display:flex; flex-wrap:wrap; gap:9px; margin-bottom:18px; }
            .classroom-actions button,.classroom-actions a { margin:0; min-height:41px; padding:9px 14px; display:inline-flex; align-items:center; justify-content:center; border-radius:8px; text-decoration:none; font-weight:750; }
            .classroom-actions a { color:#fff; border:1px solid rgba(255,255,255,.13); background:rgba(255,255,255,.055); }
            .classroom-error { margin:12px 0; padding:12px 14px; border-radius:9px; color:#ffc0d2; background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.22); }
            .classroom-section-title { display:flex; justify-content:space-between; align-items:center; gap:10px; margin:20px 0 10px; }
            .classroom-section-title h3 { margin:0; color:#fff; }
            .classroom-course-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:12px; }
            .classroom-course-card { padding:16px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.03); }
            .classroom-course-card h4 { margin:0 0 5px; color:#fff; }
            .classroom-course-card p { margin:0 0 13px; color:#9f94a7; font-size:.84rem; line-height:1.4; min-height:34px; }
            .classroom-course-card button { width:100%; margin:0; }
            .classroom-match-summary { color:#a99faf; margin-bottom:12px; line-height:1.45; }
            .classroom-match-list { display:grid; gap:9px; }
            .classroom-match-row {
                display:grid;
                grid-template-columns:minmax(190px,1fr) minmax(210px,1fr) 110px;
                gap:10px;
                align-items:center;
                padding:12px;
                border-radius:10px;
                border:1px solid rgba(255,255,255,.075);
                background:rgba(255,255,255,.027);
            }
            .classroom-match-person strong { display:block; color:#fff; margin-bottom:3px; }
            .classroom-match-person span { display:block; color:#9f94a7; font-size:.78rem; overflow-wrap:anywhere; }
            .classroom-match-row select { width:100%; min-height:40px; padding:0 9px; border-radius:8px; border:1px solid rgba(255,255,255,.13); background:#211927; color:#fff; }
            .classroom-match-badge { text-align:center; border-radius:999px; padding:6px 8px; font-size:.72rem; font-weight:800; }
            .classroom-match-badge.matched { color:#8cf0c6; background:rgba(16,185,129,.12); }
            .classroom-match-badge.unmatched { color:#ffd48b; background:rgba(245,158,11,.12); }
            .classroom-my-panel {
                margin:18px 0 22px;
                padding:20px;
                border-radius:15px;
                border:1px solid rgba(66,133,244,.25);
                background:linear-gradient(145deg,rgba(35,59,96,.55),rgba(25,23,34,.92));
                box-shadow:0 14px 34px rgba(0,0,0,.16);
            }
            .classroom-my-panel.hidden { display:none; }
            .classroom-my-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:14px; }
            .classroom-my-eyebrow { color:#76a9ff; font-size:.73rem; font-weight:850; letter-spacing:.11em; text-transform:uppercase; margin-bottom:4px; }
            .classroom-my-header h3 { margin:0 0 4px; color:#fff; }
            .classroom-my-header p { margin:0; color:#a9a0b0; font-size:.86rem; }
            .classroom-my-progress { display:grid; grid-template-columns:1fr auto; gap:10px; align-items:center; margin-bottom:14px; }
            .classroom-my-progress strong { color:#fff; }
            .classroom-my-track { grid-column:1/-1; height:8px; border-radius:999px; overflow:hidden; background:rgba(255,255,255,.08); }
            .classroom-my-fill { height:100%; background:linear-gradient(90deg,#4285f4,#34a853); }
            .classroom-next-task { padding:13px; border-radius:10px; border:1px solid rgba(66,133,244,.25); background:rgba(66,133,244,.08); margin-bottom:13px; }
            .classroom-next-task span { display:block; color:#86b2ff; font-size:.71rem; font-weight:850; text-transform:uppercase; letter-spacing:.08em; margin-bottom:5px; }
            .classroom-next-task strong { display:block; color:#fff; margin-bottom:4px; }
            .classroom-next-task small { color:#aaa0b0; }
            .classroom-my-list { display:grid; gap:7px; margin-bottom:13px; }
            .classroom-my-item { display:grid; grid-template-columns:1fr auto; gap:10px; align-items:center; padding:9px 0; border-bottom:1px solid rgba(255,255,255,.06); }
            .classroom-my-item a { color:#fff; text-decoration:none; font-weight:700; }
            .classroom-my-item a:hover { text-decoration:underline; }
            .classroom-item-meta { color:#9f95a6; font-size:.75rem; margin-top:2px; }
            .classroom-item-status { border-radius:999px; padding:5px 8px; font-size:.69rem; font-weight:800; white-space:nowrap; background:rgba(255,255,255,.07); color:#d7cfdb; }
            .classroom-item-status.complete { color:#8cf0c6; background:rgba(16,185,129,.12); }
            .classroom-item-status.submitted { color:#9fc0ff; background:rgba(66,133,244,.13); }
            .classroom-item-status.attention { color:#ffd48b; background:rgba(245,158,11,.13); }
            @media (max-width:760px) {
                .classroom-overlay { padding:8px; }
                .classroom-body { padding:14px; }
                .classroom-shell-header { padding:17px; }
                .classroom-stats { grid-template-columns:repeat(2,minmax(0,1fr)); }
                .classroom-match-row { grid-template-columns:1fr; }
                .classroom-match-badge { justify-self:start; }
                .classroom-actions button,.classroom-actions a { width:100%; }
                .classroom-my-header { flex-direction:column; }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureOverlay() {
        if (document.getElementById('googleClassroomOverlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'googleClassroomOverlay';
        overlay.className = 'classroom-overlay hidden';
        overlay.innerHTML = `
            <section class="classroom-shell" role="dialog" aria-modal="true" aria-labelledby="googleClassroomTitle">
                <header class="classroom-shell-header">
                    <div>
                        <h2 id="googleClassroomTitle">Google Classroom Connection</h2>
                        <p>Connect Lindsay's existing training course, match DJs, and synchronize progress.</p>
                    </div>
                    <button type="button" class="classroom-close" aria-label="Close Google Classroom connection">&times;</button>
                </header>
                <div class="classroom-body" id="googleClassroomBody"></div>
            </section>`;
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) closeManager();
        });
        overlay.querySelector('.classroom-close')?.addEventListener('click', closeManager);
        document.body.appendChild(overlay);
    }

    function installHeaderButton() {
        if (!canManage() || document.getElementById('googleClassroomManagerBtn')) return;
        const header = document.querySelector('.training-shell-header');
        const closeButton = header?.querySelector('.training-close');
        if (!header || !closeButton) return;

        let actions = header.querySelector('.training-header-actions');
        if (!actions) {
            actions = document.createElement('div');
            actions.className = 'training-header-actions';
            header.insertBefore(actions, closeButton);
            actions.appendChild(closeButton);
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.id = 'googleClassroomManagerBtn';
        button.className = 'classroom-header-btn';
        button.textContent = 'Google Classroom';
        button.addEventListener('click', openManager);
        actions.insertBefore(button, closeButton);
    }

    function closeManager() {
        if (state.busy) return;
        document.getElementById('googleClassroomOverlay')?.classList.add('hidden');
    }

    async function openManager() {
        if (!canManage()) return notifyError('Only administrators and managers can manage Google Classroom.');
        ensureOverlay();
        document.getElementById('googleClassroomOverlay').classList.remove('hidden');
        state.view = 'status';
        await loadStatus();
    }

    function setManagerLoading(message) {
        const body = document.getElementById('googleClassroomBody');
        if (body) body.innerHTML = `<div class="classroom-loading">${esc(message)}</div>`;
    }

    async function loadStatus() {
        setManagerLoading('Checking the Google Classroom connection…');
        try {
            state.status = await invoke(SYNC_FUNCTION, { action: 'status' });
            renderManager();
            if (state.status.connected && !state.status.course_id) await loadCourses();
        } catch (error) {
            const detail = await errorMessage(error);
            const body = document.getElementById('googleClassroomBody');
            if (body) body.innerHTML = `
                <div class="classroom-connect-card">
                    <div class="classroom-logo">G</div>
                    <h3>Google Classroom setup is not ready</h3>
                    <p>${esc(detail)}</p>
                </div>`;
        }
    }

    function renderManager() {
        const body = document.getElementById('googleClassroomBody');
        if (!body) return;
        const status = state.status || { connected: false };

        if (!status.connected) {
            body.innerHTML = `
                <div class="classroom-connect-card">
                    <div class="classroom-logo">G</div>
                    <h3>Connect Lindsay's Google Classroom</h3>
                    <p>This keeps all existing videos, links, materials, assignments, and grades in Google Classroom while the Command Center becomes the one place DJs check for their next step.</p>
                    <button type="button" onclick="window.JamminClassroom.connect()">Connect Google Classroom</button>
                </div>`;
            return;
        }

        if (!status.course_id || state.view === 'courses') {
            body.innerHTML = `
                <div class="classroom-status-top">
                    <div class="classroom-status-title">
                        <h3>Connected as ${esc(status.authorized_name || status.authorized_email)}</h3>
                        <p>${esc(status.authorized_email || '')}</p>
                    </div>
                    <span class="classroom-health good">● Connected</span>
                </div>
                <div class="classroom-section-title"><h3>Choose the JAMMIN training classroom</h3></div>
                <div id="classroomCourseList" class="classroom-course-grid">
                    ${state.courses.length ? renderCourses() : '<div class="classroom-loading">Loading Lindsay’s classrooms…</div>'}
                </div>
                <div class="classroom-actions" style="margin-top:16px">
                    <button type="button" class="btn-secondary" onclick="window.JamminClassroom.reconnect()">Reconnect Google Account</button>
                </div>`;
            return;
        }

        const unmatched = Math.max(0, Number(status.students || 0) - Number(status.matched_students || 0));
        body.innerHTML = `
            <div class="classroom-status-top">
                <div class="classroom-status-title">
                    <h3>${esc(status.course_name || 'Google Classroom')}</h3>
                    <p>Connected as ${esc(status.authorized_name || status.authorized_email)} · ${esc(status.authorized_email || '')}</p>
                </div>
                <span class="classroom-health ${status.status === 'error' ? 'error' : 'good'}">● ${status.status === 'error' ? 'Needs attention' : 'Connected'}</span>
            </div>
            <div class="classroom-stats">
                <div class="classroom-stat"><span>Students</span><strong>${Number(status.students || 0)}</strong></div>
                <div class="classroom-stat"><span>Matched DJs</span><strong>${Number(status.matched_students || 0)}</strong></div>
                <div class="classroom-stat"><span>Needs Matching</span><strong>${unmatched}</strong></div>
                <div class="classroom-stat"><span>Training Items</span><strong>${Number(status.items || 0)}</strong></div>
            </div>
            <div class="classroom-actions">
                <button type="button" onclick="window.JamminClassroom.sync()">Sync Now</button>
                <button type="button" class="btn-secondary" onclick="window.JamminClassroom.showMatches()">Review DJ Matches</button>
                <button type="button" class="btn-secondary" onclick="window.JamminClassroom.showCourses()">Change Classroom</button>
                ${status.course_url ? `<a href="${esc(status.course_url)}" target="_blank" rel="noopener noreferrer">Open Classroom ↗</a>` : ''}
                <button type="button" class="btn-secondary" onclick="window.JamminClassroom.reconnect()">Reconnect Google</button>
                ${isAdmin() ? '<button type="button" class="btn-secondary" onclick="window.JamminClassroom.disconnect()">Disconnect</button>' : ''}
            </div>
            ${status.last_sync_error ? `<div class="classroom-error">${esc(status.last_sync_error)}</div>` : ''}
            <div class="classroom-stat" style="margin-top:4px"><span>Last Synchronized</span><strong>${esc(formatDateTime(status.last_synced_at))}</strong></div>
            <div id="classroomManagerDetail"></div>`;

        if (state.view === 'matches') renderMatches();
    }

    function renderCourses() {
        if (!state.courses.length) return '<div class="classroom-empty">No classrooms were found for the connected Google account.</div>';
        return state.courses.map((course) => `
            <article class="classroom-course-card">
                <h4>${esc(course.name)}</h4>
                <p>${esc(course.section || course.description || course.state || 'Google Classroom course')}</p>
                <button type="button" onclick="window.JamminClassroom.selectCourse('${encodeURIComponent(course.id)}')">Select This Class</button>
            </article>`).join('');
    }

    async function connect() {
        if (state.busy) return;
        state.busy = true;
        try {
            const data = await invoke(AUTH_FUNCTION, { action: 'start' });
            if (!data?.authorization_url) throw new Error('Google did not return a connection page.');
            window.location.assign(data.authorization_url);
        } catch (error) {
            notifyError('Could not start Google Classroom connection: ' + await errorMessage(error));
            state.busy = false;
        }
    }

    async function loadCourses() {
        try {
            const data = await invoke(SYNC_FUNCTION, { action: 'courses' });
            state.courses = data?.courses || [];
            state.view = 'courses';
            renderManager();
        } catch (error) {
            notifyError('Could not load Lindsay’s classrooms: ' + await errorMessage(error));
        }
    }

    async function selectCourse(encodedCourseId) {
        if (state.busy) return;
        state.busy = true;
        setManagerLoading('Selecting the classroom…');
        try {
            await invoke(SYNC_FUNCTION, { action: 'select_course', course_id: decodeURIComponent(encodedCourseId) });
            notifySuccess('Classroom selected. Starting the first synchronization.');
            await syncNow();
        } catch (error) {
            notifyError('Could not select the classroom: ' + await errorMessage(error));
            state.busy = false;
            await loadStatus();
        }
    }

    async function syncNow() {
        if (state.busy && !document.getElementById('googleClassroomBody')?.textContent?.includes('Selecting')) return;
        state.busy = true;
        setManagerLoading('Synchronizing topics, training items, students, and submission progress…');
        try {
            const result = await invoke(SYNC_FUNCTION, { action: 'sync' });
            notifySuccess(`Google Classroom synchronized: ${result.students || 0} students and ${result.items || 0} training items.`);
            state.busy = false;
            state.view = 'status';
            await loadStatus();
            await loadLearnerProgress(true);
        } catch (error) {
            state.busy = false;
            notifyError('Google Classroom sync failed: ' + await errorMessage(error));
            await loadStatus();
        }
    }

    async function showCourses() {
        state.view = 'courses';
        renderManager();
        await loadCourses();
    }

    async function showMatches() {
        state.view = 'matches';
        renderManager();
        const detail = document.getElementById('classroomManagerDetail');
        if (detail) detail.innerHTML = '<div class="classroom-loading">Loading DJ matches…</div>';
        try {
            const data = await invoke(SYNC_FUNCTION, { action: 'students' });
            state.students = data?.students || [];
            state.profiles = data?.profiles || [];
            renderMatches();
        } catch (error) {
            if (detail) detail.innerHTML = `<div class="classroom-error">${esc(await errorMessage(error))}</div>`;
        }
    }

    function renderMatches() {
        const detail = document.getElementById('classroomManagerDetail');
        if (!detail) return;
        const activeStudents = state.students.filter((student) => student.active !== false);
        if (!activeStudents.length) {
            detail.innerHTML = '<div class="classroom-empty">Run Sync Now to import the Classroom roster.</div>';
            return;
        }
        const matched = activeStudents.filter((student) => student.profile_id).length;
        detail.innerHTML = `
            <div class="classroom-section-title"><h3>Classroom Student Matches</h3></div>
            <div class="classroom-match-summary">${matched} of ${activeStudents.length} Classroom students are connected to a Command Center profile. Email matches happen automatically; use the dropdown only when the emails are different.</div>
            <div class="classroom-match-list">
                ${activeStudents.map((student) => `
                    <div class="classroom-match-row">
                        <div class="classroom-match-person">
                            <strong>${esc(student.full_name || student.email || 'Classroom student')}</strong>
                            <span>${esc(student.email || 'No Classroom email')}</span>
                        </div>
                        <select aria-label="Match ${esc(student.full_name || student.email)}" onchange="window.JamminClassroom.matchStudent('${student.id}', this.value)">
                            <option value="">Not matched</option>
                            ${state.profiles.map((profile) => `<option value="${profile.id}" ${profile.id === student.profile_id ? 'selected' : ''}>${esc(profile.full_name || profile.email)} — ${esc(profile.email || 'No email')}</option>`).join('')}
                        </select>
                        <span class="classroom-match-badge ${student.profile_id ? 'matched' : 'unmatched'}">${student.profile_id ? 'Matched' : 'Needs match'}</span>
                    </div>`).join('')}
            </div>`;
    }

    async function matchStudent(studentId, profileId) {
        try {
            await invoke(SYNC_FUNCTION, { action: 'match_student', student_id: studentId, profile_id: profileId || null });
            const student = state.students.find((item) => item.id === studentId);
            if (student) {
                student.profile_id = profileId || null;
                student.match_method = profileId ? 'manual' : null;
            }
            renderMatches();
            state.status = await invoke(SYNC_FUNCTION, { action: 'status' });
            notifySuccess(profileId ? 'DJ matched successfully.' : 'DJ match removed.');
        } catch (error) {
            notifyError('Could not save the DJ match: ' + await errorMessage(error));
            await showMatches();
        }
    }

    async function reconnect() {
        if (!confirm('Reconnect the Google account that owns the JAMMIN Classroom?')) return;
        await connect();
    }

    async function disconnect() {
        if (!confirm('Disconnect Google Classroom and remove the synchronized Classroom data from the Command Center?')) return;
        state.busy = true;
        setManagerLoading('Disconnecting Google Classroom…');
        try {
            await invoke(SYNC_FUNCTION, { action: 'disconnect' });
            state.busy = false;
            state.status = { connected: false };
            state.courses = [];
            state.students = [];
            renderManager();
            notifySuccess('Google Classroom disconnected.');
            await loadLearnerProgress(true);
        } catch (error) {
            state.busy = false;
            notifyError('Could not disconnect Google Classroom: ' + await errorMessage(error));
            await loadStatus();
        }
    }

    function ensureLearnerPanel() {
        const profileForm = document.getElementById('profileForm');
        if (!profileForm) return null;
        let panel = document.getElementById('myGoogleClassroomPanel');
        if (panel) return panel;
        panel = document.createElement('section');
        panel.id = 'myGoogleClassroomPanel';
        panel.className = 'classroom-my-panel hidden';
        panel.setAttribute('aria-live', 'polite');
        const trainingPanel = document.getElementById('myTrainingProgressPanel');
        const profileGrid = profileForm.querySelector('.profile-grid');
        if (trainingPanel?.nextSibling) profileForm.insertBefore(panel, trainingPanel.nextSibling);
        else if (profileGrid) profileForm.insertBefore(panel, profileGrid);
        else profileForm.appendChild(panel);
        return panel;
    }

    function profileIsVisible() {
        const profileForm = document.getElementById('profileForm');
        return Boolean(profileForm && !profileForm.classList.contains('hidden'));
    }

    function itemStatusClass(status) {
        if (status === 'Complete') return 'complete';
        if (status === 'Submitted') return 'submitted';
        if (status === 'Needs attention') return 'attention';
        return '';
    }

    function renderLearnerPanel() {
        const panel = ensureLearnerPanel();
        if (!panel) return;
        const data = state.learnerData;
        if (!data?.connected) {
            panel.classList.add('hidden');
            return;
        }
        panel.classList.remove('hidden');

        const existingClassroomButton = document.querySelector('.my-training-classroom-btn');
        if (existingClassroomButton) {
            existingClassroomButton.href = data.course_url || CLASSROOM_HOME;
            existingClassroomButton.textContent = 'Open Full Google Classroom ↗';
        }

        if (!data.matched) {
            panel.innerHTML = `
                <div class="classroom-my-header">
                    <div><div class="classroom-my-eyebrow">Google Classroom</div><h3>${esc(data.course_name || 'JAMMIN Training')}</h3><p>Your Classroom account has not been matched to this Command Center profile yet.</p></div>
                </div>
                <div class="classroom-actions">
                    <a href="${esc(data.course_url || CLASSROOM_HOME)}" target="_blank" rel="noopener noreferrer">Open Google Classroom ↗</a>
                </div>`;
            return;
        }

        const progress = data.progress || { completed: 0, submitted: 0, total: 0, percent: 0 };
        const nextTask = data.next_task;
        panel.innerHTML = `
            <div class="classroom-my-header">
                <div>
                    <div class="classroom-my-eyebrow">Google Classroom</div>
                    <h3>${esc(data.course_name || 'JAMMIN Training')}</h3>
                    <p>Classroom account: ${esc(data.classroom_email || 'Matched')}</p>
                </div>
                <span class="classroom-health good">${Number(progress.percent || 0)}%</span>
            </div>
            <div class="classroom-my-progress">
                <strong>${Number(progress.completed || 0)} of ${Number(progress.total || 0)} assignments returned complete${progress.submitted ? ` · ${Number(progress.submitted)} awaiting review` : ''}</strong>
                <span>${Number(progress.percent || 0)}%</span>
                <div class="classroom-my-track"><div class="classroom-my-fill" style="width:${Number(progress.percent || 0)}%"></div></div>
            </div>
            ${nextTask ? `
                <div class="classroom-next-task">
                    <span>Your Next Step</span>
                    <strong>${esc(nextTask.title)}</strong>
                    <small>${esc(nextTask.status)}${nextTask.due_date ? ` · Due ${esc(formatDueDate(nextTask.due_date))}` : ''}</small>
                </div>` : '<div class="classroom-next-task"><strong>No unfinished Classroom assignments were found.</strong></div>'}
            <div class="classroom-my-list">
                ${(data.items || []).slice(0, 6).map((item) => `
                    <div class="classroom-my-item">
                        <div>
                            <a href="${esc(item.url || data.course_url || CLASSROOM_HOME)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a>
                            <div class="classroom-item-meta">${esc([item.topic, item.due_date ? `Due ${formatDueDate(item.due_date)}` : '', item.assigned_grade !== null && item.max_points !== null ? `${item.assigned_grade}/${item.max_points}` : ''].filter(Boolean).join(' · '))}</div>
                        </div>
                        <span class="classroom-item-status ${itemStatusClass(item.status)}">${esc(item.status)}</span>
                    </div>`).join('')}
            </div>
            <div class="classroom-actions">
                ${nextTask ? `<a href="${esc(nextTask.url || data.course_url || CLASSROOM_HOME)}" target="_blank" rel="noopener noreferrer">Continue Next Assignment ↗</a>` : ''}
                <a href="${esc(data.course_url || CLASSROOM_HOME)}" target="_blank" rel="noopener noreferrer">Open Full Classroom ↗</a>
                <button type="button" class="btn-secondary" onclick="window.JamminClassroom.refreshMyTraining()">Refresh Progress</button>
            </div>
            <div class="classroom-item-meta">Last synchronized: ${esc(formatDateTime(data.last_synced_at))}</div>`;
    }

    async function loadLearnerProgress(force = false) {
        const userId = currentUserId();
        if (!userId || state.learnerLoading) return;
        if (!force && state.lastLearnerUserId === userId && state.learnerData) {
            renderLearnerPanel();
            return;
        }
        const panel = ensureLearnerPanel();
        if (!panel) return;
        state.learnerLoading = true;
        panel.classList.remove('hidden');
        panel.innerHTML = '<div class="classroom-loading">Loading Google Classroom progress…</div>';
        try {
            state.learnerData = await invoke(SYNC_FUNCTION, { action: 'my_training' });
            state.lastLearnerUserId = userId;
            renderLearnerPanel();
        } catch (error) {
            const detail = await errorMessage(error);
            if (/relation .* does not exist|Could not find the table|Function not found|404/i.test(detail)) {
                panel.classList.add('hidden');
            } else {
                panel.innerHTML = `<div class="classroom-error">Google Classroom progress could not be loaded: ${esc(detail)}</div>`;
            }
        } finally {
            state.learnerLoading = false;
        }
    }

    function handleOAuthCallback() {
        if (state.callbackHandled) return;
        const url = new URL(window.location.href);
        const result = url.searchParams.get('classroom');
        if (!result) return;
        state.callbackHandled = true;
        const message = url.searchParams.get('classroom_message');
        url.searchParams.delete('classroom');
        url.searchParams.delete('classroom_message');
        window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
        if (result === 'connected') {
            notifySuccess('Google Classroom connected. Choose Lindsay’s JAMMIN training class next.');
            const waitForProfile = setInterval(() => {
                if (canManage()) {
                    clearInterval(waitForProfile);
                    openManager();
                }
            }, 300);
            setTimeout(() => clearInterval(waitForProfile), 20000);
        } else {
            notifyError('Google Classroom was not connected: ' + (message || 'Google returned an error.'));
        }
    }

    function initialize() {
        injectStyles();
        ensureOverlay();
        ensureLearnerPanel();
        installHeaderButton();
        handleOAuthCallback();
        if (profileIsVisible()) loadLearnerProgress();
        state.installed = true;
    }

    window.JamminClassroom = {
        open: openManager,
        close: closeManager,
        connect,
        reconnect,
        disconnect,
        sync: syncNow,
        showCourses,
        showMatches,
        selectCourse,
        matchStudent,
        refreshMyTraining: () => loadLearnerProgress(true)
    };

    document.addEventListener('DOMContentLoaded', initialize);
    const observer = new MutationObserver(() => window.requestAnimationFrame(() => {
        initialize();
        if (profileIsVisible()) loadLearnerProgress();
    }));
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    setInterval(() => {
        initialize();
        if (profileIsVisible()) loadLearnerProgress(true);
    }, 10 * 60 * 1000);

    const installTimer = setInterval(() => {
        initialize();
        if (state.installed && currentUserId() && typeof currentProfile !== 'undefined' && currentProfile) clearInterval(installTimer);
    }, 350);

    initialize();
})();
