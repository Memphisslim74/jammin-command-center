(() => {
    'use strict';

    const GENERIC_SUBTITLE = 'Connect the existing training course, match DJs, and synchronize progress.';

    function applyGenericClassroomCopy() {
        const title = document.getElementById('googleClassroomTitle');
        const subtitle = title?.parentElement?.querySelector('p');
        if (subtitle && subtitle.textContent !== GENERIC_SUBTITLE) {
            subtitle.textContent = GENERIC_SUBTITLE;
        }

        document.querySelectorAll('.classroom-connect-card h3').forEach((heading) => {
            const current = heading.textContent || '';
            if (/Connect .*Google Classroom/i.test(current) && current !== 'Connect Google Classroom') {
                heading.textContent = 'Connect Google Classroom';
            }
        });

        document.querySelectorAll('.classroom-loading').forEach((item) => {
            const current = item.textContent || '';
            const updated = current.replace(/Loading .*classrooms…/i, 'Loading classrooms…');
            if (updated !== current) item.textContent = updated;
        });
    }

    document.addEventListener('DOMContentLoaded', applyGenericClassroomCopy);

    const observer = new MutationObserver(() => applyGenericClassroomCopy());
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    setTimeout(() => observer.disconnect(), 30000);
})();
