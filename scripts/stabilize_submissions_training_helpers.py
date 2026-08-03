from pathlib import Path

manager_path = Path('manager-training-access.js')
manager = manager_path.read_text(encoding='utf-8')

old_manager = """        button.classList.remove('hidden');
        button.style.display = '';
        button.textContent = role() === 'user' ? 'My Training' : 'DJ Training';
        button.setAttribute('aria-label', role() === 'user' ? 'Open my training record' : 'Open DJ training management');
        return true;
"""
new_manager = """        if (button.classList.contains('hidden')) button.classList.remove('hidden');
        if (button.style.display === 'none') button.style.display = '';

        const desiredText = role() === 'user' ? 'My Training' : 'DJ Training';
        if (button.textContent !== desiredText) button.textContent = desiredText;

        const desiredLabel = role() === 'user' ? 'Open my training record' : 'Open DJ training management';
        if (button.getAttribute('aria-label') !== desiredLabel) button.setAttribute('aria-label', desiredLabel);
        return true;
"""

old_observer = """        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
"""
new_observer = """        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
"""

if manager.count(old_manager) != 1:
    raise RuntimeError('Manager button update anchor not found exactly once.')
if manager.count(old_observer) != 1:
    raise RuntimeError('Manager observer anchor not found exactly once.')

manager = manager.replace(old_manager, new_manager, 1).replace(old_observer, new_observer, 1)
manager_path.write_text(manager, encoding='utf-8')

submissions_path = Path('my-submissions.js')
submissions = submissions_path.read_text(encoding='utf-8')
old_submissions = """        if (button) button.textContent = 'View My Submissions';
"""
new_submissions = """        if (button && !button.textContent.trim()) button.textContent = 'View My Submissions';
"""

if submissions.count(old_submissions) != 1:
    raise RuntimeError('Submission button label anchor not found exactly once.')

submissions = submissions.replace(old_submissions, new_submissions, 1)
submissions_path.write_text(submissions, encoding='utf-8')

print('Stabilized helper observers and button updates.')
