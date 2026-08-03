from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')

anchor = '    <script src="bookkeeper-payroll.js"></script>\n</body>'
replacement = '    <script src="bookkeeper-payroll.js"></script>\n    <script src="my-submissions.js"></script>\n    <script src="manager-training-access.js"></script>\n</body>'

if 'my-submissions.js' in text or 'manager-training-access.js' in text:
    raise RuntimeError('One or both new scripts are already installed.')

count = text.count(anchor)
if count != 1:
    raise RuntimeError(f'Expected one script installation anchor, found {count}.')

path.write_text(text.replace(anchor, replacement, 1), encoding='utf-8')
print('Installed combined personal submissions and manager training access scripts.')
