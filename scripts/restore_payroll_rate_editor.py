from pathlib import Path

path = Path('bookkeeper-payroll.js')
text = path.read_text(encoding='utf-8')

click_anchor = """            } else if (button.dataset.action === 'view-staff') {
"""
click_replacement = """            } else if (button.dataset.action === 'save-rate') {
                const entry = findEntry(button.dataset.key);
                if (entry) saveHourlyRate(entry, button);
            } else if (button.dataset.action === 'view-staff') {
"""

style_anchor = """            .bk-check-column {
                width: 36px;
            }
"""
style_replacement = """            .bk-rate-editor {
                display: grid;
                gap: 7px;
                min-width: 190px;
            }
            .bk-rate-hours {
                color: #d9cfdf;
                font-size: 12px;
                font-weight: 800;
            }
            .bk-rate-controls {
                display: grid;
                grid-template-columns: minmax(88px, 1fr) auto;
                gap: 7px;
                align-items: center;
            }
            .bk-rate-input-wrap {
                display: flex;
                align-items: center;
                min-height: 38px;
                overflow: hidden;
                border: 1px solid rgba(255,255,255,.16);
                border-radius: 8px;
                background: rgba(7,5,11,.64);
            }
            .bk-rate-input-wrap span {
                padding-left: 10px;
                color: #a99bb5;
                font-weight: 800;
            }
            .bk-rate-input {
                width: 100%;
                min-width: 70px;
                min-height: 36px;
                padding: 0 9px 0 4px;
                border: 0 !important;
                outline: 0;
                background: transparent !important;
                color: #fff;
                font-weight: 800;
            }
            .bk-save-rate {
                min-height: 38px;
                padding: 7px 11px;
                border-radius: 8px;
                white-space: nowrap;
            }
            .bk-rate-readonly {
                display: grid;
                gap: 4px;
                min-width: 150px;
                color: #eee8f2;
                font-weight: 800;
            }
            .bk-rate-readonly small {
                color: #998da3;
                font-weight: 700;
            }
            .bk-check-column {
                width: 36px;
            }
"""

render_anchor = """    function renderEntryRows(entries) {
"""
render_replacement = """    function renderRateEditor(entry, finalized) {
        const supportsHourlyRate = ['manager_hours', 'equipment_hours'].includes(entry.sourceType) && entry.hours > 0;
        if (!supportsHourlyRate) return '-';

        if (finalized) {
            return `
                <div class="bk-rate-readonly">
                    <span>${entry.hours.toFixed(2)} hours</span>
                    <small>${entry.rate ? `${formatMoney(entry.rate)} per hour` : 'Hourly rate missing'}</small>
                </div>
            `;
        }

        const key = entryKey(entry);
        const currentRate = entry.rate > 0 ? entry.rate.toFixed(2) : '';
        return `
            <div class="bk-rate-editor">
                <div class="bk-rate-hours">${entry.hours.toFixed(2)} hours worked</div>
                <div class="bk-rate-controls">
                    <label class="bk-rate-input-wrap" aria-label="Hourly rate for ${escapeHtml(entry.staffName)}">
                        <span>$</span>
                        <input
                            type="number"
                            class="bk-rate-input"
                            data-key="${escapeHtml(key)}"
                            value="${escapeHtml(currentRate)}"
                            min="0"
                            step="0.01"
                            inputmode="decimal"
                            placeholder="0.00"
                        >
                    </label>
                    <button type="button" class="bk-save-rate" data-action="save-rate" data-key="${escapeHtml(key)}">Save Rate</button>
                </div>
            </div>
        `;
    }

    function renderEntryRows(entries) {
"""

rate_text_anchor = """            const rateText = entry.hours
                ? `${entry.hours.toFixed(2)} hrs${entry.rate ? ` @ ${formatMoney(entry.rate)}` : ' • rate missing'}`
                : '-';
            const statusClass = String(entry.status).toLowerCase();
"""
rate_text_replacement = """            const rateEditor = renderRateEditor(entry, finalized);
            const statusClass = String(entry.status).toLowerCase();
"""

rate_cell_anchor = """                    <td>${escapeHtml(rateText)}</td>
"""
rate_cell_replacement = """                    <td>${rateEditor}</td>
"""

save_anchor = """    function selectedEntryObjects() {
"""
save_replacement = """    async function saveHourlyRate(entry, button) {
        if (!['manager_hours', 'equipment_hours'].includes(entry.sourceType)) {
            notifyError('Hourly rates can only be edited for management or equipment hours.');
            return;
        }

        if (selectedPeriod()?.status === 'finalized') {
            notifyError('This payroll period is finalized. Reopen it before changing an hourly rate.');
            return;
        }

        const editor = button.closest('.bk-rate-editor');
        const input = editor?.querySelector('.bk-rate-input');
        const rate = Number(input?.value);

        if (!Number.isFinite(rate) || rate < 0) {
            notifyError('Enter a valid hourly rate of zero or more.');
            input?.focus();
            return;
        }

        const client = getClient();
        const table = SOURCE_TABLES[entry.sourceType];
        if (!client || !table) {
            notifyError('Payroll data is not available. Refresh and try again.');
            return;
        }

        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Saving...';
        if (input) input.disabled = true;

        try {
            const { error } = await client
                .from(table)
                .update({ hourly_rate: rate })
                .eq('id', entry.sourceId);

            if (error) throw error;

            await refreshApplicationData();
            notifySuccess(`Hourly rate saved at ${formatMoney(rate)} per hour. Payroll totals were recalculated.`);
        } catch (error) {
            console.error('Hourly rate update failed:', error);
            notifyError('Could not save the hourly rate: ' + (error.message || String(error)));
        } finally {
            if (button.isConnected) {
                button.disabled = false;
                button.textContent = originalText;
            }
            if (input?.isConnected) input.disabled = false;
        }
    }

    function selectedEntryObjects() {
"""

replacements = [
    (click_anchor, click_replacement, 'rate action handler'),
    (style_anchor, style_replacement, 'rate editor styles'),
    (render_anchor, render_replacement, 'rate editor renderer'),
    (rate_text_anchor, rate_text_replacement, 'rate display calculation'),
    (rate_cell_anchor, rate_cell_replacement, 'rate editor cell'),
    (save_anchor, save_replacement, 'rate save function'),
]

for anchor, replacement, label in replacements:
    count = text.count(anchor)
    if count != 1:
        raise RuntimeError(f'Expected exactly one {label} anchor, found {count}.')
    text = text.replace(anchor, replacement, 1)

path.write_text(text, encoding='utf-8')
print('Restored inline hourly-rate editing in the bookkeeper payroll workspace.')
