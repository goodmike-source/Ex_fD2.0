// ================================================================
//  КЛЮЧИ ДЛЯ ХРАНЕНИЯ
// ================================================================
const KEYS = {
    EMPLOYEES: 'app_employees',
    POSITIONS: 'app_positions',
    SHIFTS: 'app_shifts',
    MONTHLY_SCHEDULES: 'app_monthly_schedules'
};

// ================================================================
//  СОСТОЯНИЕ
// ================================================================
let employees = [];
let positions = {};
let shifts = {};
let monthlySchedules = {};
let currentScheduleKey = null;
let editingScheduleCell = null;
let editingScheduleColors = null;
let selectedScheduleCells = new Set();
let scheduleSelectionAnchor = null;
let scheduleDragAnchor = null;
let scheduleSelectionBase = new Set();
let isScheduleCellSelecting = false;
let currentShiftId = null;
let currentSort = { field: 'name', direction: 'asc' };
let currentFilters = { time: '', position: '', status: '' };
let sortableInstance = null;
let quickSearchTimeout = null;

// ================================================================
//  ИНИЦИАЛИЗАЦИЯ
// ================================================================
function init() {
    loadData();

    const today = toLocalISODate();
    document.getElementById('shiftDate').value = today;
    const dashboardDateText = document.getElementById('dashboardDateText');
    if (dashboardDateText) {
        const now = new Date();
        const formatted = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
        dashboardDateText.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1) + ' · план и фактическое присутствие';
    }

    populatePositionSelects();
    renderEmployees();
    renderPositions();
    renderShiftsList();
    renderRecentShifts();
    updateStats();
    updateNavBadges();
    initScheduleUI();
    renderDashboardScheduleSummary();

    const shiftIds = Object.keys(shifts);
    if (shiftIds.length > 0) {
        currentShiftId = shifts[today+'_По графику'] ? today+'_По графику' : (shiftIds.find(id => shifts[id].date === today) || shiftIds.sort((a,b)=>shifts[b].date.localeCompare(shifts[a].date))[0]);
        renderShift();
        renderShiftDisplay();
    }

    // Theme
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    if (localStorage.getItem('app_theme') === 'dark') {
        document.body.classList.add('dark');
    }

    // Navigation
    document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Employees
    document.getElementById('addEmployeeForm').addEventListener('submit', addEmployee);
    document.getElementById('empSearch').addEventListener('input', renderEmployees);
    document.getElementById('empFilterPosition').addEventListener('change', renderEmployees);

    // Positions
    document.getElementById('addPositionBtn').addEventListener('click', addPosition);

    // Monthly schedule
    const scheduleImportBtn = document.getElementById('scheduleImportBtn');
    if (scheduleImportBtn) scheduleImportBtn.addEventListener('click', importMonthlySchedule);
    const scheduleMonthSelect = document.getElementById('scheduleMonthSelect');
    if (scheduleMonthSelect) scheduleMonthSelect.addEventListener('change', () => selectScheduleMonth(scheduleMonthSelect.value));
    const scheduleDeleteMonthBtn = document.getElementById('scheduleDeleteMonthBtn');
    if (scheduleDeleteMonthBtn) scheduleDeleteMonthBtn.addEventListener('click', deleteScheduleMonth);
    const scheduleDate = document.getElementById('scheduleDate');
    if (scheduleDate) scheduleDate.addEventListener('change', renderScheduleDay);
    const scheduleTodayBtn = document.getElementById('scheduleTodayBtn');
    if (scheduleTodayBtn) scheduleTodayBtn.addEventListener('click', selectTodayInSchedule);
    const scheduleSearch = document.getElementById('scheduleSearch');
    if (scheduleSearch) scheduleSearch.addEventListener('input', renderScheduleDay);
    const schedulePositionFilter = document.getElementById('schedulePositionFilter');
    if (schedulePositionFilter) schedulePositionFilter.addEventListener('change', renderScheduleDay);
    const scheduleStatusFilter = document.getElementById('scheduleStatusFilter');
    if (scheduleStatusFilter) scheduleStatusFilter.addEventListener('change', renderScheduleDay);
    const scheduleCreateShiftBtn = document.getElementById('scheduleCreateShiftBtn');
    if (scheduleCreateShiftBtn) scheduleCreateShiftBtn.addEventListener('click', createShiftFromSchedule);
    const scheduleExportBtn = document.getElementById('scheduleExportBtn');
    if (scheduleExportBtn) scheduleExportBtn.addEventListener('click', exportScheduleDay);
    const schedulePrintBtn = document.getElementById('schedulePrintBtn');
    if (schedulePrintBtn) schedulePrintBtn.addEventListener('click', printScheduleDay);
    const scheduleCreateManualBtn = document.getElementById('scheduleCreateManualBtn');
    if (scheduleCreateManualBtn) scheduleCreateManualBtn.addEventListener('click', createManualSchedule);
    const scheduleSyncEmployeesBtn = document.getElementById('scheduleSyncEmployeesBtn');
    if (scheduleSyncEmployeesBtn) scheduleSyncEmployeesBtn.addEventListener('click', syncCurrentScheduleEmployees);
    const scheduleCellCloseModal = document.getElementById('scheduleCellCloseModal');
    if (scheduleCellCloseModal) scheduleCellCloseModal.addEventListener('click', closeScheduleCellEditor);
    const scheduleCellClearBtn = document.getElementById('scheduleCellClearBtn');
    if (scheduleCellClearBtn) scheduleCellClearBtn.addEventListener('click', clearEditingScheduleCell);
    const scheduleCustomApplyBtn = document.getElementById('scheduleCustomApplyBtn');
    if (scheduleCustomApplyBtn) scheduleCustomApplyBtn.addEventListener('click', applyCustomScheduleTime);
    const scheduleCellModal = document.getElementById('scheduleCellModal');
    if (scheduleCellModal) scheduleCellModal.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeScheduleCellEditor();
    });

    const scheduleBulkApplyShiftBtn = document.getElementById('scheduleBulkApplyShiftBtn');
    if (scheduleBulkApplyShiftBtn) scheduleBulkApplyShiftBtn.addEventListener('click', () => {
        const value = document.getElementById('scheduleBulkShiftSelect')?.value || '';
        if (!value) { showToast('Выберите смену', 'warning'); return; }
        applyScheduleSelectionWork(value);
    });
    const scheduleBulkOffBtn = document.getElementById('scheduleBulkOffBtn');
    if (scheduleBulkOffBtn) scheduleBulkOffBtn.addEventListener('click', () => applyScheduleSelectionAbsence('В'));
    const scheduleBulkVacationBtn = document.getElementById('scheduleBulkVacationBtn');
    if (scheduleBulkVacationBtn) scheduleBulkVacationBtn.addEventListener('click', () => applyScheduleSelectionAbsence('ОТ'));
    const scheduleBulkSickBtn = document.getElementById('scheduleBulkSickBtn');
    if (scheduleBulkSickBtn) scheduleBulkSickBtn.addEventListener('click', () => applyScheduleSelectionAbsence('Б'));
    const scheduleBulkMoreBtn = document.getElementById('scheduleBulkMoreBtn');
    if (scheduleBulkMoreBtn) scheduleBulkMoreBtn.addEventListener('click', openSelectedScheduleCellsEditor);
    const scheduleBulkClearBtn = document.getElementById('scheduleBulkClearBtn');
    if (scheduleBulkClearBtn) scheduleBulkClearBtn.addEventListener('click', clearSelectedScheduleCells);
    const scheduleClearSelectionBtn = document.getElementById('scheduleClearSelectionBtn');
    if (scheduleClearSelectionBtn) scheduleClearSelectionBtn.addEventListener('click', clearScheduleCellSelection);
    const scheduleEditColorsBtn = document.getElementById('scheduleEditColorsBtn');
    if (scheduleEditColorsBtn) scheduleEditColorsBtn.addEventListener('click', openScheduleColorsEditor);
    const scheduleColorsCloseModal = document.getElementById('scheduleColorsCloseModal');
    if (scheduleColorsCloseModal) scheduleColorsCloseModal.addEventListener('click', closeScheduleColorsEditor);
    const scheduleColorsApplyBtn = document.getElementById('scheduleColorsApplyBtn');
    if (scheduleColorsApplyBtn) scheduleColorsApplyBtn.addEventListener('click', applyScheduleColorsEditor);
    const scheduleColorsResetBtn = document.getElementById('scheduleColorsResetBtn');
    if (scheduleColorsResetBtn) scheduleColorsResetBtn.addEventListener('click', resetScheduleColorsEditor);
    const scheduleColorsModal = document.getElementById('scheduleColorsModal');
    if (scheduleColorsModal) scheduleColorsModal.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeScheduleColorsEditor();
    });
    document.addEventListener('mouseup', finishScheduleCellSelection);

    // Shifts
    document.getElementById('createShiftBtn').addEventListener('click', createShift);
    document.getElementById('openAddModalBtn').addEventListener('click', openAddModal);
    document.getElementById('clearShiftBtn').addEventListener('click', clearShift);
    document.getElementById('deleteShiftBtn').addEventListener('click', deleteShift);
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('addSelectedBtn').addEventListener('click', addSelectedToShift);
    document.getElementById('selectAllBtn').addEventListener('click', selectAllInModal);
    document.getElementById('modalSearch').addEventListener('input', renderModalList);
    document.getElementById('modalFilterPosition').addEventListener('change', renderModalList);
    document.getElementById('copyShiftBtn').addEventListener('click', copyShift);

    // Export
    document.getElementById('exportExcelBtn').addEventListener('click', exportExcel);
    document.getElementById('printShiftBtn').addEventListener('click', printShift);

    // Backup
    document.getElementById('backupDownloadBtn').addEventListener('click', downloadBackup);
    document.getElementById('backupRestoreBtn').addEventListener('click', restoreBackup);
    document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);
    document.getElementById('exportJsonBtn').addEventListener('click', exportJson);

    // Modal close on outside click
    document.getElementById('addModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        const target = e.target;
        const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
        if (e.key === 'Escape') {
            closeModal();
            closeScheduleCellEditor();
            if (selectedScheduleCells.size) clearScheduleCellSelection();
        }
        if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && selectedScheduleCells.size && document.getElementById('tab-schedule')?.classList.contains('active')) {
            e.preventDefault();
            clearSelectedScheduleCells();
        }
    });

    // Init filters
    initShiftFilters();
    initQuickAdd();

    console.log('✅ Evacuation Control Center loaded');
}

// ================================================================
//  ЗАГРУЗКА / СОХРАНЕНИЕ
// ================================================================
function loadData() {
    try {
        employees = JSON.parse(localStorage.getItem(KEYS.EMPLOYEES)) || [];
        positions = JSON.parse(localStorage.getItem(KEYS.POSITIONS)) || {};
        shifts = JSON.parse(localStorage.getItem(KEYS.SHIFTS)) || {};
        monthlySchedules = JSON.parse(localStorage.getItem(KEYS.MONTHLY_SCHEDULES)) || {};
    } catch {
        employees = [];
        positions = {};
        shifts = {};
        monthlySchedules = {};
    }
}

function saveData() {
    localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(employees));
    localStorage.setItem(KEYS.POSITIONS, JSON.stringify(positions));
    localStorage.setItem(KEYS.SHIFTS, JSON.stringify(shifts));
    localStorage.setItem(KEYS.MONTHLY_SCHEDULES, JSON.stringify(monthlySchedules));
    updateStats();
    updateNavBadges();
}

// ================================================================
//  ТЕМА
// ================================================================
function toggleTheme() {
    document.body.classList.toggle('dark');
    localStorage.setItem('app_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
}

// ================================================================
//  НАВИГАЦИЯ
// ================================================================
function switchTab(tab) {
    document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab').forEach(el => {
        el.classList.toggle('active', el.id === 'tab-' + tab);
    });

    if (tab === 'employees') renderEmployees();
    if (tab === 'positions') renderPositions();
    if (tab === 'schedule') renderScheduleTab();
    if (tab === 'shifts') {
        renderShiftsList();
        if (currentShiftId && shifts[currentShiftId]) {
            renderShift();
            renderShiftDisplay();
        }
        setTimeout(initSortable, 300);
    }
    if (tab === 'dashboard') {
        renderRecentShifts();
        updateStats();
        renderDashboardScheduleSummary();
    }
}

// ================================================================
//  ВСПОМОГАТЕЛЬНЫЕ
// ================================================================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
}

function getEmployeeById(id) {
    return employees.find(e => e.id === id);
}

function getRelativesString(empId) {
    const emp = getEmployeeById(empId);
    if (!emp || !emp.relatives || emp.relatives.length === 0) return '';
    return emp.relatives.map(r => `${r.name} (${r.phone})`).join('; ');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showToast(text, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.className = 'toast ' + type;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 3000);
}

function getSchedulesForPosition(position) {
    return positions[position] || [];
}

function updateNavBadges() {
    const empCount = document.getElementById('navEmployeeCount');
    const shiftCount = document.getElementById('navShiftCount');
    const scheduleCount = document.getElementById('navScheduleCount');
    if (empCount) empCount.textContent = employees.length;
    if (shiftCount) shiftCount.textContent = Object.keys(shifts).length;
    if (scheduleCount) scheduleCount.textContent = Object.keys(monthlySchedules).length;
    const total = document.getElementById('employeeTotalCount');
    if (total) total.textContent = employees.length + ' чел.';
}

// ================================================================
//  ПОЗИЦИИ
// ================================================================
function populatePositionSelects() {
    const selects = ['empPosition', 'empFilterPosition', 'modalFilterPosition'];
    selects.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const current = select.value;
        select.innerHTML = '<option value="">-- Без должности --</option>';
        Object.keys(positions).sort().forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        });
        if (current && positions[current]) select.value = current;
    });
}

function addPosition() {
    const name = document.getElementById('posName').value.trim();
    const schedules = document.getElementById('posSchedules').value.trim();

    if (!name) { showToast('Введите название должности!', 'warning'); return; }
    if (positions[name]) { showToast('Такая должность уже существует', 'warning'); return; }

    const scheduleList = schedules ? schedules.split(',').map(s => s.trim()).filter(s => s) : [];
    positions[name] = scheduleList;
    saveData();

    document.getElementById('posName').value = '';
    document.getElementById('posSchedules').value = '';

    populatePositionSelects();
    renderPositions();
    showToast(`✅ Должность "${name}" добавлена`, 'success');
}

function deletePosition(name) {
    if (!confirm(`Удалить должность "${name}"?`)) return;
    delete positions[name];
    saveData();
    populatePositionSelects();
    renderPositions();
    showToast('🗑 Должность удалена', 'error');
}

function renderPositions() {
    const container = document.getElementById('positionList');
    const names = Object.keys(positions);

    if (names.length === 0) {
        container.innerHTML = '<div class="empty-text">Нет добавленных должностей</div>';
        return;
    }

    container.innerHTML = names.sort().map(name => `
        <div class="position-card">
            <div class="pos-name">${escapeHtml(name)}</div>
            <div class="pos-schedules">${positions[name].length > 0 ? positions[name].join(' • ') : 'Нет графиков'}</div>
            <div class="pos-actions">
                <button onclick="deletePosition('${name}')" title="Удалить"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

// ================================================================
//  СОТРУДНИКИ
// ================================================================
function addEmployee(e) {
    e.preventDefault();

    const fullName = document.getElementById('empName').value.trim();
    const position = document.getElementById('empPosition').value;
    const phone = document.getElementById('empPhone').value.trim();
    const relName = document.getElementById('empRelName').value.trim();
    const relPhone = document.getElementById('empRelPhone').value.trim();

    if (!fullName || !phone) {
        showToast('Заполните ФИО и телефон!', 'error');
        return;
    }

    if (employees.find(e => e.fullName === fullName && e.phone === phone)) {
        showToast('Такой сотрудник уже есть', 'warning');
        return;
    }

    const newEmployee = {
        id: generateId(),
        fullName,
        position: position || '',
        phone,
        relatives: []
    };

    if (relName && relPhone) {
        newEmployee.relatives.push({ name: relName, phone: relPhone });
    }

    employees.push(newEmployee);
    saveData();

    document.getElementById('empName').value = '';
    document.getElementById('empPhone').value = '';
    document.getElementById('empRelName').value = '';
    document.getElementById('empRelPhone').value = '';

    renderEmployees();
    showToast('✅ Сотрудник добавлен', 'success');
}

function deleteEmployee(id) {
    let inUse = false;
    Object.keys(shifts).forEach(key => {
        if (shifts[key].people.find(p => p.id === id)) inUse = true;
    });

    if (inUse) {
        if (!confirm('Сотрудник используется в сменах. Удалить из базы и из всех смен?')) return;
        Object.keys(shifts).forEach(key => {
            shifts[key].people = shifts[key].people.filter(p => p.id !== id);
        });
    } else {
        if (!confirm('Удалить сотрудника из базы?')) return;
    }

    employees = employees.filter(e => e.id !== id);
    saveData();

    renderEmployees();
    renderShift();
    renderShiftsList();
    showToast('🗑 Сотрудник удалён', 'error');
}

function renderEmployees() {
    const search = document.getElementById('empSearch').value.toLowerCase().trim();
    const filterPos = document.getElementById('empFilterPosition').value;

    let filtered = employees;
    if (search) {
        filtered = filtered.filter(e =>
            e.fullName.toLowerCase().includes(search) ||
            e.phone.includes(search) ||
            (e.position && e.position.toLowerCase().includes(search))
        );
    }
    if (filterPos) {
        filtered = filtered.filter(e => e.position === filterPos);
    }

    const container = document.getElementById('employeeList');

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-text">Нет сотрудников</div>';
        return;
    }

    container.innerHTML = filtered.map(e => `
        <div class="employee-card">
            <div class="info">
                <div class="name">${escapeHtml(e.fullName)}</div>
                <div class="details">${escapeHtml(e.position || 'Без должности')} — ${escapeHtml(e.phone)}</div>
                ${e.relatives.length > 0 ? `<div class="relatives">👤 ${e.relatives.map(r => escapeHtml(r.name) + ' (' + escapeHtml(r.phone) + ')').join('; ')}</div>` : ''}
            </div>
            <div class="actions">
                <button class="edit-btn" onclick="editEmployee('${e.id}')" title="Редактировать"><i class="fa-solid fa-pen"></i></button>
                <button class="delete-btn" onclick="deleteEmployee('${e.id}')" title="Удалить"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function editEmployee(id) {
    const emp = getEmployeeById(id);
    if (!emp) return;

    document.getElementById('empName').value = emp.fullName;
    document.getElementById('empPosition').value = emp.position || '';
    document.getElementById('empPhone').value = emp.phone;
    document.getElementById('empRelName').value = emp.relatives.length > 0 ? emp.relatives[0].name : '';
    document.getElementById('empRelPhone').value = emp.relatives.length > 0 ? emp.relatives[0].phone : '';

    employees = employees.filter(e => e.id !== id);
    saveData();
    renderEmployees();

    document.getElementById('empName').focus();
    showToast('✏️ Редактируйте и нажмите "Добавить"', 'info');
}

// ================================================================
//  СМЕНЫ
// ================================================================
function createShift() {
    const date = document.getElementById('shiftDate').value;
    const name = document.getElementById('shiftName').value.trim() || 'Основная';

    if (!date) { showToast('Выберите дату!', 'warning'); return; }

    const shiftId = date + '_' + name;
    if (shifts[shiftId]) { showToast('Такая смена уже существует', 'warning'); return; }

    shifts[shiftId] = { id: shiftId, date, name, people: [] };
    saveData();
    currentShiftId = shiftId;
    resetFilters();

    renderShiftsList();
    renderShift();
    renderShiftDisplay();
    populateCopyFromSelect();
    showToast('✅ Смена создана', 'success');
}

function loadShift(id) {
    if (!shifts[id]) return;
    currentShiftId = id;
    resetFilters();
    renderShift();
    renderShiftDisplay();
    renderShiftsList();
    populateCopyFromSelect();
    setTimeout(initSortable, 300);
}

function renderShiftsList() {
    const container = document.getElementById('shiftsList');
    const ids = Object.keys(shifts);

    if (ids.length === 0) {
        container.innerHTML = '<span class="empty-text">Нет смен</span>';
        return;
    }

    ids.sort((a, b) => (shifts[b].date || '').localeCompare(shifts[a].date || ''));

    container.innerHTML = ids.map(id => {
        const s = shifts[id];
        const isActive = id === currentShiftId;
        return `<div class="shift-tab ${isActive ? 'active' : ''}" onclick="loadShift('${id}')">
            <span>📅 ${s.date}</span>
            <span>${s.name}</span>
            <span class="count">${s.people.length}</span>
        </div>`;
    }).join('');
}

function renderShiftDisplay() {
    const el = document.getElementById('shiftDisplay');
    if (!currentShiftId || !shifts[currentShiftId]) {
        el.innerHTML = '<span class="shift-placeholder">Выберите смену</span>';
        return;
    }
    const s = shifts[currentShiftId];
    el.innerHTML = `
        <span class="date">📅 ${s.date}</span>
        <span class="name">${s.name}</span>
        <span style="color:var(--text-secondary);font-weight:400;">— ${s.people.length} чел.</span>
    `;
    document.getElementById('shiftPeopleCount').textContent = s.people.length + ' чел.';
}

// ================================================================
//  RENDER SHIFT
// ================================================================
function renderShift() {
    const body = document.getElementById('shiftBody');

    if (!currentShiftId || !shifts[currentShiftId]) {
        body.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">Нет активной смены</td></tr>`;
        return;
    }

    const people = getFilteredAndSortedPeople();

    if (people.length === 0) {
        const hasFilters = Object.values(currentFilters).some(v => v !== '');
        const msg = hasFilters ? 'Нет сотрудников, соответствующих фильтрам' : 'Нет сотрудников. Нажмите "Добавить сотрудников"';
        body.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">${msg}</td></tr>`;
        updateFilteredCount();
        return;
    }

    populateTimeFilter();
    populatePositionFilterForShifts();

    body.innerHTML = people.map((p, i) => {
        const rels = getRelativesString(p.id);
        const configured = getSchedulesForPosition(p.position);
        const schedules = configured.length && p.time && !configured.includes(p.time) ? [p.time, ...configured] : configured;
        const timeOptions = schedules.length > 0 ?
            schedules.map(t => `<option value="${t}" ${p.time === t ? 'selected' : ''}>${t}</option>`).join('') : '';

        return `<tr class="${p.present ? 'present' : 'absent'}" data-id="${p.id}">
            <td>${i + 1}</td>
            <td><strong>${escapeHtml(p.fullName)}</strong></td>
            <td>${escapeHtml(p.position || '-')}</td>
            <td><a href="tel:${p.phone}" class="phone-link">${escapeHtml(p.phone)}</a></td>
            <td class="relatives-cell">${rels || '-'}</td>
            <td>
                ${schedules.length > 0 ?
                    `<select class="time-input" onchange="updateShiftTime('${p.id}', this.value)">
                        <option value="">-- Выберите --</option>
                        ${timeOptions}
                    </select>` :
                    `<input type="text" class="time-input" value="${p.time || ''}" placeholder="08:00-20:00" onchange="updateShiftTime('${p.id}', this.value)">`
                }
            </td>
            <td>
                <button class="status-btn ${p.present ? 'present' : 'absent'} small" onclick="togglePresent('${p.id}')">
                    ${p.present ? '✅ На месте' : p.reviewed === false ? 'Не отмечен' : '❌ Отсутствует'}
                </button>
            </td>
            <td>
                <span class="remove-from-shift" onclick="removeFromShift('${p.id}')" title="Убрать">&times;</span>
            </td>
        </tr>`;
    }).join('');

    updateFilteredCount();
    document.getElementById('shiftPeopleCount').textContent = shifts[currentShiftId].people.length + ' чел.';
    setTimeout(initSortable, 100);
}

// ================================================================
//  ФИЛЬТРЫ И СОРТИРОВКА
// ================================================================
function getFilteredAndSortedPeople() {
    if (!currentShiftId || !shifts[currentShiftId]) return [];

    let people = [...shifts[currentShiftId].people];
    const { time, position, status } = currentFilters;

    if (time) people = people.filter(p => p.time === time);
    if (position) people = people.filter(p => p.position === position);
    if (status) {
        people = people.filter(p => status === 'present' ? p.present : !p.present);
    }

    const { field, direction } = currentSort;
    const multiplier = direction === 'asc' ? 1 : -1;

    people.sort((a, b) => {
        let valA, valB;
        switch(field) {
            case 'name': valA = a.fullName || ''; valB = b.fullName || ''; break;
            case 'position': valA = a.position || ''; valB = b.position || ''; break;
            case 'time': valA = a.time || ''; valB = b.time || ''; break;
            case 'status': valA = a.present ? 1 : 0; valB = b.present ? 1 : 0; break;
            default: valA = a.fullName || ''; valB = b.fullName || '';
        }
        if (valA < valB) return -1 * multiplier;
        if (valA > valB) return 1 * multiplier;
        return 0;
    });

    return people;
}

function updateFilteredCount() {
    const countEl = document.getElementById('filteredCount');
    if (!countEl) return;
    if (!currentShiftId || !shifts[currentShiftId]) {
        countEl.textContent = 'Нет смены';
        return;
    }
    const people = getFilteredAndSortedPeople();
    const total = shifts[currentShiftId].people.length;
    countEl.textContent = `Показано: ${people.length} из ${total}`;
}

function resetFilters() {
    currentFilters = { time: '', position: '', status: '' };
    document.getElementById('filterTime').value = '';
    document.getElementById('filterPosition').value = '';
    document.getElementById('filterStatus').value = '';
    currentSort = { field: 'name', direction: 'asc' };
    document.getElementById('sortBy').value = 'name';
    document.getElementById('sortDirectionBtn').classList.remove('desc');
    document.querySelectorAll('.shift-table th.sortable').forEach(h => h.classList.remove('active', 'asc', 'desc'));
    const nameHeader = document.querySelector('.shift-table th.sortable[data-sort="name"]');
    if (nameHeader) nameHeader.classList.add('active', 'asc');
    renderShift();
}

// ================================================================
//  ИНИЦИАЛИЗАЦИЯ ФИЛЬТРОВ
// ================================================================
function initShiftFilters() {
    populateTimeFilter();
    populatePositionFilterForShifts();
    populateCopyFromSelect();

    ['filterTime', 'filterPosition', 'filterStatus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', function() {
                const key = id.replace('filter', '').toLowerCase();
                currentFilters[key] = this.value;
                renderShift();
            });
        }
    });

    document.getElementById('sortBy').addEventListener('change', function() {
        currentSort.field = this.value;
        renderShift();
    });

    document.getElementById('sortDirectionBtn').addEventListener('click', function() {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        this.classList.toggle('desc');
        renderShift();
    });

    document.querySelectorAll('.shift-table th.sortable').forEach(th => {
        th.addEventListener('click', function() {
            const field = this.dataset.sort;
            if (field === 'index') return;

            if (currentSort.field === field) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.field = field;
                currentSort.direction = 'asc';
            }

            document.querySelectorAll('.shift-table th.sortable').forEach(h => h.classList.remove('active', 'asc', 'desc'));
            this.classList.add('active', currentSort.direction);
            document.getElementById('sortBy').value = field;

            renderShift();
        });
    });

    document.getElementById('resetFiltersBtn').addEventListener('click', function() {
        resetFilters();
        showToast('Фильтры сброшены', 'info');
    });
}

function populateTimeFilter() {
    const select = document.getElementById('filterTime');
    if (!select) return;
    const times = new Set();
    if (currentShiftId && shifts[currentShiftId]) {
        shifts[currentShiftId].people.forEach(p => { if (p.time) times.add(p.time); });
    }
    const currentValue = select.value;
    select.innerHTML = '<option value="">Все время</option>';
    [...times].sort().forEach(time => {
        const opt = document.createElement('option');
        opt.value = time;
        opt.textContent = time;
        select.appendChild(opt);
    });
    if (currentValue && times.has(currentValue)) select.value = currentValue;
}

function populatePositionFilterForShifts() {
    const select = document.getElementById('filterPosition');
    if (!select) return;
    const posSet = new Set();
    if (currentShiftId && shifts[currentShiftId]) {
        shifts[currentShiftId].people.forEach(p => { if (p.position) posSet.add(p.position); });
    }
    const currentValue = select.value;
    select.innerHTML = '<option value="">Все должности</option>';
    [...posSet].sort().forEach(pos => {
        const opt = document.createElement('option');
        opt.value = pos;
        opt.textContent = pos;
        select.appendChild(opt);
    });
    if (currentValue && posSet.has(currentValue)) select.value = currentValue;
}

function populateCopyFromSelect() {
    const select = document.getElementById('copyFromShift');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">-- Выберите смену для копирования --</option>';
    const ids = Object.keys(shifts).filter(id => id !== currentShiftId);
    ids.sort((a, b) => (shifts[b].date || '').localeCompare(shifts[a].date || ''));
    ids.forEach(id => {
        const s = shifts[id];
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${s.date} — ${s.name} (${s.people.length} чел.)`;
        select.appendChild(opt);
    });
    if (currentValue && shifts[currentValue]) select.value = currentValue;
}

function copyShift() {
    const select = document.getElementById('copyFromShift');
    const sourceId = select.value;
    if (!sourceId) { showToast('Выберите смену для копирования!', 'warning'); return; }
    if (!currentShiftId || !shifts[currentShiftId]) { showToast('Сначала создайте целевую смену!', 'warning'); return; }

    const sourceShift = shifts[sourceId];
    const targetShift = shifts[currentShiftId];

    if (targetShift.people.length > 0 && !confirm('В текущей смене уже есть сотрудники. Заменить их?')) return;

    targetShift.people = [];
    let copied = 0;
    sourceShift.people.forEach(sourcePerson => {
        const emp = getEmployeeById(sourcePerson.id);
        if (emp) {
            targetShift.people.push({
                id: emp.id,
                fullName: emp.fullName,
                position: emp.position || '',
                phone: emp.phone,
                time: sourcePerson.time || '',
                present: false
            });
            copied++;
        }
    });

    saveData();
    renderShift();
    renderShiftsList();
    renderShiftDisplay();
    populateCopyFromSelect();
    populateTimeFilter();
    populatePositionFilterForShifts();
    showToast(`✅ Скопировано ${copied} сотрудников`, 'success');
}

// ================================================================
//  УПРАВЛЕНИЕ СОТРУДНИКАМИ В СМЕНЕ
// ================================================================
function updateShiftTime(id, value) {
    if (!currentShiftId || !shifts[currentShiftId]) return;
    const person = shifts[currentShiftId].people.find(p => p.id === id);
    if (person) { person.time = value; saveData(); populateTimeFilter(); }
}

function togglePresent(id) {
    if (!currentShiftId || !shifts[currentShiftId]) return;
    const person = shifts[currentShiftId].people.find(p => p.id === id);
    if (person) { person.present = !person.present; person.reviewed = true; saveData(); renderShift(); updateStats(); }
}

function removeFromShift(id) {
    if (!currentShiftId || !shifts[currentShiftId]) return;
    shifts[currentShiftId].people = shifts[currentShiftId].people.filter(p => p.id !== id);
    saveData();
    renderShift();
    renderShiftsList();
    populateTimeFilter();
    populatePositionFilterForShifts();
    showToast('Удалён из смены', 'warning');
}

function clearShift() {
    if (!currentShiftId || !shifts[currentShiftId]) { showToast('Нет активной смены', 'warning'); return; }
    if (!confirm('Очистить смену?')) return;
    shifts[currentShiftId].people = [];
    saveData();
    renderShift();
    renderShiftsList();
    populateTimeFilter();
    populatePositionFilterForShifts();
    showToast('🗑 Смена очищена', 'warning');
}

function deleteShift() {
    if (!currentShiftId || !shifts[currentShiftId]) { showToast('Нет активной смены', 'warning'); return; }
    if (!confirm(`Удалить смену "${shifts[currentShiftId].name}"?`)) return;
    delete shifts[currentShiftId];
    const ids = Object.keys(shifts);
    currentShiftId = ids.length > 0 ? ids[0] : null;
    saveData();
    renderShiftsList();
    renderShift();
    renderShiftDisplay();
    populateCopyFromSelect();
    showToast('🗑 Смена удалена', 'error');
}

// ================================================================
//  SORTABLE (DRAG & DROP)
// ================================================================
function initSortable() {
    const tbody = document.getElementById('shiftBody');
    if (!tbody || typeof Sortable === 'undefined') return;
    if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null; }
    if (tbody.querySelectorAll('tr').length < 2) return;

    sortableInstance = new Sortable(tbody, {
        animation: 150,
        handle: 'tr',
        onEnd: function(evt) {
            if (!currentShiftId || !shifts[currentShiftId]) return;
            const people = shifts[currentShiftId].people;
            const [moved] = people.splice(evt.oldIndex, 1);
            people.splice(evt.newIndex, 0, moved);
            saveData();
            renderShift();
        }
    });
}

// ================================================================
//  БЫСТРЫЙ ПОИСК
// ================================================================
function initQuickAdd() {
    const input = document.getElementById('quickAddInput');
    const results = document.getElementById('quickAddResults');
    if (!input) return;

    input.addEventListener('input', function() {
        clearTimeout(quickSearchTimeout);
        const query = this.value.trim();
        if (query.length < 1) { results.classList.remove('show'); return; }
        quickSearchTimeout = setTimeout(() => searchAndShowResults(query), 200);
    });

    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const firstAddBtn = results.querySelector('.result-item:not(.already-added) .add-btn');
            if (firstAddBtn) firstAddBtn.click();
            this.value = '';
            results.classList.remove('show');
            this.focus();
        }
        if (e.key === 'Escape') { results.classList.remove('show'); this.blur(); }
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.quick-add-area')) results.classList.remove('show');
    });
}

function searchAndShowResults(query) {
    const results = document.getElementById('quickAddResults');
    if (!currentShiftId || !shifts[currentShiftId]) {
        results.innerHTML = `<div class="empty-result"><i class="fa-solid fa-calendar-xmark"></i>Сначала создайте смену</div>`;
        results.classList.add('show');
        return;
    }

    const inShift = shifts[currentShiftId].people.map(p => p.id);
    const searchLower = query.toLowerCase();
    const filtered = employees.filter(e =>
        e.fullName.toLowerCase().includes(searchLower) ||
        e.phone.includes(searchLower) ||
        (e.position && e.position.toLowerCase().includes(searchLower))
    ).slice(0, 8);

    if (filtered.length === 0) {
        results.innerHTML = `<div class="empty-result"><i class="fa-solid fa-user-slash"></i>Сотрудник не найден</div>`;
        results.classList.add('show');
        return;
    }

    results.innerHTML = filtered.map(e => {
        const already = inShift.includes(e.id);
        const relCount = e.relatives ? e.relatives.length : 0;
        const schedules = getSchedulesForPosition(e.position);

        let timeHtml = '';
        if (schedules.length > 0) {
            timeHtml = `<select class="quick-time-select" data-id="${e.id}">
                <option value="">-- Время --</option>
                ${schedules.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>`;
        } else {
            timeHtml = `<input type="text" class="quick-time-input" data-id="${e.id}" placeholder="08:00-20:00" style="width:100px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg);color:var(--text);">`;
        }

        const badge = relCount > 0 ? `<span class="badge">👤 ${relCount}</span>` : '';

        return `<div class="result-item ${already ? 'already-added' : ''}" data-id="${e.id}">
            <div class="info">
                <span class="name">${escapeHtml(e.fullName)} ${badge}</span>
                <span class="details">${escapeHtml(e.position || 'Без должности')} — ${escapeHtml(e.phone)}</span>
            </div>
            <div class="time-select-wrapper">
                ${timeHtml}
                <button class="add-btn" ${already ? 'disabled' : ''} data-id="${e.id}">
                    ${already ? '✅ В смене' : '➕ Добавить'}
                </button>
            </div>
        </div>`;
    }).join('');

    results.classList.add('show');

    results.querySelectorAll('.add-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.dataset.id;
            const item = this.closest('.result-item');
            const select = item.querySelector('.quick-time-select');
            const input = item.querySelector('.quick-time-input');
            let time = select ? select.value : (input ? input.value.trim() : '');
            addEmployeeToShiftFromQuick(id, time);
        });
    });
}

function addEmployeeToShiftFromQuick(id, time) {
    if (!currentShiftId || !shifts[currentShiftId]) { showToast('Нет активной смены!', 'error'); return; }
    const emp = getEmployeeById(id);
    if (!emp) { showToast('Сотрудник не найден!', 'error'); return; }
    if (shifts[currentShiftId].people.find(p => p.id === id)) { showToast('Сотрудник уже в смене', 'warning'); return; }

    shifts[currentShiftId].people.push({
        id: emp.id,
        fullName: emp.fullName,
        position: emp.position || '',
        phone: emp.phone,
        time: time || '',
        present: false
    });

    saveData();
    renderShift();
    renderShiftsList();
    populateTimeFilter();
    populatePositionFilterForShifts();

    document.getElementById('quickAddResults').classList.remove('show');
    document.getElementById('quickAddInput').value = '';
    document.getElementById('quickAddInput').focus();
    showToast(`✅ ${emp.fullName} добавлен${time ? ' (' + time + ')' : ''}`, 'success');
}

// ================================================================
//  МОДАЛКА
// ================================================================
function openAddModal() {
    if (employees.length === 0) { showToast('Сначала добавьте сотрудников в базу!', 'warning'); return; }
    if (!currentShiftId || !shifts[currentShiftId]) { showToast('Сначала создайте смену!', 'warning'); return; }

    populateModalFilter();
    document.getElementById('modalSearch').value = '';
    renderModalList();
    document.getElementById('addModal').classList.add('active');
}

function populateModalFilter() {
    const select = document.getElementById('modalFilterPosition');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">Все должности</option>';
    const posSet = new Set();
    employees.forEach(e => { if (e.position) posSet.add(e.position); });
    [...posSet].sort().forEach(pos => {
        const opt = document.createElement('option');
        opt.value = pos;
        opt.textContent = pos;
        select.appendChild(opt);
    });
    if (current && posSet.has(current)) select.value = current;
}

function renderModalList() {
    const search = document.getElementById('modalSearch').value.toLowerCase().trim();
    const positionFilter = document.getElementById('modalFilterPosition').value || '';
    const inShift = shifts[currentShiftId]?.people.map(p => p.id) || [];

    let filtered = employees;
    if (search) filtered = filtered.filter(e => e.fullName.toLowerCase().includes(search) || e.phone.includes(search));
    if (positionFilter) filtered = filtered.filter(e => e.position === positionFilter);

    const container = document.getElementById('modalList');
    const countEl = document.getElementById('modalCount');
    const available = filtered.filter(e => !inShift.includes(e.id)).length;
    if (countEl) countEl.textContent = `${filtered.length} сотрудников (${available} доступно)`;

    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:30px;">Ничего не найдено</div>';
        return;
    }

    container.innerHTML = filtered.map(e => {
        const already = inShift.includes(e.id);
        const relCount = e.relatives ? e.relatives.length : 0;
        const schedules = getSchedulesForPosition(e.position);

        let timeHtml = '';
        if (schedules.length > 0) {
            timeHtml = `<select class="modal-time-select" data-id="${e.id}" style="padding:2px 6px;border:1px solid var(--border);border-radius:4px;font-size:12px;background:var(--bg);color:var(--text);">
                <option value="">--</option>
                ${schedules.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>`;
        }

        return `<div class="employee-item ${already ? 'already' : ''}">
            <div class="info">
                <span class="name">${escapeHtml(e.fullName)}</span>
                ${e.position ? `<span class="position">(${escapeHtml(e.position)})</span>` : ''}
                <span class="phone">${escapeHtml(e.phone)}</span>
                ${relCount > 0 ? `<span class="relatives-indicator">👤 ${relCount}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
                ${timeHtml}
                <input type="checkbox" class="checkbox" data-id="${e.id}" ${already ? 'disabled' : ''}>
            </div>
        </div>`;
    }).join('');
}

function selectAllInModal() {
    document.querySelectorAll('#modalList .checkbox:not(:disabled)').forEach(cb => cb.checked = true);
}

function addSelectedToShift() {
    if (!currentShiftId || !shifts[currentShiftId]) { showToast('Нет активной смены!', 'error'); return; }

    const selected = document.querySelectorAll('#modalList .checkbox:checked');
    if (selected.length === 0) { showToast('Выберите сотрудников!', 'warning'); return; }

    let added = 0;
    selected.forEach(cb => {
        const emp = getEmployeeById(cb.dataset.id);
        if (emp && !shifts[currentShiftId].people.find(p => p.id === emp.id)) {
            const item = cb.closest('.employee-item');
            const timeSelect = item?.querySelector('.modal-time-select');
            const time = timeSelect ? timeSelect.value : '';
            shifts[currentShiftId].people.push({
                id: emp.id,
                fullName: emp.fullName,
                position: emp.position || '',
                phone: emp.phone,
                time: time || '',
                present: false
            });
            added++;
        }
    });

    if (added === 0) { showToast('Все выбранные уже в смене', 'warning'); return; }

    saveData();
    closeModal();
    renderShift();
    renderShiftsList();
    populateTimeFilter();
    populatePositionFilterForShifts();
    showToast(`✅ Добавлено ${added} сотрудников`, 'success');
}

function closeModal() {
    document.getElementById('addModal').classList.remove('active');
}

// ================================================================
//  МЕСЯЧНЫЙ ГРАФИК ИЗ EXCEL
// ================================================================
const RU_MONTHS = {
    'январь': 1, 'января': 1,
    'февраль': 2, 'февраля': 2,
    'март': 3, 'марта': 3,
    'апрель': 4, 'апреля': 4,
    'май': 5, 'мая': 5,
    'июнь': 6, 'июня': 6,
    'июль': 7, 'июля': 7,
    'август': 8, 'августа': 8,
    'сентябрь': 9, 'сентября': 9,
    'октябрь': 10, 'октября': 10,
    'ноябрь': 11, 'ноября': 11,
    'декабрь': 12, 'декабря': 12
};
const RU_MONTH_NAMES = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];


const DEFAULT_SHIFT_COLORS = {
    '06:00-18:00': 'FFF200',
    '07:00-19:00': 'F4B183',
    '08:00-20:00': '00B0F0',
    '09:00-19:00': '7030A0',
    '10:00-22:00': '92D050',
    '11:00-23:00': '00B050',
    '12:00-00:00': 'FF66CC',
    '20:00-08:00': 'F79646'
};

const DEFAULT_MANUAL_SHIFTS = [
    '06:00-18:00', '07:00-19:00', '08:00-20:00', '09:00-19:00',
    '10:00-22:00', '11:00-23:00', '12:00-00:00', '20:00-08:00'
];

const SCHEDULE_ABSENCE_OPTIONS = [
    { raw: 'В', status: 'Выходной', color: 'E2E8F0' },
    { raw: 'ОТ', status: 'Отпуск', color: 'FFE699' },
    { raw: 'Б', status: 'Больничный', color: 'F4CCCC' },
    { raw: 'ДО', status: 'Доп. отсутствие', color: 'D9EAD3' },
    { raw: 'УВ', status: 'УВ', color: 'D9D2E9' },
    { raw: 'НН', status: 'НН', color: 'D0E0E3' },
    { raw: 'О8', status: 'Обучение', color: 'CFE2F3' },
    { raw: 'КУ', status: 'Корпоративный университет', color: 'C9DAF8' },
    { raw: 'КТЗ', status: 'КТЗ', color: 'B4A7D6' }
];

const SCHEDULE_WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

function emptyScheduleDayInfo() {
    return { raw: '', color: '', kind: 'off', status: 'Выходной', working: false, time: '' };
}

function getDefaultScheduleLegend() {
    const legend = {};
    Object.entries(DEFAULT_SHIFT_COLORS).forEach(([time, color]) => { legend[color] = time; });
    return legend;
}

function getColorForShiftTime(time) {
    if (DEFAULT_SHIFT_COLORS[time]) return DEFAULT_SHIFT_COLORS[time];
    const palette = ['5B9BD5', '70AD47', 'FFC000', 'ED7D31', 'A5A5A5', '4472C4', 'C55A11', '8064A2'];
    let hash = 0;
    for (const ch of String(time || '')) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
    return palette[Math.abs(hash) % palette.length];
}


function normalizeHexColor(value, fallback = 'CBD5E1') {
    const hex = String(value || '').trim().replace('#', '').toUpperCase();
    return /^[0-9A-F]{6}$/.test(hex) ? hex : fallback;
}

function getDefaultAbsenceColor(raw) {
    return normalizeHexColor(SCHEDULE_ABSENCE_OPTIONS.find(item => item.raw === raw)?.color || 'CBD5E1');
}

function ensureScheduleColorSettings(schedule) {
    if (!schedule) return { work: {}, absence: {} };
    if (!schedule.colorSettings || typeof schedule.colorSettings !== 'object') schedule.colorSettings = { work: {}, absence: {} };
    if (!schedule.colorSettings.work || typeof schedule.colorSettings.work !== 'object') schedule.colorSettings.work = {};
    if (!schedule.colorSettings.absence || typeof schedule.colorSettings.absence !== 'object') schedule.colorSettings.absence = {};

    Object.values(schedule.legend || {}).forEach(time => {
        if (parseTimeRange(time) && !schedule.colorSettings.work[time]) {
            const legendEntry = Object.entries(schedule.legend || {}).find(([, t]) => t === time);
            schedule.colorSettings.work[time] = normalizeHexColor((legendEntry && legendEntry[0]) || getColorForShiftTime(time));
        }
    });

    (schedule.employees || []).forEach(emp => {
        Object.values(emp.days || {}).forEach(info => {
            if (!info) return;
            if (info.working && info.time && !schedule.colorSettings.work[info.time]) {
                schedule.colorSettings.work[info.time] = normalizeHexColor(info.color || getColorForShiftTime(info.time));
            }
            if (!info.working && info.raw && !schedule.colorSettings.absence[info.raw]) {
                schedule.colorSettings.absence[info.raw] = normalizeHexColor(info.color || getDefaultAbsenceColor(info.raw));
            }
        });
    });

    DEFAULT_MANUAL_SHIFTS.forEach(time => {
        if (!schedule.colorSettings.work[time]) schedule.colorSettings.work[time] = normalizeHexColor(getColorForShiftTime(time));
    });
    SCHEDULE_ABSENCE_OPTIONS.forEach(option => {
        if (!schedule.colorSettings.absence[option.raw]) schedule.colorSettings.absence[option.raw] = normalizeHexColor(option.color);
    });
    return schedule.colorSettings;
}

function getScheduleShiftColor(schedule, time) {
    if (!parseTimeRange(time)) return normalizeHexColor(getColorForShiftTime(time));
    const settings = ensureScheduleColorSettings(schedule);
    return normalizeHexColor(settings.work[time] || getColorForShiftTime(time));
}

function getScheduleAbsenceColor(schedule, raw) {
    const settings = ensureScheduleColorSettings(schedule);
    return normalizeHexColor(settings.absence[raw] || getDefaultAbsenceColor(raw));
}

function minutesFromClock(clock) {
    const match = String(clock || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

function getPaidHoursForTime(time) {
    const parsed = parseTimeRange(time);
    if (!parsed) return 0;
    let start = parsed.start;
    let end = parsed.end;
    if (end <= start) end += 24 * 60;
    const total = (end - start) / 60;
    return Math.max(0, total - 1);
}

function getWorkCodeForTime(time) {
    if (time === '20:00-08:00') return '20,8';
    const hours = getPaidHoursForTime(time);
    if (!hours) return time;
    return Number.isInteger(hours) ? String(hours) : String(hours).replace('.', ',');
}

function getScheduleWorkHours(info) {
    if (!info || !info.working) return 0;
    if (info.time) return getPaidHoursForTime(info.time);
    const numeric = Number(String(info.raw || '').replace(',', '.'));
    return Number.isFinite(numeric) ? numeric : 0;
}

function buildManualScheduleEmployee(base, dayCount) {
    const days = {};
    for (let d = 1; d <= dayCount; d++) days[d] = emptyScheduleDayInfo();
    return {
        sourceRow: `manual_${base.id || generateId()}`,
        baseId: base.id || '',
        fullName: base.fullName,
        position: base.position || 'Без должности',
        days
    };
}

function createManualSchedule() {
    const input = document.getElementById('scheduleManualMonth');
    const key = input?.value || toLocalISODate().slice(0, 7);
    const match = key.match(/^(20\d{2})-(\d{2})$/);
    if (!match) {
        showToast('Выберите месяц для графика', 'warning');
        return;
    }
    if (monthlySchedules[key]) {
        currentScheduleKey = key;
        selectScheduleMonth(key);
        showToast('График на этот месяц уже существует — открыл его без удаления данных', 'info');
        return;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const dayCount = new Date(year, month, 0).getDate();
    const schedule = {
        key,
        year,
        month,
        dayCount,
        title: `${RU_MONTH_NAMES[month]} ${year}`,
        sourceTitle: 'Создано на сайте',
        sourceName: 'Создано на сайте',
        sheetName: '',
        importedAt: new Date().toISOString(),
        createdManually: true,
        legend: getDefaultScheduleLegend(),
        colorSettings: {
            work: Object.fromEntries(DEFAULT_MANUAL_SHIFTS.map(time => [time, normalizeHexColor(getColorForShiftTime(time))])),
            absence: Object.fromEntries(SCHEDULE_ABSENCE_OPTIONS.map(option => [option.raw, normalizeHexColor(option.color)]))
        },
        employees: employees.map(emp => buildManualScheduleEmployee(emp, dayCount))
    };

    monthlySchedules[key] = schedule;
    currentScheduleKey = key;
    saveData();
    populateScheduleMonthSelect();
    selectScheduleMonth(key);
    renderDashboardScheduleSummary();
    showToast(`✅ Создан график ${schedule.title}: ${schedule.employees.length} сотрудников`, 'success');
}

function syncCurrentScheduleEmployees() {
    const schedule = getCurrentSchedule();
    if (!schedule) {
        showToast('Сначала создайте или откройте график', 'warning');
        return;
    }
    let added = 0;
    let updated = 0;

    employees.forEach(base => {
        let target = schedule.employees.find(e => e.baseId && e.baseId === base.id);
        if (!target) target = schedule.employees.find(e => normalizeEmployeeNameForMatch(e.fullName) === normalizeEmployeeNameForMatch(base.fullName));
        if (target) {
            if (target.fullName !== base.fullName || target.position !== (base.position || 'Без должности')) updated++;
            target.baseId = base.id;
            target.fullName = base.fullName;
            target.position = base.position || 'Без должности';
        } else {
            schedule.employees.push(buildManualScheduleEmployee(base, schedule.dayCount));
            added++;
        }
    });

    schedule.updatedAt = new Date().toISOString();
    saveData();
    renderScheduleTab();
    renderDashboardScheduleSummary();
    showToast(`✅ Синхронизация: добавлено ${added}, обновлено ${updated}`, 'success');
}

function getSchedulePositionOrder(schedule) {
    const configured = Object.keys(positions || {});
    const used = [...new Set((schedule?.employees || []).map(e => e.position || 'Без должности'))];
    const result = configured.filter(p => used.includes(p));
    used.filter(p => !result.includes(p)).sort((a, b) => a.localeCompare(b, 'ru')).forEach(p => result.push(p));
    return result;
}

function groupScheduleEmployees(schedule, entries = null) {
    const list = entries || (schedule?.employees || []);
    const order = getSchedulePositionOrder({ employees: list });
    const groups = new Map(order.map(p => [p, []]));
    list.forEach(item => {
        const position = item.position || 'Без должности';
        if (!groups.has(position)) groups.set(position, []);
        groups.get(position).push(item);
    });
    return [...groups.entries()]
        .filter(([, group]) => group.length)
        .map(([position, group]) => ({
            position,
            employees: group.sort((a, b) => String(a.fullName).localeCompare(String(b.fullName), 'ru'))
        }));
}

function getScheduleDayHeaderInfo(schedule, day) {
    const date = new Date(schedule.year, schedule.month - 1, day);
    const weekday = SCHEDULE_WEEKDAYS[date.getDay()];
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    return { weekday, weekend };
}

function toLocalISODate(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function initScheduleUI() {
    const manualMonth = document.getElementById('scheduleManualMonth');
    if (manualMonth && !manualMonth.value) manualMonth.value = toLocalISODate().slice(0, 7);
    const keys = Object.keys(monthlySchedules).sort().reverse();
    if (!currentScheduleKey || !monthlySchedules[currentScheduleKey]) {
        const todayKey = toLocalISODate().slice(0, 7);
        currentScheduleKey = monthlySchedules[todayKey] ? todayKey : (keys[0] || null);
    }
    populateScheduleMonthSelect();
    if (currentScheduleKey) selectScheduleMonth(currentScheduleKey, false);
    else renderScheduleTab();
}

function populateScheduleMonthSelect() {
    const select = document.getElementById('scheduleMonthSelect');
    if (!select) return;
    const keys = Object.keys(monthlySchedules).sort().reverse();
    select.innerHTML = keys.length
        ? keys.map(key => `<option value="${key}">${escapeHtml(monthlySchedules[key].title || key)}</option>`).join('')
        : '<option value="">-- Нет загруженных графиков --</option>';
    if (currentScheduleKey && monthlySchedules[currentScheduleKey]) select.value = currentScheduleKey;
}

function selectScheduleMonth(key, render = true) {
    if (key !== currentScheduleKey) clearScheduleCellSelection();
    if (!key || !monthlySchedules[key]) {
        currentScheduleKey = null;
        if (render) renderScheduleTab();
        return;
    }
    currentScheduleKey = key;
    const select = document.getElementById('scheduleMonthSelect');
    if (select) select.value = key;
    const manualMonth = document.getElementById('scheduleManualMonth');
    if (manualMonth) manualMonth.value = key;

    const schedule = monthlySchedules[key];
    const dateInput = document.getElementById('scheduleDate');
    if (dateInput) {
        const maxDay = schedule.dayCount || new Date(schedule.year, schedule.month, 0).getDate();
        const first = `${key}-01`;
        const last = `${key}-${String(maxDay).padStart(2, '0')}`;
        dateInput.min = first;
        dateInput.max = last;
        const today = toLocalISODate();
        dateInput.value = today.startsWith(key) ? today : first;
    }
    if (render) renderScheduleTab();
}

function renderScheduleTab() {
    populateScheduleMonthSelect();
    const badge = document.getElementById('scheduleMonthBadge');
    const info = document.getElementById('scheduleImportInfo');
    const schedule = currentScheduleKey ? monthlySchedules[currentScheduleKey] : null;

    populateScheduleBulkShiftSelect(schedule);

    if (!schedule) {
        if (badge) badge.textContent = 'Нет графика';
        if (info) info.innerHTML = '<span class="empty-text">Создайте график на сайте или импортируйте Excel.</span>';
        renderScheduleLegend(null);
        renderScheduleMonthTable(null);
        renderScheduleDay();
        return;
    }

    if (badge) badge.textContent = schedule.title;
    if (info) {
        const parsedAt = schedule.updatedAt || schedule.importedAt ? new Date(schedule.updatedAt || schedule.importedAt).toLocaleString('ru-RU') : '';
        info.innerHTML = `<div class="schedule-import-ok"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(schedule.sourceName || (schedule.createdManually ? 'Создано на сайте' : 'Excel'))} — ${schedule.employees.length} сотрудников${parsedAt ? ` · ${parsedAt}` : ''}</div>`;
    }
    renderScheduleLegend(schedule);
    populateSchedulePositionFilter(schedule);
    renderScheduleMonthTable(schedule);
    renderScheduleDay();
}

// Список листов читаем до данных: большой архив за прошлые годы открывать целиком не нужно.
function monthOfSheet(title) {
    const {year, month} = parseRussianMonthYear(title);
    return year && month ? year + '-' + String(month).padStart(2, '0') : '';
}

function selectRosterSheets(names, monthKey) {
    const [year, month] = monthKey.split('-').map(Number);
    const nextKey = toLocalISODate(new Date(year, month, 1)).slice(0, 7);
    const main = names.filter(n => !/копия|копи[яи]|copy|архив/i.test(n));
    const pick = key => {
        const found = main.filter(n => monthOfSheet(n) === key);
        if (found.length > 1) throw Error('Несколько листов за ' + key + '. Загрузите книгу с одним основным листом за этот месяц.');
        return found[0];
    };
    const first = pick(monthKey);
    if (first) return [first, pick(nextKey)].filter(Boolean);
    if (names.length === 1) return names;
    throw Error('В книге нет основного листа за ' + monthKey + '. Выберите нужный месяц в разделе «График» и повторите импорт.');
}

function scheduleFromGrid(grid, sheetName, sourceName) {
    // В шапке идут подряд даты 1, 2, 3… Правее могут быть нормы и другие числа.
    let header = -1, start = -1, count = 0;
    for (let r = 0; r < Math.min(35, grid.length); r++) {
        const row = grid[r] || [];
        for (let c = 3; c < row.length; c++) {
            if (Number(row[c]?.v) !== 1) continue;
            let n = 1;
            while (n < 31 && Number(row[c+n]?.v) === n+1) n++;
            if (n >= 28 && n > count) { header = r; start = c; count = n; }
        }
    }
    if (header < 0) throw Error('На листе «' + sheetName + '» не найдена строка с днями месяца.');
    const titleCell = grid.slice(0, header+1).flatMap(row => row || []).find(c => c && monthOfSheet(c.v));
    const key = monthOfSheet(sheetName) || monthOfSheet(titleCell?.v);
    if (!key) throw Error('Укажите месяц и год в названии листа или в шапке.');
    const [year,month] = key.split('-').map(Number);
    const dayCount = new Date(year, month, 0).getDate();
    if (count < dayCount) throw Error('На листе «' + sheetName + '» не хватает дат.');
    const legend = {};
    const conflicts = new Set();
    const timeRe = /смена\s+с\s+(\d{1,2}:\d{2})\s+до\s+(\d{1,2}:\d{2})/i;
    for (const row of grid) {
        if (!row) continue;
        row.forEach((cell,c) => {
            const match = String(cell.v).match(timeRe);
            if (!match) return;
            const sample = row[c-1];
            if (!sample?.color || !String(sample.v).trim()) return;
            const time = normalizeClock(match[1]) + '-' + normalizeClock(match[2]);
            if (legend[sample.color] && time !== legend[sample.color]) conflicts.add(sample.color);
            legend[sample.color] = time;
        });
    }
    for (const color of conflicts) delete legend[color];
    const staff = [];
    for (let r = header+1; r < grid.length; r++) {
        const row = grid[r];
        if (!row) continue;
        const fullName = String(row[1]?.v ?? '').trim();
        const position = String(row[2]?.v ?? '').trim();
        if (!fullName || !position || /^(?:ваканс|самозанятые|итог|фот\b|факт\b|резерв\s*$)/iu.test(fullName.toLowerCase())) continue;
        if (!/^\d+$/.test(String(row[0]?.v || '').trim()) && !/^[А-ЯЁA-Z][\p{L}.'’-]+\s+[А-ЯЁA-Z][\p{L}.'’-]*/u.test(fullName)) continue;
        const explicit = position.match(/(?:^|\s)(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})(?:$|\s)/);
        const days = {};
        for (let day=1; day<=dayCount; day++) {
            const cell = row[start+day-1];
            const info = classifyScheduleCell(cell, legend);
            if (info.working && !info.time && explicit) info.time = normalizeClock(explicit[1]) + '-' + normalizeClock(explicit[2]);
            days[day] = info;
        }
        staff.push({sourceRow:r+1, fullName, position, days});
    }
    if (!staff.length) throw Error('На листе «' + sheetName + '» не найдены сотрудники.');
    return {key, year, month, dayCount, title:RU_MONTH_NAMES[month]+' '+year, sourceName, sheetName,
        sourceTitle:titleCell?.v || sheetName, importedAt:new Date().toISOString(), legend, employees:staff};
}

function xmlNodes(parent, name) {
    return parent ? Array.from(parent.getElementsByTagNameNS('*', name)) : [];
}

async function excelGrids(file, key) {
    const bytes = await file.arrayBuffer();
    if (/\.xls$/i.test(file.name)) {
        if (!window.XLSX) throw Error('Для старого формата .xls нужен интернет. Можно сохранить файл как .xlsx.');
        const book = XLSX.read(bytes, {type:'array',cellStyles:true});
        return selectRosterSheets(book.SheetNames, key).map(name => {
            const grid = [];
            for (const [address, cell] of Object.entries(book.Sheets[name])) {
                if (address[0] === '!') continue;
                const {r,c} = XLSX.utils.decode_cell(address);
                (grid[r] ||= [])[c] = {v:cellText(cell),color:getSheetJsFillColor(cell)};
            }
            return scheduleFromGrid(grid, name, file.name);
        });
    }
    const zip = await JSZip.loadAsync(bytes);
    async function xml(path, optional = false) {
        const item = zip.file(path);
        if (!item && optional) return null;
        if (!item) throw Error('Не найден раздел книги ' + path);
        const doc = new DOMParser().parseFromString(await item.async('string'), 'application/xml');
        if (xmlNodes(doc,'parsererror').length) throw Error('Повреждён раздел книги ' + path);
        return doc;
    }
    const [book, links, strings, styles] = await Promise.all([xml('xl/workbook.xml'),
        xml('xl/_rels/workbook.xml.rels'),xml('xl/sharedStrings.xml',true),xml('xl/styles.xml',true)]);
    const richText = node => xmlNodes(node,'t').map(t => t.textContent).join('');
    const texts = xmlNodes(strings,'si').map(richText);
    const fills = xmlNodes(styles,'fill').map(fill => xmlNodes(fill,'fgColor')[0]?.getAttribute('rgb')?.slice(-6).toUpperCase() || '');
    const colors = xmlNodes(xmlNodes(styles,'cellXfs')[0],'xf').map(x => fills[Number(x.getAttribute('fillId'))] || '');
    const targets = new Map(xmlNodes(links,'Relationship').map(x => [x.getAttribute('Id'), x.getAttribute('Target')]));
    const sheets = new Map(xmlNodes(book,'sheet').map(s => [s.getAttribute('name'), targets.get(s.getAttribute('r:id'))]));
    const parsed = [];
    for (const name of selectRosterSheets([...sheets.keys()], key)) {
        const path = new URL(sheets.get(name), 'https://workbook.invalid/xl/').pathname.slice(1);
        const grid = [];
        for (const cell of xmlNodes(await xml(path),'c')) {
            const match = /^([A-Z]+)(\d+)$/.exec(cell.getAttribute('r'));
            if (!match) continue;
            const type = cell.getAttribute('t');
            const raw = xmlNodes(cell,'v')[0]?.textContent ?? '';
            const v = type === 's' ? texts[Number(raw)] : type === 'inlineStr' ? richText(cell) : raw;
            if (v == null || v === '') continue;
            let col = 0;
            for (const ch of match[1]) col = col*26 + ch.charCodeAt(0)-64;
            (grid[Number(match[2])-1] ||= [])[col-1] = {v, color:colors[Number(cell.getAttribute('s'))] || ''};
        }
        parsed.push(scheduleFromGrid(grid,name,file.name));
    }
    return parsed;
}

function installSchedules(parsed, ask = true) {
    const existing = parsed.filter(s => monthlySchedules[s.key]).map(s => s.title);
    if (ask && existing.length && !confirm('Обновить план за ' + existing.join(', ') + '? Ручные изменения плана за эти месяцы будут заменены. Отметки выхода сохранятся.')) return false;
    const updated = {...monthlySchedules};
    parsed.forEach(s => { v6EnsureSchedule(s); updated[s.key] = s; });
    // Одна запись на все месяцы. Если браузеру не хватает места, старый план остаётся.
    try { localStorage.setItem(KEYS.MONTHLY_SCHEDULES, JSON.stringify(updated)); }
    catch { throw Error('Недостаточно места для сохранения. Создайте резервную копию и удалите ненужные месяцы.'); }
    monthlySchedules = updated;
    parsed.forEach(s => {delete scheduleHistoryV6[s.key];});
    populateScheduleMonthSelect();
    selectScheduleMonth(parsed[0].key, document.getElementById('tab-schedule').classList.contains('active'));
    updateNavBadges();
    renderDashboardScheduleSummary();
    return true;
}

async function importMonthlySchedule(event) {
    const input = document.getElementById('scheduleFileInput');
    if (!input.files.length) { input.click(); return; }
    const file = input.files[0];
    const key = input.dataset.month || document.getElementById('scheduleManualMonth').value || toLocalISODate().slice(0,7);
    const button = document.getElementById('scheduleImportBtn');
    const status = document.getElementById('sourceStatus');
    button.disabled = true;
    status.textContent = 'Читаю график…';
    try {
        const parsed = await excelGrids(file,key);
        if (installSchedules(parsed)) {
            status.textContent = 'Загружено: ' + parsed.map(s => s.title).join(', ');
            showToast(status.textContent,'success');
        } else status.textContent = 'Импорт отменён.';
    } catch (error) { status.textContent = error.message; showToast(error.message,'error'); }
    finally { input.value = ''; delete input.dataset.month; button.disabled = false; }
}


function parseRussianMonthYear(text) {
    const lower = String(text || '').toLowerCase();
    const yearMatch = lower.match(/(20\d{2})/);
    let month = null;
    Object.keys(RU_MONTHS).some(name => {
        if (lower.includes(name)) {
            month = RU_MONTHS[name];
            return true;
        }
        return false;
    });
    return { year: yearMatch ? Number(yearMatch[1]) : null, month };
}



function getSheetJsFillColor(cell) {
    if (!cell || !cell.s) return '';
    const style = cell.s;
    const fg = style.fgColor || (style.fill && style.fill.fgColor) || null;
    let rgb = fg && fg.rgb ? String(fg.rgb) : '';
    if (!rgb) return '';
    rgb = rgb.replace('#', '').toUpperCase();
    if (rgb.length === 8) rgb = rgb.slice(2);
    return rgb;
}

function normalizeClock(value) {
    const [h, m] = String(value).split(':');
    return `${String(Number(h)).padStart(2, '0')}:${String(Number(m || 0)).padStart(2, '0')}`;
}

function cellText(cell) {
    if (!cell || cell.v === undefined || cell.v === null) return '';
    if (cell.w !== undefined && cell.w !== null) return String(cell.w);
    return String(cell.v);
}

function classifyScheduleCell(cell, legend) {
    const raw = cellText(cell).trim();
    const color = cell?.color || getSheetJsFillColor(cell);
    const normalized = raw.toLowerCase().replace(/\s+/g, '');

    if (!raw) {
        return { raw: '', color, kind: 'off', status: 'Выходной', working: false, time: '' };
    }

    if (/^20([_,.])8$/.test(normalized) || /^20[:.]?00[-–]08[:.]?00$/.test(normalized)) {
        return { raw, color, kind: 'working', status: 'Ночная смена', working: true, time: '20:00-08:00' };
    }

    const numeric = Number(normalized.replace(',', '.'));
    if (!Number.isNaN(numeric) && numeric > 0) {
        return {
            raw,
            color,
            kind: 'working',
            status: 'Рабочая смена',
            working: true,
            time: legend[color] || ''
        };
    }

    const labels = {
        'от': 'Отпуск',
        'б': 'Больничный',
        'до': 'Доп. отсутствие',
        'ув': 'УВ',
        'нн': 'НН',
        'о8': 'Обучение',
        'ку': 'Корпоративный университет',
        'ктз': 'КТЗ'
    };
    return {
        raw,
        color,
        kind: labels[normalized] ? 'other' : 'other',
        status: labels[normalized] || raw,
        working: false,
        time: ''
    };
}

function getCurrentSchedule() {
    return currentScheduleKey && monthlySchedules[currentScheduleKey] ? monthlySchedules[currentScheduleKey] : null;
}

function getScheduleSelectedDate() {
    const input = document.getElementById('scheduleDate');
    return input && input.value ? input.value : null;
}

function getScheduleDayNumber() {
    const date = getScheduleSelectedDate();
    if (!date) return null;
    return Number(date.slice(8, 10));
}

function getScheduleEntriesForSelectedDay() {
    const schedule = getCurrentSchedule();
    const day = getScheduleDayNumber();
    if (!schedule || !day) return [];
    return schedule.employees.map(emp => ({ ...emp, dayInfo: emp.days[day] || { raw: '', kind: 'off', status: 'Выходной', working: false, time: '' } }));
}

function normalizeEmployeeNameForMatch(name) {
    return String(name || '')
        .replace(/\([^)]*\)\s*$/g, '')
        .replace(/ё/gi, 'е')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function findBaseEmployeeByScheduleName(name) {
    const exact = employees.find(e => e.fullName.trim().toLowerCase() === String(name).trim().toLowerCase());
    if (exact) return exact;
    const key = normalizeEmployeeNameForMatch(name);
    return employees.find(e => normalizeEmployeeNameForMatch(e.fullName) === key) || null;
}

function parseTimeRange(time) {
    const match = String(time || '').match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
    if (!match) return null;
    return {
        start: Number(match[1]) * 60 + Number(match[2]),
        end: Number(match[3]) * 60 + Number(match[4])
    };
}



function renderScheduleDay() {
    const body = document.getElementById('scheduleDayBody');
    if (!body) return;
    const schedule = getCurrentSchedule();
    if (!schedule) {
        body.innerHTML = '<tr><td colspan="7" class="schedule-empty-cell">Создайте график на сайте или импортируйте Excel</td></tr>';
        setScheduleStats(0, 0, 0, 0);
        return;
    }

    const selectedDate = getScheduleSelectedDate();
    if (!selectedDate || !selectedDate.startsWith(schedule.key)) {
        selectScheduleMonth(schedule.key, false);
    }

    let entries = getScheduleEntriesForSelectedDay();
    const total = entries.length;
    const working = entries.filter(e => e.dayInfo.working).length;
    const nowCount = entries.filter(e => isEntryActiveNow(e, getScheduleSelectedDate())).length;
    const off = total - working;
    setScheduleStats(total, working, nowCount, off);

    const search = (document.getElementById('scheduleSearch')?.value || '').toLowerCase().trim();
    const position = document.getElementById('schedulePositionFilter')?.value || '';
    const status = document.getElementById('scheduleStatusFilter')?.value || 'working';
    const date = getScheduleSelectedDate();

    if (search) entries = entries.filter(e => e.fullName.toLowerCase().includes(search) || String(e.position || '').toLowerCase().includes(search));
    if (position) entries = entries.filter(e => e.position === position);
    if (status === 'working') entries = entries.filter(e => e.dayInfo.working);
    if (status === 'now') entries = entries.filter(e => isEntryActiveNow(e, date));
    if (status === 'off') entries = entries.filter(e => !e.dayInfo.working);

    const countEl = document.getElementById('scheduleFilteredCount');
    if (countEl) countEl.textContent = `Показано: ${entries.length} из ${total}`;

    if (!entries.length) {
        body.innerHTML = '<tr><td colspan="7" class="schedule-empty-cell">Нет сотрудников по выбранному фильтру</td></tr>';
        return;
    }

    const groups = groupScheduleEmployees(schedule, entries);
    let counter = 0;
    body.innerHTML = groups.map(group => {
        const groupHeader = `<tr class="schedule-day-position-row"><td colspan="7"><i class="fa-solid fa-briefcase"></i> ${escapeHtml(group.position)} <span>${group.employees.length} чел.</span></td></tr>`;
        const rows = group.employees
            .sort((a, b) => (a.dayInfo.time || '99:99').localeCompare(b.dayInfo.time || '99:99') || a.fullName.localeCompare(b.fullName, 'ru'))
            .map(entry => {
                counter++;
                const base = findBaseEmployeeByScheduleName(entry.fullName);
                const phone = base?.phone || '';
                const active = isEntryActiveNow(entry, date);
                const statusClass = entry.dayInfo.working ? (active && date === toLocalISODate() ? 'schedule-status-now' : 'schedule-status-work') : 'schedule-status-off';
                let statusText = entry.dayInfo.status;
                if (entry.dayInfo.working && active && date === toLocalISODate()) statusText = 'Сейчас по графику';
                const time = entry.dayInfo.time || (entry.dayInfo.working ? 'Время не определено' : '—');
                return `<tr class="${entry.dayInfo.working ? 'schedule-row-working' : 'schedule-row-off'}">
                    <td>${counter}</td>
                    <td><strong>${escapeHtml(entry.fullName)}</strong>${base ? '' : '<span class="schedule-unmatched" title="Нет точного совпадения в базе сотрудников">не в базе</span>'}</td>
                    <td>${escapeHtml(entry.position)}</td>
                    <td>${phone ? `<a href="tel:${escapeHtml(phone)}" class="phone-link">${escapeHtml(phone)}</a>` : '—'}</td>
                    <td><span class="schedule-code">${escapeHtml(entry.dayInfo.raw || '—')}</span></td>
                    <td>${escapeHtml(time)}</td>
                    <td><span class="schedule-status ${statusClass}">${escapeHtml(statusText)}</span></td>
                </tr>`;
            }).join('');
        return groupHeader + rows;
    }).join('');
}

function setScheduleStats(total, working, now, absent) {
    const map = {
        scheduleStatTotal: total,
        scheduleStatWorking: working,
        scheduleStatNow: now,
        scheduleStatAbsent: absent
    };
    Object.entries(map).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
}

function populateSchedulePositionFilter(schedule) {
    const select = document.getElementById('schedulePositionFilter');
    if (!select) return;
    const current = select.value;
    const positionsList = getSchedulePositionOrder(schedule);
    select.innerHTML = '<option value="">Все должности</option>' + positionsList.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
    if (positionsList.includes(current)) select.value = current;
}

function renderScheduleLegend(schedule) {
    const el = document.getElementById('scheduleLegend');
    if (!el) return;
    if (!schedule) {
        el.innerHTML = '<span class="empty-text">Легенда появится после создания графика</span>';
        return;
    }
    const colorSettings = ensureScheduleColorSettings(schedule);
    const configured = Object.keys(colorSettings.work || {}).filter(t => parseTimeRange(t));
    const legendTimes = Object.values(schedule.legend || {}).filter(t => parseTimeRange(t));
    const times = [...new Set([...DEFAULT_MANUAL_SHIFTS, ...legendTimes, ...configured])];
    el.innerHTML = times.length
        ? times.map(time => `<span class="legend-chip"><i style="background:#${getScheduleShiftColor(schedule, time)}"></i>${escapeHtml(getWorkCodeForTime(time))} · ${escapeHtml(time)}</span>`).join('')
        : '<span class="empty-text">Добавьте рабочую смену — её цвет появится здесь.</span>';
}

function renderScheduleMonthTable(schedule) {
    const wrap = document.getElementById('scheduleMonthTableWrap');
    if (!wrap) return;
    if (!schedule) {
        selectedScheduleCells.clear();
        wrap.innerHTML = '<div class="schedule-editor-empty"><i class="fa-solid fa-table-cells-large"></i><strong>График ещё не создан</strong><span>Выберите месяц выше и нажмите «Создать график».</span></div>';
        updateScheduleSelectionUI();
        return;
    }

    const days = Array.from({ length: schedule.dayCount }, (_, i) => i + 1);
    const employeeList = schedule.employees.map((emp, index) => ({ ...emp, _scheduleIndex: index }));
    const groups = groupScheduleEmployees(schedule, employeeList);
    const dayHeaders = days.map(d => {
        const info = getScheduleDayHeaderInfo(schedule, d);
        return `<th class="schedule-day-head ${info.weekend ? 'weekend' : ''}"><span>${d}</span><small>${info.weekday}</small></th>`;
    }).join('');

    const header = `<tr>
        <th class="schedule-sticky-name schedule-name-head">ФИО</th>
        ${dayHeaders}
        <th class="schedule-total-head">Часы</th>
        <th class="schedule-total-head">Смены</th>
    </tr>`;

    let visualRow = 0;
    const body = groups.map(group => {
        const groupHours = group.employees.reduce((sum, emp) => sum + days.reduce((s, d) => s + getScheduleWorkHours(emp.days[d]), 0), 0);
        const groupShifts = group.employees.reduce((sum, emp) => sum + days.filter(d => emp.days[d]?.working).length, 0);
        const groupHeader = `<tr class="schedule-position-row">
            <td colspan="${schedule.dayCount + 3}">
                <div class="schedule-position-title">
                    <span><i class="fa-solid fa-briefcase"></i> ${escapeHtml(group.position)}</span>
                    <small>${group.employees.length} чел. · ${formatScheduleHours(groupHours)} ч. · ${groupShifts} смен</small>
                </div>
            </td>
        </tr>`;

        const rows = group.employees.map(emp => {
            const rowIndex = visualRow++;
            const totalHours = days.reduce((sum, d) => sum + getScheduleWorkHours(emp.days[d]), 0);
            const totalShifts = days.filter(d => emp.days[d]?.working).length;
            const cells = days.map(d => {
                const info = emp.days[d] || emptyScheduleDayInfo();
                const dateInfo = getScheduleDayHeaderInfo(schedule, d);
                const style = info.color ? ` style="--cell-color:#${info.color}"` : '';
                const cls = info.working ? 'm-work' : (info.raw ? 'm-other' : 'm-off');
                const title = [info.status, info.time].filter(Boolean).join(' · ') || 'Пустая ячейка';
                const key = getScheduleCellKey(emp._scheduleIndex, d);
                const selectedClass = selectedScheduleCells.has(key) ? 'selected' : '';
                return `<td class="schedule-month-cell schedule-cell-editable ${cls} ${dateInfo.weekend ? 'weekend' : ''} ${selectedClass}"${style}
                    data-employee-index="${emp._scheduleIndex}" data-day="${d}" data-row="${rowIndex}"
                    title="${escapeHtml(title)} — протяните мышкой для выделения, двойной клик для редактирования"
                    onmousedown="startScheduleCellSelection(event, ${emp._scheduleIndex}, ${d}, ${rowIndex})"
                    onmouseenter="extendScheduleCellSelection(event, ${emp._scheduleIndex}, ${d}, ${rowIndex})"
                    ondblclick="openScheduleCellEditor(${emp._scheduleIndex}, ${d})">${escapeHtml(info.raw || '')}</td>`;
            }).join('');
            return `<tr class="schedule-employee-row">
                <td class="schedule-sticky-name schedule-employee-name"><strong>${escapeHtml(emp.fullName)}</strong></td>
                ${cells}
                <td class="schedule-total-cell">${formatScheduleHours(totalHours)}</td>
                <td class="schedule-total-cell">${totalShifts}</td>
            </tr>`;
        }).join('');
        return groupHeader + rows;
    }).join('');

    wrap.innerHTML = `<table class="schedule-month-table schedule-editor-table"><thead>${header}</thead><tbody>${body}</tbody></table>`;
    updateScheduleSelectionUI();
}

function getScheduleCellKey(employeeIndex, day) {
    return `${employeeIndex}:${day}`;
}

function parseScheduleCellKey(key) {
    const [employeeIndex, day] = String(key).split(':').map(Number);
    return Number.isInteger(employeeIndex) && Number.isInteger(day) ? { employeeIndex, day } : null;
}

function startScheduleCellSelection(event, employeeIndex, day, row) {
    if (event.button !== 0) return;
    event.preventDefault();
    isScheduleCellSelecting = true;

    const keepExisting = event.ctrlKey || event.metaKey;
    scheduleSelectionBase = keepExisting ? new Set(selectedScheduleCells) : new Set();

    if (event.shiftKey && scheduleSelectionAnchor) {
        scheduleDragAnchor = { ...scheduleSelectionAnchor };
    } else {
        scheduleSelectionAnchor = { employeeIndex, day, row };
        scheduleDragAnchor = { employeeIndex, day, row };
    }

    applyScheduleSelectionRectangle(scheduleDragAnchor, { employeeIndex, day, row });
}

function extendScheduleCellSelection(event, employeeIndex, day, row) {
    if (!isScheduleCellSelecting || !scheduleDragAnchor) return;
    if (event.buttons !== undefined && (event.buttons & 1) !== 1) return;
    applyScheduleSelectionRectangle(scheduleDragAnchor, { employeeIndex, day, row });
}

function finishScheduleCellSelection() {
    if (!isScheduleCellSelecting) return;
    isScheduleCellSelecting = false;
    scheduleDragAnchor = null;
    updateScheduleSelectionUI();
}

function applyScheduleSelectionRectangle(anchor, current) {
    const minRow = Math.min(anchor.row, current.row);
    const maxRow = Math.max(anchor.row, current.row);
    const minDay = Math.min(anchor.day, current.day);
    const maxDay = Math.max(anchor.day, current.day);
    const next = new Set(scheduleSelectionBase);

    document.querySelectorAll('#scheduleMonthTableWrap .schedule-cell-editable').forEach(cell => {
        const row = Number(cell.dataset.row);
        const day = Number(cell.dataset.day);
        if (row >= minRow && row <= maxRow && day >= minDay && day <= maxDay) {
            next.add(getScheduleCellKey(Number(cell.dataset.employeeIndex), day));
        }
    });

    selectedScheduleCells = next;
    updateScheduleSelectionUI();
}

function clearScheduleCellSelection() {
    selectedScheduleCells.clear();
    scheduleSelectionAnchor = null;
    scheduleDragAnchor = null;
    scheduleSelectionBase = new Set();
    isScheduleCellSelecting = false;
    updateScheduleSelectionUI();
}

function updateScheduleSelectionUI() {
    document.querySelectorAll('#scheduleMonthTableWrap .schedule-cell-editable').forEach(cell => {
        const key = getScheduleCellKey(Number(cell.dataset.employeeIndex), Number(cell.dataset.day));
        cell.classList.toggle('selected', selectedScheduleCells.has(key));
    });

    const bar = document.getElementById('scheduleSelectionBar');
    const count = document.getElementById('scheduleSelectionCount');
    const details = document.getElementById('scheduleSelectionDetails');
    const size = selectedScheduleCells.size;
    if (bar) bar.classList.toggle('active', size > 0);
    if (count) count.textContent = `${size} ${pluralizeRu(size, 'ячейка', 'ячейки', 'ячеек')}`;

    if (details) {
        if (!size) {
            details.textContent = 'Выделите ячейки мышкой';
        } else {
            const parsed = [...selectedScheduleCells].map(parseScheduleCellKey).filter(Boolean);
            const employeesCount = new Set(parsed.map(x => x.employeeIndex)).size;
            const daysCount = new Set(parsed.map(x => x.day)).size;
            details.textContent = `${employeesCount} ${pluralizeRu(employeesCount, 'сотрудник', 'сотрудника', 'сотрудников')} · ${daysCount} ${pluralizeRu(daysCount, 'день', 'дня', 'дней')}`;
        }
    }
}

function pluralizeRu(value, one, few, many) {
    const n = Math.abs(Number(value)) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return many;
    if (n1 > 1 && n1 < 5) return few;
    if (n1 === 1) return one;
    return many;
}

function getSelectedScheduleContexts() {
    const schedule = getCurrentSchedule();
    if (!schedule) return [];
    return [...selectedScheduleCells]
        .map(parseScheduleCellKey)
        .filter(Boolean)
        .map(({ employeeIndex, day }) => ({ schedule, employee: schedule.employees[employeeIndex], employeeIndex, day }))
        .filter(ctx => ctx.employee && ctx.day >= 1 && ctx.day <= schedule.dayCount);
}

function populateScheduleBulkShiftSelect(schedule) {
    const select = document.getElementById('scheduleBulkShiftSelect');
    if (!select) return;
    const current = select.value;
    const configured = Object.values(positions || {}).flat().filter(t => parseTimeRange(t));
    const legendTimes = Object.values(schedule?.legend || {}).filter(t => parseTimeRange(t));
    const shiftsList = [...new Set([...DEFAULT_MANUAL_SHIFTS, ...configured, ...legendTimes])];
    select.innerHTML = '<option value="">Выберите смену…</option>' + shiftsList.map(time => `<option value="${escapeHtml(time)}">${escapeHtml(getWorkCodeForTime(time))} · ${escapeHtml(time)}</option>`).join('');
    if (current && shiftsList.includes(current)) select.value = current;
    else if (shiftsList.includes('11:00-23:00')) select.value = '11:00-23:00';
}

function applyScheduleWorkToContexts(contexts, time) {
    if (!contexts.length || !parseTimeRange(time)) return false;
    const schedule = contexts[0].schedule;
    const color = getScheduleShiftColor(schedule, time);
    contexts.forEach(ctx => {
        ctx.employee.days[ctx.day] = {
            raw: getWorkCodeForTime(time),
            color,
            kind: 'working',
            status: time === '20:00-08:00' ? 'Ночная смена' : 'Рабочая смена',
            working: true,
            time
        };
    });
    schedule.legend = schedule.legend || {};
    ensureScheduleColorSettings(schedule);
    schedule.colorSettings.work[time] = color;
    Object.keys(schedule.legend).forEach(key => { if (schedule.legend[key] === time) delete schedule.legend[key]; });
    schedule.legend[color] = time;
    return true;
}

function applyScheduleAbsenceToContexts(contexts, option) {
    if (!contexts.length || !option) return false;
    const schedule = contexts[0].schedule;
    const color = getScheduleAbsenceColor(schedule, option.raw);
    contexts.forEach(ctx => {
        ctx.employee.days[ctx.day] = {
            raw: option.raw,
            color,
            kind: 'other',
            status: option.status,
            working: false,
            time: ''
        };
    });
    ensureScheduleColorSettings(schedule);
    schedule.colorSettings.absence[option.raw] = color;
    return true;
}

function applyScheduleSelectionWork(time) {
    const contexts = getSelectedScheduleContexts();
    if (!contexts.length) { showToast('Сначала выделите ячейки', 'warning'); return; }
    if (!applyScheduleWorkToContexts(contexts, time)) return;
    persistScheduleBulkEdit(contexts[0].schedule, contexts.length, `Смена ${time}`);
}

function applyScheduleSelectionAbsence(raw) {
    const contexts = getSelectedScheduleContexts();
    if (!contexts.length) { showToast('Сначала выделите ячейки', 'warning'); return; }
    const option = SCHEDULE_ABSENCE_OPTIONS.find(item => item.raw === raw);
    if (!option || !applyScheduleAbsenceToContexts(contexts, option)) return;
    persistScheduleBulkEdit(contexts[0].schedule, contexts.length, option.status);
}

function clearSelectedScheduleCells() {
    const contexts = getSelectedScheduleContexts();
    if (!contexts.length) { showToast('Сначала выделите ячейки', 'warning'); return; }
    contexts.forEach(ctx => { ctx.employee.days[ctx.day] = emptyScheduleDayInfo(); });
    persistScheduleBulkEdit(contexts[0].schedule, contexts.length, 'Очищено');
}

function persistScheduleBulkEdit(schedule, count, label) {
    schedule.updatedAt = new Date().toISOString();
    schedule.sourceName = schedule.createdManually ? 'Создано на сайте' : (schedule.sourceName || 'Excel');
    saveData();
    renderScheduleLegend(schedule);
    renderScheduleMonthTable(schedule);
    renderScheduleDay();
    renderDashboardScheduleSummary();
    showToast(`✅ ${label}: обновлено ${count} ${pluralizeRu(count, 'ячейка', 'ячейки', 'ячеек')}`, 'success');
}

function formatScheduleHours(value) {
    const n = Number(value || 0);
    return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}


function openScheduleCellEditor(employeeIndex, day) {
    const schedule = getCurrentSchedule();
    if (!schedule?.employees?.[employeeIndex] || !day) return;
    selectedScheduleCells = new Set([getScheduleCellKey(employeeIndex, day)]);
    scheduleSelectionAnchor = null;
    updateScheduleSelectionUI();
    openScheduleCellsEditor([{ employeeIndex, day }]);
}

function openSelectedScheduleCellsEditor() {
    const cells = [...selectedScheduleCells].map(parseScheduleCellKey).filter(Boolean);
    if (!cells.length) {
        showToast('Сначала выделите ячейки', 'warning');
        return;
    }
    openScheduleCellsEditor(cells);
}

function openScheduleCellsEditor(cells) {
    const schedule = getCurrentSchedule();
    if (!schedule || !cells.length) return;
    const validCells = cells.filter(cell => schedule.employees[cell.employeeIndex] && cell.day >= 1 && cell.day <= schedule.dayCount);
    if (!validCells.length) return;

    editingScheduleCell = { scheduleKey: schedule.key, cells: validCells };
    const contexts = getEditingScheduleContexts();
    const subtitle = document.getElementById('scheduleCellModalSubtitle');
    if (subtitle) {
        if (contexts.length === 1) {
            const ctx = contexts[0];
            subtitle.innerHTML = `<strong>${escapeHtml(ctx.employee.fullName)}</strong><span>${escapeHtml(ctx.employee.position || 'Без должности')} · ${ctx.day} ${RU_MONTH_NAMES[schedule.month].toLowerCase()}</span>`;
        } else {
            const employeeCount = new Set(contexts.map(ctx => ctx.employeeIndex)).size;
            const days = [...new Set(contexts.map(ctx => ctx.day))].sort((a, b) => a - b);
            const dayText = days.length === 1 ? `${days[0]} ${RU_MONTH_NAMES[schedule.month].toLowerCase()}` : `${days[0]}–${days[days.length - 1]} ${RU_MONTH_NAMES[schedule.month].toLowerCase()}`;
            subtitle.innerHTML = `<strong>${contexts.length} ${pluralizeRu(contexts.length, 'ячейка', 'ячейки', 'ячеек')} выбрано</strong><span>${employeeCount} ${pluralizeRu(employeeCount, 'сотрудник', 'сотрудника', 'сотрудников')} · ${dayText}</span>`;
        }
    }

    const positionShifts = contexts.flatMap(ctx => getSchedulesForPosition(ctx.employee.position)).filter(t => parseTimeRange(t));
    const shiftsList = [...new Set([...positionShifts, ...DEFAULT_MANUAL_SHIFTS])];
    const currentInfos = contexts.map(ctx => ctx.employee.days[ctx.day] || emptyScheduleDayInfo());
    const workOptions = document.getElementById('scheduleCellWorkOptions');
    if (workOptions) {
        workOptions.innerHTML = shiftsList.map(time => {
            const color = getScheduleShiftColor(schedule, time);
            const code = getWorkCodeForTime(time);
            const active = currentInfos.length > 0 && currentInfos.every(info => info.working && info.time === time);
            return `<button class="schedule-cell-option work ${active ? 'active' : ''}" onclick="setEditingScheduleWork('${time}')">
                <i style="background:#${color}"></i>
                <span><strong>${escapeHtml(code)}</strong><small>${escapeHtml(time)}</small></span>
            </button>`;
        }).join('');
    }

    const absenceOptions = document.getElementById('scheduleCellAbsenceOptions');
    if (absenceOptions) {
        absenceOptions.innerHTML = SCHEDULE_ABSENCE_OPTIONS.map((option, index) => {
            const active = currentInfos.length > 0 && currentInfos.every(info => !info.working && info.raw === option.raw);
            return `<button class="schedule-cell-option absence-option ${active ? 'active' : ''}" onclick="setEditingScheduleAbsence(${index})">
                <i style="background:#${getScheduleAbsenceColor(schedule, option.raw)}"></i>
                <span><strong>${escapeHtml(option.raw)}</strong><small>${escapeHtml(option.status)}</small></span>
            </button>`;
        }).join('');
    }

    const sameTime = currentInfos.length > 0 && currentInfos.every(info => info.time && info.time === currentInfos[0].time) ? currentInfos[0].time : '';
    if (sameTime) {
        const parsed = sameTime.split('-');
        if (parsed.length === 2) {
            const start = document.getElementById('scheduleCustomStart');
            const end = document.getElementById('scheduleCustomEnd');
            if (start) start.value = parsed[0];
            if (end) end.value = parsed[1];
        }
    }

        document.getElementById('scheduleCellModal')?.classList.add('active');
}

function closeScheduleCellEditor() {
    const modal = document.getElementById('scheduleCellModal');
    if (modal) modal.classList.remove('active');
    editingScheduleCell = null;
}

function getEditingScheduleContexts() {
    if (!editingScheduleCell) return [];
    const schedule = monthlySchedules[editingScheduleCell.scheduleKey];
    if (!schedule) return [];
    const cells = editingScheduleCell.cells || (editingScheduleCell.employeeIndex !== undefined ? [{ employeeIndex: editingScheduleCell.employeeIndex, day: editingScheduleCell.day }] : []);
    return cells.map(cell => ({
        schedule,
        employee: schedule.employees[cell.employeeIndex],
        employeeIndex: cell.employeeIndex,
        day: cell.day
    })).filter(ctx => ctx.employee && ctx.day >= 1 && ctx.day <= schedule.dayCount);
}

function setEditingScheduleWork(time) {
    const contexts = getEditingScheduleContexts();
    if (!contexts.length || !parseTimeRange(time)) return;
    if (!applyScheduleWorkToContexts(contexts, time)) return;
    persistScheduleCellEdit(contexts[0].schedule, contexts.length);
}

function setEditingScheduleAbsence(optionIndex) {
    const contexts = getEditingScheduleContexts();
    const option = SCHEDULE_ABSENCE_OPTIONS[optionIndex];
    if (!contexts.length || !option) return;
    if (!applyScheduleAbsenceToContexts(contexts, option)) return;
    persistScheduleCellEdit(contexts[0].schedule, contexts.length);
}

function clearEditingScheduleCell() {
    const contexts = getEditingScheduleContexts();
    if (!contexts.length) return;
    contexts.forEach(ctx => { ctx.employee.days[ctx.day] = emptyScheduleDayInfo(); });
    persistScheduleCellEdit(contexts[0].schedule, contexts.length);
}

function applyCustomScheduleTime() {
    const start = document.getElementById('scheduleCustomStart')?.value;
    const end = document.getElementById('scheduleCustomEnd')?.value;
    if (!start || !end) {
        showToast('Укажите начало и окончание смены', 'warning');
        return;
    }
    setEditingScheduleWork(`${normalizeClock(start)}-${normalizeClock(end)}`);
}

function persistScheduleCellEdit(schedule, count = 1) {
    schedule.updatedAt = new Date().toISOString();
    schedule.sourceName = schedule.createdManually ? 'Создано на сайте' : (schedule.sourceName || 'Excel');
    saveData();
    closeScheduleCellEditor();
    renderScheduleLegend(schedule);
    renderScheduleMonthTable(schedule);
    renderScheduleDay();
    renderDashboardScheduleSummary();
    if (count > 1) showToast(`✅ Обновлено ${count} ${pluralizeRu(count, 'ячейка', 'ячейки', 'ячеек')}`, 'success');
}


function getAvailableScheduleWorkTimes(schedule) {
    if (!schedule) return [];
    const fromPositions = Object.values(positions || {}).flat().filter(t => parseTimeRange(t));
    const fromLegend = Object.values(schedule.legend || {}).filter(t => parseTimeRange(t));
    const fromCells = [];
    (schedule.employees || []).forEach(emp => {
        Object.values(emp.days || {}).forEach(info => {
            if (info?.working && info.time && parseTimeRange(info.time)) fromCells.push(info.time);
        });
    });
    const fromSettings = Object.keys(ensureScheduleColorSettings(schedule).work || {}).filter(t => parseTimeRange(t));
    return [...new Set([...DEFAULT_MANUAL_SHIFTS, ...fromPositions, ...fromLegend, ...fromCells, ...fromSettings])];
}

function openScheduleColorsEditor() {
    const schedule = getCurrentSchedule();
    if (!schedule) {
        showToast('Сначала создайте или откройте график', 'warning');
        return;
    }
    const settings = ensureScheduleColorSettings(schedule);
    editingScheduleColors = {
        scheduleKey: schedule.key,
        work: { ...settings.work },
        absence: { ...settings.absence }
    };

    const subtitle = document.getElementById('scheduleColorsModalSubtitle');
    if (subtitle) subtitle.textContent = `Настройте цвета для месяца «${schedule.title}». Изменения сразу применятся ко всем таким сменам в этом месяце.`;

    renderScheduleColorsEditor();
    document.getElementById('scheduleColorsModal')?.classList.add('active');
}

function renderScheduleColorsEditor() {
    if (!editingScheduleColors) return;
    const schedule = monthlySchedules[editingScheduleColors.scheduleKey];
    if (!schedule) return;
    const workList = document.getElementById('scheduleColorsWorkList');
    const absenceList = document.getElementById('scheduleColorsAbsenceList');
    const times = getAvailableScheduleWorkTimes(schedule);
    if (workList) {
        workList.innerHTML = times.map(time => {
            const color = normalizeHexColor(editingScheduleColors.work[time] || getScheduleShiftColor(schedule, time));
            return `<label class="schedule-color-editor-item">
                <span class="schedule-color-editor-main">
                    <i style="background:#${color}"></i>
                    <span><strong>${escapeHtml(getWorkCodeForTime(time))}</strong><small>${escapeHtml(time)}</small></span>
                </span>
                <input type="color" value="#${color}" data-type="work" data-key="${escapeHtml(time)}" onchange="updateScheduleColorDraft(this)" />
            </label>`;
        }).join('');
    }
    if (absenceList) {
        absenceList.innerHTML = SCHEDULE_ABSENCE_OPTIONS.map(option => {
            const color = normalizeHexColor(editingScheduleColors.absence[option.raw] || getScheduleAbsenceColor(schedule, option.raw));
            return `<label class="schedule-color-editor-item">
                <span class="schedule-color-editor-main">
                    <i style="background:#${color}"></i>
                    <span><strong>${escapeHtml(option.raw)}</strong><small>${escapeHtml(option.status)}</small></span>
                </span>
                <input type="color" value="#${color}" data-type="absence" data-key="${escapeHtml(option.raw)}" onchange="updateScheduleColorDraft(this)" />
            </label>`;
        }).join('');
    }
}

function updateScheduleColorDraft(input) {
    if (!editingScheduleColors || !input) return;
    const type = input.dataset.type;
    const key = input.dataset.key;
    const value = normalizeHexColor(input.value);
    if (!key || !['work', 'absence'].includes(type)) return;
    editingScheduleColors[type][key] = value;
    const preview = input.closest('.schedule-color-editor-item')?.querySelector('i');
    if (preview) preview.style.background = `#${value}`;
}

function resetScheduleColorsEditor() {
    if (!editingScheduleColors) return;
    const schedule = monthlySchedules[editingScheduleColors.scheduleKey];
    if (!schedule) return;
    editingScheduleColors.work = {};
    getAvailableScheduleWorkTimes(schedule).forEach(time => {
        editingScheduleColors.work[time] = normalizeHexColor(getColorForShiftTime(time));
    });
    editingScheduleColors.absence = {};
    SCHEDULE_ABSENCE_OPTIONS.forEach(option => {
        editingScheduleColors.absence[option.raw] = normalizeHexColor(option.color);
    });
    renderScheduleColorsEditor();
}

function applyScheduleColorsEditor() {
    if (!editingScheduleColors) return;
    const schedule = monthlySchedules[editingScheduleColors.scheduleKey];
    if (!schedule) return;
    ensureScheduleColorSettings(schedule);
    schedule.colorSettings.work = { ...schedule.colorSettings.work, ...editingScheduleColors.work };
    schedule.colorSettings.absence = { ...schedule.colorSettings.absence, ...editingScheduleColors.absence };

    const nextLegend = {};
    Object.keys(schedule.colorSettings.work).forEach(time => {
        if (parseTimeRange(time)) nextLegend[normalizeHexColor(schedule.colorSettings.work[time])] = time;
    });
    schedule.legend = nextLegend;

    (schedule.employees || []).forEach(emp => {
        Object.values(emp.days || {}).forEach(info => {
            if (!info) return;
            if (info.working && info.time) info.color = getScheduleShiftColor(schedule, info.time);
            if (!info.working && info.raw) info.color = getScheduleAbsenceColor(schedule, info.raw);
        });
    });

    schedule.updatedAt = new Date().toISOString();
    saveData();
    closeScheduleColorsEditor();
    renderScheduleLegend(schedule);
    renderScheduleMonthTable(schedule);
    renderScheduleDay();
    renderDashboardScheduleSummary();
    showToast('✅ Цвета смен обновлены', 'success');
}

function closeScheduleColorsEditor() {
    const modal = document.getElementById('scheduleColorsModal');
    if (modal) modal.classList.remove('active');
    editingScheduleColors = null;
}

function selectTodayInSchedule() {
    const today = toLocalISODate();
    const key = today.slice(0, 7);
    if (monthlySchedules[key]) {
        selectScheduleMonth(key, false);
        const input = document.getElementById('scheduleDate');
        if (input) input.value = today;
        renderScheduleTab();
    } else {
        showToast('На текущий месяц график не загружен', 'warning');
    }
}

function deleteScheduleMonth() {
    const schedule = getCurrentSchedule();
    if (!schedule) return;
    if (!confirm(`Удалить загруженный график за ${schedule.title}?`)) return;
    delete monthlySchedules[schedule.key];
    currentScheduleKey = Object.keys(monthlySchedules).sort().reverse()[0] || null;
    saveData();
    initScheduleUI();
    renderDashboardScheduleSummary();
    showToast('График удалён', 'warning');
}

function createShiftFromSchedule() {
    const schedule = getCurrentSchedule();
    const date = getScheduleSelectedDate();
    if (!schedule || !date) {
        showToast('Сначала загрузите график и выберите дату', 'warning');
        return;
    }
    const entries = rosterForDate(date);
    if (!entries.length) {
        showToast('В выбранный день нет рабочих смен', 'warning');
        return;
    }

    const name = 'По графику';
    const shiftId = `${date}_${name}`;
    if (shifts[shiftId]) { loadShift(shiftId); switchTab('shifts'); return; }

    shifts[shiftId] = {
        id: shiftId,
        date,
        name,
        people: entries.map((entry, i) => {
            const base = findBaseEmployeeByScheduleName(entry.fullName);
            return {
                id: base?.id || `schedule_${schedule.key}_${entry.sourceRow}_${i}`,
                fullName: entry.fullName,
                position: entry.position,
                phone: base?.phone || '',
                time: entry.time || '',
                present: false, reviewed: false
            };
        })
    };
    currentShiftId = shiftId;
    saveData();
    renderShiftsList();
    renderShift();
    renderShiftDisplay();
    populateCopyFromSelect();
    showToast(`✅ Смена создана: ${entries.length} сотрудников`, 'success');
    switchTab('shifts');
}

function exportScheduleDay() {
    const schedule = getCurrentSchedule();
    const date = getScheduleSelectedDate();
    if (!schedule || !date) { showToast('Нет данных для экспорта', 'warning'); return; }
    const entries = getScheduleEntriesForSelectedDay().filter(e => e.dayInfo.working);
    if (!entries.length) { showToast('В этот день нет рабочих смен', 'warning'); return; }

    const data = [
        ['СПИСОК СОТРУДНИКОВ ПО ГРАФИКУ'],
        [`Дата: ${date}`],
        [],
        ['№', 'ФИО', 'Должность', 'Телефон', 'Значение в графике', 'Время']
    ];
    let n = 0;
    groupScheduleEmployees(schedule, entries).forEach(group => {
        data.push([]);
        data.push([group.position.toUpperCase()]);
        group.employees
            .sort((a, b) => (a.dayInfo.time || '').localeCompare(b.dayInfo.time || '') || a.fullName.localeCompare(b.fullName, 'ru'))
            .forEach(entry => {
                n++;
                const base = findBaseEmployeeByScheduleName(entry.fullName);
                data.push([n, entry.fullName, entry.position, base?.phone || '', entry.dayInfo.raw || '', entry.dayInfo.time || 'Время не определено']);
            });
    });
    const outWb = XLSX.utils.book_new();
    const outWs = XLSX.utils.aoa_to_sheet(data);
    outWs['!cols'] = [{ wch: 6 }, { wch: 38 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(outWb, outWs, 'По графику');
    XLSX.writeFile(outWb, `график_${date}.xlsx`);
    showToast('📥 Список Excel скачан', 'success');
}

function printScheduleDay() {
    const tab = document.getElementById('tab-schedule');
    if (!tab) return;
    document.body.classList.add('print-schedule-mode');
    window.print();
    setTimeout(() => document.body.classList.remove('print-schedule-mode'), 300);
}

function rosterForDate(date) {
    const schedule = monthlySchedules[date.slice(0,7)];
    const people = new Map();
    for (const emp of schedule?.employees || []) {
        const info = emp.days[Number(date.slice(8))];
        if (!info?.working || /^(?:ваканси|самозанятые$)/i.test(emp.fullName.trim())) continue;
        const key = emp.baseId || normalizeEmployeeNameForMatch(emp.fullName);
        let person = people.get(key);
        if (!person) {
            person = {fullName:emp.fullName, baseId:emp.baseId, position:emp.position, time:'', times:new Set(), sourceRow:emp.sourceRow};
            people.set(key,person);
        }
        if (info.time) person.times.add(info.time);
    }
    for (const person of people.values()) {
        person.time = person.times.size === 1 ? [...person.times][0] : '';
        person.timeLabel = person.times.size > 1 ? 'Сверить интервалы: ' + [...person.times].join(', ') : person.time || 'Время уточняется';
    }
    return [...people.values()].sort((a,b) => (a.time || '99').localeCompare(b.time || '99') || a.fullName.localeCompare(b.fullName,'ru'));
}

function shiftRunning(time, startDate, now) {
    const range = parseTimeRange(time);
    if (!range) return false;
    const [y,m,d] = startDate.split('-').map(Number);
    const start = new Date(y,m-1,d,0,range.start);
    const end = new Date(y,m-1,d + (range.end <= range.start ? 1 : 0),0,range.end);
    return start <= now && now < end;
}

function isEntryActiveNow(entry, selectedDate) {
    return !!entry.dayInfo.working && shiftRunning(entry.dayInfo.time,selectedDate,new Date());
}

let rosterView = 'day';
function changeRosterView(value) { rosterView = value; renderDashboardScheduleSummary(); }

function renderDashboardScheduleSummary() {
    const container = document.getElementById('dashboardScheduleSummary');
    if (!container) return;
    const now = new Date(), today = toLocalISODate(now);
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate()-1);
    const yesterday = toLocalISODate(yesterdayDate);
    const schedule = monthlySchedules[today.slice(0,7)];
    const day = rosterForDate(today);
    const night = rosterForDate(yesterday).filter(p => shiftRunning(p.time,yesterday,now));
    const current = day.filter(p => shiftRunning(p.time,today,now));
    const activeKeys = new Set(current.map(p => normalizeEmployeeNameForMatch(p.fullName)));
    const carryOver = night.filter(p => !activeKeys.has(normalizeEmployeeNameForMatch(p.fullName)));
    const active = [...carryOver.map(p => ({...p, timeLabel:p.time+' · со вчера'})), ...current];
    const items = rosterView === 'now' ? active : day;
    const groups = new Map();
    items.forEach(person => {
        if (!groups.has(person.timeLabel)) groups.set(person.timeLabel,[]);
        groups.get(person.timeLabel).push(person);
    });
    const unresolved = (schedule?.employees || []).flatMap(p=>{
        const d = p.days[Number(today.slice(8))];
        if (!d || d.working || !d.raw || /^(в|выходной|от|б|до|ув|нн|прогул|0)$/i.test(d.raw)) return [];
        return [escapeHtml(p.fullName)+' · '+escapeHtml(d.raw)];
    });
    const missing = day.filter(p => !p.time).length;
    const buttons = '<div class="roster-tools"><button type="button" class="btn btn-outline btn-sm" onclick="chooseTodayFile()">Загрузить график</button></div>';
    const heading = document.getElementById('dashboardDateText');
    if (heading) heading.textContent = now.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    const info = schedule ? '<p class="roster-source">'+escapeHtml(schedule.sheetName || schedule.title)
        + (schedule.importedAt ? ' · загружен '+new Date(schedule.importedAt).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '')+'</p>' : '';
    if (!schedule && !active.length) {
        container.innerHTML = '<p>Загрузите файл графика. Список сотрудников будет меняться каждый день автоматически.</p>'+buttons;
        return;
    }
    container.innerHTML = info + '<div class="roster-tabs" aria-label="Период списка">'
        +'<button aria-pressed="'+(rosterView==='day')+'" onclick="changeRosterView(\'day\')">На сегодня · '+day.length+'</button>'
        +'<button aria-pressed="'+(rosterView==='now')+'" onclick="changeRosterView(\'now\')">Сейчас · '+active.length+'</button></div>'
        +(rosterView==='now' && missing ? '<p class="roster-source">У '+missing+' чел. время уточняется. Они в списке «На сегодня».</p>' : '')
        +'<div class="roster-groups">'+([...groups].map(([label,group]) =>
            '<section class="roster-group"><h4>'+escapeHtml(label.replace(/(\d)-(\d)/g,'$1–$2'))+' <small>'+group.length+' чел.</small></h4><ul>'
            +group.map(p=>'<li><strong>'+escapeHtml(p.fullName)+'</strong><span>'+escapeHtml(p.position)+'</span></li>').join('')+'</ul></section>').join('')
            || '<p>'+(rosterView==='now' ? 'Сейчас нет сотрудников с подтверждённым временем по графику.' : schedule ? 'На сегодня рабочие смены не запланированы.' : 'График на этот месяц ещё не загружен.')+'</p>')+'</div>'
        + (rosterView==='day' && unresolved.length ? '<details class="roster-google"><summary>Проверить обозначения · '+unresolved.length+'</summary>'+unresolved.map(x=>'<p>'+x+'</p>').join('')+'</details>' : '')
        + (rosterView==='now' && now.getDate()===1 && !monthlySchedules[yesterday.slice(0,7)] ? '<p class="roster-source">Для ночных смен со вчера нужен график за предыдущий месяц.</p>' : '')
        + '<div class="roster-tools">'+(day.length ? '<button type="button" class="btn btn-primary btn-sm" onclick="openRosterReview()">Сверить выход за сегодня</button>' : '')
        + '<button type="button" class="btn btn-outline btn-sm" onclick="chooseTodayFile()">Обновить из файла</button></div>';
}

function chooseTodayFile() {
    const input = document.getElementById('scheduleFileInput');
    input.dataset.month = toLocalISODate().slice(0,7);
    input.click();
}

let reviewDate = '', reviewPeople = [], reviewChoices = new Map();
function openRosterReview() {
    reviewDate = toLocalISODate();
    reviewPeople = rosterForDate(reviewDate);
    if (!reviewPeople.length) { showToast('На сегодня нет сотрудников по графику.','info'); return; }
    const planId = reviewDate+'_По графику';
    const prior = [...(shifts[planId]?.people || []), ...Object.values(shifts).filter(s=>s.date===reviewDate && s.id!==planId).flatMap(s=>s.people || [])];
    reviewChoices = new Map();
    for (const [i,person] of reviewPeople.entries()) {
        const old = prior.find(p => normalizeEmployeeNameForMatch(p.fullName) === normalizeEmployeeNameForMatch(person.fullName));
        reviewChoices.set(i, old && old.reviewed !== false ? !!old.present : true);
    }
    const select = document.getElementById('rosterReviewTime');
    select.replaceChildren(new Option('Весь день',''));
    for (const label of new Set(reviewPeople.map(p => p.timeLabel))) select.add(new Option(label,label));
    document.getElementById('rosterReviewDate').textContent = reviewDate.split('-').reverse().join('.');
    renderRosterReview();
    document.getElementById('rosterReview').showModal();
}

function reviewEntries() {
    const group = document.getElementById('rosterReviewTime').value;
    return [...reviewPeople.entries()].filter(([,p])=> !group || p.timeLabel === group);
}

function renderRosterReview() {
    const entries = reviewEntries();
    document.getElementById('rosterReviewList').innerHTML = entries.map(([i,p])=>
        '<label class="roster-review-person"><input type="checkbox" data-index="'+i+'" '+(reviewChoices.get(i)?'checked':'')+'><span><strong>'+escapeHtml(p.fullName)+'</strong><small>'+escapeHtml(p.position)+' · '+escapeHtml(p.timeLabel)+'</small></span></label>').join('');
    updateReviewCount();
}

function updateReviewCount() {
    const entries = reviewEntries();
    document.getElementById('rosterReviewCount').textContent = 'На месте: '+entries.filter(([i])=>reviewChoices.get(i)).length+' из '+entries.length;
}

function commitRosterReview() {
    const date = reviewDate, name = 'По графику', id = date+'_'+name;
    if (date !== toLocalISODate()) {
        document.getElementById('rosterReview').close();
        renderDashboardScheduleSummary(); showToast('Дата изменилась. Откройте список на новый день.','info'); return;
    }
    const currentPlan = rosterForDate(date);
    const signature = list => JSON.stringify(list.map(p=>[p.fullName,p.timeLabel,p.position]));
    if (signature(reviewPeople) !== signature(currentPlan)) {
        document.getElementById('rosterReview').close();
        renderDashboardScheduleSummary(); showToast('План изменился. Сверьте обновлённый список.','warning'); return;
    }
    const old = shifts[id];
    const people = (old?.people || []).map(p=>({...p}));
    for (const [i,entry] of reviewEntries()) {
        const base = findBaseEmployeeByScheduleName(entry.fullName);
        let person = people.find(p=> normalizeEmployeeNameForMatch(p.fullName) === normalizeEmployeeNameForMatch(entry.fullName));
        if (!person) {
            person = {id:base?.id || generateId(), fullName:entry.fullName,position:entry.position,phone:base?.phone || '',time:entry.time};
            people.push(person);
        }
        person.present = reviewChoices.get(i);
        person.reviewed = true;
    }
    const next = {...shifts, [id]:{...old,id,date,name,people}};
    try { localStorage.setItem(KEYS.SHIFTS,JSON.stringify(next)); } catch {
        showToast('Не удалось сохранить факт: проверьте свободное место в браузере.','error'); return;
    }
    shifts = next;
    document.getElementById('rosterReview').close();
    updateStats(); renderRecentShifts(); populateCopyFromSelect(); loadShift(id); switchTab('shifts');
    showToast('Выход сотрудников сохранён','success');
}

function initRoster() {
    document.getElementById('scheduleFileInput').addEventListener('change',importMonthlySchedule);
    document.getElementById('rosterReviewTime').addEventListener('change',renderRosterReview);
    document.getElementById('rosterReviewList').addEventListener('change',e=>{
        if (e.target.matches('input[data-index]')) reviewChoices.set(Number(e.target.dataset.index),e.target.checked);
        updateReviewCount();
    });
    document.getElementById('rosterCheckGroup').addEventListener('click',()=>{
        reviewEntries().forEach(([i])=>reviewChoices.set(i,true)); renderRosterReview();
    });
    document.getElementById('rosterReviewSave').addEventListener('click',commitRosterReview);
    let lastMinute = '';
    const refresh = () => {
        if (document.hidden) return;
        const now = new Date(), minute = toLocalISODate(now)+' '+now.getHours()+':'+now.getMinutes();
        if (minute !== lastMinute) {
            lastMinute=minute;
            if (document.getElementById('tab-dashboard').classList.contains('active')) { renderDashboardScheduleSummary(); updateStats(); }
        }
    };
    window.setInterval(refresh,15000);
    document.addEventListener('visibilitychange',refresh);
    window.addEventListener('storage',e=>{
        if (!Object.values(KEYS).includes(e.key)) return;
        loadData(); renderDashboardScheduleSummary(); updateStats();
        if (document.getElementById('rosterReview').open) {
            document.getElementById('rosterReview').close(); showToast('Данные изменились в другой вкладке. Сверьте список ещё раз.','info');
        }
    });
    initGoogleRoster();
}
document.addEventListener('DOMContentLoaded',initRoster);

// Доступ к закрытой таблице от имени пользователя. Токен живёт только в этой вкладке.
function initGoogleRoster() {
    const box = document.getElementById('googleSetup');
    const link = document.getElementById('googleSheetLink');
    const client = document.getElementById('googleClientId');
    const button = document.getElementById('connectGoogle');
    const status = document.getElementById('googleStatus');
    let token = '', expiry = 0, sourceId = '', busy = false, loading = false, syncing = false;
    try {
        const saved = JSON.parse(localStorage.getItem('roster_google_source') || '{}');
        link.value = saved.link || ''; client.value = saved.client || '';
    } catch { /* Пустая настройка источника. */ }
    const fieldMask = 'sheets(properties(title),data(startRow,startColumn,rowData(values(formattedValue,effectiveFormat(backgroundColor,backgroundColorStyle)))))';
    function report(message) { status.textContent = message; }
    box.addEventListener('toggle',()=>{
        if (!box.open || window.google?.accounts?.oauth2 || loading) return;
        if (location.protocol === 'file:') {
            report('Для подключения Google откройте сайт по HTTPS. На этом компьютере график можно загрузить из Excel.');
            button.disabled = true; return;
        }
        loading = true; button.disabled = true;
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.onload = ()=>{loading=false;button.disabled=false;};
        script.onerror = ()=>{loading=false;script.remove();report('Не удалось открыть вход Google. Проверьте интернет и раскройте настройки ещё раз.');};
        document.head.append(script);
    });
    async function getData(id,params) {
        const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+id+'?'+params,{
            headers:{Authorization:'Bearer '+token},cache:'no-store'
        });
        if (response.status === 401) { expiry=0; throw Error('Войдите в Google ещё раз. Сохранённый план доступен.'); }
        if (!response.ok) throw Error(response.status === 403 || response.status === 404 ? 'Проверьте доступ аккаунта к таблице и включение Google Sheets API.' : 'Не удалось получить таблицу. Проверьте интернет.');
        return response.json();
    }
    function rgb(value) {
        return value ? ['red','green','blue'].map(k=>Math.round((value[k] || 0)*255).toString(16).padStart(2,'0')).join('').toUpperCase() : '';
    }
    function gridForSheet(sheet) {
        const grid = [];
        for (const block of sheet.data || []) {
            (block.rowData || []).forEach((r,i)=>{
                const row = grid[(block.startRow || 0)+i] ||= [];
                (r.values || []).forEach((cell,j)=>{
                    if (!cell.formattedValue) return;
                    const fmt = cell.effectiveFormat || {};
                    row[(block.startColumn || 0)+j] = {v:cell.formattedValue,color:rgb(fmt.backgroundColorStyle?.rgbColor || fmt.backgroundColor)};
                });
            });
        }
        return grid;
    }
    async function refresh(manual) {
        if (busy || !token || (!manual && (!syncing || document.hidden))) return;
        if (Date.now() >= expiry) {
            syncing=false; report('Для новых изменений нужен повторный вход. На сайте сохранён последний график.'); return;
        }
        busy=true; button.disabled=true;
        const id=sourceId;
        try {
            const meta = await getData(id,new URLSearchParams({fields:'sheets(properties(title))'}));
            const key = toLocalISODate().slice(0,7);
            const names = selectRosterSheets(meta.sheets.map(s=>s.properties.title), key);
            const params = new URLSearchParams({fields:fieldMask});
            names.forEach(n=>params.append('ranges',"'"+n.replace(/'/g,"''")+"'"));
            const book = await getData(id,params);
            const plans = names.map(name=>{
                const sheet=book.sheets.find(s=>s.properties.title === name);
                const plan=scheduleFromGrid(gridForSheet(sheet),name,'Google Таблицы');
                plan.googleSheetId=id;
                return plan;
            });
            const fingerprint = plan => JSON.stringify(plan.employees.map(p=>[p.fullName,p.position,
                Object.values(p.days).map(d=>[d.raw,d.time,d.working,d.color])]));
            const changed = [];
            for (const plan of plans) {
                const old = monthlySchedules[plan.key];
                v6EnsureSchedule(plan);
                if (old?.googleSheetId === id && fingerprint(old) === fingerprint(plan)) continue;
                if (old && !manual && (old.googleSheetId !== id || old.updatedAt)) {
                    syncing=false;
                    throw Error('На сайте есть отдельная версия графика. Нажмите «Получить из Google», чтобы выбрать, заменить ли её.');
                }
                changed.push(plan);
            }
            if (changed.length && !installSchedules(changed,manual)) { syncing=false; report('Обновление отменено.'); return; }
            syncing=true;
            try {localStorage.setItem('roster_google_source',JSON.stringify({link:link.value.trim(), client:client.value.trim()}));} catch {}
            report('Проверено в '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+'. Следующая проверка через 5 минут, пока открыт сайт и действует вход.');
        } catch(e) {report(e.message);}
        finally {busy=false;button.disabled=false;}
    }
    button.addEventListener('click',()=>{
        const id=link.value.trim().match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:[/?#]|$)/)?.[1];
        const app=client.value.trim();
        if (!id || !/^[\w-]+\.apps\.googleusercontent\.com$/.test(app)) {report('Укажите ссылку на Google Таблицу и ID веб-клиента.'); return;}
        if (!window.google?.accounts?.oauth2) {report('Вход Google ещё недоступен.');return;}
        if (id === sourceId && token && Date.now() < expiry) {refresh(true);return;}
        const auth = google.accounts.oauth2.initTokenClient({client_id:app,scope:'https://www.googleapis.com/auth/spreadsheets.readonly',
            callback:result=>{
                if (result.error || !result.access_token) {report('Google не предоставил доступ.');return;}
                sourceId=id;token=result.access_token;expiry=Date.now()+(Number(result.expires_in)-30)*1000;
                refresh(true);
            },error_callback:()=>report('Вход не завершён. Можно продолжить с сохранённым графиком.')});
        auth.requestAccessToken({prompt:''});
    });
    window.setInterval(()=>refresh(false),5*60000);
    document.addEventListener('visibilitychange',()=>{if (!document.hidden && syncing) refresh(false);});
}


// ================================================================
//  СТАТИСТИКА
// ================================================================
function updateStats() {
    document.getElementById('statEmployees').textContent = employees.length;
    document.getElementById('statShifts').textContent = Object.keys(shifts).length;

    let present = 0, absent = 0;
    const today = toLocalISODate();
    const todayPeople = new Map();
    for (const shift of Object.values(shifts)) {
        if (shift.date !== today) continue;
        for (const p of shift.people || []) {
            const key = normalizeEmployeeNameForMatch(p.fullName) || p.id;
            if (!todayPeople.has(key) || p.present) todayPeople.set(key,p);
        }
    }
    {
        const people = [...todayPeople.values()];
        present += people.filter(p => p.present).length;
        absent += people.filter(p => !p.present).length;
    }

    document.getElementById('statPresent').textContent = present;
    document.getElementById('statAbsent').textContent = absent;
    updateNavBadges();
}

function renderRecentShifts() {
    const container = document.getElementById('recentShifts');
    const ids = Object.keys(shifts);
    if (ids.length === 0) {
        container.innerHTML = '<span class="empty-text">Нет созданных смен</span>';
        return;
    }
    ids.sort((a, b) => (shifts[b].date || '').localeCompare(shifts[a].date || ''));
    const recent = ids.slice(0, 5);
    container.innerHTML = recent.map(id => {
        const s = shifts[id];
        return `<div class="recent-item" onclick="loadShift('${id}');switchTab('shifts')">
            <span class="date">📅 ${s.date}</span>
            <span>${s.name}</span>
            <span class="count">${s.people.length} чел.</span>
        </div>`;
    }).join('');
}

// ================================================================
//  ЭКСПОРТ
// ================================================================
function exportExcel() {
    if (!currentShiftId || !shifts[currentShiftId]) { showToast('Нет активной смены!', 'error'); return; }
    const shift = shifts[currentShiftId];
    if (shift.people.length === 0) { showToast('Нет данных для экспорта!', 'error'); return; }

    const data = [
        ['СПИСОК ВЫХОДА СОТРУДНИКОВ НА РАБОТУ', '', '', '', '', '', ''],
        [`Дата: ${shift.date}, Смена: ${shift.name}`, '', '', '', '', '', ''],
        [],
        ['№', 'ФИО', 'Должность', 'Телефон', 'Родственники', 'Время', 'Статус']
    ];

    shift.people.forEach((p, i) => {
        data.push([i + 1, p.fullName, p.position || '', p.phone, getRelativesString(p.id) || '', p.time || '', p.present ? 'На месте' : p.reviewed === false ? 'Не отмечен' : 'Отсутствует']);
    });

    const present = shift.people.filter(p => p.present).length;
    const pending = shift.people.filter(p => p.reviewed === false && !p.present).length;
    data.push([]);
    data.push([`Всего: ${shift.people.length}, На месте: ${present}, Отсутствуют: ${shift.people.length - present - pending}, Не отмечены: ${pending}`]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 35 }, { wch: 16 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Смена');
    XLSX.writeFile(wb, `табель_${shift.date}_${shift.name}.xlsx`);
    showToast('📥 Excel скачан!', 'success');
}

function printShift() {
    if (!currentShiftId || !shifts[currentShiftId]) { showToast('Нет активной смены!', 'warning'); return; }
    window.print();
}

// ================================================================
//  БЭКАП
// ================================================================
function downloadBackup() {
    const data = { version: '2.0', date: new Date().toISOString(), employees, positions, shifts, monthlySchedules };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evacuation_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 Бэкап скачан', 'success');
}

function restoreBackup() {
    const input = document.getElementById('backupFileInput');
    if (!input.files.length) { showToast('Выберите файл!', 'warning'); return; }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.employees || !data.positions || !data.shifts) {
                showToast('Неверный формат файла!', 'error');
                return;
            }
            if (!confirm('Восстановить данные из бэкапа? Текущие данные будут заменены.')) return;

            employees = data.employees || [];
            positions = data.positions || {};
            shifts = data.shifts || {};
            monthlySchedules = data.monthlySchedules || {};

            saveData();
            populatePositionSelects();
            renderEmployees();
            renderPositions();
            renderShiftsList();
            renderRecentShifts();
            updateStats();
            initScheduleUI();
            renderDashboardScheduleSummary();

            if (Object.keys(shifts).length > 0) {
                currentShiftId = Object.keys(shifts)[0];
                renderShift();
                renderShiftDisplay();
            }

            input.value = '';
            showToast('✅ Данные восстановлены', 'success');
        } catch (error) {
            showToast('Ошибка чтения файла: ' + error.message, 'error');
        }
    };
    reader.readAsText(input.files[0]);
}

function exportCsv() {
    if (employees.length === 0) { showToast('Нет данных для экспорта', 'warning'); return; }
    let csv = 'ФИО,Должность,Телефон,Родственник,Телефон родственника\n';
    employees.forEach(e => {
        const rel = e.relatives.length > 0 ? e.relatives[0] : { name: '', phone: '' };
        csv += `"${e.fullName}","${e.position || ''}","${e.phone}","${rel.name}","${rel.phone}"\n`;
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 CSV скачан', 'success');
}

function exportJson() {
    const data = { version: '2.0', date: new Date().toISOString(), employees, positions, shifts, monthlySchedules };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 JSON скачан', 'success');
}

// ================================================================
//  ЗАПУСК
// ================================================================
document.addEventListener('DOMContentLoaded', init);
// ================================================================
//  SCHEDULE PRO V6 — advanced editor
// ================================================================
const SCHEDULE_TEMPLATES_KEY_V6 = 'app_schedule_cycle_templates_v6';
let scheduleTemplatesV6 = {};
let scheduleHistoryV6 = {};
let scheduleClipboardV6 = null;
let editingShiftTypesV6 = null;
let removedShiftTypeIdsV6 = new Set();
let scheduleValidationIssuesV6 = [];

function v6Clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function v6ScheduleEmployeeKey(emp) {
    return emp?.baseId || normalizeEmployeeNameForMatch(emp?.fullName || '');
}

function v6DefaultSettings() {
    return {
        defaultMonthlyHours: 176,
        absenceReductionHours: 11,
        maxConsecutive: 4,
        minOffBlock: 2,
        maxOffBlock: 4,
        overtimeTolerance: 11,
        absenceReduceCodes: ['ОТ', 'Б', 'ДО']
    };
}

function v6MakeShiftId(time) {
    const cleaned = String(time || '').replace(/[^0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    return `shift_${cleaned || generateId()}`;
}

function v6IsNightTime(time) {
    const range = parseTimeRange(time);
    if (!range) return false;
    return range.start >= 18 * 60 || range.end <= range.start;
}

function v6BuildShiftType(time, sample = {}) {
    const parsed = String(time || '').split('-');
    const start = parsed[0] || '08:00';
    const end = parsed[1] || '20:00';
    const code = sample.code || sample.raw || getWorkCodeForTime(time);
    return {
        id: sample.id || v6MakeShiftId(time),
        code: String(code || '').trim() || getWorkCodeForTime(time),
        name: sample.name || (v6IsNightTime(time) ? 'Ночная смена' : 'Рабочая смена'),
        start,
        end,
        time,
        paidHours: Number.isFinite(Number(sample.paidHours)) ? Number(sample.paidHours) : getPaidHoursForTime(time),
        color: normalizeHexColor(sample.color || getColorForShiftTime(time))
    };
}

function v6EnsureSchedule(schedule) {
    if (!schedule) return null;
    schedule.settings = { ...v6DefaultSettings(), ...(schedule.settings || {}) };
    schedule.positionNorms = schedule.positionNorms || {};
    schedule.employeeTargets = schedule.employeeTargets || {};
    schedule.collapsedPositions = schedule.collapsedPositions || {};
    schedule.colorSettings = schedule.colorSettings || { work: {}, absence: {} };
    schedule.colorSettings.work = schedule.colorSettings.work || {};
    schedule.colorSettings.absence = schedule.colorSettings.absence || {};

    const sources = new Map();
    const hasExplicitShiftTypes = Array.isArray(schedule.shiftTypes) && schedule.shiftTypes.length > 0;
    if (hasExplicitShiftTypes) {
        schedule.shiftTypes.forEach(type => {
            const time = type.time || `${type.start || '08:00'}-${type.end || '20:00'}`;
            if (parseTimeRange(time)) sources.set(time, { ...type, time });
        });
    } else {
        DEFAULT_MANUAL_SHIFTS.forEach(time => sources.set(time, { time, color: getColorForShiftTime(time) }));
        Object.values(positions || {}).flat().filter(t => parseTimeRange(t)).forEach(time => {
            if (!sources.has(time)) sources.set(time, { time, color: getColorForShiftTime(time) });
        });
    }
    Object.entries(schedule.legend || {}).forEach(([color, time]) => {
        if (parseTimeRange(time) && (!hasExplicitShiftTypes || !sources.has(time))) sources.set(time, { ...(sources.get(time) || {}), time, color });
    });
    (schedule.employees || []).forEach(emp => {
        Object.values(emp.days || {}).forEach(info => {
            if (info?.working && info.time && parseTimeRange(info.time)) {
                const prev = sources.get(info.time) || {};
                sources.set(info.time, {
                    ...prev,
                    time: info.time,
                    raw: prev.raw || info.raw,
                    color: prev.color || info.color,
                    paidHours: Number.isFinite(Number(info.paidHours)) ? Number(info.paidHours) : prev.paidHours,
                    id: info.shiftId || prev.id,
                    name: info.shiftName || prev.name
                });
            }
        });
    });

    const existing = new Map((schedule.shiftTypes || []).map(type => [type.id, { ...type }]));
    const existingByTime = new Map((schedule.shiftTypes || []).map(type => [type.time, { ...type }]));
    const shiftTypes = [];
    sources.forEach((sample, time) => {
        const old = existingByTime.get(time) || (sample.id ? existing.get(sample.id) : null) || {};
        const type = v6BuildShiftType(time, { ...sample, ...old });
        type.id = old.id || sample.id || v6MakeShiftId(time);
        type.code = old.code || sample.raw || getWorkCodeForTime(time);
        type.name = old.name || sample.name || (v6IsNightTime(time) ? 'Ночная смена' : 'Рабочая смена');
        type.paidHours = Number.isFinite(Number(old.paidHours)) ? Number(old.paidHours) : (Number.isFinite(Number(sample.paidHours)) ? Number(sample.paidHours) : getPaidHoursForTime(time));
        type.color = normalizeHexColor(old.color || sample.color || schedule.colorSettings.work?.[time] || getColorForShiftTime(time));
        shiftTypes.push(type);
    });
    // Keep explicitly created custom types even if not yet used.
    (schedule.shiftTypes || []).forEach(type => {
        if (!shiftTypes.some(item => item.id === type.id)) {
            const time = type.time || `${type.start}-${type.end}`;
            if (parseTimeRange(time)) shiftTypes.push(v6BuildShiftType(time, type));
        }
    });
    schedule.shiftTypes = shiftTypes;

    schedule.shiftTypes.forEach(type => {
        schedule.colorSettings.work[type.time] = normalizeHexColor(type.color);
    });
    SCHEDULE_ABSENCE_OPTIONS.forEach(option => {
        if (!schedule.colorSettings.absence[option.raw]) schedule.colorSettings.absence[option.raw] = normalizeHexColor(option.color);
    });

    const typeByTime = new Map(schedule.shiftTypes.map(type => [type.time, type]));
    const typeById = new Map(schedule.shiftTypes.map(type => [type.id, type]));
    (schedule.employees || []).forEach(emp => {
        emp.days = emp.days || {};
        for (let d = 1; d <= schedule.dayCount; d++) {
            if (!emp.days[d]) emp.days[d] = emptyScheduleDayInfo();
            const info = emp.days[d];
            if (info?.working) {
                let type = info.shiftId ? typeById.get(info.shiftId) : null;
                if (!type && info.time) type = typeByTime.get(info.time);
                if (type) {
                    info.shiftId = type.id;
                    info.shiftName = type.name;
                    info.time = type.time;
                    info.color = type.color;
                    info.paidHours = type.paidHours;
                    if (!info.raw || info.raw === getWorkCodeForTime(info.time)) info.raw = type.code;
                }
            }
        }
    });

    getSchedulePositionOrder(schedule).forEach(pos => {
        if (!schedule.positionNorms[pos]) schedule.positionNorms[pos] = { totalMin: 0, dayMin: 0, nightMin: 0 };
    });
    return schedule;
}

function v6GetShiftTypes(schedule = getCurrentSchedule()) {
    v6EnsureSchedule(schedule);
    return schedule?.shiftTypes || [];
}

function v6FindShiftType(schedule, value) {
    if (!schedule || !value) return null;
    v6EnsureSchedule(schedule);
    return schedule.shiftTypes.find(type => type.id === value || type.time === value || type.code === value) || null;
}

// Override: shift color follows editable shift definition first.
function getScheduleShiftColor(schedule, time) {
    if (!schedule) return normalizeHexColor(getColorForShiftTime(time));
    const direct = (schedule.shiftTypes || []).find(type => type.time === time);
    if (direct?.color) return normalizeHexColor(direct.color);
    const color = schedule.colorSettings?.work?.[time];
    return normalizeHexColor(color || getColorForShiftTime(time));
}

// Override: paid hours can be explicitly edited in shift settings.
function getScheduleWorkHours(info) {
    if (!info || !info.working) return 0;
    if (Number.isFinite(Number(info.paidHours))) return Number(info.paidHours);
    if (info.time) return getPaidHoursForTime(info.time);
    const numeric = Number(String(info.raw || '').replace(',', '.'));
    return Number.isFinite(numeric) ? numeric : 0;
}

function v6PushHistory(schedule) {
    if (!schedule) return;
    const key = schedule.key;
    if (!scheduleHistoryV6[key]) scheduleHistoryV6[key] = { undo: [], redo: [] };
    const history = scheduleHistoryV6[key];
    history.undo.push(v6Clone(schedule));
    if (history.undo.length > 50) history.undo.shift();
    history.redo = [];
    v6UpdateHistoryButtons();
}

function v6UndoSchedule() {
    const schedule = getCurrentSchedule();
    if (!schedule) return;
    const history = scheduleHistoryV6[schedule.key];
    if (!history?.undo?.length) { showToast('Нет действий для отмены', 'info'); return; }
    history.redo.push(v6Clone(schedule));
    const previous = history.undo.pop();
    monthlySchedules[schedule.key] = previous;
    currentScheduleKey = previous.key;
    saveData();
    renderScheduleTab();
    v6UpdateHistoryButtons();
    showToast('↩️ Последнее действие отменено', 'info');
}

function v6RedoSchedule() {
    const schedule = getCurrentSchedule();
    if (!schedule) return;
    const history = scheduleHistoryV6[schedule.key];
    if (!history?.redo?.length) { showToast('Нет действий для возврата', 'info'); return; }
    history.undo.push(v6Clone(schedule));
    const next = history.redo.pop();
    monthlySchedules[schedule.key] = next;
    currentScheduleKey = next.key;
    saveData();
    renderScheduleTab();
    v6UpdateHistoryButtons();
    showToast('↪️ Действие возвращено', 'info');
}

function v6UpdateHistoryButtons() {
    const schedule = getCurrentSchedule();
    const history = schedule ? scheduleHistoryV6[schedule.key] : null;
    const undo = document.getElementById('scheduleUndoBtn');
    const redo = document.getElementById('scheduleRedoBtn');
    if (undo) undo.disabled = !history?.undo?.length;
    if (redo) redo.disabled = !history?.redo?.length;
}

function v6AfterMutation(schedule, message = '') {
    if (!schedule) return;
    schedule.updatedAt = new Date().toISOString();
    schedule.sourceName = schedule.createdManually ? 'Создано на сайте' : (schedule.sourceName || 'Excel');
    v6EnsureSchedule(schedule);
    saveData();
    renderScheduleLegend(schedule);
    populateScheduleBulkShiftSelect(schedule);
    renderScheduleMonthTable(schedule);
    renderScheduleDay();
    renderDashboardScheduleSummary();
    v6RenderCoverageSummary(schedule);
    v6UpdateHistoryButtons();
    const panel = document.getElementById('scheduleValidationPanel');
    if (panel) panel.style.display = 'none';
    if (message) showToast(message, 'success');
}

function v6AdjustedTargetHours(schedule, emp) {
    if (!schedule.settings) v6EnsureSchedule(schedule);
    const key = v6ScheduleEmployeeKey(emp);
    const base = Number(schedule.employeeTargets?.[key] ?? schedule.settings.defaultMonthlyHours ?? 176);
    const reduction = Number(schedule.settings.absenceReductionHours || 0);
    const codes = new Set(schedule.settings.absenceReduceCodes || ['ОТ', 'Б', 'ДО']);
    let days = 0;
    for (let d = 1; d <= schedule.dayCount; d++) {
        const info = emp.days?.[d];
        if (info && !info.working && codes.has(info.raw)) days++;
    }
    return Math.max(0, base - days * reduction);
}

function editScheduleEmployeeTarget(employeeIndex) {
    const schedule = getCurrentSchedule();
    const emp = schedule?.employees?.[employeeIndex];
    if (!schedule || !emp) return;
    const key = v6ScheduleEmployeeKey(emp);
    const current = Number(schedule.employeeTargets?.[key] ?? schedule.settings.defaultMonthlyHours ?? 176);
    const value = window.prompt(`Базовая норма часов для ${emp.fullName}:`, String(current));
    if (value === null) return;
    const num = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(num) || num < 0) { showToast('Введите корректное число часов', 'warning'); return; }
    v6PushHistory(schedule);
    schedule.employeeTargets[key] = num;
    v6AfterMutation(schedule, '✅ Норма часов обновлена');
}

function toggleSchedulePosition(position) {
    const schedule = getCurrentSchedule();
    if (!schedule) return;
    v6EnsureSchedule(schedule);
    schedule.collapsedPositions[position] = !schedule.collapsedPositions[position];
    saveData();
    renderScheduleMonthTable(schedule);
}

function v6CoverageForDay(schedule, day) {
    if (!schedule.positionNorms) v6EnsureSchedule(schedule);
    const groups = groupScheduleEmployees(schedule);
    return groups.map(group => {
        const norm = schedule.positionNorms[group.position] || { totalMin: 0, dayMin: 0, nightMin: 0 };
        const work = group.employees.filter(emp => emp.days?.[day]?.working);
        const night = work.filter(emp => v6IsNightTime(emp.days[day]?.time)).length;
        const dayCount = work.length - night;
        const total = work.length;
        const violations = [];
        if (Number(norm.totalMin) > 0 && total < Number(norm.totalMin)) violations.push(`всего ${total}/${norm.totalMin}`);
        if (Number(norm.dayMin) > 0 && dayCount < Number(norm.dayMin)) violations.push(`день ${dayCount}/${norm.dayMin}`);
        if (Number(norm.nightMin) > 0 && night < Number(norm.nightMin)) violations.push(`ночь ${night}/${norm.nightMin}`);
        return { position: group.position, total, day: dayCount, night, norm, violations };
    });
}

function v6DayCoverageBadge(schedule, day) {
    const coverage = v6CoverageForDay(schedule, day);
    const configured = coverage.some(item => Number(item.norm.totalMin) > 0 || Number(item.norm.dayMin) > 0 || Number(item.norm.nightMin) > 0);
    if (!configured) return { cls: 'none', text: '•', title: 'Нормативы не заданы' };
    const bad = coverage.filter(item => item.violations.length);
    if (!bad.length) return { cls: 'ok', text: '✓', title: 'Все нормативы выполнены' };
    return {
        cls: 'bad',
        text: String(bad.length),
        title: bad.map(item => `${item.position}: ${item.violations.join(', ')}`).join('; ')
    };
}

function v6RenderCoverageSummary(schedule) {
    const el = document.getElementById('scheduleCoverageSummary');
    if (!el) return;
    if (!schedule) { el.innerHTML = ''; return; }
    let day = getScheduleDayNumber();
    if (!day || day > schedule.dayCount) day = 1;
    const coverage = v6CoverageForDay(schedule, day);
    el.innerHTML = coverage.map(item => {
        const normSet = Number(item.norm.totalMin) || Number(item.norm.dayMin) || Number(item.norm.nightMin);
        const bad = item.violations.length > 0;
        return `<div class="schedule-coverage-card">
            <strong>${escapeHtml(item.position)} · ${day} число</strong>
            <div class="schedule-coverage-line"><span>Всего</span><span class="schedule-coverage-value ${bad && Number(item.norm.totalMin) > item.total ? 'bad' : 'good'}">${item.total}${Number(item.norm.totalMin) ? ` / ${item.norm.totalMin}` : ''}</span></div>
            <div class="schedule-coverage-line"><span>День</span><span class="schedule-coverage-value ${bad && Number(item.norm.dayMin) > item.day ? 'bad' : ''}">${item.day}${Number(item.norm.dayMin) ? ` / ${item.norm.dayMin}` : ''}</span></div>
            <div class="schedule-coverage-line"><span>Ночь</span><span class="schedule-coverage-value ${bad && Number(item.norm.nightMin) > item.night ? 'bad' : ''}">${item.night}${Number(item.norm.nightMin) ? ` / ${item.norm.nightMin}` : ''}</span></div>
            ${!normSet ? '<div class="schedule-coverage-line"><span>Норматив</span><span>не задан</span></div>' : ''}
        </div>`;
    }).join('');
}

// Override monthly table: day health badges, collapsible positions, target hours and comments.
function renderScheduleMonthTable(schedule) {
    const wrap = document.getElementById('scheduleMonthTableWrap');
    if (!wrap) return;
    if (!schedule) {
        selectedScheduleCells.clear();
        wrap.innerHTML = '<div class="schedule-editor-empty"><i class="fa-solid fa-table-cells-large"></i><strong>График ещё не создан</strong><span>Выберите месяц выше и нажмите «Создать график».</span></div>';
        updateScheduleSelectionUI();
        v6RenderCoverageSummary(null);
        return;
    }
    v6EnsureSchedule(schedule);

    const days = Array.from({ length: schedule.dayCount }, (_, i) => i + 1);
    const employeeList = schedule.employees.map((emp, index) => ({ ...emp, _scheduleIndex: index }));
    const groups = groupScheduleEmployees(schedule, employeeList);
    const dayHeaders = days.map(d => {
        const info = getScheduleDayHeaderInfo(schedule, d);
        const badge = v6DayCoverageBadge(schedule, d);
        return `<th class="schedule-day-head ${info.weekend ? 'weekend' : ''}" onclick="openScheduleDayDetails(${d})" title="${escapeHtml(badge.title)}"><span>${d}</span><small>${info.weekday}</small><b class="coverage-badge ${badge.cls}">${badge.text}</b></th>`;
    }).join('');

    const header = `<tr>
        <th class="schedule-sticky-name schedule-name-head">ФИО</th>
        ${dayHeaders}
        <th class="schedule-total-head">Часы</th>
        <th class="schedule-total-head">Норма</th>
        <th class="schedule-total-head">Δ</th>
        <th class="schedule-total-head">Смены</th>
    </tr>`;

    let visualRow = 0;
    const body = groups.map(group => {
        const collapsed = !!schedule.collapsedPositions[group.position];
        const groupHours = group.employees.reduce((sum, emp) => sum + days.reduce((s, d) => s + getScheduleWorkHours(emp.days[d]), 0), 0);
        const groupTarget = group.employees.reduce((sum, emp) => sum + v6AdjustedTargetHours(schedule, emp), 0);
        const groupShifts = group.employees.reduce((sum, emp) => sum + days.filter(d => emp.days[d]?.working).length, 0);
        const groupDelta = groupHours - groupTarget;
        const groupHeader = `<tr class="schedule-position-row ${collapsed ? 'collapsed' : ''}" data-position="${escapeHtml(group.position)}" onclick="toggleSchedulePosition(this.dataset.position)">
            <td colspan="${schedule.dayCount + 5}">
                <div class="schedule-position-title">
                    <span><b class="collapse-icon"><i class="fa-solid fa-chevron-down"></i></b><i class="fa-solid fa-briefcase"></i> ${escapeHtml(group.position)}</span>
                    <small>${group.employees.length} чел. · ${formatScheduleHours(groupHours)} / ${formatScheduleHours(groupTarget)} ч. · Δ ${groupDelta >= 0 ? '+' : ''}${formatScheduleHours(groupDelta)} · ${groupShifts} смен</small>
                </div>
            </td>
        </tr>`;
        if (collapsed) {
            visualRow += group.employees.length;
            return groupHeader;
        }

        const rows = group.employees.map(emp => {
            const rowIndex = visualRow++;
            const totalHours = days.reduce((sum, d) => sum + getScheduleWorkHours(emp.days[d]), 0);
            const target = v6AdjustedTargetHours(schedule, emp);
            const delta = totalHours - target;
            const totalShifts = days.filter(d => emp.days[d]?.working).length;
            const deltaClass = Math.abs(delta) < 0.01 ? 'hours-diff-good' : (Math.abs(delta) <= Number(schedule.settings.overtimeTolerance || 11) ? 'hours-diff-warn' : 'hours-diff-bad');
            const cells = days.map(d => {
                const info = emp.days[d] || emptyScheduleDayInfo();
                const dateInfo = getScheduleDayHeaderInfo(schedule, d);
                const style = info.color ? ` style="--cell-color:#${normalizeHexColor(info.color)}"` : '';
                const cls = info.working ? 'm-work' : (info.raw ? 'm-other' : 'm-off');
                const comment = String(info.comment || '').trim();
                const title = [info.shiftName || info.status, info.time, comment ? `Комментарий: ${comment}` : ''].filter(Boolean).join(' · ') || 'Пустая ячейка';
                const key = getScheduleCellKey(emp._scheduleIndex, d);
                const selectedClass = selectedScheduleCells.has(key) ? 'selected' : '';
                return `<td class="schedule-month-cell schedule-cell-editable ${cls} ${dateInfo.weekend ? 'weekend' : ''} ${selectedClass} ${comment ? 'schedule-cell-comment-mark' : ''}"${style}
                    data-employee-index="${emp._scheduleIndex}" data-day="${d}" data-row="${rowIndex}"
                    title="${escapeHtml(title)} — протяните мышкой для выделения, двойной клик для редактирования"
                    onmousedown="startScheduleCellSelection(event, ${emp._scheduleIndex}, ${d}, ${rowIndex})"
                    onmouseenter="extendScheduleCellSelection(event, ${emp._scheduleIndex}, ${d}, ${rowIndex})"
                    ondblclick="openScheduleCellEditor(${emp._scheduleIndex}, ${d})">${escapeHtml(info.raw || '')}</td>`;
            }).join('');
            return `<tr class="schedule-employee-row" data-employee-index="${emp._scheduleIndex}">
                <td class="schedule-sticky-name schedule-employee-name"><strong>${escapeHtml(emp.fullName)}</strong></td>
                ${cells}
                <td class="schedule-total-cell">${formatScheduleHours(totalHours)}</td>
                <td class="schedule-total-cell schedule-target-cell" ondblclick="editScheduleEmployeeTarget(${emp._scheduleIndex})" title="Двойной клик — изменить базовую норму">${formatScheduleHours(target)}<small>двойной клик</small></td>
                <td class="schedule-total-cell ${deltaClass}">${delta >= 0 ? '+' : ''}${formatScheduleHours(delta)}</td>
                <td class="schedule-total-cell">${totalShifts}</td>
            </tr>`;
        }).join('');
        return groupHeader + rows;
    }).join('');

    wrap.innerHTML = `<table class="schedule-month-table schedule-editor-table"><thead>${header}</thead><tbody>${body}</tbody></table>`;
    updateScheduleSelectionUI();
    v6RenderCoverageSummary(schedule);
}

function populateScheduleBulkShiftSelect(schedule) {
    const select = document.getElementById('scheduleBulkShiftSelect');
    if (!select) return;
    const current = select.value;
    const types = v6GetShiftTypes(schedule);
    select.innerHTML = '<option value="">Выберите смену…</option>' + types.map(type => `<option value="${escapeHtml(type.id)}">${escapeHtml(type.code)} · ${escapeHtml(type.name)} · ${escapeHtml(type.time)}</option>`).join('');
    if (current && types.some(type => type.id === current)) select.value = current;
    else {
        const preferred = types.find(type => type.time === '11:00-23:00') || types[0];
        if (preferred) select.value = preferred.id;
    }
}

function v6ApplyShiftToContexts(contexts, value) {
    if (!contexts.length) return false;
    const schedule = contexts[0].schedule;
    v6EnsureSchedule(schedule);
    let type = v6FindShiftType(schedule, value);
    if (!type && parseTimeRange(value)) {
        type = v6BuildShiftType(value, { color: getScheduleShiftColor(schedule, value) });
        if (!schedule.shiftTypes.some(item => item.id === type.id)) schedule.shiftTypes.push(type);
    }
    if (!type) return false;
    contexts.forEach(ctx => {
        const comment = ctx.employee.days?.[ctx.day]?.comment || '';
        ctx.employee.days[ctx.day] = {
            raw: type.code,
            color: type.color,
            kind: 'working',
            status: type.name || (v6IsNightTime(type.time) ? 'Ночная смена' : 'Рабочая смена'),
            working: true,
            time: type.time,
            shiftId: type.id,
            shiftName: type.name,
            paidHours: Number(type.paidHours || 0),
            comment
        };
    });
    schedule.colorSettings.work[type.time] = type.color;
    schedule.legend = schedule.legend || {};
    Object.keys(schedule.legend).forEach(color => { if (schedule.legend[color] === type.time) delete schedule.legend[color]; });
    schedule.legend[type.color] = type.time;
    return true;
}

function applyScheduleWorkToContexts(contexts, value) {
    return v6ApplyShiftToContexts(contexts, value);
}

function applyScheduleAbsenceToContexts(contexts, option) {
    if (!contexts.length || !option) return false;
    const schedule = contexts[0].schedule;
    v6EnsureSchedule(schedule);
    const color = getScheduleAbsenceColor(schedule, option.raw);
    contexts.forEach(ctx => {
        const comment = ctx.employee.days?.[ctx.day]?.comment || '';
        ctx.employee.days[ctx.day] = {
            raw: option.raw,
            color,
            kind: 'other',
            status: option.status,
            working: false,
            time: '',
            comment
        };
    });
    schedule.colorSettings.absence[option.raw] = color;
    return true;
}

function applyScheduleSelectionWork(value) {
    const contexts = getSelectedScheduleContexts();
    if (!contexts.length) { showToast('Сначала выделите ячейки', 'warning'); return; }
    const schedule = contexts[0].schedule;
    v6PushHistory(schedule);
    if (!v6ApplyShiftToContexts(contexts, value)) { scheduleHistoryV6[schedule.key].undo.pop(); return; }
    const type = v6FindShiftType(schedule, value);
    v6AfterMutation(schedule, `✅ ${type?.name || 'Смена'}: обновлено ${contexts.length} ${pluralizeRu(contexts.length, 'ячейка', 'ячейки', 'ячеек')}`);
}

function applyScheduleSelectionAbsence(raw) {
    const contexts = getSelectedScheduleContexts();
    if (!contexts.length) { showToast('Сначала выделите ячейки', 'warning'); return; }
    const option = SCHEDULE_ABSENCE_OPTIONS.find(item => item.raw === raw);
    if (!option) return;
    const schedule = contexts[0].schedule;
    v6PushHistory(schedule);
    applyScheduleAbsenceToContexts(contexts, option);
    v6AfterMutation(schedule, `✅ ${option.status}: обновлено ${contexts.length} ${pluralizeRu(contexts.length, 'ячейка', 'ячейки', 'ячеек')}`);
}

function clearSelectedScheduleCells() {
    const contexts = getSelectedScheduleContexts();
    if (!contexts.length) { showToast('Сначала выделите ячейки', 'warning'); return; }
    const schedule = contexts[0].schedule;
    v6PushHistory(schedule);
    contexts.forEach(ctx => {
        const comment = ctx.employee.days?.[ctx.day]?.comment || '';
        ctx.employee.days[ctx.day] = { ...emptyScheduleDayInfo(), comment };
    });
    v6AfterMutation(schedule, `✅ Очищено ${contexts.length} ${pluralizeRu(contexts.length, 'ячейка', 'ячейки', 'ячеек')}`);
}

function persistScheduleBulkEdit(schedule, count, label) {
    v6AfterMutation(schedule, `✅ ${label}: обновлено ${count} ${pluralizeRu(count, 'ячейка', 'ячейки', 'ячеек')}`);
}

function persistScheduleCellEdit(schedule, count = 1) {
    closeScheduleCellEditor();
    v6AfterMutation(schedule, count > 1 ? `✅ Обновлено ${count} ${pluralizeRu(count, 'ячейка', 'ячейки', 'ячеек')}` : '');
}

// Override detailed cell editor to use editable shift presets and comments.
function openScheduleCellsEditor(cells) {
    const schedule = getCurrentSchedule();
    if (!schedule || !cells.length) return;
    v6EnsureSchedule(schedule);
    const validCells = cells.filter(cell => schedule.employees[cell.employeeIndex] && cell.day >= 1 && cell.day <= schedule.dayCount);
    if (!validCells.length) return;
    editingScheduleCell = { scheduleKey: schedule.key, cells: validCells };
    const contexts = getEditingScheduleContexts();
    const subtitle = document.getElementById('scheduleCellModalSubtitle');
    if (subtitle) {
        if (contexts.length === 1) {
            const ctx = contexts[0];
            subtitle.innerHTML = `<strong>${escapeHtml(ctx.employee.fullName)}</strong><span>${escapeHtml(ctx.employee.position || 'Без должности')} · ${ctx.day} ${RU_MONTH_NAMES[schedule.month].toLowerCase()}</span>`;
        } else {
            const employeeCount = new Set(contexts.map(ctx => ctx.employeeIndex)).size;
            const days = [...new Set(contexts.map(ctx => ctx.day))].sort((a, b) => a - b);
            const dayText = days.length === 1 ? `${days[0]} ${RU_MONTH_NAMES[schedule.month].toLowerCase()}` : `${days[0]}–${days[days.length - 1]} ${RU_MONTH_NAMES[schedule.month].toLowerCase()}`;
            subtitle.innerHTML = `<strong>${contexts.length} ${pluralizeRu(contexts.length, 'ячейка', 'ячейки', 'ячеек')} выбрано</strong><span>${employeeCount} ${pluralizeRu(employeeCount, 'сотрудник', 'сотрудника', 'сотрудников')} · ${dayText}</span>`;
        }
    }

    const currentInfos = contexts.map(ctx => ctx.employee.days[ctx.day] || emptyScheduleDayInfo());
    const workOptions = document.getElementById('scheduleCellWorkOptions');
    if (workOptions) {
        workOptions.innerHTML = v6GetShiftTypes(schedule).map(type => {
            const active = currentInfos.length > 0 && currentInfos.every(info => info.working && (info.shiftId === type.id || (!info.shiftId && info.time === type.time)));
            return `<button class="schedule-cell-option work ${active ? 'active' : ''}" onclick="setEditingScheduleWork('${type.id}')">
                <i style="background:#${type.color}"></i>
                <span><strong>${escapeHtml(type.code)}</strong><small>${escapeHtml(type.name)} · ${escapeHtml(type.time)} · ${formatScheduleHours(type.paidHours)} ч.</small></span>
            </button>`;
        }).join('');
    }

    const absenceOptions = document.getElementById('scheduleCellAbsenceOptions');
    if (absenceOptions) {
        absenceOptions.innerHTML = SCHEDULE_ABSENCE_OPTIONS.map((option, index) => {
            const active = currentInfos.length > 0 && currentInfos.every(info => !info.working && info.raw === option.raw);
            return `<button class="schedule-cell-option absence-option ${active ? 'active' : ''}" onclick="setEditingScheduleAbsence(${index})">
                <i style="background:#${getScheduleAbsenceColor(schedule, option.raw)}"></i>
                <span><strong>${escapeHtml(option.raw)}</strong><small>${escapeHtml(option.status)}</small></span>
            </button>`;
        }).join('');
    }

    const sameTime = currentInfos.length > 0 && currentInfos.every(info => info.time && info.time === currentInfos[0].time) ? currentInfos[0].time : '';
    if (sameTime) {
        const parsed = sameTime.split('-');
        if (parsed.length === 2) {
            const start = document.getElementById('scheduleCustomStart');
            const end = document.getElementById('scheduleCustomEnd');
            if (start) start.value = parsed[0];
            if (end) end.value = parsed[1];
        }
    }
    const commentBox = document.getElementById('scheduleCellComment');
    if (commentBox) {
        const comments = currentInfos.map(info => String(info.comment || ''));
        commentBox.value = comments.length && comments.every(c => c === comments[0]) ? comments[0] : '';
        commentBox.placeholder = comments.length > 1 && new Set(comments).size > 1 ? 'У выбранных ячеек разные комментарии. Введите новый, чтобы заменить во всех.' : 'Например: замена сотрудника, согласовано с руководителем…';
    }
    document.getElementById('scheduleCellModal')?.classList.add('active');
}

function setEditingScheduleWork(value) {
    const contexts = getEditingScheduleContexts();
    if (!contexts.length) return;
    const schedule = contexts[0].schedule;
    v6PushHistory(schedule);
    if (!v6ApplyShiftToContexts(contexts, value)) { scheduleHistoryV6[schedule.key].undo.pop(); return; }
    persistScheduleCellEdit(schedule, contexts.length);
}

function setEditingScheduleAbsence(optionIndex) {
    const contexts = getEditingScheduleContexts();
    const option = SCHEDULE_ABSENCE_OPTIONS[optionIndex];
    if (!contexts.length || !option) return;
    const schedule = contexts[0].schedule;
    v6PushHistory(schedule);
    applyScheduleAbsenceToContexts(contexts, option);
    persistScheduleCellEdit(schedule, contexts.length);
}

function clearEditingScheduleCell() {
    const contexts = getEditingScheduleContexts();
    if (!contexts.length) return;
    const schedule = contexts[0].schedule;
    v6PushHistory(schedule);
    contexts.forEach(ctx => {
        const comment = ctx.employee.days?.[ctx.day]?.comment || '';
        ctx.employee.days[ctx.day] = { ...emptyScheduleDayInfo(), comment };
    });
    persistScheduleCellEdit(schedule, contexts.length);
}

function applyCustomScheduleTime() {
    const contexts = getEditingScheduleContexts();
    if (!contexts.length) return;
    const schedule = contexts[0].schedule;
    const start = document.getElementById('scheduleCustomStart')?.value;
    const end = document.getElementById('scheduleCustomEnd')?.value;
    if (!start || !end) { showToast('Укажите начало и окончание смены', 'warning'); return; }
    const time = `${normalizeClock(start)}-${normalizeClock(end)}`;
    let type = v6FindShiftType(schedule, time);
    if (!type) {
        type = v6BuildShiftType(time, { name: 'Своя смена', color: getColorForShiftTime(time) });
        let baseId = type.id;
        let n = 2;
        while (schedule.shiftTypes.some(item => item.id === type.id)) type.id = `${baseId}_${n++}`;
        schedule.shiftTypes.push(type);
    }
    v6PushHistory(schedule);
    v6ApplyShiftToContexts(contexts, type.id);
    persistScheduleCellEdit(schedule, contexts.length);
}

function saveEditingScheduleComment() {
    const contexts = getEditingScheduleContexts();
    if (!contexts.length) return;
    const schedule = contexts[0].schedule;
    const text = document.getElementById('scheduleCellComment')?.value?.trim() || '';
    v6PushHistory(schedule);
    contexts.forEach(ctx => {
        if (!ctx.employee.days[ctx.day]) ctx.employee.days[ctx.day] = emptyScheduleDayInfo();
        ctx.employee.days[ctx.day].comment = text;
    });
    v6AfterMutation(schedule, `✅ Комментарий сохранён для ${contexts.length} ${pluralizeRu(contexts.length, 'ячейка', 'ячейки', 'ячеек')}`);
    closeScheduleCellEditor();
}

// ------------------------ Shift presets editor -------------------
function openScheduleShiftsEditor() {
    const schedule = getCurrentSchedule();
    if (!schedule) { showToast('Сначала создайте или откройте график', 'warning'); return; }
    v6EnsureSchedule(schedule);
    editingShiftTypesV6 = v6Clone(schedule.shiftTypes);
    removedShiftTypeIdsV6 = new Set();
    renderScheduleShiftsEditor();
    document.getElementById('scheduleShiftsModal')?.classList.add('active');
}

function closeScheduleShiftsEditor() {
    document.getElementById('scheduleShiftsModal')?.classList.remove('active');
    editingShiftTypesV6 = null;
    removedShiftTypeIdsV6 = new Set();
}

function renderScheduleShiftsEditor() {
    const list = document.getElementById('scheduleShiftTypesList');
    if (!list || !editingShiftTypesV6) return;
    list.innerHTML = editingShiftTypesV6.map(type => {
        const removed = removedShiftTypeIdsV6.has(type.id);
        return `<div class="schedule-shift-type-row ${removed ? 'removed' : ''}" data-id="${escapeHtml(type.id)}">
            <div class="schedule-shift-edit-grid">
                <div class="form-group"><label>Код</label><input class="v6-shift-code" value="${escapeHtml(type.code)}" ${removed ? 'disabled' : ''}></div>
                <div class="form-group"><label>Название</label><input class="v6-shift-name" value="${escapeHtml(type.name)}" ${removed ? 'disabled' : ''}></div>
                <div class="form-group"><label>С</label><input class="v6-shift-start" type="time" value="${escapeHtml(type.start)}" ${removed ? 'disabled' : ''}></div>
                <div class="form-group"><label>До</label><input class="v6-shift-end" type="time" value="${escapeHtml(type.end)}" ${removed ? 'disabled' : ''}></div>
                <div class="form-group"><label>Оплач. часов</label><input class="v6-shift-paid" type="number" min="0" step="0.5" value="${Number(type.paidHours)}" ${removed ? 'disabled' : ''}></div>
                <div class="form-group"><label>Цвет</label><input class="v6-shift-color" type="color" value="#${normalizeHexColor(type.color)}" ${removed ? 'disabled' : ''}></div>
                <button class="schedule-shift-delete-btn" onclick="toggleRemoveShiftTypeV6('${type.id}')" title="${removed ? 'Вернуть смену' : 'Удалить смену (ячейки этой смены будут очищены)'}"><i class="fa-solid ${removed ? 'fa-rotate-left' : 'fa-trash'}"></i></button>
            </div>
        </div>`;
    }).join('');
}

function toggleRemoveShiftTypeV6(id) {
    if (removedShiftTypeIdsV6.has(id)) removedShiftTypeIdsV6.delete(id); else removedShiftTypeIdsV6.add(id);
    renderScheduleShiftsEditor();
}

function addShiftTypeV6() {
    const schedule = getCurrentSchedule();
    if (!schedule || !editingShiftTypesV6) return;
    const code = document.getElementById('newShiftCode')?.value?.trim();
    const name = document.getElementById('newShiftName')?.value?.trim() || 'Рабочая смена';
    const start = document.getElementById('newShiftStart')?.value || '08:00';
    const end = document.getElementById('newShiftEnd')?.value || '20:00';
    const paid = Number(document.getElementById('newShiftPaidHours')?.value);
    const color = normalizeHexColor(document.getElementById('newShiftColor')?.value || '00B0F0');
    const time = `${normalizeClock(start)}-${normalizeClock(end)}`;
    if (!parseTimeRange(time)) { showToast('Некорректное время смены', 'warning'); return; }
    let id = v6MakeShiftId(time);
    let n = 2;
    while (editingShiftTypesV6.some(type => type.id === id)) id = `${v6MakeShiftId(time)}_${n++}`;
    const type = v6BuildShiftType(time, { id, code: code || getWorkCodeForTime(time), name, paidHours: Number.isFinite(paid) ? paid : getPaidHoursForTime(time), color });
    editingShiftTypesV6.push(type);
    renderScheduleShiftsEditor();
    showToast('Смена добавлена в список. Нажмите «Сохранить изменения».', 'info');
}

function saveShiftTypesV6() {
    const schedule = getCurrentSchedule();
    if (!schedule || !editingShiftTypesV6) return;
    const oldTypes = v6Clone(schedule.shiftTypes || []);
    const rows = [...document.querySelectorAll('#scheduleShiftTypesList .schedule-shift-type-row')];
    const nextTypes = [];
    for (const row of rows) {
        const id = row.dataset.id;
        if (removedShiftTypeIdsV6.has(id)) continue;
        const start = row.querySelector('.v6-shift-start')?.value;
        const end = row.querySelector('.v6-shift-end')?.value;
        const time = `${normalizeClock(start)}-${normalizeClock(end)}`;
        if (!parseTimeRange(time)) { showToast('Проверьте время в настройках смен', 'warning'); return; }
        const paid = Number(row.querySelector('.v6-shift-paid')?.value);
        nextTypes.push({
            id,
            code: row.querySelector('.v6-shift-code')?.value?.trim() || getWorkCodeForTime(time),
            name: row.querySelector('.v6-shift-name')?.value?.trim() || 'Рабочая смена',
            start: normalizeClock(start),
            end: normalizeClock(end),
            time,
            paidHours: Number.isFinite(paid) ? paid : getPaidHoursForTime(time),
            color: normalizeHexColor(row.querySelector('.v6-shift-color')?.value || '00B0F0')
        });
    }
    // Include newly added rows not yet represented in DOM draft? render already includes them.
    if (!nextTypes.length) { showToast('Должна остаться хотя бы одна рабочая смена', 'warning'); return; }
    if (removedShiftTypeIdsV6.size) {
        const removedOld = oldTypes.filter(type => removedShiftTypeIdsV6.has(type.id));
        let affected = 0;
        (schedule.employees || []).forEach(emp => {
            Object.values(emp.days || {}).forEach(info => {
                if (info?.working && removedOld.some(type => info.shiftId === type.id || (!info.shiftId && info.time === type.time))) affected++;
            });
        });
        if (affected && !confirm(`Удаляемые смены используются в ${affected} ячейках. Эти ячейки будут очищены. Продолжить?`)) return;
    }
    const duplicateTime = nextTypes.find((type, i) => nextTypes.some((other, j) => i !== j && other.time === type.time));
    if (duplicateTime) { showToast(`Две смены не могут иметь одинаковое время ${duplicateTime.time}`, 'warning'); return; }

    v6PushHistory(schedule);
    const oldById = new Map(oldTypes.map(type => [type.id, type]));
    const nextById = new Map(nextTypes.map(type => [type.id, type]));
    (schedule.employees || []).forEach(emp => {
        for (let d = 1; d <= schedule.dayCount; d++) {
            const info = emp.days?.[d];
            if (!info?.working) continue;
            let old = info.shiftId ? oldById.get(info.shiftId) : null;
            if (!old && info.time) old = oldTypes.find(type => type.time === info.time);
            if (!old) continue;
            const next = nextById.get(old.id);
            if (!next) {
                const comment = info.comment || '';
                emp.days[d] = { ...emptyScheduleDayInfo(), comment };
                continue;
            }
            info.shiftId = next.id;
            info.raw = next.code;
            info.shiftName = next.name;
            info.status = next.name;
            info.time = next.time;
            info.paidHours = next.paidHours;
            info.color = next.color;
        }
    });
    schedule.shiftTypes = nextTypes;
    const nextByOldTime = new Map();
    oldTypes.forEach(old => { const next = nextById.get(old.id); if (next) nextByOldTime.set(old.time, next.time); });
    Object.values(scheduleTemplatesV6).forEach(template => {
        if (template.shiftTime && nextByOldTime.has(template.shiftTime)) template.shiftTime = nextByOldTime.get(template.shiftTime);
    });
    v6SaveTemplates();
    schedule.legend = {};
    schedule.colorSettings.work = {};
    nextTypes.forEach(type => {
        schedule.legend[type.color] = type.time;
        schedule.colorSettings.work[type.time] = type.color;
    });
    closeScheduleShiftsEditor();
    v6AfterMutation(schedule, '✅ Настройки смен сохранены');
}

// Override color editor apply so colors stay synchronized with shift presets.
function applyScheduleColorsEditor() {
    if (!editingScheduleColors) return;
    const schedule = monthlySchedules[editingScheduleColors.scheduleKey];
    if (!schedule) return;
    v6EnsureSchedule(schedule);
    v6PushHistory(schedule);
    schedule.colorSettings.work = { ...schedule.colorSettings.work, ...editingScheduleColors.work };
    schedule.colorSettings.absence = { ...schedule.colorSettings.absence, ...editingScheduleColors.absence };
    schedule.shiftTypes.forEach(type => {
        const color = editingScheduleColors.work[type.time];
        if (color) type.color = normalizeHexColor(color);
    });
    schedule.colorSettings.work = Object.fromEntries(schedule.shiftTypes.map(type => [type.time, type.color]));
    schedule.legend = {};
    schedule.shiftTypes.forEach(type => { schedule.legend[type.color] = type.time; });
    (schedule.employees || []).forEach(emp => {
        Object.values(emp.days || {}).forEach(info => {
            if (!info) return;
            if (info.working && info.time) {
                const type = v6FindShiftType(schedule, info.shiftId || info.time);
                info.color = type?.color || normalizeHexColor(schedule.colorSettings.work[info.time]);
            }
            if (!info.working && info.raw) info.color = normalizeHexColor(schedule.colorSettings.absence[info.raw] || getDefaultAbsenceColor(info.raw));
        });
    });
    closeScheduleColorsEditor();
    v6AfterMutation(schedule, '✅ Цвета смен обновлены');
}

// ------------------------ Cycles and templates -------------------
function v6LoadTemplates() {
    try { scheduleTemplatesV6 = JSON.parse(localStorage.getItem(SCHEDULE_TEMPLATES_KEY_V6)) || {}; }
    catch { scheduleTemplatesV6 = {}; }
}
function v6SaveTemplates() {
    localStorage.setItem(SCHEDULE_TEMPLATES_KEY_V6, JSON.stringify(scheduleTemplatesV6));
}

function v6PopulateEmployeeSelect(selectId) {
    const schedule = getCurrentSchedule();
    const select = document.getElementById(selectId);
    if (!schedule || !select) return;
    select.innerHTML = schedule.employees.map((emp, index) => `<option value="${index}">${escapeHtml(emp.position)} · ${escapeHtml(emp.fullName)}</option>`).join('');
}

function v6PopulateShiftSelect(selectId) {
    const schedule = getCurrentSchedule();
    const select = document.getElementById(selectId);
    if (!schedule || !select) return;
    select.innerHTML = v6GetShiftTypes(schedule).map(type => `<option value="${type.id}">${escapeHtml(type.code)} · ${escapeHtml(type.name)} · ${escapeHtml(type.time)}</option>`).join('');
}

function openScheduleCycleModalV6() {
    const schedule = getCurrentSchedule();
    if (!schedule) { showToast('Сначала создайте или откройте график', 'warning'); return; }
    v6PopulateEmployeeSelect('scheduleCycleEmployee');
    v6PopulateShiftSelect('scheduleCycleShift');
    const employeeSelect = document.getElementById('scheduleCycleEmployee');
    const selected = [...selectedScheduleCells].map(parseScheduleCellKey).filter(Boolean)[0];
    if (selected && employeeSelect) employeeSelect.value = String(selected.employeeIndex);
    document.getElementById('scheduleCycleStartDay').max = String(schedule.dayCount);
    document.getElementById('scheduleCycleModal')?.classList.add('active');
}
function closeScheduleCycleModalV6() { document.getElementById('scheduleCycleModal')?.classList.remove('active'); }

function v6ApplyCycleToEmployee(schedule, emp, template, onlyEmpty = true) {
    const type = v6FindShiftType(schedule, template.shiftId || template.shiftTime);
    if (!type) return 0;
    const workDays = Math.max(1, Number(template.workDays || 3));
    const offDays = Math.max(1, Number(template.offDays || 3));
    const startDay = Math.max(1, Math.min(schedule.dayCount, Number(template.startDay || 1)));
    const phase = template.phase === 'off' ? 'off' : 'work';
    const cycle = phase === 'work'
        ? [...Array(workDays).fill('work'), ...Array(offDays).fill('off')]
        : [...Array(offDays).fill('off'), ...Array(workDays).fill('work')];
    let changed = 0;
    for (let day = startDay; day <= schedule.dayCount; day++) {
        const current = emp.days?.[day] || emptyScheduleDayInfo();
        if (onlyEmpty && current.raw) continue;
        const state = cycle[(day - startDay) % cycle.length];
        if (state === 'work') {
            v6ApplyShiftToContexts([{ schedule, employee: emp, day }], type.id);
        } else {
            const off = SCHEDULE_ABSENCE_OPTIONS.find(item => item.raw === 'В');
            applyScheduleAbsenceToContexts([{ schedule, employee: emp, day }], off);
        }
        changed++;
    }
    return changed;
}

function applyScheduleCycleV6() {
    const schedule = getCurrentSchedule();
    if (!schedule) return;
    const employeeIndex = Number(document.getElementById('scheduleCycleEmployee')?.value);
    const employee = schedule.employees[employeeIndex];
    if (!employee) return;
    const template = {
        workDays: Number(document.getElementById('scheduleCycleWorkDays')?.value || 3),
        offDays: Number(document.getElementById('scheduleCycleOffDays')?.value || 3),
        startDay: Number(document.getElementById('scheduleCycleStartDay')?.value || 1),
        phase: document.getElementById('scheduleCyclePhase')?.value || 'work',
        shiftId: document.getElementById('scheduleCycleShift')?.value || '',
        shiftTime: v6FindShiftType(schedule, document.getElementById('scheduleCycleShift')?.value || '')?.time || ''
    };
    const onlyEmpty = !!document.getElementById('scheduleCycleOnlyEmpty')?.checked;
    const wholePosition = !!document.getElementById('scheduleCycleWholePosition')?.checked;
    const targets = wholePosition ? schedule.employees.filter(emp => emp.position === employee.position) : [employee];
    v6PushHistory(schedule);
    let changed = 0;
    targets.forEach(emp => {
        changed += v6ApplyCycleToEmployee(schedule, emp, template, onlyEmpty);
        if (document.getElementById('scheduleCycleSaveTemplate')?.checked) {
            scheduleTemplatesV6[v6ScheduleEmployeeKey(emp)] = { ...template, shiftId: '', shiftTime: template.shiftTime };
        }
    });
    v6SaveTemplates();
    closeScheduleCycleModalV6();
    v6AfterMutation(schedule, `✅ Цикл применён: ${changed} ${pluralizeRu(changed, 'ячейка', 'ячейки', 'ячеек')}`);
}

function applyScheduleTemplatesV6() {
    const schedule = getCurrentSchedule();
    if (!schedule) return;
    const withTemplates = schedule.employees.filter(emp => scheduleTemplatesV6[v6ScheduleEmployeeKey(emp)]);
    if (!withTemplates.length) { showToast('Сохранённых шаблонов сотрудников пока нет', 'warning'); return; }
    v6PushHistory(schedule);
    let changed = 0;
    withTemplates.forEach(emp => {
        const template = scheduleTemplatesV6[v6ScheduleEmployeeKey(emp)];
        changed += v6ApplyCycleToEmployee(schedule, emp, template, true);
    });
    v6AfterMutation(schedule, `✅ По шаблонам заполнено ${changed} ${pluralizeRu(changed, 'ячейка', 'ячейки', 'ячеек')}`);
}

// ------------------------ Absence ranges -------------------------
function openScheduleAbsenceModalV6() {
    const schedule = getCurrentSchedule();
    if (!schedule) { showToast('Сначала создайте или откройте график', 'warning'); return; }
    v6PopulateEmployeeSelect('scheduleAbsenceEmployee');
    const type = document.getElementById('scheduleAbsenceType');
    if (type) type.innerHTML = SCHEDULE_ABSENCE_OPTIONS.filter(item => item.raw !== 'В').map(item => `<option value="${escapeHtml(item.raw)}">${escapeHtml(item.raw)} · ${escapeHtml(item.status)}</option>`).join('');
    const selected = [...selectedScheduleCells].map(parseScheduleCellKey).filter(Boolean);
    if (selected.length) {
        document.getElementById('scheduleAbsenceEmployee').value = String(selected[0].employeeIndex);
        const days = selected.map(item => item.day);
        document.getElementById('scheduleAbsenceStartDay').value = String(Math.min(...days));
        document.getElementById('scheduleAbsenceEndDay').value = String(Math.max(...days));
    }
    document.getElementById('scheduleAbsenceStartDay').max = String(schedule.dayCount);
    document.getElementById('scheduleAbsenceEndDay').max = String(schedule.dayCount);
    document.getElementById('scheduleAbsenceModal')?.classList.add('active');
}
function closeScheduleAbsenceModalV6() { document.getElementById('scheduleAbsenceModal')?.classList.remove('active'); }
function applyScheduleAbsenceRangeV6() {
    const schedule = getCurrentSchedule();
    if (!schedule) return;
    const employeeIndex = Number(document.getElementById('scheduleAbsenceEmployee')?.value);
    const emp = schedule.employees[employeeIndex];
    const raw = document.getElementById('scheduleAbsenceType')?.value;
    const option = SCHEDULE_ABSENCE_OPTIONS.find(item => item.raw === raw);
    let start = Number(document.getElementById('scheduleAbsenceStartDay')?.value);
    let end = Number(document.getElementById('scheduleAbsenceEndDay')?.value);
    if (!emp || !option || !start || !end) return;
    if (start > end) [start, end] = [end, start];
    start = Math.max(1, start); end = Math.min(schedule.dayCount, end);
    v6PushHistory(schedule);
    const contexts = [];
    for (let day = start; day <= end; day++) contexts.push({ schedule, employee: emp, employeeIndex, day });
    applyScheduleAbsenceToContexts(contexts, option);
    closeScheduleAbsenceModalV6();
    v6AfterMutation(schedule, `✅ ${option.status}: ${emp.fullName}, ${start}–${end} число`);
}

// ------------------------ Norms & validation ---------------------
function openScheduleNormsModalV6() {
    const schedule = getCurrentSchedule();
    if (!schedule) { showToast('Сначала создайте или откройте график', 'warning'); return; }
    v6EnsureSchedule(schedule);
    document.getElementById('scheduleDefaultMonthlyHours').value = schedule.settings.defaultMonthlyHours;
    document.getElementById('scheduleAbsenceReductionHours').value = schedule.settings.absenceReductionHours;
    document.getElementById('scheduleMaxConsecutive').value = schedule.settings.maxConsecutive;
    document.getElementById('scheduleMinOffBlock').value = schedule.settings.minOffBlock;
    document.getElementById('scheduleMaxOffBlock').value = schedule.settings.maxOffBlock;
    document.getElementById('scheduleOvertimeTolerance').value = schedule.settings.overtimeTolerance;
    const list = document.getElementById('schedulePositionNormsList');
    if (list) {
        list.innerHTML = getSchedulePositionOrder(schedule).map(pos => {
            const norm = schedule.positionNorms[pos] || { totalMin: 0, dayMin: 0, nightMin: 0 };
            return `<div class="schedule-position-norm-row" data-position="${escapeHtml(pos)}">
                <div class="pos-label">${escapeHtml(pos)}</div>
                <div class="form-group"><label>Всего минимум</label><input class="v6-norm-total" type="number" min="0" value="${Number(norm.totalMin || 0)}"></div>
                <div class="form-group"><label>День минимум</label><input class="v6-norm-day" type="number" min="0" value="${Number(norm.dayMin || 0)}"></div>
                <div class="form-group"><label>Ночь минимум</label><input class="v6-norm-night" type="number" min="0" value="${Number(norm.nightMin || 0)}"></div>
            </div>`;
        }).join('');
    }
    document.getElementById('scheduleNormsModal')?.classList.add('active');
}
function closeScheduleNormsModalV6() { document.getElementById('scheduleNormsModal')?.classList.remove('active'); }
function saveScheduleNormsV6() {
    const schedule = getCurrentSchedule();
    if (!schedule) return;
    v6PushHistory(schedule);
    schedule.settings.defaultMonthlyHours = Math.max(0, Number(document.getElementById('scheduleDefaultMonthlyHours')?.value || 0));
    schedule.settings.absenceReductionHours = Math.max(0, Number(document.getElementById('scheduleAbsenceReductionHours')?.value || 0));
    schedule.settings.maxConsecutive = Math.max(1, Number(document.getElementById('scheduleMaxConsecutive')?.value || 4));
    schedule.settings.minOffBlock = Math.max(1, Number(document.getElementById('scheduleMinOffBlock')?.value || 2));
    schedule.settings.maxOffBlock = Math.max(schedule.settings.minOffBlock, Number(document.getElementById('scheduleMaxOffBlock')?.value || 4));
    schedule.settings.overtimeTolerance = Math.max(0, Number(document.getElementById('scheduleOvertimeTolerance')?.value || 0));
    document.querySelectorAll('#schedulePositionNormsList .schedule-position-norm-row').forEach(row => {
        const pos = row.dataset.position;
        schedule.positionNorms[pos] = {
            totalMin: Math.max(0, Number(row.querySelector('.v6-norm-total')?.value || 0)),
            dayMin: Math.max(0, Number(row.querySelector('.v6-norm-day')?.value || 0)),
            nightMin: Math.max(0, Number(row.querySelector('.v6-norm-night')?.value || 0))
        };
    });
    closeScheduleNormsModalV6();
    v6AfterMutation(schedule, '✅ Нормативы сохранены');
}

function v6ValidateSchedule(schedule) {
    v6EnsureSchedule(schedule);
    const issues = [];
    // Coverage norms.
    for (let day = 1; day <= schedule.dayCount; day++) {
        v6CoverageForDay(schedule, day).forEach(item => {
            item.violations.forEach(text => issues.push({
                severity: 'error', type: 'coverage', day, employeeIndex: null,
                title: `${item.position}: не хватает сотрудников`, detail: `${day} число · ${text}`
            }));
        });
    }
    // Employee rules.
    schedule.employees.forEach((emp, employeeIndex) => {
        let runStart = null;
        let runLen = 0;
        let offStart = null;
        let offLen = 0;
        const finishOffBlock = (endDay) => {
            if (!offLen) return;
            const minOff = Number(schedule.settings.minOffBlock || 2);
            const maxOff = Number(schedule.settings.maxOffBlock || 4);
            const touchesMonthBoundary = offStart === 1 || endDay === schedule.dayCount;
            if (offLen < minOff && !touchesMonthBoundary) issues.push({ severity: 'warn', type: 'off-short', employeeIndex, day: offStart, title: `${emp.fullName}: только ${offLen} выходн. подряд`, detail: `${offStart}–${endDay} число · минимум ${minOff}` });
            if (offLen > maxOff) issues.push({ severity: 'warn', type: 'off-long', employeeIndex, day: offStart, title: `${emp.fullName}: ${offLen} выходн. подряд`, detail: `${offStart}–${endDay} число · максимум ${maxOff}` });
            offStart = null; offLen = 0;
        };
        for (let day = 1; day <= schedule.dayCount; day++) {
            const info = emp.days?.[day] || emptyScheduleDayInfo();
            if (info.working) {
                finishOffBlock(day - 1);
                if (runStart === null) runStart = day;
                runLen++;
                if (!info.time) issues.push({ severity: 'warn', type: 'time', employeeIndex, day, title: `${emp.fullName}: не указано время`, detail: `${day} число · рабочая ячейка «${info.raw || 'смена'}»` });
                const next = emp.days?.[day + 1];
                if (next?.working && v6IsNightTime(info.time) && !v6IsNightTime(next.time)) {
                    issues.push({ severity: 'error', type: 'night-day', employeeIndex, day: day + 1, title: `${emp.fullName}: день после ночи`, detail: `Ночная ${day} числа → дневная ${day + 1} числа` });
                }
            } else {
                if (runLen > Number(schedule.settings.maxConsecutive || 4)) {
                    issues.push({ severity: 'error', type: 'consecutive', employeeIndex, day: runStart, title: `${emp.fullName}: ${runLen} смен подряд`, detail: `${runStart}–${day - 1} число · максимум ${schedule.settings.maxConsecutive}` });
                }
                runStart = null; runLen = 0;
                if (offStart === null) offStart = day;
                offLen++;
            }
        }
        finishOffBlock(schedule.dayCount);
        if (runLen > Number(schedule.settings.maxConsecutive || 4)) {
            issues.push({ severity: 'error', type: 'consecutive', employeeIndex, day: runStart, title: `${emp.fullName}: ${runLen} смен подряд`, detail: `${runStart}–${schedule.dayCount} число · максимум ${schedule.settings.maxConsecutive}` });
        }
        const hours = Array.from({ length: schedule.dayCount }, (_, i) => i + 1).reduce((sum, d) => sum + getScheduleWorkHours(emp.days[d]), 0);
        const target = v6AdjustedTargetHours(schedule, emp);
        const diff = hours - target;
        const tolerance = Number(schedule.settings.overtimeTolerance || 0);
        if (diff > tolerance) issues.push({ severity: 'warn', type: 'hours-high', employeeIndex, day: null, title: `${emp.fullName}: переработка +${formatScheduleHours(diff)} ч.`, detail: `${formatScheduleHours(hours)} ч. при норме ${formatScheduleHours(target)} ч.` });
        if (diff < -tolerance) issues.push({ severity: 'warn', type: 'hours-low', employeeIndex, day: null, title: `${emp.fullName}: недобор ${formatScheduleHours(Math.abs(diff))} ч.`, detail: `${formatScheduleHours(hours)} ч. при норме ${formatScheduleHours(target)} ч.` });
    });
    return issues;
}

function runScheduleValidationV6() {
    const schedule = getCurrentSchedule();
    if (!schedule) return;
    scheduleValidationIssuesV6 = v6ValidateSchedule(schedule);
    const panel = document.getElementById('scheduleValidationPanel');
    if (!panel) return;
    const errors = scheduleValidationIssuesV6.filter(i => i.severity === 'error').length;
    const warnings = scheduleValidationIssuesV6.filter(i => i.severity === 'warn').length;
    panel.style.display = 'block';
    panel.innerHTML = `<div class="schedule-validation-head">
        <strong><i class="fa-solid fa-list-check"></i> Проверка графика</strong>
        <div class="schedule-validation-kpis">
            ${!scheduleValidationIssuesV6.length ? '<span class="schedule-validation-kpi ok">Ошибок нет</span>' : ''}
            ${errors ? `<span class="schedule-validation-kpi error">Ошибки: ${errors}</span>` : ''}
            ${warnings ? `<span class="schedule-validation-kpi warn">Предупреждения: ${warnings}</span>` : ''}
        </div>
    </div>
    <div class="schedule-validation-list">
        ${scheduleValidationIssuesV6.length ? scheduleValidationIssuesV6.slice(0, 200).map((issue, index) => `<button class="schedule-validation-item ${issue.severity}" onclick="goToScheduleValidationIssueV6(${index})">
            <i class="fa-solid ${issue.severity === 'error' ? 'fa-circle-exclamation' : 'fa-triangle-exclamation'}"></i>
            <span><strong>${escapeHtml(issue.title)}</strong><small>${escapeHtml(issue.detail)}</small></span>
        </button>`).join('') : '<div class="schedule-editor-empty" style="min-height:90px"><i class="fa-solid fa-circle-check"></i><strong>График прошёл проверку</strong><span>По текущим нормативам проблем не найдено.</span></div>'}
    </div>`;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function goToScheduleValidationIssueV6(index) {
    const issue = scheduleValidationIssuesV6[index];
    if (!issue) return;
    if (issue.day) {
        const schedule = getCurrentSchedule();
        const date = `${schedule.key}-${String(issue.day).padStart(2, '0')}`;
        const dateInput = document.getElementById('scheduleDate');
        if (dateInput) dateInput.value = date;
    }
    if (issue.employeeIndex !== null && issue.employeeIndex !== undefined) v6ScrollToEmployee(issue.employeeIndex, issue.day || 1);
    else if (issue.day) openScheduleDayDetails(issue.day);
}

// ------------------------ Copy month -----------------------------
function openScheduleCopyMonthModalV6() {
    const schedule = getCurrentSchedule();
    if (!schedule) { showToast('Сначала откройте месяц, который хотите копировать', 'warning'); return; }
    const next = new Date(schedule.year, schedule.month, 1);
    const key = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('scheduleCopyTargetMonth').value = key;
    document.getElementById('scheduleCopyMonthModal')?.classList.add('active');
}
function closeScheduleCopyMonthModalV6() { document.getElementById('scheduleCopyMonthModal')?.classList.remove('active'); }
function applyScheduleCopyMonthV6() {
    const source = getCurrentSchedule();
    const key = document.getElementById('scheduleCopyTargetMonth')?.value;
    const match = String(key || '').match(/^(20\d{2})-(\d{2})$/);
    if (!source || !match) { showToast('Выберите новый месяц', 'warning'); return; }
    if (monthlySchedules[key] && !confirm('График на этот месяц уже существует. Заменить его?')) return;
    v6EnsureSchedule(source);
    const year = Number(match[1]);
    const month = Number(match[2]);
    const dayCount = new Date(year, month, 0).getDate();
    const copyCells = !!document.getElementById('scheduleCopyCells')?.checked;
    const copySettings = !!document.getElementById('scheduleCopySettings')?.checked;
    const target = {
        key, year, month, dayCount,
        title: `${RU_MONTH_NAMES[month]} ${year}`,
        sourceTitle: `Копия ${source.title}`,
        sourceName: `Копия ${source.title}`,
        sheetName: '', importedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdManually: true,
        employees: source.employees.map(emp => {
            const days = {};
            for (let d = 1; d <= dayCount; d++) days[d] = copyCells && d <= source.dayCount ? v6Clone(emp.days[d] || emptyScheduleDayInfo()) : emptyScheduleDayInfo();
            return { sourceRow: emp.sourceRow || `copy_${generateId()}`, baseId: emp.baseId || '', fullName: emp.fullName, position: emp.position, days };
        })
    };
    if (copySettings) {
        target.legend = v6Clone(source.legend || {});
        target.colorSettings = v6Clone(source.colorSettings || {});
        target.shiftTypes = v6Clone(source.shiftTypes || []);
        target.settings = v6Clone(source.settings || v6DefaultSettings());
        target.positionNorms = v6Clone(source.positionNorms || {});
        target.employeeTargets = v6Clone(source.employeeTargets || {});
    }
    v6EnsureSchedule(target);
    monthlySchedules[key] = target;
    currentScheduleKey = key;
    saveData();
    populateScheduleMonthSelect();
    closeScheduleCopyMonthModalV6();
    selectScheduleMonth(key);
    showToast(`✅ Создан график ${target.title}`, 'success');
}

// ------------------------ Search, copy/paste ---------------------
function v6ScrollToEmployee(employeeIndex, day = 1) {
    const schedule = getCurrentSchedule();
    const emp = schedule?.employees?.[employeeIndex];
    if (!schedule || !emp) return;
    if (schedule.collapsedPositions?.[emp.position]) {
        schedule.collapsedPositions[emp.position] = false;
        renderScheduleMonthTable(schedule);
    }
    requestAnimationFrame(() => {
        document.querySelectorAll('#scheduleMonthTableWrap .schedule-employee-row').forEach(row => row.classList.remove('grid-search-match'));
        const row = document.querySelector(`#scheduleMonthTableWrap .schedule-employee-row[data-employee-index="${employeeIndex}"]`);
        if (row) {
            row.classList.add('grid-search-match');
            row.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }
        const cell = document.querySelector(`#scheduleMonthTableWrap .schedule-cell-editable[data-employee-index="${employeeIndex}"][data-day="${day}"]`);
        if (cell) {
            selectedScheduleCells = new Set([getScheduleCellKey(employeeIndex, day)]);
            updateScheduleSelectionUI();
            cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    });
}

function findScheduleEmployeeV6() {
    const schedule = getCurrentSchedule();
    const q = document.getElementById('scheduleGridSearch')?.value?.trim().toLowerCase();
    if (!schedule || !q) return;
    const index = schedule.employees.findIndex(emp => emp.fullName.toLowerCase().includes(q) || String(emp.position || '').toLowerCase().includes(q));
    if (index < 0) { showToast('Сотрудник не найден', 'warning'); return; }
    v6ScrollToEmployee(index, 1);
}

function copySelectedScheduleCellsV6() {
    const cells = [...document.querySelectorAll('#scheduleMonthTableWrap .schedule-cell-editable.selected')];
    const schedule = getCurrentSchedule();
    if (!schedule || !cells.length) { showToast('Сначала выделите ячейки', 'warning'); return; }
    const parsed = cells.map(cell => ({
        row: Number(cell.dataset.row), day: Number(cell.dataset.day), employeeIndex: Number(cell.dataset.employeeIndex),
        info: v6Clone(schedule.employees[Number(cell.dataset.employeeIndex)]?.days?.[Number(cell.dataset.day)] || emptyScheduleDayInfo())
    }));
    const minRow = Math.min(...parsed.map(x => x.row));
    const maxRow = Math.max(...parsed.map(x => x.row));
    const minDay = Math.min(...parsed.map(x => x.day));
    const maxDay = Math.max(...parsed.map(x => x.day));
    scheduleClipboardV6 = parsed.map(item => ({ dr: item.row - minRow, dd: item.day - minDay, info: item.info }));

    // Also put the visible cell values into the normal OS clipboard.
    // This makes Ctrl+C / Ctrl+V compatible with Google Sheets and Excel.
    const valueMap = new Map(parsed.map(item => [`${item.row}:${item.day}`, item.info?.raw || '']));
    const rows = [];
    for (let row = minRow; row <= maxRow; row++) {
        const values = [];
        for (let day = minDay; day <= maxDay; day++) values.push(valueMap.get(`${row}:${day}`) ?? '');
        rows.push(values.join('\t'));
    }
    const clipboardText = rows.join('\n');
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(clipboardText).catch(() => {});

    showToast(`📋 Скопировано ${parsed.length} ${pluralizeRu(parsed.length, 'ячейка', 'ячейки', 'ячеек')}`, 'info');
}

function pasteScheduleCellsV6() {
    const schedule = getCurrentSchedule();
    if (!scheduleClipboardV6?.length || !schedule) { showToast('Буфер графика пуст', 'warning'); return; }
    const selected = [...document.querySelectorAll('#scheduleMonthTableWrap .schedule-cell-editable.selected')];
    if (!selected.length) { showToast('Выберите ячейку, с которой начинать вставку', 'warning'); return; }
    selected.sort((a, b) => Number(a.dataset.row) - Number(b.dataset.row) || Number(a.dataset.day) - Number(b.dataset.day));
    const anchor = selected[0];
    const anchorRow = Number(anchor.dataset.row);
    const anchorDay = Number(anchor.dataset.day);
    const tableCells = [...document.querySelectorAll('#scheduleMonthTableWrap .schedule-cell-editable')];
    const byCoord = new Map(tableCells.map(cell => [`${cell.dataset.row}:${cell.dataset.day}`, cell]));
    v6PushHistory(schedule);
    let pasted = 0;
    const nextSelection = new Set();
    scheduleClipboardV6.forEach(item => {
        const target = byCoord.get(`${anchorRow + item.dr}:${anchorDay + item.dd}`);
        if (!target) return;
        const employeeIndex = Number(target.dataset.employeeIndex);
        const day = Number(target.dataset.day);
        schedule.employees[employeeIndex].days[day] = v6Clone(item.info);
        nextSelection.add(getScheduleCellKey(employeeIndex, day));
        pasted++;
    });
    if (!pasted) { scheduleHistoryV6[schedule.key].undo.pop(); showToast('Вставка выходит за границы таблицы', 'warning'); return; }
    selectedScheduleCells = nextSelection;
    v6AfterMutation(schedule, `✅ Вставлено ${pasted} ${pluralizeRu(pasted, 'ячейка', 'ячейки', 'ячеек')}`);
}


// ------------------------ V7: paste from Google Sheets / Excel ---------------------
function v7ParseClipboardGrid(text) {
    const normalized = String(text ?? '').replace(/\r\n?/g, '\n');
    let rows = normalized.split('\n').map(line => line.split('\t'));
    while (rows.length && rows[rows.length - 1].every(cell => String(cell ?? '') === '')) rows.pop();
    let maxCols = rows.reduce((m, row) => Math.max(m, row.length), 0);
    while (maxCols > 0 && rows.every(row => String(row[maxCols - 1] ?? '') === '')) maxCols--;
    rows = rows.map(row => Array.from({ length: maxCols }, (_, i) => String(row[i] ?? '')));
    return rows;
}

function v7NormalizeClipboardToken(value) {
    return String(value ?? '')
        .replace(/\u00A0/g, ' ')
        .replace(/[–—−]/g, '-')
        .replace(/\s*-\s*/g, '-')
        .trim();
}

function v7ParseClipboardDay(value) {
    const s = v7NormalizeClipboardToken(value);
    if (!s) return null;
    if (/^(?:[1-9]|[12]\d|3[01])$/.test(s)) return Number(s);
    const dateMatch = s.match(/^([0-3]?\d)[./-]([01]?\d)(?:[./-](?:\d{2}|\d{4}))?$/);
    if (dateMatch) {
        const day = Number(dateMatch[1]);
        return day >= 1 && day <= 31 ? day : null;
    }
    const leadingDay = s.match(/^([1-9]|[12]\d|3[01])(?:\s|\.|,|$)/);
    return leadingDay ? Number(leadingDay[1]) : null;
}

function v7CompactPersonName(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^a-zа-я0-9]+/gi, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function v7FindScheduleEmployeeIndex(schedule, value) {
    const raw = String(value || '').trim();
    if (!schedule || raw.length < 2) return -1;
    const compact = v7CompactPersonName(raw);
    if (!compact) return -1;

    let index = schedule.employees.findIndex(emp => v7CompactPersonName(emp.fullName) === compact);
    if (index >= 0) return index;

    const tokens = compact.split(' ').filter(Boolean);
    const surname = tokens[0] || '';
    if (!surname || surname.length < 3) return -1;
    const candidates = schedule.employees
        .map((emp, i) => ({ i, name: v7CompactPersonName(emp.fullName), emp }))
        .filter(item => item.name.split(' ')[0] === surname);
    if (candidates.length === 1) return candidates[0].i;

    // Supports variants like "Иванов И.И." against a full name in the employee base.
    const initials = tokens.slice(1).join('').replace(/[^a-zа-я]/gi, '');
    if (initials && candidates.length) {
        const matched = candidates.filter(item => {
            const parts = item.name.split(' ').filter(Boolean);
            const empInitials = parts.slice(1).map(part => part[0] || '').join('');
            return empInitials.startsWith(initials) || initials.startsWith(empInitials);
        });
        if (matched.length === 1) return matched[0].i;
    }
    return -1;
}

function v7FindShiftTypeFromClipboard(schedule, rawValue) {
    const token = v7NormalizeClipboardToken(rawValue);
    if (!token) return null;
    v6EnsureSchedule(schedule);
    const lower = token.toLowerCase();
    let type = schedule.shiftTypes.find(item =>
        [item.id, item.code, item.time, item.name].some(value => String(value || '').trim().toLowerCase() === lower)
    );
    if (type) return type;

    // Normalize copied clock ranges: 8:00 - 20:00, 08.00–20.00, etc.
    const timeMatch = token.match(/^(\d{1,2})[.:](\d{2})-(\d{1,2})[.:](\d{2})$/);
    if (timeMatch) {
        const start = normalizeClock(`${timeMatch[1]}:${timeMatch[2]}`);
        const end = normalizeClock(`${timeMatch[3]}:${timeMatch[4]}`);
        const time = `${start}-${end}`;
        type = v6FindShiftType(schedule, time);
        if (!type) {
            type = v6BuildShiftType(time, { name: 'Вставлено из таблицы', color: getColorForShiftTime(time) });
            let id = type.id;
            let n = 2;
            while (schedule.shiftTypes.some(item => item.id === id)) id = `${type.id}_${n++}`;
            type.id = id;
            schedule.shiftTypes.push(type);
        }
        return type;
    }
    return null;
}

function v7FindAbsenceFromClipboard(rawValue) {
    const token = v7NormalizeClipboardToken(rawValue);
    if (!token) return null;
    const upper = token.toUpperCase();
    const direct = SCHEDULE_ABSENCE_OPTIONS.find(option => String(option.raw).toUpperCase() === upper || String(option.status).toUpperCase() === upper);
    if (direct) return direct;
    const aliases = {
        'ВЫХ': 'В', 'ВЫХ.': 'В', 'ВЫХОДНОЙ': 'В',
        'ОТПУСК': 'ОТ', 'ОТП': 'ОТ',
        'БОЛЬНИЧНЫЙ': 'Б', 'БЛ': 'Б',
        'ДОП ОТПУСК': 'ДО', 'ДОП. ОТПУСК': 'ДО',
        'КОРПОРАТИВНЫЙ УНИВЕРСИТЕТ': 'КУ'
    };
    const raw = aliases[upper];
    return raw ? SCHEDULE_ABSENCE_OPTIONS.find(option => option.raw === raw) || null : null;
}

function v7ApplyClipboardToken(schedule, employeeIndex, day, rawValue, stats) {
    const employee = schedule?.employees?.[employeeIndex];
    if (!employee || day < 1 || day > schedule.dayCount) return false;
    const token = v7NormalizeClipboardToken(rawValue);

    if (!token || token === '-' || token === '—') {
        employee.days[day] = emptyScheduleDayInfo();
        stats.cleared++;
        return true;
    }

    const type = v7FindShiftTypeFromClipboard(schedule, token);
    if (type) {
        v6ApplyShiftToContexts([{ schedule, employee, employeeIndex, day }], type.id);
        stats.working++;
        return true;
    }

    const absence = v7FindAbsenceFromClipboard(token);
    if (absence) {
        applyScheduleAbsenceToContexts([{ schedule, employee, employeeIndex, day }], absence);
        stats.absence++;
        return true;
    }

    // Keep unknown codes instead of losing them. They can later be edited normally in the cell editor.
    employee.days[day] = {
        raw: token,
        color: 'CBD5E1',
        kind: 'other',
        status: 'Обозначение из таблицы',
        working: false,
        time: ''
    };
    stats.unknown.push(token);
    return true;
}

function v7TrySmartWholeSchedulePaste(schedule, grid, stats) {
    if (!schedule || !grid.length) return { used: false, pasted: 0, selection: new Set() };

    // Detect a header row containing day numbers (1..31). This allows copying a whole Google Sheets block
    // with FIO + days, not only the shift cells themselves.
    let headerRow = -1;
    let dayColumns = new Map();
    let bestCount = 0;
    grid.slice(0, Math.min(grid.length, 12)).forEach((row, r) => {
        const map = new Map();
        row.forEach((value, c) => {
            const day = v7ParseClipboardDay(value);
            if (day && day <= schedule.dayCount && ![...map.values()].includes(day)) map.set(c, day);
        });
        if (map.size > bestCount) {
            bestCount = map.size;
            headerRow = r;
            dayColumns = map;
        }
    });
    if (headerRow < 0 || bestCount < 5) return { used: false, pasted: 0, selection: new Set() };

    const firstDayCol = Math.min(...dayColumns.keys());
    let matchedEmployees = 0;
    let pasted = 0;
    const selection = new Set();

    for (let r = headerRow + 1; r < grid.length; r++) {
        const row = grid[r];
        let employeeIndex = -1;
        // FIO is usually somewhere before the first day column; scan those cells first.
        for (let c = 0; c < Math.max(1, firstDayCol); c++) {
            employeeIndex = v7FindScheduleEmployeeIndex(schedule, row[c]);
            if (employeeIndex >= 0) break;
        }
        if (employeeIndex < 0) continue;
        matchedEmployees++;
        dayColumns.forEach((day, c) => {
            if (c >= row.length) return;
            if (v7ApplyClipboardToken(schedule, employeeIndex, day, row[c], stats)) {
                selection.add(getScheduleCellKey(employeeIndex, day));
                pasted++;
            }
        });
    }

    if (!matchedEmployees || !pasted) return { used: false, pasted: 0, selection: new Set() };
    return { used: true, pasted, selection, matchedEmployees };
}

function v7PasteClipboardGridAtSelection(schedule, grid, stats) {
    const selected = [...document.querySelectorAll('#scheduleMonthTableWrap .schedule-cell-editable.selected')];
    if (!selected.length) return { pasted: 0, selection: new Set(), noAnchor: true };
    selected.sort((a, b) => Number(a.dataset.row) - Number(b.dataset.row) || Number(a.dataset.day) - Number(b.dataset.day));
    const anchor = selected[0];
    const anchorRow = Number(anchor.dataset.row);
    const anchorDay = Number(anchor.dataset.day);
    const tableCells = [...document.querySelectorAll('#scheduleMonthTableWrap .schedule-cell-editable')];
    const byCoord = new Map(tableCells.map(cell => [`${cell.dataset.row}:${cell.dataset.day}`, cell]));
    let pasted = 0;
    const selection = new Set();

    grid.forEach((row, dr) => {
        row.forEach((value, dc) => {
            const target = byCoord.get(`${anchorRow + dr}:${anchorDay + dc}`);
            if (!target) return;
            const employeeIndex = Number(target.dataset.employeeIndex);
            const day = Number(target.dataset.day);
            if (v7ApplyClipboardToken(schedule, employeeIndex, day, value, stats)) {
                selection.add(getScheduleCellKey(employeeIndex, day));
                pasted++;
            }
        });
    });
    return { pasted, selection, noAnchor: false };
}

function pasteScheduleTextV7(text) {
    const schedule = getCurrentSchedule();
    if (!schedule) { showToast('Сначала откройте график', 'warning'); return false; }
    const grid = v7ParseClipboardGrid(text);
    if (!grid.length || !grid[0]?.length) return false;

    const stats = { working: 0, absence: 0, cleared: 0, unknown: [] };
    v6PushHistory(schedule);

    let result = v7TrySmartWholeSchedulePaste(schedule, grid, stats);
    let mode = 'smart';
    if (!result.used) {
        result = v7PasteClipboardGridAtSelection(schedule, grid, stats);
        mode = 'range';
    }

    if (!result.pasted) {
        scheduleHistoryV6[schedule.key]?.undo?.pop();
        v6UpdateHistoryButtons();
        if (result.noAnchor) showToast('Выберите первую ячейку графика и нажмите Ctrl+V', 'warning');
        else showToast('Не удалось вставить диапазон', 'warning');
        return false;
    }

    selectedScheduleCells = result.selection;
    const unknownUnique = [...new Set(stats.unknown)];
    const label = mode === 'smart'
        ? `✅ Google Таблица: сопоставлено ${result.matchedEmployees || 0} сотрудников, вставлено ${result.pasted} ячеек`
        : `✅ Вставлено из таблицы ${result.pasted} ${pluralizeRu(result.pasted, 'ячейка', 'ячейки', 'ячеек')}`;
    v6AfterMutation(schedule, label);
    if (unknownUnique.length) {
        const preview = unknownUnique.slice(0, 5).join(', ');
        showToast(`⚠️ Не распознано как смены: ${preview}${unknownUnique.length > 5 ? '…' : ''}. Значения сохранены как обозначения.`, 'warning');
    }
    return true;
}

function handleSchedulePasteV7(event) {
    const scheduleTabActive = document.getElementById('tab-schedule')?.classList.contains('active');
    if (!scheduleTabActive) return;
    const typing = event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);
    if (typing) return;
    const text = event.clipboardData?.getData('text/plain') || '';
    if (!text) {
        // Fallback for browsers where clipboard text is unavailable but the internal schedule buffer exists.
        if (scheduleClipboardV6?.length) {
            event.preventDefault();
            pasteScheduleCellsV6();
        }
        return;
    }
    event.preventDefault();
    pasteScheduleTextV7(text);
}

// ------------------------ Plan / Fact ----------------------------
function v6FactDataForDate(date) {
    const relevant = Object.values(shifts || {}).filter(shift => shift.date === date);
    const map = new Map();
    relevant.forEach(shift => {
        (shift.people || []).forEach(person => {
            const key = normalizeEmployeeNameForMatch(person.fullName || '');
            const prev = map.get(key) || { present: false, included: false, shifts: [] };
            prev.included = true;
            prev.present = prev.present || !!person.present;
            prev.shifts.push({ name: shift.name, time: person.time || '' });
            map.set(key, prev);
        });
    });
    return { hasAny: relevant.length > 0, shifts: relevant, map };
}

function v6FactForEntry(entry, factData) {
    if (!factData.hasAny) return { state: 'no-data', text: 'Нет отметок' };
    const key = normalizeEmployeeNameForMatch(entry.fullName || '');
    const fact = factData.map.get(key);
    if (fact?.present) return { state: 'present', text: 'На месте' };
    if (fact?.included) return { state: 'missing', text: 'Не отмечен' };
    return { state: 'missing', text: 'Нет в смене' };
}

// Override day list to show actual presence and additional stats.
function renderScheduleDay() {
    const body = document.getElementById('scheduleDayBody');
    if (!body) return;
    const schedule = getCurrentSchedule();
    if (!schedule) {
        body.innerHTML = '<tr><td colspan="8" class="schedule-empty-cell">Создайте график на сайте или импортируйте Excel</td></tr>';
        setScheduleStats(0, 0, 0, 0, null, null);
        return;
    }
    v6EnsureSchedule(schedule);
    const selectedDate = getScheduleSelectedDate();
    if (!selectedDate || !selectedDate.startsWith(schedule.key)) selectScheduleMonth(schedule.key, false);
    const date = getScheduleSelectedDate();
    const factData = v6FactDataForDate(date);

    let entries = getScheduleEntriesForSelectedDay();
    const total = entries.length;
    const workingEntries = entries.filter(e => e.dayInfo.working);
    const working = workingEntries.length;
    const nowCount = entries.filter(e => isEntryActiveNow(e, date)).length;
    const off = total - working;
    const present = factData.hasAny ? workingEntries.filter(e => v6FactForEntry(e, factData).state === 'present').length : null;
    const missing = factData.hasAny ? working - present : null;
    setScheduleStats(total, working, nowCount, off, present, missing);

    const search = (document.getElementById('scheduleSearch')?.value || '').toLowerCase().trim();
    const position = document.getElementById('schedulePositionFilter')?.value || '';
    const status = document.getElementById('scheduleStatusFilter')?.value || 'working';
    if (search) entries = entries.filter(e => e.fullName.toLowerCase().includes(search) || String(e.position || '').toLowerCase().includes(search));
    if (position) entries = entries.filter(e => e.position === position);
    if (status === 'working') entries = entries.filter(e => e.dayInfo.working);
    if (status === 'now') entries = entries.filter(e => isEntryActiveNow(e, date));
    if (status === 'off') entries = entries.filter(e => !e.dayInfo.working);
    const countEl = document.getElementById('scheduleFilteredCount');
    if (countEl) countEl.textContent = `Показано: ${entries.length} из ${total}`;
    if (!entries.length) { body.innerHTML = '<tr><td colspan="8" class="schedule-empty-cell">Нет сотрудников по выбранному фильтру</td></tr>'; v6RenderCoverageSummary(schedule); return; }

    const groups = groupScheduleEmployees(schedule, entries);
    let counter = 0;
    body.innerHTML = groups.map(group => {
        const groupHeader = `<tr class="schedule-day-position-row"><td colspan="8"><i class="fa-solid fa-briefcase"></i> ${escapeHtml(group.position)} <span>${group.employees.length} чел.</span></td></tr>`;
        const rows = group.employees.sort((a, b) => (a.dayInfo.time || '99:99').localeCompare(b.dayInfo.time || '99:99') || a.fullName.localeCompare(b.fullName, 'ru')).map(entry => {
            counter++;
            const base = findBaseEmployeeByScheduleName(entry.fullName);
            const phone = base?.phone || '';
            const active = isEntryActiveNow(entry, date);
            const statusClass = entry.dayInfo.working ? (active && date === toLocalISODate() ? 'schedule-status-now' : 'schedule-status-work') : 'schedule-status-off';
            let statusText = entry.dayInfo.shiftName || entry.dayInfo.status;
            if (entry.dayInfo.working && active && date === toLocalISODate()) statusText = 'Сейчас по графику';
            const time = entry.dayInfo.time || (entry.dayInfo.working ? 'Время не определено' : '—');
            const fact = v6FactForEntry(entry, factData);
            return `<tr class="${entry.dayInfo.working ? 'schedule-row-working' : 'schedule-row-off'}">
                <td>${counter}</td>
                <td><strong>${escapeHtml(entry.fullName)}</strong>${base ? '' : '<span class="schedule-unmatched" title="Нет точного совпадения в базе сотрудников">не в базе</span>'}</td>
                <td>${escapeHtml(entry.position)}</td>
                <td>${phone ? `<a href="tel:${escapeHtml(phone)}" class="phone-link">${escapeHtml(phone)}</a>` : '—'}</td>
                <td><span class="schedule-code">${escapeHtml(entry.dayInfo.raw || '—')}</span></td>
                <td>${escapeHtml(time)}</td>
                <td><span class="schedule-status ${statusClass}">${escapeHtml(statusText)}</span></td>
                <td><span class="schedule-fact-badge ${fact.state}">${escapeHtml(fact.text)}</span></td>
            </tr>`;
        }).join('');
        return groupHeader + rows;
    }).join('');
    v6RenderCoverageSummary(schedule);
}

function setScheduleStats(total, working, now, absent, present = null, missing = null) {
    const map = { scheduleStatTotal: total, scheduleStatWorking: working, scheduleStatNow: now, scheduleStatAbsent: absent };
    Object.entries(map).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.textContent = value; });
    const presentEl = document.getElementById('scheduleStatPresent');
    const missingEl = document.getElementById('scheduleStatMissing');
    if (presentEl) presentEl.textContent = present === null ? '—' : present;
    if (missingEl) missingEl.textContent = missing === null ? '—' : missing;
}

function openScheduleDayDetails(day) {
    const schedule = getCurrentSchedule();
    if (!schedule || day < 1 || day > schedule.dayCount) return;
    const date = `${schedule.key}-${String(day).padStart(2, '0')}`;
    const dateInput = document.getElementById('scheduleDate');
    if (dateInput) dateInput.value = date;
    renderScheduleDay();
    const entries = schedule.employees.map(emp => ({ ...emp, dayInfo: emp.days?.[day] || emptyScheduleDayInfo() }));
    const planned = entries.filter(e => e.dayInfo.working);
    const factData = v6FactDataForDate(date);
    const present = factData.hasAny ? planned.filter(e => v6FactForEntry(e, factData).state === 'present').length : 0;
    const missing = factData.hasAny ? planned.length - present : 0;
    const extraPresent = factData.hasAny ? [...factData.map.entries()].filter(([name, fact]) => fact.present && !planned.some(e => normalizeEmployeeNameForMatch(e.fullName) === name)).length : 0;
    const title = document.getElementById('scheduleDayDetailsTitle');
    if (title) title.innerHTML = `<i class="fa-solid fa-calendar-day"></i> ${day} ${RU_MONTH_NAMES[schedule.month].toLowerCase()} ${schedule.year}`;
    const subtitle = document.getElementById('scheduleDayDetailsSubtitle');
    if (subtitle) subtitle.textContent = factData.hasAny ? `План и факт · найдено фактических смен: ${factData.shifts.length}` : 'Фактическая смена на эту дату ещё не создана';
    const content = document.getElementById('scheduleDayDetailsContent');
    const coverage = v6CoverageForDay(schedule, day);
    if (content) {
        content.innerHTML = `<div class="schedule-day-detail-kpis">
            <div class="schedule-day-detail-kpi"><span>По плану</span><strong>${planned.length}</strong></div>
            <div class="schedule-day-detail-kpi"><span>Фактически на месте</span><strong>${factData.hasAny ? present : '—'}</strong></div>
            <div class="schedule-day-detail-kpi"><span>Не отмечены</span><strong>${factData.hasAny ? missing : '—'}</strong></div>
            <div class="schedule-day-detail-kpi"><span>На месте вне плана</span><strong>${factData.hasAny ? extraPresent : '—'}</strong></div>
        </div>
        ${coverage.map(item => {
            const groupEntries = planned.filter(e => e.position === item.position);
            return `<div class="schedule-day-detail-position">
                <h3>${escapeHtml(item.position)} · день ${item.day}${Number(item.norm.dayMin) ? `/${item.norm.dayMin}` : ''} · ночь ${item.night}${Number(item.norm.nightMin) ? `/${item.norm.nightMin}` : ''}${item.violations.length ? ` · ⚠ ${escapeHtml(item.violations.join(', '))}` : ''}</h3>
                <table class="schedule-day-detail-table"><thead><tr><th>ФИО</th><th>Смена</th><th>Время</th><th>Факт</th></tr></thead><tbody>
                    ${groupEntries.length ? groupEntries.map(entry => {
                        const fact = v6FactForEntry(entry, factData);
                        return `<tr><td>${escapeHtml(entry.fullName)}</td><td>${escapeHtml(entry.dayInfo.raw || '')}</td><td>${escapeHtml(entry.dayInfo.time || '—')}</td><td><span class="schedule-fact-badge ${fact.state}">${escapeHtml(fact.text)}</span></td></tr>`;
                    }).join('') : '<tr><td colspan="4">Нет работающих сотрудников</td></tr>'}
                </tbody></table>
            </div>`;
        }).join('')}`;
    }
    document.getElementById('scheduleDayDetailsModal')?.classList.add('active');
}
function closeScheduleDayDetailsV6() { document.getElementById('scheduleDayDetailsModal')?.classList.remove('active'); }

// Override schedule tab to ensure V6 data and toolbar state.
function renderScheduleTab() {
    populateScheduleMonthSelect();
    const badge = document.getElementById('scheduleMonthBadge');
    const info = document.getElementById('scheduleImportInfo');
    const schedule = currentScheduleKey ? monthlySchedules[currentScheduleKey] : null;
    if (!schedule) {
        if (badge) badge.textContent = 'Нет графика';
        if (info) info.innerHTML = '<span class="empty-text">Создайте график на сайте или импортируйте Excel</span>';
        renderScheduleLegend(null);
        populateSchedulePositionFilter({ employees: [] });
        renderScheduleMonthTable(null);
        renderScheduleDay();
        v6UpdateHistoryButtons();
        return;
    }
    v6EnsureSchedule(schedule);
    if (badge) badge.textContent = schedule.title;
    if (info) {
        const parsedAt = schedule.updatedAt || schedule.importedAt ? new Date(schedule.updatedAt || schedule.importedAt).toLocaleString('ru-RU') : '';
        info.innerHTML = `<div class="schedule-import-ok"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(schedule.sourceName || (schedule.createdManually ? 'Создано на сайте' : 'Excel'))} — ${schedule.employees.length} сотрудников${parsedAt ? ` · ${parsedAt}` : ''}</div>`;
    }
    renderScheduleLegend(schedule);
    populateSchedulePositionFilter(schedule);
    populateScheduleBulkShiftSelect(schedule);
    renderScheduleMonthTable(schedule);
    renderScheduleDay();
    v6UpdateHistoryButtons();
}

// Override legend to show editable shift names, code and color.
function renderScheduleLegend(schedule) {
    const el = document.getElementById('scheduleLegend');
    if (!el) return;
    if (!schedule) { el.innerHTML = '<span class="empty-text">Легенда появится после создания графика</span>'; return; }
    v6EnsureSchedule(schedule);
    el.innerHTML = schedule.shiftTypes.map(type => `<span class="legend-chip" title="${escapeHtml(type.name)} · ${formatScheduleHours(type.paidHours)} оплач. ч."><i style="background:#${type.color}"></i>${escapeHtml(type.code)} · ${escapeHtml(type.time)}</span>`).join('');
}

// Backup/export with cycle templates.
function downloadBackup() {
    const data = { version: '3.0', date: new Date().toISOString(), employees, positions, shifts, monthlySchedules, scheduleTemplates: scheduleTemplatesV6 };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `evacuation_backup_${new Date().toISOString().split('T')[0]}.json`; a.click();
    URL.revokeObjectURL(url); showToast('📥 Бэкап скачан', 'success');
}
function restoreBackup() {
    const input = document.getElementById('backupFileInput');
    if (!input.files.length) { showToast('Выберите файл!', 'warning'); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.employees || !data.positions || !data.shifts) { showToast('Неверный формат файла!', 'error'); return; }
            if (!confirm('Восстановить данные из бэкапа? Текущие данные будут заменены.')) return;
            employees = data.employees || []; positions = data.positions || {}; shifts = data.shifts || {}; monthlySchedules = data.monthlySchedules || {};
            scheduleTemplatesV6 = data.scheduleTemplates || {}; v6SaveTemplates();
            Object.values(monthlySchedules).forEach(v6EnsureSchedule);
            saveData(); populatePositionSelects(); renderEmployees(); renderPositions(); renderShiftsList(); renderRecentShifts(); updateStats(); initScheduleUI(); renderDashboardScheduleSummary();
            if (Object.keys(shifts).length > 0) { currentShiftId = Object.keys(shifts)[0]; renderShift(); renderShiftDisplay(); }
            input.value = ''; showToast('✅ Данные восстановлены', 'success');
        } catch (error) { showToast('Ошибка чтения файла: ' + error.message, 'error'); }
    };
    reader.readAsText(input.files[0]);
}
function exportJson() {
    const data = { version: '3.0', date: new Date().toISOString(), employees, positions, shifts, monthlySchedules, scheduleTemplates: scheduleTemplatesV6 };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `export_${new Date().toISOString().split('T')[0]}.json`; a.click();
    URL.revokeObjectURL(url); showToast('📥 JSON скачан', 'success');
}

function closeScheduleProModalsV6() {
    ['scheduleShiftsModal','scheduleCycleModal','scheduleAbsenceModal','scheduleNormsModal','scheduleCopyMonthModal','scheduleDayDetailsModal'].forEach(id => document.getElementById(id)?.classList.remove('active'));
}

function initScheduleV6Enhancements() {
    v6LoadTemplates();
    Object.values(monthlySchedules || {}).forEach(v6EnsureSchedule);

    const on = (id, event, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(event, fn); };
    on('scheduleEditShiftsBtn', 'click', openScheduleShiftsEditor);
    on('scheduleShiftsCloseModal', 'click', closeScheduleShiftsEditor);
    on('scheduleAddShiftTypeBtn', 'click', addShiftTypeV6);
    on('scheduleSaveShiftTypesBtn', 'click', saveShiftTypesV6);
    on('scheduleCycleBtn', 'click', openScheduleCycleModalV6);
    on('scheduleCycleCloseModal', 'click', closeScheduleCycleModalV6);
    on('scheduleCycleApplyBtn', 'click', applyScheduleCycleV6);
    on('scheduleApplyTemplatesBtn', 'click', applyScheduleTemplatesV6);
    on('scheduleAbsenceRangeBtn', 'click', openScheduleAbsenceModalV6);
    on('scheduleAbsenceCloseModal', 'click', closeScheduleAbsenceModalV6);
    on('scheduleAbsenceApplyBtn', 'click', applyScheduleAbsenceRangeV6);
    on('scheduleNormsBtn', 'click', openScheduleNormsModalV6);
    on('scheduleNormsCloseModal', 'click', closeScheduleNormsModalV6);
    on('scheduleNormsSaveBtn', 'click', saveScheduleNormsV6);
    on('scheduleValidateBtn', 'click', runScheduleValidationV6);
    on('scheduleUndoBtn', 'click', v6UndoSchedule);
    on('scheduleRedoBtn', 'click', v6RedoSchedule);
    on('scheduleGridSearchBtn', 'click', findScheduleEmployeeV6);
    on('scheduleGridSearch', 'keydown', e => { if (e.key === 'Enter') { e.preventDefault(); findScheduleEmployeeV6(); } });
    on('scheduleCopyMonthBtn', 'click', openScheduleCopyMonthModalV6);
    on('scheduleCopyMonthCloseModal', 'click', closeScheduleCopyMonthModalV6);
    on('scheduleCopyMonthApplyBtn', 'click', applyScheduleCopyMonthV6);
    on('scheduleDayDetailsCloseModal', 'click', closeScheduleDayDetailsV6);
    on('scheduleCellCommentSaveBtn', 'click', saveEditingScheduleComment);
    document.querySelectorAll('.schedule-cycle-presets [data-cycle]').forEach(btn => btn.addEventListener('click', () => {
        const [work, off] = String(btn.dataset.cycle || '3,3').split(',');
        const workInput = document.getElementById('scheduleCycleWorkDays');
        const offInput = document.getElementById('scheduleCycleOffDays');
        if (workInput) workInput.value = work;
        if (offInput) offInput.value = off;
    }));

    ['scheduleShiftsModal','scheduleCycleModal','scheduleAbsenceModal','scheduleNormsModal','scheduleCopyMonthModal','scheduleDayDetailsModal'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal) modal.addEventListener('click', e => { if (e.target === e.currentTarget) modal.classList.remove('active'); });
    });

    document.addEventListener('paste', handleSchedulePasteV7);

    document.addEventListener('keydown', e => {
        const scheduleTabActive = document.getElementById('tab-schedule')?.classList.contains('active');
        if (!scheduleTabActive) return;
        const typing = e.target && ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName);
        if (e.key === 'Escape') closeScheduleProModalsV6();
        if (typing) return;
        const mod = e.ctrlKey || e.metaKey;
        if (mod && e.key.toLowerCase() === 'c' && selectedScheduleCells.size) { e.preventDefault(); copySelectedScheduleCellsV6(); }
        // Ctrl+V is handled by the real 'paste' event so external clipboard data from Google Sheets / Excel is available.
        if (mod && e.key.toLowerCase() === 'v') return;
        if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); v6UndoSchedule(); }
        if ((mod && e.key.toLowerCase() === 'y') || (mod && e.shiftKey && e.key.toLowerCase() === 'z')) { e.preventDefault(); v6RedoSchedule(); }
    });

    if (getCurrentSchedule()) renderScheduleTab();
}

document.addEventListener('DOMContentLoaded', initScheduleV6Enhancements);

// V6 override: synchronization participates in undo history.
function syncCurrentScheduleEmployees() {
    const schedule = getCurrentSchedule();
    if (!schedule) { showToast('Сначала создайте или откройте график', 'warning'); return; }
    v6PushHistory(schedule);
    let added = 0, updated = 0;
    employees.forEach(base => {
        let target = schedule.employees.find(e => e.baseId && e.baseId === base.id);
        if (!target) target = schedule.employees.find(e => normalizeEmployeeNameForMatch(e.fullName) === normalizeEmployeeNameForMatch(base.fullName));
        if (target) {
            if (target.fullName !== base.fullName || target.position !== (base.position || 'Без должности')) updated++;
            target.baseId = base.id;
            target.fullName = base.fullName;
            target.position = base.position || 'Без должности';
        } else {
            schedule.employees.push(buildManualScheduleEmployee(base, schedule.dayCount));
            added++;
        }
    });
    if (!added && !updated) {
        scheduleHistoryV6[schedule.key]?.undo?.pop();
        v6UpdateHistoryButtons();
        showToast('Сотрудники уже синхронизированы', 'info');
        return;
    }
    v6EnsureSchedule(schedule);
    v6AfterMutation(schedule, `✅ Синхронизация: добавлено ${added}, обновлено ${updated}`);
}


// V6 override: the color editor shows only actual editable shift presets of the month.
function getAvailableScheduleWorkTimes(schedule) {
    return v6GetShiftTypes(schedule).map(type => type.time);
}


/* Bundled JSZip — JSZip is dual licensed. At your choice you may use it under the MIT license *or* the GPLv3
license.

The MIT License
===============

Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.


 */
/*!

JSZip v3.10.1 - A JavaScript class for generating and reading zip files
<http://stuartk.com/jszip>

(c) 2009-2016 Stuart Knightley <stuart [at] stuartk.com>
Dual licenced under the MIT license or GPLv3. See https://raw.github.com/Stuk/jszip/main/LICENSE.markdown.

JSZip uses the library pako released under the MIT license :
https://github.com/nodeca/pako/blob/main/LICENSE
*/

!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{("undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this).JSZip=e()}}(function(){return function s(a,o,h){function u(r,e){if(!o[r]){if(!a[r]){var t="function"==typeof require&&require;if(!e&&t)return t(r,!0);if(l)return l(r,!0);var n=new Error("Cannot find module '"+r+"'");throw n.code="MODULE_NOT_FOUND",n}var i=o[r]={exports:{}};a[r][0].call(i.exports,function(e){var t=a[r][1][e];return u(t||e)},i,i.exports,s,a,o,h)}return o[r].exports}for(var l="function"==typeof require&&require,e=0;e<h.length;e++)u(h[e]);return u}({1:[function(e,t,r){"use strict";var d=e("./utils"),c=e("./support"),p="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";r.encode=function(e){for(var t,r,n,i,s,a,o,h=[],u=0,l=e.length,f=l,c="string"!==d.getTypeOf(e);u<e.length;)f=l-u,n=c?(t=e[u++],r=u<l?e[u++]:0,u<l?e[u++]:0):(t=e.charCodeAt(u++),r=u<l?e.charCodeAt(u++):0,u<l?e.charCodeAt(u++):0),i=t>>2,s=(3&t)<<4|r>>4,a=1<f?(15&r)<<2|n>>6:64,o=2<f?63&n:64,h.push(p.charAt(i)+p.charAt(s)+p.charAt(a)+p.charAt(o));return h.join("")},r.decode=function(e){var t,r,n,i,s,a,o=0,h=0,u="data:";if(e.substr(0,u.length)===u)throw new Error("Invalid base64 input, it looks like a data url.");var l,f=3*(e=e.replace(/[^A-Za-z0-9+/=]/g,"")).length/4;if(e.charAt(e.length-1)===p.charAt(64)&&f--,e.charAt(e.length-2)===p.charAt(64)&&f--,f%1!=0)throw new Error("Invalid base64 input, bad content length.");for(l=c.uint8array?new Uint8Array(0|f):new Array(0|f);o<e.length;)t=p.indexOf(e.charAt(o++))<<2|(i=p.indexOf(e.charAt(o++)))>>4,r=(15&i)<<4|(s=p.indexOf(e.charAt(o++)))>>2,n=(3&s)<<6|(a=p.indexOf(e.charAt(o++))),l[h++]=t,64!==s&&(l[h++]=r),64!==a&&(l[h++]=n);return l}},{"./support":30,"./utils":32}],2:[function(e,t,r){"use strict";var n=e("./external"),i=e("./stream/DataWorker"),s=e("./stream/Crc32Probe"),a=e("./stream/DataLengthProbe");function o(e,t,r,n,i){this.compressedSize=e,this.uncompressedSize=t,this.crc32=r,this.compression=n,this.compressedContent=i}o.prototype={getContentWorker:function(){var e=new i(n.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new a("data_length")),t=this;return e.on("end",function(){if(this.streamInfo.data_length!==t.uncompressedSize)throw new Error("Bug : uncompressed data size mismatch")}),e},getCompressedWorker:function(){return new i(n.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize",this.compressedSize).withStreamInfo("uncompressedSize",this.uncompressedSize).withStreamInfo("crc32",this.crc32).withStreamInfo("compression",this.compression)}},o.createWorkerFrom=function(e,t,r){return e.pipe(new s).pipe(new a("uncompressedSize")).pipe(t.compressWorker(r)).pipe(new a("compressedSize")).withStreamInfo("compression",t)},t.exports=o},{"./external":6,"./stream/Crc32Probe":25,"./stream/DataLengthProbe":26,"./stream/DataWorker":27}],3:[function(e,t,r){"use strict";var n=e("./stream/GenericWorker");r.STORE={magic:"\0\0",compressWorker:function(){return new n("STORE compression")},uncompressWorker:function(){return new n("STORE decompression")}},r.DEFLATE=e("./flate")},{"./flate":7,"./stream/GenericWorker":28}],4:[function(e,t,r){"use strict";var n=e("./utils");var o=function(){for(var e,t=[],r=0;r<256;r++){e=r;for(var n=0;n<8;n++)e=1&e?3988292384^e>>>1:e>>>1;t[r]=e}return t}();t.exports=function(e,t){return void 0!==e&&e.length?"string"!==n.getTypeOf(e)?function(e,t,r,n){var i=o,s=n+r;e^=-1;for(var a=n;a<s;a++)e=e>>>8^i[255&(e^t[a])];return-1^e}(0|t,e,e.length,0):function(e,t,r,n){var i=o,s=n+r;e^=-1;for(var a=n;a<s;a++)e=e>>>8^i[255&(e^t.charCodeAt(a))];return-1^e}(0|t,e,e.length,0):0}},{"./utils":32}],5:[function(e,t,r){"use strict";r.base64=!1,r.binary=!1,r.dir=!1,r.createFolders=!0,r.date=null,r.compression=null,r.compressionOptions=null,r.comment=null,r.unixPermissions=null,r.dosPermissions=null},{}],6:[function(e,t,r){"use strict";var n=null;n="undefined"!=typeof Promise?Promise:e("lie"),t.exports={Promise:n}},{lie:37}],7:[function(e,t,r){"use strict";var n="undefined"!=typeof Uint8Array&&"undefined"!=typeof Uint16Array&&"undefined"!=typeof Uint32Array,i=e("pako"),s=e("./utils"),a=e("./stream/GenericWorker"),o=n?"uint8array":"array";function h(e,t){a.call(this,"FlateWorker/"+e),this._pako=null,this._pakoAction=e,this._pakoOptions=t,this.meta={}}r.magic="\b\0",s.inherits(h,a),h.prototype.processChunk=function(e){this.meta=e.meta,null===this._pako&&this._createPako(),this._pako.push(s.transformTo(o,e.data),!1)},h.prototype.flush=function(){a.prototype.flush.call(this),null===this._pako&&this._createPako(),this._pako.push([],!0)},h.prototype.cleanUp=function(){a.prototype.cleanUp.call(this),this._pako=null},h.prototype._createPako=function(){this._pako=new i[this._pakoAction]({raw:!0,level:this._pakoOptions.level||-1});var t=this;this._pako.onData=function(e){t.push({data:e,meta:t.meta})}},r.compressWorker=function(e){return new h("Deflate",e)},r.uncompressWorker=function(){return new h("Inflate",{})}},{"./stream/GenericWorker":28,"./utils":32,pako:38}],8:[function(e,t,r){"use strict";function A(e,t){var r,n="";for(r=0;r<t;r++)n+=String.fromCharCode(255&e),e>>>=8;return n}function n(e,t,r,n,i,s){var a,o,h=e.file,u=e.compression,l=s!==O.utf8encode,f=I.transformTo("string",s(h.name)),c=I.transformTo("string",O.utf8encode(h.name)),d=h.comment,p=I.transformTo("string",s(d)),m=I.transformTo("string",O.utf8encode(d)),_=c.length!==h.name.length,g=m.length!==d.length,b="",v="",y="",w=h.dir,k=h.date,x={crc32:0,compressedSize:0,uncompressedSize:0};t&&!r||(x.crc32=e.crc32,x.compressedSize=e.compressedSize,x.uncompressedSize=e.uncompressedSize);var S=0;t&&(S|=8),l||!_&&!g||(S|=2048);var z=0,C=0;w&&(z|=16),"UNIX"===i?(C=798,z|=function(e,t){var r=e;return e||(r=t?16893:33204),(65535&r)<<16}(h.unixPermissions,w)):(C=20,z|=function(e){return 63&(e||0)}(h.dosPermissions)),a=k.getUTCHours(),a<<=6,a|=k.getUTCMinutes(),a<<=5,a|=k.getUTCSeconds()/2,o=k.getUTCFullYear()-1980,o<<=4,o|=k.getUTCMonth()+1,o<<=5,o|=k.getUTCDate(),_&&(v=A(1,1)+A(B(f),4)+c,b+="up"+A(v.length,2)+v),g&&(y=A(1,1)+A(B(p),4)+m,b+="uc"+A(y.length,2)+y);var E="";return E+="\n\0",E+=A(S,2),E+=u.magic,E+=A(a,2),E+=A(o,2),E+=A(x.crc32,4),E+=A(x.compressedSize,4),E+=A(x.uncompressedSize,4),E+=A(f.length,2),E+=A(b.length,2),{fileRecord:R.LOCAL_FILE_HEADER+E+f+b,dirRecord:R.CENTRAL_FILE_HEADER+A(C,2)+E+A(p.length,2)+"\0\0\0\0"+A(z,4)+A(n,4)+f+b+p}}var I=e("../utils"),i=e("../stream/GenericWorker"),O=e("../utf8"),B=e("../crc32"),R=e("../signature");function s(e,t,r,n){i.call(this,"ZipFileWorker"),this.bytesWritten=0,this.zipComment=t,this.zipPlatform=r,this.encodeFileName=n,this.streamFiles=e,this.accumulate=!1,this.contentBuffer=[],this.dirRecords=[],this.currentSourceOffset=0,this.entriesCount=0,this.currentFile=null,this._sources=[]}I.inherits(s,i),s.prototype.push=function(e){var t=e.meta.percent||0,r=this.entriesCount,n=this._sources.length;this.accumulate?this.contentBuffer.push(e):(this.bytesWritten+=e.data.length,i.prototype.push.call(this,{data:e.data,meta:{currentFile:this.currentFile,percent:r?(t+100*(r-n-1))/r:100}}))},s.prototype.openedSource=function(e){this.currentSourceOffset=this.bytesWritten,this.currentFile=e.file.name;var t=this.streamFiles&&!e.file.dir;if(t){var r=n(e,t,!1,this.currentSourceOffset,this.zipPlatform,this.encodeFileName);this.push({data:r.fileRecord,meta:{percent:0}})}else this.accumulate=!0},s.prototype.closedSource=function(e){this.accumulate=!1;var t=this.streamFiles&&!e.file.dir,r=n(e,t,!0,this.currentSourceOffset,this.zipPlatform,this.encodeFileName);if(this.dirRecords.push(r.dirRecord),t)this.push({data:function(e){return R.DATA_DESCRIPTOR+A(e.crc32,4)+A(e.compressedSize,4)+A(e.uncompressedSize,4)}(e),meta:{percent:100}});else for(this.push({data:r.fileRecord,meta:{percent:0}});this.contentBuffer.length;)this.push(this.contentBuffer.shift());this.currentFile=null},s.prototype.flush=function(){for(var e=this.bytesWritten,t=0;t<this.dirRecords.length;t++)this.push({data:this.dirRecords[t],meta:{percent:100}});var r=this.bytesWritten-e,n=function(e,t,r,n,i){var s=I.transformTo("string",i(n));return R.CENTRAL_DIRECTORY_END+"\0\0\0\0"+A(e,2)+A(e,2)+A(t,4)+A(r,4)+A(s.length,2)+s}(this.dirRecords.length,r,e,this.zipComment,this.encodeFileName);this.push({data:n,meta:{percent:100}})},s.prototype.prepareNextSource=function(){this.previous=this._sources.shift(),this.openedSource(this.previous.streamInfo),this.isPaused?this.previous.pause():this.previous.resume()},s.prototype.registerPrevious=function(e){this._sources.push(e);var t=this;return e.on("data",function(e){t.processChunk(e)}),e.on("end",function(){t.closedSource(t.previous.streamInfo),t._sources.length?t.prepareNextSource():t.end()}),e.on("error",function(e){t.error(e)}),this},s.prototype.resume=function(){return!!i.prototype.resume.call(this)&&(!this.previous&&this._sources.length?(this.prepareNextSource(),!0):this.previous||this._sources.length||this.generatedError?void 0:(this.end(),!0))},s.prototype.error=function(e){var t=this._sources;if(!i.prototype.error.call(this,e))return!1;for(var r=0;r<t.length;r++)try{t[r].error(e)}catch(e){}return!0},s.prototype.lock=function(){i.prototype.lock.call(this);for(var e=this._sources,t=0;t<e.length;t++)e[t].lock()},t.exports=s},{"../crc32":4,"../signature":23,"../stream/GenericWorker":28,"../utf8":31,"../utils":32}],9:[function(e,t,r){"use strict";var u=e("../compressions"),n=e("./ZipFileWorker");r.generateWorker=function(e,a,t){var o=new n(a.streamFiles,t,a.platform,a.encodeFileName),h=0;try{e.forEach(function(e,t){h++;var r=function(e,t){var r=e||t,n=u[r];if(!n)throw new Error(r+" is not a valid compression method !");return n}(t.options.compression,a.compression),n=t.options.compressionOptions||a.compressionOptions||{},i=t.dir,s=t.date;t._compressWorker(r,n).withStreamInfo("file",{name:e,dir:i,date:s,comment:t.comment||"",unixPermissions:t.unixPermissions,dosPermissions:t.dosPermissions}).pipe(o)}),o.entriesCount=h}catch(e){o.error(e)}return o}},{"../compressions":3,"./ZipFileWorker":8}],10:[function(e,t,r){"use strict";function n(){if(!(this instanceof n))return new n;if(arguments.length)throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");this.files=Object.create(null),this.comment=null,this.root="",this.clone=function(){var e=new n;for(var t in this)"function"!=typeof this[t]&&(e[t]=this[t]);return e}}(n.prototype=e("./object")).loadAsync=e("./load"),n.support=e("./support"),n.defaults=e("./defaults"),n.version="3.10.1",n.loadAsync=function(e,t){return(new n).loadAsync(e,t)},n.external=e("./external"),t.exports=n},{"./defaults":5,"./external":6,"./load":11,"./object":15,"./support":30}],11:[function(e,t,r){"use strict";var u=e("./utils"),i=e("./external"),n=e("./utf8"),s=e("./zipEntries"),a=e("./stream/Crc32Probe"),l=e("./nodejsUtils");function f(n){return new i.Promise(function(e,t){var r=n.decompressed.getContentWorker().pipe(new a);r.on("error",function(e){t(e)}).on("end",function(){r.streamInfo.crc32!==n.decompressed.crc32?t(new Error("Corrupted zip : CRC32 mismatch")):e()}).resume()})}t.exports=function(e,o){var h=this;return o=u.extend(o||{},{base64:!1,checkCRC32:!1,optimizedBinaryString:!1,createFolders:!1,decodeFileName:n.utf8decode}),l.isNode&&l.isStream(e)?i.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file.")):u.prepareContent("the loaded zip file",e,!0,o.optimizedBinaryString,o.base64).then(function(e){var t=new s(o);return t.load(e),t}).then(function(e){var t=[i.Promise.resolve(e)],r=e.files;if(o.checkCRC32)for(var n=0;n<r.length;n++)t.push(f(r[n]));return i.Promise.all(t)}).then(function(e){for(var t=e.shift(),r=t.files,n=0;n<r.length;n++){var i=r[n],s=i.fileNameStr,a=u.resolve(i.fileNameStr);h.file(a,i.decompressed,{binary:!0,optimizedBinaryString:!0,date:i.date,dir:i.dir,comment:i.fileCommentStr.length?i.fileCommentStr:null,unixPermissions:i.unixPermissions,dosPermissions:i.dosPermissions,createFolders:o.createFolders}),i.dir||(h.file(a).unsafeOriginalName=s)}return t.zipComment.length&&(h.comment=t.zipComment),h})}},{"./external":6,"./nodejsUtils":14,"./stream/Crc32Probe":25,"./utf8":31,"./utils":32,"./zipEntries":33}],12:[function(e,t,r){"use strict";var n=e("../utils"),i=e("../stream/GenericWorker");function s(e,t){i.call(this,"Nodejs stream input adapter for "+e),this._upstreamEnded=!1,this._bindStream(t)}n.inherits(s,i),s.prototype._bindStream=function(e){var t=this;(this._stream=e).pause(),e.on("data",function(e){t.push({data:e,meta:{percent:0}})}).on("error",function(e){t.isPaused?this.generatedError=e:t.error(e)}).on("end",function(){t.isPaused?t._upstreamEnded=!0:t.end()})},s.prototype.pause=function(){return!!i.prototype.pause.call(this)&&(this._stream.pause(),!0)},s.prototype.resume=function(){return!!i.prototype.resume.call(this)&&(this._upstreamEnded?this.end():this._stream.resume(),!0)},t.exports=s},{"../stream/GenericWorker":28,"../utils":32}],13:[function(e,t,r){"use strict";var i=e("readable-stream").Readable;function n(e,t,r){i.call(this,t),this._helper=e;var n=this;e.on("data",function(e,t){n.push(e)||n._helper.pause(),r&&r(t)}).on("error",function(e){n.emit("error",e)}).on("end",function(){n.push(null)})}e("../utils").inherits(n,i),n.prototype._read=function(){this._helper.resume()},t.exports=n},{"../utils":32,"readable-stream":16}],14:[function(e,t,r){"use strict";t.exports={isNode:"undefined"!=typeof Buffer,newBufferFrom:function(e,t){if(Buffer.from&&Buffer.from!==Uint8Array.from)return Buffer.from(e,t);if("number"==typeof e)throw new Error('The "data" argument must not be a number');return new Buffer(e,t)},allocBuffer:function(e){if(Buffer.alloc)return Buffer.alloc(e);var t=new Buffer(e);return t.fill(0),t},isBuffer:function(e){return Buffer.isBuffer(e)},isStream:function(e){return e&&"function"==typeof e.on&&"function"==typeof e.pause&&"function"==typeof e.resume}}},{}],15:[function(e,t,r){"use strict";function s(e,t,r){var n,i=u.getTypeOf(t),s=u.extend(r||{},f);s.date=s.date||new Date,null!==s.compression&&(s.compression=s.compression.toUpperCase()),"string"==typeof s.unixPermissions&&(s.unixPermissions=parseInt(s.unixPermissions,8)),s.unixPermissions&&16384&s.unixPermissions&&(s.dir=!0),s.dosPermissions&&16&s.dosPermissions&&(s.dir=!0),s.dir&&(e=g(e)),s.createFolders&&(n=_(e))&&b.call(this,n,!0);var a="string"===i&&!1===s.binary&&!1===s.base64;r&&void 0!==r.binary||(s.binary=!a),(t instanceof c&&0===t.uncompressedSize||s.dir||!t||0===t.length)&&(s.base64=!1,s.binary=!0,t="",s.compression="STORE",i="string");var o=null;o=t instanceof c||t instanceof l?t:p.isNode&&p.isStream(t)?new m(e,t):u.prepareContent(e,t,s.binary,s.optimizedBinaryString,s.base64);var h=new d(e,o,s);this.files[e]=h}var i=e("./utf8"),u=e("./utils"),l=e("./stream/GenericWorker"),a=e("./stream/StreamHelper"),f=e("./defaults"),c=e("./compressedObject"),d=e("./zipObject"),o=e("./generate"),p=e("./nodejsUtils"),m=e("./nodejs/NodejsStreamInputAdapter"),_=function(e){"/"===e.slice(-1)&&(e=e.substring(0,e.length-1));var t=e.lastIndexOf("/");return 0<t?e.substring(0,t):""},g=function(e){return"/"!==e.slice(-1)&&(e+="/"),e},b=function(e,t){return t=void 0!==t?t:f.createFolders,e=g(e),this.files[e]||s.call(this,e,null,{dir:!0,createFolders:t}),this.files[e]};function h(e){return"[object RegExp]"===Object.prototype.toString.call(e)}var n={load:function(){throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.")},forEach:function(e){var t,r,n;for(t in this.files)n=this.files[t],(r=t.slice(this.root.length,t.length))&&t.slice(0,this.root.length)===this.root&&e(r,n)},filter:function(r){var n=[];return this.forEach(function(e,t){r(e,t)&&n.push(t)}),n},file:function(e,t,r){if(1!==arguments.length)return e=this.root+e,s.call(this,e,t,r),this;if(h(e)){var n=e;return this.filter(function(e,t){return!t.dir&&n.test(e)})}var i=this.files[this.root+e];return i&&!i.dir?i:null},folder:function(r){if(!r)return this;if(h(r))return this.filter(function(e,t){return t.dir&&r.test(e)});var e=this.root+r,t=b.call(this,e),n=this.clone();return n.root=t.name,n},remove:function(r){r=this.root+r;var e=this.files[r];if(e||("/"!==r.slice(-1)&&(r+="/"),e=this.files[r]),e&&!e.dir)delete this.files[r];else for(var t=this.filter(function(e,t){return t.name.slice(0,r.length)===r}),n=0;n<t.length;n++)delete this.files[t[n].name];return this},generate:function(){throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.")},generateInternalStream:function(e){var t,r={};try{if((r=u.extend(e||{},{streamFiles:!1,compression:"STORE",compressionOptions:null,type:"",platform:"DOS",comment:null,mimeType:"application/zip",encodeFileName:i.utf8encode})).type=r.type.toLowerCase(),r.compression=r.compression.toUpperCase(),"binarystring"===r.type&&(r.type="string"),!r.type)throw new Error("No output type specified.");u.checkSupport(r.type),"darwin"!==r.platform&&"freebsd"!==r.platform&&"linux"!==r.platform&&"sunos"!==r.platform||(r.platform="UNIX"),"win32"===r.platform&&(r.platform="DOS");var n=r.comment||this.comment||"";t=o.generateWorker(this,r,n)}catch(e){(t=new l("error")).error(e)}return new a(t,r.type||"string",r.mimeType)},generateAsync:function(e,t){return this.generateInternalStream(e).accumulate(t)},generateNodeStream:function(e,t){return(e=e||{}).type||(e.type="nodebuffer"),this.generateInternalStream(e).toNodejsStream(t)}};t.exports=n},{"./compressedObject":2,"./defaults":5,"./generate":9,"./nodejs/NodejsStreamInputAdapter":12,"./nodejsUtils":14,"./stream/GenericWorker":28,"./stream/StreamHelper":29,"./utf8":31,"./utils":32,"./zipObject":35}],16:[function(e,t,r){"use strict";t.exports=e("stream")},{stream:void 0}],17:[function(e,t,r){"use strict";var n=e("./DataReader");function i(e){n.call(this,e);for(var t=0;t<this.data.length;t++)e[t]=255&e[t]}e("../utils").inherits(i,n),i.prototype.byteAt=function(e){return this.data[this.zero+e]},i.prototype.lastIndexOfSignature=function(e){for(var t=e.charCodeAt(0),r=e.charCodeAt(1),n=e.charCodeAt(2),i=e.charCodeAt(3),s=this.length-4;0<=s;--s)if(this.data[s]===t&&this.data[s+1]===r&&this.data[s+2]===n&&this.data[s+3]===i)return s-this.zero;return-1},i.prototype.readAndCheckSignature=function(e){var t=e.charCodeAt(0),r=e.charCodeAt(1),n=e.charCodeAt(2),i=e.charCodeAt(3),s=this.readData(4);return t===s[0]&&r===s[1]&&n===s[2]&&i===s[3]},i.prototype.readData=function(e){if(this.checkOffset(e),0===e)return[];var t=this.data.slice(this.zero+this.index,this.zero+this.index+e);return this.index+=e,t},t.exports=i},{"../utils":32,"./DataReader":18}],18:[function(e,t,r){"use strict";var n=e("../utils");function i(e){this.data=e,this.length=e.length,this.index=0,this.zero=0}i.prototype={checkOffset:function(e){this.checkIndex(this.index+e)},checkIndex:function(e){if(this.length<this.zero+e||e<0)throw new Error("End of data reached (data length = "+this.length+", asked index = "+e+"). Corrupted zip ?")},setIndex:function(e){this.checkIndex(e),this.index=e},skip:function(e){this.setIndex(this.index+e)},byteAt:function(){},readInt:function(e){var t,r=0;for(this.checkOffset(e),t=this.index+e-1;t>=this.index;t--)r=(r<<8)+this.byteAt(t);return this.index+=e,r},readString:function(e){return n.transformTo("string",this.readData(e))},readData:function(){},lastIndexOfSignature:function(){},readAndCheckSignature:function(){},readDate:function(){var e=this.readInt(4);return new Date(Date.UTC(1980+(e>>25&127),(e>>21&15)-1,e>>16&31,e>>11&31,e>>5&63,(31&e)<<1))}},t.exports=i},{"../utils":32}],19:[function(e,t,r){"use strict";var n=e("./Uint8ArrayReader");function i(e){n.call(this,e)}e("../utils").inherits(i,n),i.prototype.readData=function(e){this.checkOffset(e);var t=this.data.slice(this.zero+this.index,this.zero+this.index+e);return this.index+=e,t},t.exports=i},{"../utils":32,"./Uint8ArrayReader":21}],20:[function(e,t,r){"use strict";var n=e("./DataReader");function i(e){n.call(this,e)}e("../utils").inherits(i,n),i.prototype.byteAt=function(e){return this.data.charCodeAt(this.zero+e)},i.prototype.lastIndexOfSignature=function(e){return this.data.lastIndexOf(e)-this.zero},i.prototype.readAndCheckSignature=function(e){return e===this.readData(4)},i.prototype.readData=function(e){this.checkOffset(e);var t=this.data.slice(this.zero+this.index,this.zero+this.index+e);return this.index+=e,t},t.exports=i},{"../utils":32,"./DataReader":18}],21:[function(e,t,r){"use strict";var n=e("./ArrayReader");function i(e){n.call(this,e)}e("../utils").inherits(i,n),i.prototype.readData=function(e){if(this.checkOffset(e),0===e)return new Uint8Array(0);var t=this.data.subarray(this.zero+this.index,this.zero+this.index+e);return this.index+=e,t},t.exports=i},{"../utils":32,"./ArrayReader":17}],22:[function(e,t,r){"use strict";var n=e("../utils"),i=e("../support"),s=e("./ArrayReader"),a=e("./StringReader"),o=e("./NodeBufferReader"),h=e("./Uint8ArrayReader");t.exports=function(e){var t=n.getTypeOf(e);return n.checkSupport(t),"string"!==t||i.uint8array?"nodebuffer"===t?new o(e):i.uint8array?new h(n.transformTo("uint8array",e)):new s(n.transformTo("array",e)):new a(e)}},{"../support":30,"../utils":32,"./ArrayReader":17,"./NodeBufferReader":19,"./StringReader":20,"./Uint8ArrayReader":21}],23:[function(e,t,r){"use strict";r.LOCAL_FILE_HEADER="PK",r.CENTRAL_FILE_HEADER="PK",r.CENTRAL_DIRECTORY_END="PK",r.ZIP64_CENTRAL_DIRECTORY_LOCATOR="PK",r.ZIP64_CENTRAL_DIRECTORY_END="PK",r.DATA_DESCRIPTOR="PK\b"},{}],24:[function(e,t,r){"use strict";var n=e("./GenericWorker"),i=e("../utils");function s(e){n.call(this,"ConvertWorker to "+e),this.destType=e}i.inherits(s,n),s.prototype.processChunk=function(e){this.push({data:i.transformTo(this.destType,e.data),meta:e.meta})},t.exports=s},{"../utils":32,"./GenericWorker":28}],25:[function(e,t,r){"use strict";var n=e("./GenericWorker"),i=e("../crc32");function s(){n.call(this,"Crc32Probe"),this.withStreamInfo("crc32",0)}e("../utils").inherits(s,n),s.prototype.processChunk=function(e){this.streamInfo.crc32=i(e.data,this.streamInfo.crc32||0),this.push(e)},t.exports=s},{"../crc32":4,"../utils":32,"./GenericWorker":28}],26:[function(e,t,r){"use strict";var n=e("../utils"),i=e("./GenericWorker");function s(e){i.call(this,"DataLengthProbe for "+e),this.propName=e,this.withStreamInfo(e,0)}n.inherits(s,i),s.prototype.processChunk=function(e){if(e){var t=this.streamInfo[this.propName]||0;this.streamInfo[this.propName]=t+e.data.length}i.prototype.processChunk.call(this,e)},t.exports=s},{"../utils":32,"./GenericWorker":28}],27:[function(e,t,r){"use strict";var n=e("../utils"),i=e("./GenericWorker");function s(e){i.call(this,"DataWorker");var t=this;this.dataIsReady=!1,this.index=0,this.max=0,this.data=null,this.type="",this._tickScheduled=!1,e.then(function(e){t.dataIsReady=!0,t.data=e,t.max=e&&e.length||0,t.type=n.getTypeOf(e),t.isPaused||t._tickAndRepeat()},function(e){t.error(e)})}n.inherits(s,i),s.prototype.cleanUp=function(){i.prototype.cleanUp.call(this),this.data=null},s.prototype.resume=function(){return!!i.prototype.resume.call(this)&&(!this._tickScheduled&&this.dataIsReady&&(this._tickScheduled=!0,n.delay(this._tickAndRepeat,[],this)),!0)},s.prototype._tickAndRepeat=function(){this._tickScheduled=!1,this.isPaused||this.isFinished||(this._tick(),this.isFinished||(n.delay(this._tickAndRepeat,[],this),this._tickScheduled=!0))},s.prototype._tick=function(){if(this.isPaused||this.isFinished)return!1;var e=null,t=Math.min(this.max,this.index+16384);if(this.index>=this.max)return this.end();switch(this.type){case"string":e=this.data.substring(this.index,t);break;case"uint8array":e=this.data.subarray(this.index,t);break;case"array":case"nodebuffer":e=this.data.slice(this.index,t)}return this.index=t,this.push({data:e,meta:{percent:this.max?this.index/this.max*100:0}})},t.exports=s},{"../utils":32,"./GenericWorker":28}],28:[function(e,t,r){"use strict";function n(e){this.name=e||"default",this.streamInfo={},this.generatedError=null,this.extraStreamInfo={},this.isPaused=!0,this.isFinished=!1,this.isLocked=!1,this._listeners={data:[],end:[],error:[]},this.previous=null}n.prototype={push:function(e){this.emit("data",e)},end:function(){if(this.isFinished)return!1;this.flush();try{this.emit("end"),this.cleanUp(),this.isFinished=!0}catch(e){this.emit("error",e)}return!0},error:function(e){return!this.isFinished&&(this.isPaused?this.generatedError=e:(this.isFinished=!0,this.emit("error",e),this.previous&&this.previous.error(e),this.cleanUp()),!0)},on:function(e,t){return this._listeners[e].push(t),this},cleanUp:function(){this.streamInfo=this.generatedError=this.extraStreamInfo=null,this._listeners=[]},emit:function(e,t){if(this._listeners[e])for(var r=0;r<this._listeners[e].length;r++)this._listeners[e][r].call(this,t)},pipe:function(e){return e.registerPrevious(this)},registerPrevious:function(e){if(this.isLocked)throw new Error("The stream '"+this+"' has already been used.");this.streamInfo=e.streamInfo,this.mergeStreamInfo(),this.previous=e;var t=this;return e.on("data",function(e){t.processChunk(e)}),e.on("end",function(){t.end()}),e.on("error",function(e){t.error(e)}),this},pause:function(){return!this.isPaused&&!this.isFinished&&(this.isPaused=!0,this.previous&&this.previous.pause(),!0)},resume:function(){if(!this.isPaused||this.isFinished)return!1;var e=this.isPaused=!1;return this.generatedError&&(this.error(this.generatedError),e=!0),this.previous&&this.previous.resume(),!e},flush:function(){},processChunk:function(e){this.push(e)},withStreamInfo:function(e,t){return this.extraStreamInfo[e]=t,this.mergeStreamInfo(),this},mergeStreamInfo:function(){for(var e in this.extraStreamInfo)Object.prototype.hasOwnProperty.call(this.extraStreamInfo,e)&&(this.streamInfo[e]=this.extraStreamInfo[e])},lock:function(){if(this.isLocked)throw new Error("The stream '"+this+"' has already been used.");this.isLocked=!0,this.previous&&this.previous.lock()},toString:function(){var e="Worker "+this.name;return this.previous?this.previous+" -> "+e:e}},t.exports=n},{}],29:[function(e,t,r){"use strict";var h=e("../utils"),i=e("./ConvertWorker"),s=e("./GenericWorker"),u=e("../base64"),n=e("../support"),a=e("../external"),o=null;if(n.nodestream)try{o=e("../nodejs/NodejsStreamOutputAdapter")}catch(e){}function l(e,o){return new a.Promise(function(t,r){var n=[],i=e._internalType,s=e._outputType,a=e._mimeType;e.on("data",function(e,t){n.push(e),o&&o(t)}).on("error",function(e){n=[],r(e)}).on("end",function(){try{var e=function(e,t,r){switch(e){case"blob":return h.newBlob(h.transformTo("arraybuffer",t),r);case"base64":return u.encode(t);default:return h.transformTo(e,t)}}(s,function(e,t){var r,n=0,i=null,s=0;for(r=0;r<t.length;r++)s+=t[r].length;switch(e){case"string":return t.join("");case"array":return Array.prototype.concat.apply([],t);case"uint8array":for(i=new Uint8Array(s),r=0;r<t.length;r++)i.set(t[r],n),n+=t[r].length;return i;case"nodebuffer":return Buffer.concat(t);default:throw new Error("concat : unsupported type '"+e+"'")}}(i,n),a);t(e)}catch(e){r(e)}n=[]}).resume()})}function f(e,t,r){var n=t;switch(t){case"blob":case"arraybuffer":n="uint8array";break;case"base64":n="string"}try{this._internalType=n,this._outputType=t,this._mimeType=r,h.checkSupport(n),this._worker=e.pipe(new i(n)),e.lock()}catch(e){this._worker=new s("error"),this._worker.error(e)}}f.prototype={accumulate:function(e){return l(this,e)},on:function(e,t){var r=this;return"data"===e?this._worker.on(e,function(e){t.call(r,e.data,e.meta)}):this._worker.on(e,function(){h.delay(t,arguments,r)}),this},resume:function(){return h.delay(this._worker.resume,[],this._worker),this},pause:function(){return this._worker.pause(),this},toNodejsStream:function(e){if(h.checkSupport("nodestream"),"nodebuffer"!==this._outputType)throw new Error(this._outputType+" is not supported by this method");return new o(this,{objectMode:"nodebuffer"!==this._outputType},e)}},t.exports=f},{"../base64":1,"../external":6,"../nodejs/NodejsStreamOutputAdapter":13,"../support":30,"../utils":32,"./ConvertWorker":24,"./GenericWorker":28}],30:[function(e,t,r){"use strict";if(r.base64=!0,r.array=!0,r.string=!0,r.arraybuffer="undefined"!=typeof ArrayBuffer&&"undefined"!=typeof Uint8Array,r.nodebuffer="undefined"!=typeof Buffer,r.uint8array="undefined"!=typeof Uint8Array,"undefined"==typeof ArrayBuffer)r.blob=!1;else{var n=new ArrayBuffer(0);try{r.blob=0===new Blob([n],{type:"application/zip"}).size}catch(e){try{var i=new(self.BlobBuilder||self.WebKitBlobBuilder||self.MozBlobBuilder||self.MSBlobBuilder);i.append(n),r.blob=0===i.getBlob("application/zip").size}catch(e){r.blob=!1}}}try{r.nodestream=!!e("readable-stream").Readable}catch(e){r.nodestream=!1}},{"readable-stream":16}],31:[function(e,t,s){"use strict";for(var o=e("./utils"),h=e("./support"),r=e("./nodejsUtils"),n=e("./stream/GenericWorker"),u=new Array(256),i=0;i<256;i++)u[i]=252<=i?6:248<=i?5:240<=i?4:224<=i?3:192<=i?2:1;u[254]=u[254]=1;function a(){n.call(this,"utf-8 decode"),this.leftOver=null}function l(){n.call(this,"utf-8 encode")}s.utf8encode=function(e){return h.nodebuffer?r.newBufferFrom(e,"utf-8"):function(e){var t,r,n,i,s,a=e.length,o=0;for(i=0;i<a;i++)55296==(64512&(r=e.charCodeAt(i)))&&i+1<a&&56320==(64512&(n=e.charCodeAt(i+1)))&&(r=65536+(r-55296<<10)+(n-56320),i++),o+=r<128?1:r<2048?2:r<65536?3:4;for(t=h.uint8array?new Uint8Array(o):new Array(o),i=s=0;s<o;i++)55296==(64512&(r=e.charCodeAt(i)))&&i+1<a&&56320==(64512&(n=e.charCodeAt(i+1)))&&(r=65536+(r-55296<<10)+(n-56320),i++),r<128?t[s++]=r:(r<2048?t[s++]=192|r>>>6:(r<65536?t[s++]=224|r>>>12:(t[s++]=240|r>>>18,t[s++]=128|r>>>12&63),t[s++]=128|r>>>6&63),t[s++]=128|63&r);return t}(e)},s.utf8decode=function(e){return h.nodebuffer?o.transformTo("nodebuffer",e).toString("utf-8"):function(e){var t,r,n,i,s=e.length,a=new Array(2*s);for(t=r=0;t<s;)if((n=e[t++])<128)a[r++]=n;else if(4<(i=u[n]))a[r++]=65533,t+=i-1;else{for(n&=2===i?31:3===i?15:7;1<i&&t<s;)n=n<<6|63&e[t++],i--;1<i?a[r++]=65533:n<65536?a[r++]=n:(n-=65536,a[r++]=55296|n>>10&1023,a[r++]=56320|1023&n)}return a.length!==r&&(a.subarray?a=a.subarray(0,r):a.length=r),o.applyFromCharCode(a)}(e=o.transformTo(h.uint8array?"uint8array":"array",e))},o.inherits(a,n),a.prototype.processChunk=function(e){var t=o.transformTo(h.uint8array?"uint8array":"array",e.data);if(this.leftOver&&this.leftOver.length){if(h.uint8array){var r=t;(t=new Uint8Array(r.length+this.leftOver.length)).set(this.leftOver,0),t.set(r,this.leftOver.length)}else t=this.leftOver.concat(t);this.leftOver=null}var n=function(e,t){var r;for((t=t||e.length)>e.length&&(t=e.length),r=t-1;0<=r&&128==(192&e[r]);)r--;return r<0?t:0===r?t:r+u[e[r]]>t?r:t}(t),i=t;n!==t.length&&(h.uint8array?(i=t.subarray(0,n),this.leftOver=t.subarray(n,t.length)):(i=t.slice(0,n),this.leftOver=t.slice(n,t.length))),this.push({data:s.utf8decode(i),meta:e.meta})},a.prototype.flush=function(){this.leftOver&&this.leftOver.length&&(this.push({data:s.utf8decode(this.leftOver),meta:{}}),this.leftOver=null)},s.Utf8DecodeWorker=a,o.inherits(l,n),l.prototype.processChunk=function(e){this.push({data:s.utf8encode(e.data),meta:e.meta})},s.Utf8EncodeWorker=l},{"./nodejsUtils":14,"./stream/GenericWorker":28,"./support":30,"./utils":32}],32:[function(e,t,a){"use strict";var o=e("./support"),h=e("./base64"),r=e("./nodejsUtils"),u=e("./external");function n(e){return e}function l(e,t){for(var r=0;r<e.length;++r)t[r]=255&e.charCodeAt(r);return t}e("setimmediate"),a.newBlob=function(t,r){a.checkSupport("blob");try{return new Blob([t],{type:r})}catch(e){try{var n=new(self.BlobBuilder||self.WebKitBlobBuilder||self.MozBlobBuilder||self.MSBlobBuilder);return n.append(t),n.getBlob(r)}catch(e){throw new Error("Bug : can't construct the Blob.")}}};var i={stringifyByChunk:function(e,t,r){var n=[],i=0,s=e.length;if(s<=r)return String.fromCharCode.apply(null,e);for(;i<s;)"array"===t||"nodebuffer"===t?n.push(String.fromCharCode.apply(null,e.slice(i,Math.min(i+r,s)))):n.push(String.fromCharCode.apply(null,e.subarray(i,Math.min(i+r,s)))),i+=r;return n.join("")},stringifyByChar:function(e){for(var t="",r=0;r<e.length;r++)t+=String.fromCharCode(e[r]);return t},applyCanBeUsed:{uint8array:function(){try{return o.uint8array&&1===String.fromCharCode.apply(null,new Uint8Array(1)).length}catch(e){return!1}}(),nodebuffer:function(){try{return o.nodebuffer&&1===String.fromCharCode.apply(null,r.allocBuffer(1)).length}catch(e){return!1}}()}};function s(e){var t=65536,r=a.getTypeOf(e),n=!0;if("uint8array"===r?n=i.applyCanBeUsed.uint8array:"nodebuffer"===r&&(n=i.applyCanBeUsed.nodebuffer),n)for(;1<t;)try{return i.stringifyByChunk(e,r,t)}catch(e){t=Math.floor(t/2)}return i.stringifyByChar(e)}function f(e,t){for(var r=0;r<e.length;r++)t[r]=e[r];return t}a.applyFromCharCode=s;var c={};c.string={string:n,array:function(e){return l(e,new Array(e.length))},arraybuffer:function(e){return c.string.uint8array(e).buffer},uint8array:function(e){return l(e,new Uint8Array(e.length))},nodebuffer:function(e){return l(e,r.allocBuffer(e.length))}},c.array={string:s,array:n,arraybuffer:function(e){return new Uint8Array(e).buffer},uint8array:function(e){return new Uint8Array(e)},nodebuffer:function(e){return r.newBufferFrom(e)}},c.arraybuffer={string:function(e){return s(new Uint8Array(e))},array:function(e){return f(new Uint8Array(e),new Array(e.byteLength))},arraybuffer:n,uint8array:function(e){return new Uint8Array(e)},nodebuffer:function(e){return r.newBufferFrom(new Uint8Array(e))}},c.uint8array={string:s,array:function(e){return f(e,new Array(e.length))},arraybuffer:function(e){return e.buffer},uint8array:n,nodebuffer:function(e){return r.newBufferFrom(e)}},c.nodebuffer={string:s,array:function(e){return f(e,new Array(e.length))},arraybuffer:function(e){return c.nodebuffer.uint8array(e).buffer},uint8array:function(e){return f(e,new Uint8Array(e.length))},nodebuffer:n},a.transformTo=function(e,t){if(t=t||"",!e)return t;a.checkSupport(e);var r=a.getTypeOf(t);return c[r][e](t)},a.resolve=function(e){for(var t=e.split("/"),r=[],n=0;n<t.length;n++){var i=t[n];"."===i||""===i&&0!==n&&n!==t.length-1||(".."===i?r.pop():r.push(i))}return r.join("/")},a.getTypeOf=function(e){return"string"==typeof e?"string":"[object Array]"===Object.prototype.toString.call(e)?"array":o.nodebuffer&&r.isBuffer(e)?"nodebuffer":o.uint8array&&e instanceof Uint8Array?"uint8array":o.arraybuffer&&e instanceof ArrayBuffer?"arraybuffer":void 0},a.checkSupport=function(e){if(!o[e.toLowerCase()])throw new Error(e+" is not supported by this platform")},a.MAX_VALUE_16BITS=65535,a.MAX_VALUE_32BITS=-1,a.pretty=function(e){var t,r,n="";for(r=0;r<(e||"").length;r++)n+="\\x"+((t=e.charCodeAt(r))<16?"0":"")+t.toString(16).toUpperCase();return n},a.delay=function(e,t,r){setImmediate(function(){e.apply(r||null,t||[])})},a.inherits=function(e,t){function r(){}r.prototype=t.prototype,e.prototype=new r},a.extend=function(){var e,t,r={};for(e=0;e<arguments.length;e++)for(t in arguments[e])Object.prototype.hasOwnProperty.call(arguments[e],t)&&void 0===r[t]&&(r[t]=arguments[e][t]);return r},a.prepareContent=function(r,e,n,i,s){return u.Promise.resolve(e).then(function(n){return o.blob&&(n instanceof Blob||-1!==["[object File]","[object Blob]"].indexOf(Object.prototype.toString.call(n)))&&"undefined"!=typeof FileReader?new u.Promise(function(t,r){var e=new FileReader;e.onload=function(e){t(e.target.result)},e.onerror=function(e){r(e.target.error)},e.readAsArrayBuffer(n)}):n}).then(function(e){var t=a.getTypeOf(e);return t?("arraybuffer"===t?e=a.transformTo("uint8array",e):"string"===t&&(s?e=h.decode(e):n&&!0!==i&&(e=function(e){return l(e,o.uint8array?new Uint8Array(e.length):new Array(e.length))}(e))),e):u.Promise.reject(new Error("Can't read the data of '"+r+"'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"))})}},{"./base64":1,"./external":6,"./nodejsUtils":14,"./support":30,setimmediate:54}],33:[function(e,t,r){"use strict";var n=e("./reader/readerFor"),i=e("./utils"),s=e("./signature"),a=e("./zipEntry"),o=e("./support");function h(e){this.files=[],this.loadOptions=e}h.prototype={checkSignature:function(e){if(!this.reader.readAndCheckSignature(e)){this.reader.index-=4;var t=this.reader.readString(4);throw new Error("Corrupted zip or bug: unexpected signature ("+i.pretty(t)+", expected "+i.pretty(e)+")")}},isSignature:function(e,t){var r=this.reader.index;this.reader.setIndex(e);var n=this.reader.readString(4)===t;return this.reader.setIndex(r),n},readBlockEndOfCentral:function(){this.diskNumber=this.reader.readInt(2),this.diskWithCentralDirStart=this.reader.readInt(2),this.centralDirRecordsOnThisDisk=this.reader.readInt(2),this.centralDirRecords=this.reader.readInt(2),this.centralDirSize=this.reader.readInt(4),this.centralDirOffset=this.reader.readInt(4),this.zipCommentLength=this.reader.readInt(2);var e=this.reader.readData(this.zipCommentLength),t=o.uint8array?"uint8array":"array",r=i.transformTo(t,e);this.zipComment=this.loadOptions.decodeFileName(r)},readBlockZip64EndOfCentral:function(){this.zip64EndOfCentralSize=this.reader.readInt(8),this.reader.skip(4),this.diskNumber=this.reader.readInt(4),this.diskWithCentralDirStart=this.reader.readInt(4),this.centralDirRecordsOnThisDisk=this.reader.readInt(8),this.centralDirRecords=this.reader.readInt(8),this.centralDirSize=this.reader.readInt(8),this.centralDirOffset=this.reader.readInt(8),this.zip64ExtensibleData={};for(var e,t,r,n=this.zip64EndOfCentralSize-44;0<n;)e=this.reader.readInt(2),t=this.reader.readInt(4),r=this.reader.readData(t),this.zip64ExtensibleData[e]={id:e,length:t,value:r}},readBlockZip64EndOfCentralLocator:function(){if(this.diskWithZip64CentralDirStart=this.reader.readInt(4),this.relativeOffsetEndOfZip64CentralDir=this.reader.readInt(8),this.disksCount=this.reader.readInt(4),1<this.disksCount)throw new Error("Multi-volumes zip are not supported")},readLocalFiles:function(){var e,t;for(e=0;e<this.files.length;e++)t=this.files[e],this.reader.setIndex(t.localHeaderOffset),this.checkSignature(s.LOCAL_FILE_HEADER),t.readLocalPart(this.reader),t.handleUTF8(),t.processAttributes()},readCentralDir:function(){var e;for(this.reader.setIndex(this.centralDirOffset);this.reader.readAndCheckSignature(s.CENTRAL_FILE_HEADER);)(e=new a({zip64:this.zip64},this.loadOptions)).readCentralPart(this.reader),this.files.push(e);if(this.centralDirRecords!==this.files.length&&0!==this.centralDirRecords&&0===this.files.length)throw new Error("Corrupted zip or bug: expected "+this.centralDirRecords+" records in central dir, got "+this.files.length)},readEndOfCentral:function(){var e=this.reader.lastIndexOfSignature(s.CENTRAL_DIRECTORY_END);if(e<0)throw!this.isSignature(0,s.LOCAL_FILE_HEADER)?new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html"):new Error("Corrupted zip: can't find end of central directory");this.reader.setIndex(e);var t=e;if(this.checkSignature(s.CENTRAL_DIRECTORY_END),this.readBlockEndOfCentral(),this.diskNumber===i.MAX_VALUE_16BITS||this.diskWithCentralDirStart===i.MAX_VALUE_16BITS||this.centralDirRecordsOnThisDisk===i.MAX_VALUE_16BITS||this.centralDirRecords===i.MAX_VALUE_16BITS||this.centralDirSize===i.MAX_VALUE_32BITS||this.centralDirOffset===i.MAX_VALUE_32BITS){if(this.zip64=!0,(e=this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR))<0)throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");if(this.reader.setIndex(e),this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR),this.readBlockZip64EndOfCentralLocator(),!this.isSignature(this.relativeOffsetEndOfZip64CentralDir,s.ZIP64_CENTRAL_DIRECTORY_END)&&(this.relativeOffsetEndOfZip64CentralDir=this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_END),this.relativeOffsetEndOfZip64CentralDir<0))throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir),this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_END),this.readBlockZip64EndOfCentral()}var r=this.centralDirOffset+this.centralDirSize;this.zip64&&(r+=20,r+=12+this.zip64EndOfCentralSize);var n=t-r;if(0<n)this.isSignature(t,s.CENTRAL_FILE_HEADER)||(this.reader.zero=n);else if(n<0)throw new Error("Corrupted zip: missing "+Math.abs(n)+" bytes.")},prepareReader:function(e){this.reader=n(e)},load:function(e){this.prepareReader(e),this.readEndOfCentral(),this.readCentralDir(),this.readLocalFiles()}},t.exports=h},{"./reader/readerFor":22,"./signature":23,"./support":30,"./utils":32,"./zipEntry":34}],34:[function(e,t,r){"use strict";var n=e("./reader/readerFor"),s=e("./utils"),i=e("./compressedObject"),a=e("./crc32"),o=e("./utf8"),h=e("./compressions"),u=e("./support");function l(e,t){this.options=e,this.loadOptions=t}l.prototype={isEncrypted:function(){return 1==(1&this.bitFlag)},useUTF8:function(){return 2048==(2048&this.bitFlag)},readLocalPart:function(e){var t,r;if(e.skip(22),this.fileNameLength=e.readInt(2),r=e.readInt(2),this.fileName=e.readData(this.fileNameLength),e.skip(r),-1===this.compressedSize||-1===this.uncompressedSize)throw new Error("Bug or corrupted zip : didn't get enough information from the central directory (compressedSize === -1 || uncompressedSize === -1)");if(null===(t=function(e){for(var t in h)if(Object.prototype.hasOwnProperty.call(h,t)&&h[t].magic===e)return h[t];return null}(this.compressionMethod)))throw new Error("Corrupted zip : compression "+s.pretty(this.compressionMethod)+" unknown (inner file : "+s.transformTo("string",this.fileName)+")");this.decompressed=new i(this.compressedSize,this.uncompressedSize,this.crc32,t,e.readData(this.compressedSize))},readCentralPart:function(e){this.versionMadeBy=e.readInt(2),e.skip(2),this.bitFlag=e.readInt(2),this.compressionMethod=e.readString(2),this.date=e.readDate(),this.crc32=e.readInt(4),this.compressedSize=e.readInt(4),this.uncompressedSize=e.readInt(4);var t=e.readInt(2);if(this.extraFieldsLength=e.readInt(2),this.fileCommentLength=e.readInt(2),this.diskNumberStart=e.readInt(2),this.internalFileAttributes=e.readInt(2),this.externalFileAttributes=e.readInt(4),this.localHeaderOffset=e.readInt(4),this.isEncrypted())throw new Error("Encrypted zip are not supported");e.skip(t),this.readExtraFields(e),this.parseZIP64ExtraField(e),this.fileComment=e.readData(this.fileCommentLength)},processAttributes:function(){this.unixPermissions=null,this.dosPermissions=null;var e=this.versionMadeBy>>8;this.dir=!!(16&this.externalFileAttributes),0==e&&(this.dosPermissions=63&this.externalFileAttributes),3==e&&(this.unixPermissions=this.externalFileAttributes>>16&65535),this.dir||"/"!==this.fileNameStr.slice(-1)||(this.dir=!0)},parseZIP64ExtraField:function(){if(this.extraFields[1]){var e=n(this.extraFields[1].value);this.uncompressedSize===s.MAX_VALUE_32BITS&&(this.uncompressedSize=e.readInt(8)),this.compressedSize===s.MAX_VALUE_32BITS&&(this.compressedSize=e.readInt(8)),this.localHeaderOffset===s.MAX_VALUE_32BITS&&(this.localHeaderOffset=e.readInt(8)),this.diskNumberStart===s.MAX_VALUE_32BITS&&(this.diskNumberStart=e.readInt(4))}},readExtraFields:function(e){var t,r,n,i=e.index+this.extraFieldsLength;for(this.extraFields||(this.extraFields={});e.index+4<i;)t=e.readInt(2),r=e.readInt(2),n=e.readData(r),this.extraFields[t]={id:t,length:r,value:n};e.setIndex(i)},handleUTF8:function(){var e=u.uint8array?"uint8array":"array";if(this.useUTF8())this.fileNameStr=o.utf8decode(this.fileName),this.fileCommentStr=o.utf8decode(this.fileComment);else{var t=this.findExtraFieldUnicodePath();if(null!==t)this.fileNameStr=t;else{var r=s.transformTo(e,this.fileName);this.fileNameStr=this.loadOptions.decodeFileName(r)}var n=this.findExtraFieldUnicodeComment();if(null!==n)this.fileCommentStr=n;else{var i=s.transformTo(e,this.fileComment);this.fileCommentStr=this.loadOptions.decodeFileName(i)}}},findExtraFieldUnicodePath:function(){var e=this.extraFields[28789];if(e){var t=n(e.value);return 1!==t.readInt(1)?null:a(this.fileName)!==t.readInt(4)?null:o.utf8decode(t.readData(e.length-5))}return null},findExtraFieldUnicodeComment:function(){var e=this.extraFields[25461];if(e){var t=n(e.value);return 1!==t.readInt(1)?null:a(this.fileComment)!==t.readInt(4)?null:o.utf8decode(t.readData(e.length-5))}return null}},t.exports=l},{"./compressedObject":2,"./compressions":3,"./crc32":4,"./reader/readerFor":22,"./support":30,"./utf8":31,"./utils":32}],35:[function(e,t,r){"use strict";function n(e,t,r){this.name=e,this.dir=r.dir,this.date=r.date,this.comment=r.comment,this.unixPermissions=r.unixPermissions,this.dosPermissions=r.dosPermissions,this._data=t,this._dataBinary=r.binary,this.options={compression:r.compression,compressionOptions:r.compressionOptions}}var s=e("./stream/StreamHelper"),i=e("./stream/DataWorker"),a=e("./utf8"),o=e("./compressedObject"),h=e("./stream/GenericWorker");n.prototype={internalStream:function(e){var t=null,r="string";try{if(!e)throw new Error("No output type specified.");var n="string"===(r=e.toLowerCase())||"text"===r;"binarystring"!==r&&"text"!==r||(r="string"),t=this._decompressWorker();var i=!this._dataBinary;i&&!n&&(t=t.pipe(new a.Utf8EncodeWorker)),!i&&n&&(t=t.pipe(new a.Utf8DecodeWorker))}catch(e){(t=new h("error")).error(e)}return new s(t,r,"")},async:function(e,t){return this.internalStream(e).accumulate(t)},nodeStream:function(e,t){return this.internalStream(e||"nodebuffer").toNodejsStream(t)},_compressWorker:function(e,t){if(this._data instanceof o&&this._data.compression.magic===e.magic)return this._data.getCompressedWorker();var r=this._decompressWorker();return this._dataBinary||(r=r.pipe(new a.Utf8EncodeWorker)),o.createWorkerFrom(r,e,t)},_decompressWorker:function(){return this._data instanceof o?this._data.getContentWorker():this._data instanceof h?this._data:new i(this._data)}};for(var u=["asText","asBinary","asNodeBuffer","asUint8Array","asArrayBuffer"],l=function(){throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.")},f=0;f<u.length;f++)n.prototype[u[f]]=l;t.exports=n},{"./compressedObject":2,"./stream/DataWorker":27,"./stream/GenericWorker":28,"./stream/StreamHelper":29,"./utf8":31}],36:[function(e,l,t){(function(t){"use strict";var r,n,e=t.MutationObserver||t.WebKitMutationObserver;if(e){var i=0,s=new e(u),a=t.document.createTextNode("");s.observe(a,{characterData:!0}),r=function(){a.data=i=++i%2}}else if(t.setImmediate||void 0===t.MessageChannel)r="document"in t&&"onreadystatechange"in t.document.createElement("script")?function(){var e=t.document.createElement("script");e.onreadystatechange=function(){u(),e.onreadystatechange=null,e.parentNode.removeChild(e),e=null},t.document.documentElement.appendChild(e)}:function(){setTimeout(u,0)};else{var o=new t.MessageChannel;o.port1.onmessage=u,r=function(){o.port2.postMessage(0)}}var h=[];function u(){var e,t;n=!0;for(var r=h.length;r;){for(t=h,h=[],e=-1;++e<r;)t[e]();r=h.length}n=!1}l.exports=function(e){1!==h.push(e)||n||r()}}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{}],37:[function(e,t,r){"use strict";var i=e("immediate");function u(){}var l={},s=["REJECTED"],a=["FULFILLED"],n=["PENDING"];function o(e){if("function"!=typeof e)throw new TypeError("resolver must be a function");this.state=n,this.queue=[],this.outcome=void 0,e!==u&&d(this,e)}function h(e,t,r){this.promise=e,"function"==typeof t&&(this.onFulfilled=t,this.callFulfilled=this.otherCallFulfilled),"function"==typeof r&&(this.onRejected=r,this.callRejected=this.otherCallRejected)}function f(t,r,n){i(function(){var e;try{e=r(n)}catch(e){return l.reject(t,e)}e===t?l.reject(t,new TypeError("Cannot resolve promise with itself")):l.resolve(t,e)})}function c(e){var t=e&&e.then;if(e&&("object"==typeof e||"function"==typeof e)&&"function"==typeof t)return function(){t.apply(e,arguments)}}function d(t,e){var r=!1;function n(e){r||(r=!0,l.reject(t,e))}function i(e){r||(r=!0,l.resolve(t,e))}var s=p(function(){e(i,n)});"error"===s.status&&n(s.value)}function p(e,t){var r={};try{r.value=e(t),r.status="success"}catch(e){r.status="error",r.value=e}return r}(t.exports=o).prototype.finally=function(t){if("function"!=typeof t)return this;var r=this.constructor;return this.then(function(e){return r.resolve(t()).then(function(){return e})},function(e){return r.resolve(t()).then(function(){throw e})})},o.prototype.catch=function(e){return this.then(null,e)},o.prototype.then=function(e,t){if("function"!=typeof e&&this.state===a||"function"!=typeof t&&this.state===s)return this;var r=new this.constructor(u);this.state!==n?f(r,this.state===a?e:t,this.outcome):this.queue.push(new h(r,e,t));return r},h.prototype.callFulfilled=function(e){l.resolve(this.promise,e)},h.prototype.otherCallFulfilled=function(e){f(this.promise,this.onFulfilled,e)},h.prototype.callRejected=function(e){l.reject(this.promise,e)},h.prototype.otherCallRejected=function(e){f(this.promise,this.onRejected,e)},l.resolve=function(e,t){var r=p(c,t);if("error"===r.status)return l.reject(e,r.value);var n=r.value;if(n)d(e,n);else{e.state=a,e.outcome=t;for(var i=-1,s=e.queue.length;++i<s;)e.queue[i].callFulfilled(t)}return e},l.reject=function(e,t){e.state=s,e.outcome=t;for(var r=-1,n=e.queue.length;++r<n;)e.queue[r].callRejected(t);return e},o.resolve=function(e){if(e instanceof this)return e;return l.resolve(new this(u),e)},o.reject=function(e){var t=new this(u);return l.reject(t,e)},o.all=function(e){var r=this;if("[object Array]"!==Object.prototype.toString.call(e))return this.reject(new TypeError("must be an array"));var n=e.length,i=!1;if(!n)return this.resolve([]);var s=new Array(n),a=0,t=-1,o=new this(u);for(;++t<n;)h(e[t],t);return o;function h(e,t){r.resolve(e).then(function(e){s[t]=e,++a!==n||i||(i=!0,l.resolve(o,s))},function(e){i||(i=!0,l.reject(o,e))})}},o.race=function(e){var t=this;if("[object Array]"!==Object.prototype.toString.call(e))return this.reject(new TypeError("must be an array"));var r=e.length,n=!1;if(!r)return this.resolve([]);var i=-1,s=new this(u);for(;++i<r;)a=e[i],t.resolve(a).then(function(e){n||(n=!0,l.resolve(s,e))},function(e){n||(n=!0,l.reject(s,e))});var a;return s}},{immediate:36}],38:[function(e,t,r){"use strict";var n={};(0,e("./lib/utils/common").assign)(n,e("./lib/deflate"),e("./lib/inflate"),e("./lib/zlib/constants")),t.exports=n},{"./lib/deflate":39,"./lib/inflate":40,"./lib/utils/common":41,"./lib/zlib/constants":44}],39:[function(e,t,r){"use strict";var a=e("./zlib/deflate"),o=e("./utils/common"),h=e("./utils/strings"),i=e("./zlib/messages"),s=e("./zlib/zstream"),u=Object.prototype.toString,l=0,f=-1,c=0,d=8;function p(e){if(!(this instanceof p))return new p(e);this.options=o.assign({level:f,method:d,chunkSize:16384,windowBits:15,memLevel:8,strategy:c,to:""},e||{});var t=this.options;t.raw&&0<t.windowBits?t.windowBits=-t.windowBits:t.gzip&&0<t.windowBits&&t.windowBits<16&&(t.windowBits+=16),this.err=0,this.msg="",this.ended=!1,this.chunks=[],this.strm=new s,this.strm.avail_out=0;var r=a.deflateInit2(this.strm,t.level,t.method,t.windowBits,t.memLevel,t.strategy);if(r!==l)throw new Error(i[r]);if(t.header&&a.deflateSetHeader(this.strm,t.header),t.dictionary){var n;if(n="string"==typeof t.dictionary?h.string2buf(t.dictionary):"[object ArrayBuffer]"===u.call(t.dictionary)?new Uint8Array(t.dictionary):t.dictionary,(r=a.deflateSetDictionary(this.strm,n))!==l)throw new Error(i[r]);this._dict_set=!0}}function n(e,t){var r=new p(t);if(r.push(e,!0),r.err)throw r.msg||i[r.err];return r.result}p.prototype.push=function(e,t){var r,n,i=this.strm,s=this.options.chunkSize;if(this.ended)return!1;n=t===~~t?t:!0===t?4:0,"string"==typeof e?i.input=h.string2buf(e):"[object ArrayBuffer]"===u.call(e)?i.input=new Uint8Array(e):i.input=e,i.next_in=0,i.avail_in=i.input.length;do{if(0===i.avail_out&&(i.output=new o.Buf8(s),i.next_out=0,i.avail_out=s),1!==(r=a.deflate(i,n))&&r!==l)return this.onEnd(r),!(this.ended=!0);0!==i.avail_out&&(0!==i.avail_in||4!==n&&2!==n)||("string"===this.options.to?this.onData(h.buf2binstring(o.shrinkBuf(i.output,i.next_out))):this.onData(o.shrinkBuf(i.output,i.next_out)))}while((0<i.avail_in||0===i.avail_out)&&1!==r);return 4===n?(r=a.deflateEnd(this.strm),this.onEnd(r),this.ended=!0,r===l):2!==n||(this.onEnd(l),!(i.avail_out=0))},p.prototype.onData=function(e){this.chunks.push(e)},p.prototype.onEnd=function(e){e===l&&("string"===this.options.to?this.result=this.chunks.join(""):this.result=o.flattenChunks(this.chunks)),this.chunks=[],this.err=e,this.msg=this.strm.msg},r.Deflate=p,r.deflate=n,r.deflateRaw=function(e,t){return(t=t||{}).raw=!0,n(e,t)},r.gzip=function(e,t){return(t=t||{}).gzip=!0,n(e,t)}},{"./utils/common":41,"./utils/strings":42,"./zlib/deflate":46,"./zlib/messages":51,"./zlib/zstream":53}],40:[function(e,t,r){"use strict";var c=e("./zlib/inflate"),d=e("./utils/common"),p=e("./utils/strings"),m=e("./zlib/constants"),n=e("./zlib/messages"),i=e("./zlib/zstream"),s=e("./zlib/gzheader"),_=Object.prototype.toString;function a(e){if(!(this instanceof a))return new a(e);this.options=d.assign({chunkSize:16384,windowBits:0,to:""},e||{});var t=this.options;t.raw&&0<=t.windowBits&&t.windowBits<16&&(t.windowBits=-t.windowBits,0===t.windowBits&&(t.windowBits=-15)),!(0<=t.windowBits&&t.windowBits<16)||e&&e.windowBits||(t.windowBits+=32),15<t.windowBits&&t.windowBits<48&&0==(15&t.windowBits)&&(t.windowBits|=15),this.err=0,this.msg="",this.ended=!1,this.chunks=[],this.strm=new i,this.strm.avail_out=0;var r=c.inflateInit2(this.strm,t.windowBits);if(r!==m.Z_OK)throw new Error(n[r]);this.header=new s,c.inflateGetHeader(this.strm,this.header)}function o(e,t){var r=new a(t);if(r.push(e,!0),r.err)throw r.msg||n[r.err];return r.result}a.prototype.push=function(e,t){var r,n,i,s,a,o,h=this.strm,u=this.options.chunkSize,l=this.options.dictionary,f=!1;if(this.ended)return!1;n=t===~~t?t:!0===t?m.Z_FINISH:m.Z_NO_FLUSH,"string"==typeof e?h.input=p.binstring2buf(e):"[object ArrayBuffer]"===_.call(e)?h.input=new Uint8Array(e):h.input=e,h.next_in=0,h.avail_in=h.input.length;do{if(0===h.avail_out&&(h.output=new d.Buf8(u),h.next_out=0,h.avail_out=u),(r=c.inflate(h,m.Z_NO_FLUSH))===m.Z_NEED_DICT&&l&&(o="string"==typeof l?p.string2buf(l):"[object ArrayBuffer]"===_.call(l)?new Uint8Array(l):l,r=c.inflateSetDictionary(this.strm,o)),r===m.Z_BUF_ERROR&&!0===f&&(r=m.Z_OK,f=!1),r!==m.Z_STREAM_END&&r!==m.Z_OK)return this.onEnd(r),!(this.ended=!0);h.next_out&&(0!==h.avail_out&&r!==m.Z_STREAM_END&&(0!==h.avail_in||n!==m.Z_FINISH&&n!==m.Z_SYNC_FLUSH)||("string"===this.options.to?(i=p.utf8border(h.output,h.next_out),s=h.next_out-i,a=p.buf2string(h.output,i),h.next_out=s,h.avail_out=u-s,s&&d.arraySet(h.output,h.output,i,s,0),this.onData(a)):this.onData(d.shrinkBuf(h.output,h.next_out)))),0===h.avail_in&&0===h.avail_out&&(f=!0)}while((0<h.avail_in||0===h.avail_out)&&r!==m.Z_STREAM_END);return r===m.Z_STREAM_END&&(n=m.Z_FINISH),n===m.Z_FINISH?(r=c.inflateEnd(this.strm),this.onEnd(r),this.ended=!0,r===m.Z_OK):n!==m.Z_SYNC_FLUSH||(this.onEnd(m.Z_OK),!(h.avail_out=0))},a.prototype.onData=function(e){this.chunks.push(e)},a.prototype.onEnd=function(e){e===m.Z_OK&&("string"===this.options.to?this.result=this.chunks.join(""):this.result=d.flattenChunks(this.chunks)),this.chunks=[],this.err=e,this.msg=this.strm.msg},r.Inflate=a,r.inflate=o,r.inflateRaw=function(e,t){return(t=t||{}).raw=!0,o(e,t)},r.ungzip=o},{"./utils/common":41,"./utils/strings":42,"./zlib/constants":44,"./zlib/gzheader":47,"./zlib/inflate":49,"./zlib/messages":51,"./zlib/zstream":53}],41:[function(e,t,r){"use strict";var n="undefined"!=typeof Uint8Array&&"undefined"!=typeof Uint16Array&&"undefined"!=typeof Int32Array;r.assign=function(e){for(var t=Array.prototype.slice.call(arguments,1);t.length;){var r=t.shift();if(r){if("object"!=typeof r)throw new TypeError(r+"must be non-object");for(var n in r)r.hasOwnProperty(n)&&(e[n]=r[n])}}return e},r.shrinkBuf=function(e,t){return e.length===t?e:e.subarray?e.subarray(0,t):(e.length=t,e)};var i={arraySet:function(e,t,r,n,i){if(t.subarray&&e.subarray)e.set(t.subarray(r,r+n),i);else for(var s=0;s<n;s++)e[i+s]=t[r+s]},flattenChunks:function(e){var t,r,n,i,s,a;for(t=n=0,r=e.length;t<r;t++)n+=e[t].length;for(a=new Uint8Array(n),t=i=0,r=e.length;t<r;t++)s=e[t],a.set(s,i),i+=s.length;return a}},s={arraySet:function(e,t,r,n,i){for(var s=0;s<n;s++)e[i+s]=t[r+s]},flattenChunks:function(e){return[].concat.apply([],e)}};r.setTyped=function(e){e?(r.Buf8=Uint8Array,r.Buf16=Uint16Array,r.Buf32=Int32Array,r.assign(r,i)):(r.Buf8=Array,r.Buf16=Array,r.Buf32=Array,r.assign(r,s))},r.setTyped(n)},{}],42:[function(e,t,r){"use strict";var h=e("./common"),i=!0,s=!0;try{String.fromCharCode.apply(null,[0])}catch(e){i=!1}try{String.fromCharCode.apply(null,new Uint8Array(1))}catch(e){s=!1}for(var u=new h.Buf8(256),n=0;n<256;n++)u[n]=252<=n?6:248<=n?5:240<=n?4:224<=n?3:192<=n?2:1;function l(e,t){if(t<65537&&(e.subarray&&s||!e.subarray&&i))return String.fromCharCode.apply(null,h.shrinkBuf(e,t));for(var r="",n=0;n<t;n++)r+=String.fromCharCode(e[n]);return r}u[254]=u[254]=1,r.string2buf=function(e){var t,r,n,i,s,a=e.length,o=0;for(i=0;i<a;i++)55296==(64512&(r=e.charCodeAt(i)))&&i+1<a&&56320==(64512&(n=e.charCodeAt(i+1)))&&(r=65536+(r-55296<<10)+(n-56320),i++),o+=r<128?1:r<2048?2:r<65536?3:4;for(t=new h.Buf8(o),i=s=0;s<o;i++)55296==(64512&(r=e.charCodeAt(i)))&&i+1<a&&56320==(64512&(n=e.charCodeAt(i+1)))&&(r=65536+(r-55296<<10)+(n-56320),i++),r<128?t[s++]=r:(r<2048?t[s++]=192|r>>>6:(r<65536?t[s++]=224|r>>>12:(t[s++]=240|r>>>18,t[s++]=128|r>>>12&63),t[s++]=128|r>>>6&63),t[s++]=128|63&r);return t},r.buf2binstring=function(e){return l(e,e.length)},r.binstring2buf=function(e){for(var t=new h.Buf8(e.length),r=0,n=t.length;r<n;r++)t[r]=e.charCodeAt(r);return t},r.buf2string=function(e,t){var r,n,i,s,a=t||e.length,o=new Array(2*a);for(r=n=0;r<a;)if((i=e[r++])<128)o[n++]=i;else if(4<(s=u[i]))o[n++]=65533,r+=s-1;else{for(i&=2===s?31:3===s?15:7;1<s&&r<a;)i=i<<6|63&e[r++],s--;1<s?o[n++]=65533:i<65536?o[n++]=i:(i-=65536,o[n++]=55296|i>>10&1023,o[n++]=56320|1023&i)}return l(o,n)},r.utf8border=function(e,t){var r;for((t=t||e.length)>e.length&&(t=e.length),r=t-1;0<=r&&128==(192&e[r]);)r--;return r<0?t:0===r?t:r+u[e[r]]>t?r:t}},{"./common":41}],43:[function(e,t,r){"use strict";t.exports=function(e,t,r,n){for(var i=65535&e|0,s=e>>>16&65535|0,a=0;0!==r;){for(r-=a=2e3<r?2e3:r;s=s+(i=i+t[n++]|0)|0,--a;);i%=65521,s%=65521}return i|s<<16|0}},{}],44:[function(e,t,r){"use strict";t.exports={Z_NO_FLUSH:0,Z_PARTIAL_FLUSH:1,Z_SYNC_FLUSH:2,Z_FULL_FLUSH:3,Z_FINISH:4,Z_BLOCK:5,Z_TREES:6,Z_OK:0,Z_STREAM_END:1,Z_NEED_DICT:2,Z_ERRNO:-1,Z_STREAM_ERROR:-2,Z_DATA_ERROR:-3,Z_BUF_ERROR:-5,Z_NO_COMPRESSION:0,Z_BEST_SPEED:1,Z_BEST_COMPRESSION:9,Z_DEFAULT_COMPRESSION:-1,Z_FILTERED:1,Z_HUFFMAN_ONLY:2,Z_RLE:3,Z_FIXED:4,Z_DEFAULT_STRATEGY:0,Z_BINARY:0,Z_TEXT:1,Z_UNKNOWN:2,Z_DEFLATED:8}},{}],45:[function(e,t,r){"use strict";var o=function(){for(var e,t=[],r=0;r<256;r++){e=r;for(var n=0;n<8;n++)e=1&e?3988292384^e>>>1:e>>>1;t[r]=e}return t}();t.exports=function(e,t,r,n){var i=o,s=n+r;e^=-1;for(var a=n;a<s;a++)e=e>>>8^i[255&(e^t[a])];return-1^e}},{}],46:[function(e,t,r){"use strict";var h,c=e("../utils/common"),u=e("./trees"),d=e("./adler32"),p=e("./crc32"),n=e("./messages"),l=0,f=4,m=0,_=-2,g=-1,b=4,i=2,v=8,y=9,s=286,a=30,o=19,w=2*s+1,k=15,x=3,S=258,z=S+x+1,C=42,E=113,A=1,I=2,O=3,B=4;function R(e,t){return e.msg=n[t],t}function T(e){return(e<<1)-(4<e?9:0)}function D(e){for(var t=e.length;0<=--t;)e[t]=0}function F(e){var t=e.state,r=t.pending;r>e.avail_out&&(r=e.avail_out),0!==r&&(c.arraySet(e.output,t.pending_buf,t.pending_out,r,e.next_out),e.next_out+=r,t.pending_out+=r,e.total_out+=r,e.avail_out-=r,t.pending-=r,0===t.pending&&(t.pending_out=0))}function N(e,t){u._tr_flush_block(e,0<=e.block_start?e.block_start:-1,e.strstart-e.block_start,t),e.block_start=e.strstart,F(e.strm)}function U(e,t){e.pending_buf[e.pending++]=t}function P(e,t){e.pending_buf[e.pending++]=t>>>8&255,e.pending_buf[e.pending++]=255&t}function L(e,t){var r,n,i=e.max_chain_length,s=e.strstart,a=e.prev_length,o=e.nice_match,h=e.strstart>e.w_size-z?e.strstart-(e.w_size-z):0,u=e.window,l=e.w_mask,f=e.prev,c=e.strstart+S,d=u[s+a-1],p=u[s+a];e.prev_length>=e.good_match&&(i>>=2),o>e.lookahead&&(o=e.lookahead);do{if(u[(r=t)+a]===p&&u[r+a-1]===d&&u[r]===u[s]&&u[++r]===u[s+1]){s+=2,r++;do{}while(u[++s]===u[++r]&&u[++s]===u[++r]&&u[++s]===u[++r]&&u[++s]===u[++r]&&u[++s]===u[++r]&&u[++s]===u[++r]&&u[++s]===u[++r]&&u[++s]===u[++r]&&s<c);if(n=S-(c-s),s=c-S,a<n){if(e.match_start=t,o<=(a=n))break;d=u[s+a-1],p=u[s+a]}}}while((t=f[t&l])>h&&0!=--i);return a<=e.lookahead?a:e.lookahead}function j(e){var t,r,n,i,s,a,o,h,u,l,f=e.w_size;do{if(i=e.window_size-e.lookahead-e.strstart,e.strstart>=f+(f-z)){for(c.arraySet(e.window,e.window,f,f,0),e.match_start-=f,e.strstart-=f,e.block_start-=f,t=r=e.hash_size;n=e.head[--t],e.head[t]=f<=n?n-f:0,--r;);for(t=r=f;n=e.prev[--t],e.prev[t]=f<=n?n-f:0,--r;);i+=f}if(0===e.strm.avail_in)break;if(a=e.strm,o=e.window,h=e.strstart+e.lookahead,u=i,l=void 0,l=a.avail_in,u<l&&(l=u),r=0===l?0:(a.avail_in-=l,c.arraySet(o,a.input,a.next_in,l,h),1===a.state.wrap?a.adler=d(a.adler,o,l,h):2===a.state.wrap&&(a.adler=p(a.adler,o,l,h)),a.next_in+=l,a.total_in+=l,l),e.lookahead+=r,e.lookahead+e.insert>=x)for(s=e.strstart-e.insert,e.ins_h=e.window[s],e.ins_h=(e.ins_h<<e.hash_shift^e.window[s+1])&e.hash_mask;e.insert&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[s+x-1])&e.hash_mask,e.prev[s&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=s,s++,e.insert--,!(e.lookahead+e.insert<x)););}while(e.lookahead<z&&0!==e.strm.avail_in)}function Z(e,t){for(var r,n;;){if(e.lookahead<z){if(j(e),e.lookahead<z&&t===l)return A;if(0===e.lookahead)break}if(r=0,e.lookahead>=x&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+x-1])&e.hash_mask,r=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart),0!==r&&e.strstart-r<=e.w_size-z&&(e.match_length=L(e,r)),e.match_length>=x)if(n=u._tr_tally(e,e.strstart-e.match_start,e.match_length-x),e.lookahead-=e.match_length,e.match_length<=e.max_lazy_match&&e.lookahead>=x){for(e.match_length--;e.strstart++,e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+x-1])&e.hash_mask,r=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart,0!=--e.match_length;);e.strstart++}else e.strstart+=e.match_length,e.match_length=0,e.ins_h=e.window[e.strstart],e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+1])&e.hash_mask;else n=u._tr_tally(e,0,e.window[e.strstart]),e.lookahead--,e.strstart++;if(n&&(N(e,!1),0===e.strm.avail_out))return A}return e.insert=e.strstart<x-1?e.strstart:x-1,t===f?(N(e,!0),0===e.strm.avail_out?O:B):e.last_lit&&(N(e,!1),0===e.strm.avail_out)?A:I}function W(e,t){for(var r,n,i;;){if(e.lookahead<z){if(j(e),e.lookahead<z&&t===l)return A;if(0===e.lookahead)break}if(r=0,e.lookahead>=x&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+x-1])&e.hash_mask,r=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart),e.prev_length=e.match_length,e.prev_match=e.match_start,e.match_length=x-1,0!==r&&e.prev_length<e.max_lazy_match&&e.strstart-r<=e.w_size-z&&(e.match_length=L(e,r),e.match_length<=5&&(1===e.strategy||e.match_length===x&&4096<e.strstart-e.match_start)&&(e.match_length=x-1)),e.prev_length>=x&&e.match_length<=e.prev_length){for(i=e.strstart+e.lookahead-x,n=u._tr_tally(e,e.strstart-1-e.prev_match,e.prev_length-x),e.lookahead-=e.prev_length-1,e.prev_length-=2;++e.strstart<=i&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+x-1])&e.hash_mask,r=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart),0!=--e.prev_length;);if(e.match_available=0,e.match_length=x-1,e.strstart++,n&&(N(e,!1),0===e.strm.avail_out))return A}else if(e.match_available){if((n=u._tr_tally(e,0,e.window[e.strstart-1]))&&N(e,!1),e.strstart++,e.lookahead--,0===e.strm.avail_out)return A}else e.match_available=1,e.strstart++,e.lookahead--}return e.match_available&&(n=u._tr_tally(e,0,e.window[e.strstart-1]),e.match_available=0),e.insert=e.strstart<x-1?e.strstart:x-1,t===f?(N(e,!0),0===e.strm.avail_out?O:B):e.last_lit&&(N(e,!1),0===e.strm.avail_out)?A:I}function M(e,t,r,n,i){this.good_length=e,this.max_lazy=t,this.nice_length=r,this.max_chain=n,this.func=i}function H(){this.strm=null,this.status=0,this.pending_buf=null,this.pending_buf_size=0,this.pending_out=0,this.pending=0,this.wrap=0,this.gzhead=null,this.gzindex=0,this.method=v,this.last_flush=-1,this.w_size=0,this.w_bits=0,this.w_mask=0,this.window=null,this.window_size=0,this.prev=null,this.head=null,this.ins_h=0,this.hash_size=0,this.hash_bits=0,this.hash_mask=0,this.hash_shift=0,this.block_start=0,this.match_length=0,this.prev_match=0,this.match_available=0,this.strstart=0,this.match_start=0,this.lookahead=0,this.prev_length=0,this.max_chain_length=0,this.max_lazy_match=0,this.level=0,this.strategy=0,this.good_match=0,this.nice_match=0,this.dyn_ltree=new c.Buf16(2*w),this.dyn_dtree=new c.Buf16(2*(2*a+1)),this.bl_tree=new c.Buf16(2*(2*o+1)),D(this.dyn_ltree),D(this.dyn_dtree),D(this.bl_tree),this.l_desc=null,this.d_desc=null,this.bl_desc=null,this.bl_count=new c.Buf16(k+1),this.heap=new c.Buf16(2*s+1),D(this.heap),this.heap_len=0,this.heap_max=0,this.depth=new c.Buf16(2*s+1),D(this.depth),this.l_buf=0,this.lit_bufsize=0,this.last_lit=0,this.d_buf=0,this.opt_len=0,this.static_len=0,this.matches=0,this.insert=0,this.bi_buf=0,this.bi_valid=0}function G(e){var t;return e&&e.state?(e.total_in=e.total_out=0,e.data_type=i,(t=e.state).pending=0,t.pending_out=0,t.wrap<0&&(t.wrap=-t.wrap),t.status=t.wrap?C:E,e.adler=2===t.wrap?0:1,t.last_flush=l,u._tr_init(t),m):R(e,_)}function K(e){var t=G(e);return t===m&&function(e){e.window_size=2*e.w_size,D(e.head),e.max_lazy_match=h[e.level].max_lazy,e.good_match=h[e.level].good_length,e.nice_match=h[e.level].nice_length,e.max_chain_length=h[e.level].max_chain,e.strstart=0,e.block_start=0,e.lookahead=0,e.insert=0,e.match_length=e.prev_length=x-1,e.match_available=0,e.ins_h=0}(e.state),t}function Y(e,t,r,n,i,s){if(!e)return _;var a=1;if(t===g&&(t=6),n<0?(a=0,n=-n):15<n&&(a=2,n-=16),i<1||y<i||r!==v||n<8||15<n||t<0||9<t||s<0||b<s)return R(e,_);8===n&&(n=9);var o=new H;return(e.state=o).strm=e,o.wrap=a,o.gzhead=null,o.w_bits=n,o.w_size=1<<o.w_bits,o.w_mask=o.w_size-1,o.hash_bits=i+7,o.hash_size=1<<o.hash_bits,o.hash_mask=o.hash_size-1,o.hash_shift=~~((o.hash_bits+x-1)/x),o.window=new c.Buf8(2*o.w_size),o.head=new c.Buf16(o.hash_size),o.prev=new c.Buf16(o.w_size),o.lit_bufsize=1<<i+6,o.pending_buf_size=4*o.lit_bufsize,o.pending_buf=new c.Buf8(o.pending_buf_size),o.d_buf=1*o.lit_bufsize,o.l_buf=3*o.lit_bufsize,o.level=t,o.strategy=s,o.method=r,K(e)}h=[new M(0,0,0,0,function(e,t){var r=65535;for(r>e.pending_buf_size-5&&(r=e.pending_buf_size-5);;){if(e.lookahead<=1){if(j(e),0===e.lookahead&&t===l)return A;if(0===e.lookahead)break}e.strstart+=e.lookahead,e.lookahead=0;var n=e.block_start+r;if((0===e.strstart||e.strstart>=n)&&(e.lookahead=e.strstart-n,e.strstart=n,N(e,!1),0===e.strm.avail_out))return A;if(e.strstart-e.block_start>=e.w_size-z&&(N(e,!1),0===e.strm.avail_out))return A}return e.insert=0,t===f?(N(e,!0),0===e.strm.avail_out?O:B):(e.strstart>e.block_start&&(N(e,!1),e.strm.avail_out),A)}),new M(4,4,8,4,Z),new M(4,5,16,8,Z),new M(4,6,32,32,Z),new M(4,4,16,16,W),new M(8,16,32,32,W),new M(8,16,128,128,W),new M(8,32,128,256,W),new M(32,128,258,1024,W),new M(32,258,258,4096,W)],r.deflateInit=function(e,t){return Y(e,t,v,15,8,0)},r.deflateInit2=Y,r.deflateReset=K,r.deflateResetKeep=G,r.deflateSetHeader=function(e,t){return e&&e.state?2!==e.state.wrap?_:(e.state.gzhead=t,m):_},r.deflate=function(e,t){var r,n,i,s;if(!e||!e.state||5<t||t<0)return e?R(e,_):_;if(n=e.state,!e.output||!e.input&&0!==e.avail_in||666===n.status&&t!==f)return R(e,0===e.avail_out?-5:_);if(n.strm=e,r=n.last_flush,n.last_flush=t,n.status===C)if(2===n.wrap)e.adler=0,U(n,31),U(n,139),U(n,8),n.gzhead?(U(n,(n.gzhead.text?1:0)+(n.gzhead.hcrc?2:0)+(n.gzhead.extra?4:0)+(n.gzhead.name?8:0)+(n.gzhead.comment?16:0)),U(n,255&n.gzhead.time),U(n,n.gzhead.time>>8&255),U(n,n.gzhead.time>>16&255),U(n,n.gzhead.time>>24&255),U(n,9===n.level?2:2<=n.strategy||n.level<2?4:0),U(n,255&n.gzhead.os),n.gzhead.extra&&n.gzhead.extra.length&&(U(n,255&n.gzhead.extra.length),U(n,n.gzhead.extra.length>>8&255)),n.gzhead.hcrc&&(e.adler=p(e.adler,n.pending_buf,n.pending,0)),n.gzindex=0,n.status=69):(U(n,0),U(n,0),U(n,0),U(n,0),U(n,0),U(n,9===n.level?2:2<=n.strategy||n.level<2?4:0),U(n,3),n.status=E);else{var a=v+(n.w_bits-8<<4)<<8;a|=(2<=n.strategy||n.level<2?0:n.level<6?1:6===n.level?2:3)<<6,0!==n.strstart&&(a|=32),a+=31-a%31,n.status=E,P(n,a),0!==n.strstart&&(P(n,e.adler>>>16),P(n,65535&e.adler)),e.adler=1}if(69===n.status)if(n.gzhead.extra){for(i=n.pending;n.gzindex<(65535&n.gzhead.extra.length)&&(n.pending!==n.pending_buf_size||(n.gzhead.hcrc&&n.pending>i&&(e.adler=p(e.adler,n.pending_buf,n.pending-i,i)),F(e),i=n.pending,n.pending!==n.pending_buf_size));)U(n,255&n.gzhead.extra[n.gzindex]),n.gzindex++;n.gzhead.hcrc&&n.pending>i&&(e.adler=p(e.adler,n.pending_buf,n.pending-i,i)),n.gzindex===n.gzhead.extra.length&&(n.gzindex=0,n.status=73)}else n.status=73;if(73===n.status)if(n.gzhead.name){i=n.pending;do{if(n.pending===n.pending_buf_size&&(n.gzhead.hcrc&&n.pending>i&&(e.adler=p(e.adler,n.pending_buf,n.pending-i,i)),F(e),i=n.pending,n.pending===n.pending_buf_size)){s=1;break}s=n.gzindex<n.gzhead.name.length?255&n.gzhead.name.charCodeAt(n.gzindex++):0,U(n,s)}while(0!==s);n.gzhead.hcrc&&n.pending>i&&(e.adler=p(e.adler,n.pending_buf,n.pending-i,i)),0===s&&(n.gzindex=0,n.status=91)}else n.status=91;if(91===n.status)if(n.gzhead.comment){i=n.pending;do{if(n.pending===n.pending_buf_size&&(n.gzhead.hcrc&&n.pending>i&&(e.adler=p(e.adler,n.pending_buf,n.pending-i,i)),F(e),i=n.pending,n.pending===n.pending_buf_size)){s=1;break}s=n.gzindex<n.gzhead.comment.length?255&n.gzhead.comment.charCodeAt(n.gzindex++):0,U(n,s)}while(0!==s);n.gzhead.hcrc&&n.pending>i&&(e.adler=p(e.adler,n.pending_buf,n.pending-i,i)),0===s&&(n.status=103)}else n.status=103;if(103===n.status&&(n.gzhead.hcrc?(n.pending+2>n.pending_buf_size&&F(e),n.pending+2<=n.pending_buf_size&&(U(n,255&e.adler),U(n,e.adler>>8&255),e.adler=0,n.status=E)):n.status=E),0!==n.pending){if(F(e),0===e.avail_out)return n.last_flush=-1,m}else if(0===e.avail_in&&T(t)<=T(r)&&t!==f)return R(e,-5);if(666===n.status&&0!==e.avail_in)return R(e,-5);if(0!==e.avail_in||0!==n.lookahead||t!==l&&666!==n.status){var o=2===n.strategy?function(e,t){for(var r;;){if(0===e.lookahead&&(j(e),0===e.lookahead)){if(t===l)return A;break}if(e.match_length=0,r=u._tr_tally(e,0,e.window[e.strstart]),e.lookahead--,e.strstart++,r&&(N(e,!1),0===e.strm.avail_out))return A}return e.insert=0,t===f?(N(e,!0),0===e.strm.avail_out?O:B):e.last_lit&&(N(e,!1),0===e.strm.avail_out)?A:I}(n,t):3===n.strategy?function(e,t){for(var r,n,i,s,a=e.window;;){if(e.lookahead<=S){if(j(e),e.lookahead<=S&&t===l)return A;if(0===e.lookahead)break}if(e.match_length=0,e.lookahead>=x&&0<e.strstart&&(n=a[i=e.strstart-1])===a[++i]&&n===a[++i]&&n===a[++i]){s=e.strstart+S;do{}while(n===a[++i]&&n===a[++i]&&n===a[++i]&&n===a[++i]&&n===a[++i]&&n===a[++i]&&n===a[++i]&&n===a[++i]&&i<s);e.match_length=S-(s-i),e.match_length>e.lookahead&&(e.match_length=e.lookahead)}if(e.match_length>=x?(r=u._tr_tally(e,1,e.match_length-x),e.lookahead-=e.match_length,e.strstart+=e.match_length,e.match_length=0):(r=u._tr_tally(e,0,e.window[e.strstart]),e.lookahead--,e.strstart++),r&&(N(e,!1),0===e.strm.avail_out))return A}return e.insert=0,t===f?(N(e,!0),0===e.strm.avail_out?O:B):e.last_lit&&(N(e,!1),0===e.strm.avail_out)?A:I}(n,t):h[n.level].func(n,t);if(o!==O&&o!==B||(n.status=666),o===A||o===O)return 0===e.avail_out&&(n.last_flush=-1),m;if(o===I&&(1===t?u._tr_align(n):5!==t&&(u._tr_stored_block(n,0,0,!1),3===t&&(D(n.head),0===n.lookahead&&(n.strstart=0,n.block_start=0,n.insert=0))),F(e),0===e.avail_out))return n.last_flush=-1,m}return t!==f?m:n.wrap<=0?1:(2===n.wrap?(U(n,255&e.adler),U(n,e.adler>>8&255),U(n,e.adler>>16&255),U(n,e.adler>>24&255),U(n,255&e.total_in),U(n,e.total_in>>8&255),U(n,e.total_in>>16&255),U(n,e.total_in>>24&255)):(P(n,e.adler>>>16),P(n,65535&e.adler)),F(e),0<n.wrap&&(n.wrap=-n.wrap),0!==n.pending?m:1)},r.deflateEnd=function(e){var t;return e&&e.state?(t=e.state.status)!==C&&69!==t&&73!==t&&91!==t&&103!==t&&t!==E&&666!==t?R(e,_):(e.state=null,t===E?R(e,-3):m):_},r.deflateSetDictionary=function(e,t){var r,n,i,s,a,o,h,u,l=t.length;if(!e||!e.state)return _;if(2===(s=(r=e.state).wrap)||1===s&&r.status!==C||r.lookahead)return _;for(1===s&&(e.adler=d(e.adler,t,l,0)),r.wrap=0,l>=r.w_size&&(0===s&&(D(r.head),r.strstart=0,r.block_start=0,r.insert=0),u=new c.Buf8(r.w_size),c.arraySet(u,t,l-r.w_size,r.w_size,0),t=u,l=r.w_size),a=e.avail_in,o=e.next_in,h=e.input,e.avail_in=l,e.next_in=0,e.input=t,j(r);r.lookahead>=x;){for(n=r.strstart,i=r.lookahead-(x-1);r.ins_h=(r.ins_h<<r.hash_shift^r.window[n+x-1])&r.hash_mask,r.prev[n&r.w_mask]=r.head[r.ins_h],r.head[r.ins_h]=n,n++,--i;);r.strstart=n,r.lookahead=x-1,j(r)}return r.strstart+=r.lookahead,r.block_start=r.strstart,r.insert=r.lookahead,r.lookahead=0,r.match_length=r.prev_length=x-1,r.match_available=0,e.next_in=o,e.input=h,e.avail_in=a,r.wrap=s,m},r.deflateInfo="pako deflate (from Nodeca project)"},{"../utils/common":41,"./adler32":43,"./crc32":45,"./messages":51,"./trees":52}],47:[function(e,t,r){"use strict";t.exports=function(){this.text=0,this.time=0,this.xflags=0,this.os=0,this.extra=null,this.extra_len=0,this.name="",this.comment="",this.hcrc=0,this.done=!1}},{}],48:[function(e,t,r){"use strict";t.exports=function(e,t){var r,n,i,s,a,o,h,u,l,f,c,d,p,m,_,g,b,v,y,w,k,x,S,z,C;r=e.state,n=e.next_in,z=e.input,i=n+(e.avail_in-5),s=e.next_out,C=e.output,a=s-(t-e.avail_out),o=s+(e.avail_out-257),h=r.dmax,u=r.wsize,l=r.whave,f=r.wnext,c=r.window,d=r.hold,p=r.bits,m=r.lencode,_=r.distcode,g=(1<<r.lenbits)-1,b=(1<<r.distbits)-1;e:do{p<15&&(d+=z[n++]<<p,p+=8,d+=z[n++]<<p,p+=8),v=m[d&g];t:for(;;){if(d>>>=y=v>>>24,p-=y,0===(y=v>>>16&255))C[s++]=65535&v;else{if(!(16&y)){if(0==(64&y)){v=m[(65535&v)+(d&(1<<y)-1)];continue t}if(32&y){r.mode=12;break e}e.msg="invalid literal/length code",r.mode=30;break e}w=65535&v,(y&=15)&&(p<y&&(d+=z[n++]<<p,p+=8),w+=d&(1<<y)-1,d>>>=y,p-=y),p<15&&(d+=z[n++]<<p,p+=8,d+=z[n++]<<p,p+=8),v=_[d&b];r:for(;;){if(d>>>=y=v>>>24,p-=y,!(16&(y=v>>>16&255))){if(0==(64&y)){v=_[(65535&v)+(d&(1<<y)-1)];continue r}e.msg="invalid distance code",r.mode=30;break e}if(k=65535&v,p<(y&=15)&&(d+=z[n++]<<p,(p+=8)<y&&(d+=z[n++]<<p,p+=8)),h<(k+=d&(1<<y)-1)){e.msg="invalid distance too far back",r.mode=30;break e}if(d>>>=y,p-=y,(y=s-a)<k){if(l<(y=k-y)&&r.sane){e.msg="invalid distance too far back",r.mode=30;break e}if(S=c,(x=0)===f){if(x+=u-y,y<w){for(w-=y;C[s++]=c[x++],--y;);x=s-k,S=C}}else if(f<y){if(x+=u+f-y,(y-=f)<w){for(w-=y;C[s++]=c[x++],--y;);if(x=0,f<w){for(w-=y=f;C[s++]=c[x++],--y;);x=s-k,S=C}}}else if(x+=f-y,y<w){for(w-=y;C[s++]=c[x++],--y;);x=s-k,S=C}for(;2<w;)C[s++]=S[x++],C[s++]=S[x++],C[s++]=S[x++],w-=3;w&&(C[s++]=S[x++],1<w&&(C[s++]=S[x++]))}else{for(x=s-k;C[s++]=C[x++],C[s++]=C[x++],C[s++]=C[x++],2<(w-=3););w&&(C[s++]=C[x++],1<w&&(C[s++]=C[x++]))}break}}break}}while(n<i&&s<o);n-=w=p>>3,d&=(1<<(p-=w<<3))-1,e.next_in=n,e.next_out=s,e.avail_in=n<i?i-n+5:5-(n-i),e.avail_out=s<o?o-s+257:257-(s-o),r.hold=d,r.bits=p}},{}],49:[function(e,t,r){"use strict";var I=e("../utils/common"),O=e("./adler32"),B=e("./crc32"),R=e("./inffast"),T=e("./inftrees"),D=1,F=2,N=0,U=-2,P=1,n=852,i=592;function L(e){return(e>>>24&255)+(e>>>8&65280)+((65280&e)<<8)+((255&e)<<24)}function s(){this.mode=0,this.last=!1,this.wrap=0,this.havedict=!1,this.flags=0,this.dmax=0,this.check=0,this.total=0,this.head=null,this.wbits=0,this.wsize=0,this.whave=0,this.wnext=0,this.window=null,this.hold=0,this.bits=0,this.length=0,this.offset=0,this.extra=0,this.lencode=null,this.distcode=null,this.lenbits=0,this.distbits=0,this.ncode=0,this.nlen=0,this.ndist=0,this.have=0,this.next=null,this.lens=new I.Buf16(320),this.work=new I.Buf16(288),this.lendyn=null,this.distdyn=null,this.sane=0,this.back=0,this.was=0}function a(e){var t;return e&&e.state?(t=e.state,e.total_in=e.total_out=t.total=0,e.msg="",t.wrap&&(e.adler=1&t.wrap),t.mode=P,t.last=0,t.havedict=0,t.dmax=32768,t.head=null,t.hold=0,t.bits=0,t.lencode=t.lendyn=new I.Buf32(n),t.distcode=t.distdyn=new I.Buf32(i),t.sane=1,t.back=-1,N):U}function o(e){var t;return e&&e.state?((t=e.state).wsize=0,t.whave=0,t.wnext=0,a(e)):U}function h(e,t){var r,n;return e&&e.state?(n=e.state,t<0?(r=0,t=-t):(r=1+(t>>4),t<48&&(t&=15)),t&&(t<8||15<t)?U:(null!==n.window&&n.wbits!==t&&(n.window=null),n.wrap=r,n.wbits=t,o(e))):U}function u(e,t){var r,n;return e?(n=new s,(e.state=n).window=null,(r=h(e,t))!==N&&(e.state=null),r):U}var l,f,c=!0;function j(e){if(c){var t;for(l=new I.Buf32(512),f=new I.Buf32(32),t=0;t<144;)e.lens[t++]=8;for(;t<256;)e.lens[t++]=9;for(;t<280;)e.lens[t++]=7;for(;t<288;)e.lens[t++]=8;for(T(D,e.lens,0,288,l,0,e.work,{bits:9}),t=0;t<32;)e.lens[t++]=5;T(F,e.lens,0,32,f,0,e.work,{bits:5}),c=!1}e.lencode=l,e.lenbits=9,e.distcode=f,e.distbits=5}function Z(e,t,r,n){var i,s=e.state;return null===s.window&&(s.wsize=1<<s.wbits,s.wnext=0,s.whave=0,s.window=new I.Buf8(s.wsize)),n>=s.wsize?(I.arraySet(s.window,t,r-s.wsize,s.wsize,0),s.wnext=0,s.whave=s.wsize):(n<(i=s.wsize-s.wnext)&&(i=n),I.arraySet(s.window,t,r-n,i,s.wnext),(n-=i)?(I.arraySet(s.window,t,r-n,n,0),s.wnext=n,s.whave=s.wsize):(s.wnext+=i,s.wnext===s.wsize&&(s.wnext=0),s.whave<s.wsize&&(s.whave+=i))),0}r.inflateReset=o,r.inflateReset2=h,r.inflateResetKeep=a,r.inflateInit=function(e){return u(e,15)},r.inflateInit2=u,r.inflate=function(e,t){var r,n,i,s,a,o,h,u,l,f,c,d,p,m,_,g,b,v,y,w,k,x,S,z,C=0,E=new I.Buf8(4),A=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];if(!e||!e.state||!e.output||!e.input&&0!==e.avail_in)return U;12===(r=e.state).mode&&(r.mode=13),a=e.next_out,i=e.output,h=e.avail_out,s=e.next_in,n=e.input,o=e.avail_in,u=r.hold,l=r.bits,f=o,c=h,x=N;e:for(;;)switch(r.mode){case P:if(0===r.wrap){r.mode=13;break}for(;l<16;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}if(2&r.wrap&&35615===u){E[r.check=0]=255&u,E[1]=u>>>8&255,r.check=B(r.check,E,2,0),l=u=0,r.mode=2;break}if(r.flags=0,r.head&&(r.head.done=!1),!(1&r.wrap)||(((255&u)<<8)+(u>>8))%31){e.msg="incorrect header check",r.mode=30;break}if(8!=(15&u)){e.msg="unknown compression method",r.mode=30;break}if(l-=4,k=8+(15&(u>>>=4)),0===r.wbits)r.wbits=k;else if(k>r.wbits){e.msg="invalid window size",r.mode=30;break}r.dmax=1<<k,e.adler=r.check=1,r.mode=512&u?10:12,l=u=0;break;case 2:for(;l<16;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}if(r.flags=u,8!=(255&r.flags)){e.msg="unknown compression method",r.mode=30;break}if(57344&r.flags){e.msg="unknown header flags set",r.mode=30;break}r.head&&(r.head.text=u>>8&1),512&r.flags&&(E[0]=255&u,E[1]=u>>>8&255,r.check=B(r.check,E,2,0)),l=u=0,r.mode=3;case 3:for(;l<32;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}r.head&&(r.head.time=u),512&r.flags&&(E[0]=255&u,E[1]=u>>>8&255,E[2]=u>>>16&255,E[3]=u>>>24&255,r.check=B(r.check,E,4,0)),l=u=0,r.mode=4;case 4:for(;l<16;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}r.head&&(r.head.xflags=255&u,r.head.os=u>>8),512&r.flags&&(E[0]=255&u,E[1]=u>>>8&255,r.check=B(r.check,E,2,0)),l=u=0,r.mode=5;case 5:if(1024&r.flags){for(;l<16;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}r.length=u,r.head&&(r.head.extra_len=u),512&r.flags&&(E[0]=255&u,E[1]=u>>>8&255,r.check=B(r.check,E,2,0)),l=u=0}else r.head&&(r.head.extra=null);r.mode=6;case 6:if(1024&r.flags&&(o<(d=r.length)&&(d=o),d&&(r.head&&(k=r.head.extra_len-r.length,r.head.extra||(r.head.extra=new Array(r.head.extra_len)),I.arraySet(r.head.extra,n,s,d,k)),512&r.flags&&(r.check=B(r.check,n,d,s)),o-=d,s+=d,r.length-=d),r.length))break e;r.length=0,r.mode=7;case 7:if(2048&r.flags){if(0===o)break e;for(d=0;k=n[s+d++],r.head&&k&&r.length<65536&&(r.head.name+=String.fromCharCode(k)),k&&d<o;);if(512&r.flags&&(r.check=B(r.check,n,d,s)),o-=d,s+=d,k)break e}else r.head&&(r.head.name=null);r.length=0,r.mode=8;case 8:if(4096&r.flags){if(0===o)break e;for(d=0;k=n[s+d++],r.head&&k&&r.length<65536&&(r.head.comment+=String.fromCharCode(k)),k&&d<o;);if(512&r.flags&&(r.check=B(r.check,n,d,s)),o-=d,s+=d,k)break e}else r.head&&(r.head.comment=null);r.mode=9;case 9:if(512&r.flags){for(;l<16;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}if(u!==(65535&r.check)){e.msg="header crc mismatch",r.mode=30;break}l=u=0}r.head&&(r.head.hcrc=r.flags>>9&1,r.head.done=!0),e.adler=r.check=0,r.mode=12;break;case 10:for(;l<32;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}e.adler=r.check=L(u),l=u=0,r.mode=11;case 11:if(0===r.havedict)return e.next_out=a,e.avail_out=h,e.next_in=s,e.avail_in=o,r.hold=u,r.bits=l,2;e.adler=r.check=1,r.mode=12;case 12:if(5===t||6===t)break e;case 13:if(r.last){u>>>=7&l,l-=7&l,r.mode=27;break}for(;l<3;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}switch(r.last=1&u,l-=1,3&(u>>>=1)){case 0:r.mode=14;break;case 1:if(j(r),r.mode=20,6!==t)break;u>>>=2,l-=2;break e;case 2:r.mode=17;break;case 3:e.msg="invalid block type",r.mode=30}u>>>=2,l-=2;break;case 14:for(u>>>=7&l,l-=7&l;l<32;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}if((65535&u)!=(u>>>16^65535)){e.msg="invalid stored block lengths",r.mode=30;break}if(r.length=65535&u,l=u=0,r.mode=15,6===t)break e;case 15:r.mode=16;case 16:if(d=r.length){if(o<d&&(d=o),h<d&&(d=h),0===d)break e;I.arraySet(i,n,s,d,a),o-=d,s+=d,h-=d,a+=d,r.length-=d;break}r.mode=12;break;case 17:for(;l<14;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}if(r.nlen=257+(31&u),u>>>=5,l-=5,r.ndist=1+(31&u),u>>>=5,l-=5,r.ncode=4+(15&u),u>>>=4,l-=4,286<r.nlen||30<r.ndist){e.msg="too many length or distance symbols",r.mode=30;break}r.have=0,r.mode=18;case 18:for(;r.have<r.ncode;){for(;l<3;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}r.lens[A[r.have++]]=7&u,u>>>=3,l-=3}for(;r.have<19;)r.lens[A[r.have++]]=0;if(r.lencode=r.lendyn,r.lenbits=7,S={bits:r.lenbits},x=T(0,r.lens,0,19,r.lencode,0,r.work,S),r.lenbits=S.bits,x){e.msg="invalid code lengths set",r.mode=30;break}r.have=0,r.mode=19;case 19:for(;r.have<r.nlen+r.ndist;){for(;g=(C=r.lencode[u&(1<<r.lenbits)-1])>>>16&255,b=65535&C,!((_=C>>>24)<=l);){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}if(b<16)u>>>=_,l-=_,r.lens[r.have++]=b;else{if(16===b){for(z=_+2;l<z;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}if(u>>>=_,l-=_,0===r.have){e.msg="invalid bit length repeat",r.mode=30;break}k=r.lens[r.have-1],d=3+(3&u),u>>>=2,l-=2}else if(17===b){for(z=_+3;l<z;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}l-=_,k=0,d=3+(7&(u>>>=_)),u>>>=3,l-=3}else{for(z=_+7;l<z;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}l-=_,k=0,d=11+(127&(u>>>=_)),u>>>=7,l-=7}if(r.have+d>r.nlen+r.ndist){e.msg="invalid bit length repeat",r.mode=30;break}for(;d--;)r.lens[r.have++]=k}}if(30===r.mode)break;if(0===r.lens[256]){e.msg="invalid code -- missing end-of-block",r.mode=30;break}if(r.lenbits=9,S={bits:r.lenbits},x=T(D,r.lens,0,r.nlen,r.lencode,0,r.work,S),r.lenbits=S.bits,x){e.msg="invalid literal/lengths set",r.mode=30;break}if(r.distbits=6,r.distcode=r.distdyn,S={bits:r.distbits},x=T(F,r.lens,r.nlen,r.ndist,r.distcode,0,r.work,S),r.distbits=S.bits,x){e.msg="invalid distances set",r.mode=30;break}if(r.mode=20,6===t)break e;case 20:r.mode=21;case 21:if(6<=o&&258<=h){e.next_out=a,e.avail_out=h,e.next_in=s,e.avail_in=o,r.hold=u,r.bits=l,R(e,c),a=e.next_out,i=e.output,h=e.avail_out,s=e.next_in,n=e.input,o=e.avail_in,u=r.hold,l=r.bits,12===r.mode&&(r.back=-1);break}for(r.back=0;g=(C=r.lencode[u&(1<<r.lenbits)-1])>>>16&255,b=65535&C,!((_=C>>>24)<=l);){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}if(g&&0==(240&g)){for(v=_,y=g,w=b;g=(C=r.lencode[w+((u&(1<<v+y)-1)>>v)])>>>16&255,b=65535&C,!(v+(_=C>>>24)<=l);){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}u>>>=v,l-=v,r.back+=v}if(u>>>=_,l-=_,r.back+=_,r.length=b,0===g){r.mode=26;break}if(32&g){r.back=-1,r.mode=12;break}if(64&g){e.msg="invalid literal/length code",r.mode=30;break}r.extra=15&g,r.mode=22;case 22:if(r.extra){for(z=r.extra;l<z;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}r.length+=u&(1<<r.extra)-1,u>>>=r.extra,l-=r.extra,r.back+=r.extra}r.was=r.length,r.mode=23;case 23:for(;g=(C=r.distcode[u&(1<<r.distbits)-1])>>>16&255,b=65535&C,!((_=C>>>24)<=l);){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}if(0==(240&g)){for(v=_,y=g,w=b;g=(C=r.distcode[w+((u&(1<<v+y)-1)>>v)])>>>16&255,b=65535&C,!(v+(_=C>>>24)<=l);){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}u>>>=v,l-=v,r.back+=v}if(u>>>=_,l-=_,r.back+=_,64&g){e.msg="invalid distance code",r.mode=30;break}r.offset=b,r.extra=15&g,r.mode=24;case 24:if(r.extra){for(z=r.extra;l<z;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}r.offset+=u&(1<<r.extra)-1,u>>>=r.extra,l-=r.extra,r.back+=r.extra}if(r.offset>r.dmax){e.msg="invalid distance too far back",r.mode=30;break}r.mode=25;case 25:if(0===h)break e;if(d=c-h,r.offset>d){if((d=r.offset-d)>r.whave&&r.sane){e.msg="invalid distance too far back",r.mode=30;break}p=d>r.wnext?(d-=r.wnext,r.wsize-d):r.wnext-d,d>r.length&&(d=r.length),m=r.window}else m=i,p=a-r.offset,d=r.length;for(h<d&&(d=h),h-=d,r.length-=d;i[a++]=m[p++],--d;);0===r.length&&(r.mode=21);break;case 26:if(0===h)break e;i[a++]=r.length,h--,r.mode=21;break;case 27:if(r.wrap){for(;l<32;){if(0===o)break e;o--,u|=n[s++]<<l,l+=8}if(c-=h,e.total_out+=c,r.total+=c,c&&(e.adler=r.check=r.flags?B(r.check,i,c,a-c):O(r.check,i,c,a-c)),c=h,(r.flags?u:L(u))!==r.check){e.msg="incorrect data check",r.mode=30;break}l=u=0}r.mode=28;case 28:if(r.wrap&&r.flags){for(;l<32;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8}if(u!==(4294967295&r.total)){e.msg="incorrect length check",r.mode=30;break}l=u=0}r.mode=29;case 29:x=1;break e;case 30:x=-3;break e;case 31:return-4;case 32:default:return U}return e.next_out=a,e.avail_out=h,e.next_in=s,e.avail_in=o,r.hold=u,r.bits=l,(r.wsize||c!==e.avail_out&&r.mode<30&&(r.mode<27||4!==t))&&Z(e,e.output,e.next_out,c-e.avail_out)?(r.mode=31,-4):(f-=e.avail_in,c-=e.avail_out,e.total_in+=f,e.total_out+=c,r.total+=c,r.wrap&&c&&(e.adler=r.check=r.flags?B(r.check,i,c,e.next_out-c):O(r.check,i,c,e.next_out-c)),e.data_type=r.bits+(r.last?64:0)+(12===r.mode?128:0)+(20===r.mode||15===r.mode?256:0),(0==f&&0===c||4===t)&&x===N&&(x=-5),x)},r.inflateEnd=function(e){if(!e||!e.state)return U;var t=e.state;return t.window&&(t.window=null),e.state=null,N},r.inflateGetHeader=function(e,t){var r;return e&&e.state?0==(2&(r=e.state).wrap)?U:((r.head=t).done=!1,N):U},r.inflateSetDictionary=function(e,t){var r,n=t.length;return e&&e.state?0!==(r=e.state).wrap&&11!==r.mode?U:11===r.mode&&O(1,t,n,0)!==r.check?-3:Z(e,t,n,n)?(r.mode=31,-4):(r.havedict=1,N):U},r.inflateInfo="pako inflate (from Nodeca project)"},{"../utils/common":41,"./adler32":43,"./crc32":45,"./inffast":48,"./inftrees":50}],50:[function(e,t,r){"use strict";var D=e("../utils/common"),F=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,0,0],N=[16,16,16,16,16,16,16,16,17,17,17,17,18,18,18,18,19,19,19,19,20,20,20,20,21,21,21,21,16,72,78],U=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,0,0],P=[16,16,16,16,17,17,18,18,19,19,20,20,21,21,22,22,23,23,24,24,25,25,26,26,27,27,28,28,29,29,64,64];t.exports=function(e,t,r,n,i,s,a,o){var h,u,l,f,c,d,p,m,_,g=o.bits,b=0,v=0,y=0,w=0,k=0,x=0,S=0,z=0,C=0,E=0,A=null,I=0,O=new D.Buf16(16),B=new D.Buf16(16),R=null,T=0;for(b=0;b<=15;b++)O[b]=0;for(v=0;v<n;v++)O[t[r+v]]++;for(k=g,w=15;1<=w&&0===O[w];w--);if(w<k&&(k=w),0===w)return i[s++]=20971520,i[s++]=20971520,o.bits=1,0;for(y=1;y<w&&0===O[y];y++);for(k<y&&(k=y),b=z=1;b<=15;b++)if(z<<=1,(z-=O[b])<0)return-1;if(0<z&&(0===e||1!==w))return-1;for(B[1]=0,b=1;b<15;b++)B[b+1]=B[b]+O[b];for(v=0;v<n;v++)0!==t[r+v]&&(a[B[t[r+v]]++]=v);if(d=0===e?(A=R=a,19):1===e?(A=F,I-=257,R=N,T-=257,256):(A=U,R=P,-1),b=y,c=s,S=v=E=0,l=-1,f=(C=1<<(x=k))-1,1===e&&852<C||2===e&&592<C)return 1;for(;;){for(p=b-S,_=a[v]<d?(m=0,a[v]):a[v]>d?(m=R[T+a[v]],A[I+a[v]]):(m=96,0),h=1<<b-S,y=u=1<<x;i[c+(E>>S)+(u-=h)]=p<<24|m<<16|_|0,0!==u;);for(h=1<<b-1;E&h;)h>>=1;if(0!==h?(E&=h-1,E+=h):E=0,v++,0==--O[b]){if(b===w)break;b=t[r+a[v]]}if(k<b&&(E&f)!==l){for(0===S&&(S=k),c+=y,z=1<<(x=b-S);x+S<w&&!((z-=O[x+S])<=0);)x++,z<<=1;if(C+=1<<x,1===e&&852<C||2===e&&592<C)return 1;i[l=E&f]=k<<24|x<<16|c-s|0}}return 0!==E&&(i[c+E]=b-S<<24|64<<16|0),o.bits=k,0}},{"../utils/common":41}],51:[function(e,t,r){"use strict";t.exports={2:"need dictionary",1:"stream end",0:"","-1":"file error","-2":"stream error","-3":"data error","-4":"insufficient memory","-5":"buffer error","-6":"incompatible version"}},{}],52:[function(e,t,r){"use strict";var i=e("../utils/common"),o=0,h=1;function n(e){for(var t=e.length;0<=--t;)e[t]=0}var s=0,a=29,u=256,l=u+1+a,f=30,c=19,_=2*l+1,g=15,d=16,p=7,m=256,b=16,v=17,y=18,w=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0],k=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13],x=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,7],S=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],z=new Array(2*(l+2));n(z);var C=new Array(2*f);n(C);var E=new Array(512);n(E);var A=new Array(256);n(A);var I=new Array(a);n(I);var O,B,R,T=new Array(f);function D(e,t,r,n,i){this.static_tree=e,this.extra_bits=t,this.extra_base=r,this.elems=n,this.max_length=i,this.has_stree=e&&e.length}function F(e,t){this.dyn_tree=e,this.max_code=0,this.stat_desc=t}function N(e){return e<256?E[e]:E[256+(e>>>7)]}function U(e,t){e.pending_buf[e.pending++]=255&t,e.pending_buf[e.pending++]=t>>>8&255}function P(e,t,r){e.bi_valid>d-r?(e.bi_buf|=t<<e.bi_valid&65535,U(e,e.bi_buf),e.bi_buf=t>>d-e.bi_valid,e.bi_valid+=r-d):(e.bi_buf|=t<<e.bi_valid&65535,e.bi_valid+=r)}function L(e,t,r){P(e,r[2*t],r[2*t+1])}function j(e,t){for(var r=0;r|=1&e,e>>>=1,r<<=1,0<--t;);return r>>>1}function Z(e,t,r){var n,i,s=new Array(g+1),a=0;for(n=1;n<=g;n++)s[n]=a=a+r[n-1]<<1;for(i=0;i<=t;i++){var o=e[2*i+1];0!==o&&(e[2*i]=j(s[o]++,o))}}function W(e){var t;for(t=0;t<l;t++)e.dyn_ltree[2*t]=0;for(t=0;t<f;t++)e.dyn_dtree[2*t]=0;for(t=0;t<c;t++)e.bl_tree[2*t]=0;e.dyn_ltree[2*m]=1,e.opt_len=e.static_len=0,e.last_lit=e.matches=0}function M(e){8<e.bi_valid?U(e,e.bi_buf):0<e.bi_valid&&(e.pending_buf[e.pending++]=e.bi_buf),e.bi_buf=0,e.bi_valid=0}function H(e,t,r,n){var i=2*t,s=2*r;return e[i]<e[s]||e[i]===e[s]&&n[t]<=n[r]}function G(e,t,r){for(var n=e.heap[r],i=r<<1;i<=e.heap_len&&(i<e.heap_len&&H(t,e.heap[i+1],e.heap[i],e.depth)&&i++,!H(t,n,e.heap[i],e.depth));)e.heap[r]=e.heap[i],r=i,i<<=1;e.heap[r]=n}function K(e,t,r){var n,i,s,a,o=0;if(0!==e.last_lit)for(;n=e.pending_buf[e.d_buf+2*o]<<8|e.pending_buf[e.d_buf+2*o+1],i=e.pending_buf[e.l_buf+o],o++,0===n?L(e,i,t):(L(e,(s=A[i])+u+1,t),0!==(a=w[s])&&P(e,i-=I[s],a),L(e,s=N(--n),r),0!==(a=k[s])&&P(e,n-=T[s],a)),o<e.last_lit;);L(e,m,t)}function Y(e,t){var r,n,i,s=t.dyn_tree,a=t.stat_desc.static_tree,o=t.stat_desc.has_stree,h=t.stat_desc.elems,u=-1;for(e.heap_len=0,e.heap_max=_,r=0;r<h;r++)0!==s[2*r]?(e.heap[++e.heap_len]=u=r,e.depth[r]=0):s[2*r+1]=0;for(;e.heap_len<2;)s[2*(i=e.heap[++e.heap_len]=u<2?++u:0)]=1,e.depth[i]=0,e.opt_len--,o&&(e.static_len-=a[2*i+1]);for(t.max_code=u,r=e.heap_len>>1;1<=r;r--)G(e,s,r);for(i=h;r=e.heap[1],e.heap[1]=e.heap[e.heap_len--],G(e,s,1),n=e.heap[1],e.heap[--e.heap_max]=r,e.heap[--e.heap_max]=n,s[2*i]=s[2*r]+s[2*n],e.depth[i]=(e.depth[r]>=e.depth[n]?e.depth[r]:e.depth[n])+1,s[2*r+1]=s[2*n+1]=i,e.heap[1]=i++,G(e,s,1),2<=e.heap_len;);e.heap[--e.heap_max]=e.heap[1],function(e,t){var r,n,i,s,a,o,h=t.dyn_tree,u=t.max_code,l=t.stat_desc.static_tree,f=t.stat_desc.has_stree,c=t.stat_desc.extra_bits,d=t.stat_desc.extra_base,p=t.stat_desc.max_length,m=0;for(s=0;s<=g;s++)e.bl_count[s]=0;for(h[2*e.heap[e.heap_max]+1]=0,r=e.heap_max+1;r<_;r++)p<(s=h[2*h[2*(n=e.heap[r])+1]+1]+1)&&(s=p,m++),h[2*n+1]=s,u<n||(e.bl_count[s]++,a=0,d<=n&&(a=c[n-d]),o=h[2*n],e.opt_len+=o*(s+a),f&&(e.static_len+=o*(l[2*n+1]+a)));if(0!==m){do{for(s=p-1;0===e.bl_count[s];)s--;e.bl_count[s]--,e.bl_count[s+1]+=2,e.bl_count[p]--,m-=2}while(0<m);for(s=p;0!==s;s--)for(n=e.bl_count[s];0!==n;)u<(i=e.heap[--r])||(h[2*i+1]!==s&&(e.opt_len+=(s-h[2*i+1])*h[2*i],h[2*i+1]=s),n--)}}(e,t),Z(s,u,e.bl_count)}function X(e,t,r){var n,i,s=-1,a=t[1],o=0,h=7,u=4;for(0===a&&(h=138,u=3),t[2*(r+1)+1]=65535,n=0;n<=r;n++)i=a,a=t[2*(n+1)+1],++o<h&&i===a||(o<u?e.bl_tree[2*i]+=o:0!==i?(i!==s&&e.bl_tree[2*i]++,e.bl_tree[2*b]++):o<=10?e.bl_tree[2*v]++:e.bl_tree[2*y]++,s=i,u=(o=0)===a?(h=138,3):i===a?(h=6,3):(h=7,4))}function V(e,t,r){var n,i,s=-1,a=t[1],o=0,h=7,u=4;for(0===a&&(h=138,u=3),n=0;n<=r;n++)if(i=a,a=t[2*(n+1)+1],!(++o<h&&i===a)){if(o<u)for(;L(e,i,e.bl_tree),0!=--o;);else 0!==i?(i!==s&&(L(e,i,e.bl_tree),o--),L(e,b,e.bl_tree),P(e,o-3,2)):o<=10?(L(e,v,e.bl_tree),P(e,o-3,3)):(L(e,y,e.bl_tree),P(e,o-11,7));s=i,u=(o=0)===a?(h=138,3):i===a?(h=6,3):(h=7,4)}}n(T);var q=!1;function J(e,t,r,n){P(e,(s<<1)+(n?1:0),3),function(e,t,r,n){M(e),n&&(U(e,r),U(e,~r)),i.arraySet(e.pending_buf,e.window,t,r,e.pending),e.pending+=r}(e,t,r,!0)}r._tr_init=function(e){q||(function(){var e,t,r,n,i,s=new Array(g+1);for(n=r=0;n<a-1;n++)for(I[n]=r,e=0;e<1<<w[n];e++)A[r++]=n;for(A[r-1]=n,n=i=0;n<16;n++)for(T[n]=i,e=0;e<1<<k[n];e++)E[i++]=n;for(i>>=7;n<f;n++)for(T[n]=i<<7,e=0;e<1<<k[n]-7;e++)E[256+i++]=n;for(t=0;t<=g;t++)s[t]=0;for(e=0;e<=143;)z[2*e+1]=8,e++,s[8]++;for(;e<=255;)z[2*e+1]=9,e++,s[9]++;for(;e<=279;)z[2*e+1]=7,e++,s[7]++;for(;e<=287;)z[2*e+1]=8,e++,s[8]++;for(Z(z,l+1,s),e=0;e<f;e++)C[2*e+1]=5,C[2*e]=j(e,5);O=new D(z,w,u+1,l,g),B=new D(C,k,0,f,g),R=new D(new Array(0),x,0,c,p)}(),q=!0),e.l_desc=new F(e.dyn_ltree,O),e.d_desc=new F(e.dyn_dtree,B),e.bl_desc=new F(e.bl_tree,R),e.bi_buf=0,e.bi_valid=0,W(e)},r._tr_stored_block=J,r._tr_flush_block=function(e,t,r,n){var i,s,a=0;0<e.level?(2===e.strm.data_type&&(e.strm.data_type=function(e){var t,r=4093624447;for(t=0;t<=31;t++,r>>>=1)if(1&r&&0!==e.dyn_ltree[2*t])return o;if(0!==e.dyn_ltree[18]||0!==e.dyn_ltree[20]||0!==e.dyn_ltree[26])return h;for(t=32;t<u;t++)if(0!==e.dyn_ltree[2*t])return h;return o}(e)),Y(e,e.l_desc),Y(e,e.d_desc),a=function(e){var t;for(X(e,e.dyn_ltree,e.l_desc.max_code),X(e,e.dyn_dtree,e.d_desc.max_code),Y(e,e.bl_desc),t=c-1;3<=t&&0===e.bl_tree[2*S[t]+1];t--);return e.opt_len+=3*(t+1)+5+5+4,t}(e),i=e.opt_len+3+7>>>3,(s=e.static_len+3+7>>>3)<=i&&(i=s)):i=s=r+5,r+4<=i&&-1!==t?J(e,t,r,n):4===e.strategy||s===i?(P(e,2+(n?1:0),3),K(e,z,C)):(P(e,4+(n?1:0),3),function(e,t,r,n){var i;for(P(e,t-257,5),P(e,r-1,5),P(e,n-4,4),i=0;i<n;i++)P(e,e.bl_tree[2*S[i]+1],3);V(e,e.dyn_ltree,t-1),V(e,e.dyn_dtree,r-1)}(e,e.l_desc.max_code+1,e.d_desc.max_code+1,a+1),K(e,e.dyn_ltree,e.dyn_dtree)),W(e),n&&M(e)},r._tr_tally=function(e,t,r){return e.pending_buf[e.d_buf+2*e.last_lit]=t>>>8&255,e.pending_buf[e.d_buf+2*e.last_lit+1]=255&t,e.pending_buf[e.l_buf+e.last_lit]=255&r,e.last_lit++,0===t?e.dyn_ltree[2*r]++:(e.matches++,t--,e.dyn_ltree[2*(A[r]+u+1)]++,e.dyn_dtree[2*N(t)]++),e.last_lit===e.lit_bufsize-1},r._tr_align=function(e){P(e,2,3),L(e,m,z),function(e){16===e.bi_valid?(U(e,e.bi_buf),e.bi_buf=0,e.bi_valid=0):8<=e.bi_valid&&(e.pending_buf[e.pending++]=255&e.bi_buf,e.bi_buf>>=8,e.bi_valid-=8)}(e)}},{"../utils/common":41}],53:[function(e,t,r){"use strict";t.exports=function(){this.input=null,this.next_in=0,this.avail_in=0,this.total_in=0,this.output=null,this.next_out=0,this.avail_out=0,this.total_out=0,this.msg="",this.state=null,this.data_type=2,this.adler=0}},{}],54:[function(e,t,r){(function(e){!function(r,n){"use strict";if(!r.setImmediate){var i,s,t,a,o=1,h={},u=!1,l=r.document,e=Object.getPrototypeOf&&Object.getPrototypeOf(r);e=e&&e.setTimeout?e:r,i="[object process]"==={}.toString.call(r.process)?function(e){process.nextTick(function(){c(e)})}:function(){if(r.postMessage&&!r.importScripts){var e=!0,t=r.onmessage;return r.onmessage=function(){e=!1},r.postMessage("","*"),r.onmessage=t,e}}()?(a="setImmediate$"+Math.random()+"$",r.addEventListener?r.addEventListener("message",d,!1):r.attachEvent("onmessage",d),function(e){r.postMessage(a+e,"*")}):r.MessageChannel?((t=new MessageChannel).port1.onmessage=function(e){c(e.data)},function(e){t.port2.postMessage(e)}):l&&"onreadystatechange"in l.createElement("script")?(s=l.documentElement,function(e){var t=l.createElement("script");t.onreadystatechange=function(){c(e),t.onreadystatechange=null,s.removeChild(t),t=null},s.appendChild(t)}):function(e){setTimeout(c,0,e)},e.setImmediate=function(e){"function"!=typeof e&&(e=new Function(""+e));for(var t=new Array(arguments.length-1),r=0;r<t.length;r++)t[r]=arguments[r+1];var n={callback:e,args:t};return h[o]=n,i(o),o++},e.clearImmediate=f}function f(e){delete h[e]}function c(e){if(u)setTimeout(c,0,e);else{var t=h[e];if(t){u=!0;try{!function(e){var t=e.callback,r=e.args;switch(r.length){case 0:t();break;case 1:t(r[0]);break;case 2:t(r[0],r[1]);break;case 3:t(r[0],r[1],r[2]);break;default:t.apply(n,r)}}(t)}finally{f(e),u=!1}}}}function d(e){e.source===r&&"string"==typeof e.data&&0===e.data.indexOf(a)&&c(+e.data.slice(a.length))}}("undefined"==typeof self?void 0===e?this:e:self)}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{}]},{},[10])(10)});
