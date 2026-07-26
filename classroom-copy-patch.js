(() => {
    'use strict';

    function applyGenericClassroomCopy() {
        const title = document.getElementById('googleClassroomTitle');
        const subtitle = title?.parentElement?.querySelector('p');
        if (subtitle) {
            subtitle.textContent = 'Connect the existing training course, match DJs, and synchronize progress.';
        }

        document.querySelectorAll('.classroom-connect-card h3').forEach((heading) => {
            if (/Connect .*Google Classroom/i.test(heading.textContent || '')) {
                heading.textContent = 'Connect Google Classroom';
            }
        });

        document.querySelectorAll('.classroom-loading').forEach((item) => {
            item.textContent = (item.textContent || '').replace(/Loading .*classrooms…/i, 'Loading classrooms…');
        });
    }

    document.addEventListener('DOMContentLoaded', applyGenericClassroomCopy);
    new MutationObserver(applyGenericClassroomCopy).observe(document.documentElement, {
        childList: true,
        subtree: true
    });
})();
