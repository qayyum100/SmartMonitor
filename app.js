// ===== STATE & LOCAL STORAGE =====
const STORAGE_KEY = 'smart_alert_data';

let state = {
  settings: {
    emailjsService: 'service_czx54o2',
    emailjsTemplate: '',
    emailjsPublicKey: 'V3Di-GuW2o-XDsymw',
    alertEmail: '',
    warnDays: 7,
    criticalDays: 2,
    cameraInterval: 5,
    dailyTime: '08:00',
    browserNotif: true,
    emailNotif: true,
    sound: false
  },
  monitors: {
    camera: { expiryDate: '' },
    recharge: { expiryDate: '' },
    insurance: { expiryDate: '' }
  },
  customMonitors: [], // { id, name, iconColor, expiryDate }
  history: [] // { id, type, title, message, level, time }
};

// Initialize app
function init() {
  // Check login
  if (sessionStorage.getItem('isLoggedIn') === 'true') {
    document.getElementById('login-screen').classList.add('hidden');
  }

  loadData();
  setupUI();
  updateDashboard();
  
  // Update countdowns every second
  setInterval(() => {
    updateDashboard();
  }, 1000);
  
  requestNotificationPermission();
  
  // Initialize EmailJS
  if (state.settings.emailjsPublicKey) {
    emailjs.init(state.settings.emailjsPublicKey);
  }
}

function checkLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pw = document.getElementById('login-password').value;
  
  // Simple check - replace with real auth logic for production backend
  if ((email === 'admin@example.com' && pw === 'admin') || (pw === '1234')) {
    sessionStorage.setItem('isLoggedIn', 'true');
    document.getElementById('login-screen').classList.add('hidden');
  } else {
    showToast('Access Denied', 'Incorrect email or password', 'error');
  }
}

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Merge with default state
      state.settings = { ...state.settings, ...parsed.settings };
      state.monitors = { ...state.monitors, ...parsed.monitors };
      state.customMonitors = parsed.customMonitors || [];
      state.history = parsed.history || [];
    } catch (e) {
      console.error('Error loading data', e);
    }
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ===== UI LOGIC =====

function switchTab(tabId) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.nav-tab[data-tab="${tabId}"]`).classList.add('active');
  
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`tab-${tabId}`).classList.add('active');
  
  if (tabId === 'history') renderHistory();
}

function setupUI() {
  // Populate settings
  document.getElementById('emailjs-service').value = state.settings.emailjsService;
  document.getElementById('emailjs-template').value = state.settings.emailjsTemplate;
  document.getElementById('emailjs-public-key').value = state.settings.emailjsPublicKey;
  document.getElementById('alert-email').value = state.settings.alertEmail;
  
  document.getElementById('warn-days').value = state.settings.warnDays;
  document.getElementById('critical-days').value = state.settings.criticalDays;
  document.getElementById('camera-check-interval').value = state.settings.cameraInterval;
  document.getElementById('daily-check-time').value = state.settings.dailyTime;
  
  document.getElementById('toggle-browser-notif').checked = state.settings.browserNotif;
  document.getElementById('toggle-email-notif').checked = state.settings.emailNotif;
  document.getElementById('toggle-sound').checked = state.settings.sound;
  
  renderAlertLog();
}

function updateDashboard() {
  let active = 0, warn = 0, danger = 0;

  // BASE MONITORS (camera, recharge, insurance)
  ['camera', 'recharge', 'insurance'].forEach(type => {
    if (state.monitors[type].expiryDate) {
      active++;
      document.getElementById(`${type}-expiry-display`).textContent = new Date(state.monitors[type].expiryDate).toLocaleString();
      
      const status = calculateExpiryStatus(state.monitors[type].expiryDate);
      updateCardUI(type, status);
      if (status.level === 'danger') danger++;
      else if (status.level === 'warning') warn++;
    }
  });

  // CUSTOM MONITORS
  renderCustomMonitors();
  state.customMonitors.forEach(monitor => {
    if (monitor.expiryDate) {
      active++;
      const status = calculateExpiryStatus(monitor.expiryDate);
      updateCardUI(`custom-${monitor.id}`, status);
      if (status.level === 'danger') danger++;
      else if (status.level === 'warning') warn++;
    }
  });

  // Stats
  document.getElementById('active-count').textContent = active;
  document.getElementById('warn-count').textContent = warn;
  document.getElementById('danger-count').textContent = danger;
}

function renderCustomMonitors() {
  const grid = document.getElementById('cards-grid');
  // Remove existing custom cards
  document.querySelectorAll('.monitor-card.custom').forEach(c => c.remove());
  
  state.customMonitors.forEach(monitor => {
    const cardHTML = `
      <div class="monitor-card custom" id="card-custom-${monitor.id}">
        <div class="card-glow" style="background: ${monitor.iconColor || 'var(--purple-glow)'}"></div>
        <div class="card-header">
          <div class="card-icon-wrap" style="background: ${monitor.iconColor || 'rgba(167,139,250,0.15)'}; color: ${monitor.iconColor ? '#fff' : 'var(--purple)'}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div class="card-title-block">
            <h2 class="card-title">${monitor.name}</h2>
            <p class="card-sub">Custom Expiry Monitor</p>
          </div>
          <div class="card-status-badge" id="custom-${monitor.id}-badge">
            <span class="pulse-dot" id="custom-${monitor.id}-pulse"></span>
            <span id="custom-${monitor.id}-status-text">Not Set</span>
          </div>
        </div>

        <div class="card-body">
          <div class="info-row">
            <span class="info-label">Expiry Date</span>
            <span class="info-value" id="custom-${monitor.id}-expiry-display">${new Date(monitor.expiryDate).toLocaleString()}</span>
          </div>
          <div class="countdown-block">
            <div class="countdown-label">Time Remaining</div>
            <div class="countdown-timer">
              <div class="time-unit"><span class="time-num" id="custom-${monitor.id}-days">--</span><span class="time-lbl">Days</span></div>
              <div class="time-sep">:</div>
              <div class="time-unit"><span class="time-num" id="custom-${monitor.id}-hours">--</span><span class="time-lbl">Hours</span></div>
              <div class="time-sep">:</div>
              <div class="time-unit"><span class="time-num" id="custom-${monitor.id}-mins">--</span><span class="time-lbl">Mins</span></div>
              <div class="time-sep">:</div>
              <div class="time-unit"><span class="time-num" id="custom-${monitor.id}-secs">--</span><span class="time-lbl">Secs</span></div>
            </div>
          </div>
          <div class="progress-wrap">
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" id="custom-${monitor.id}-progress" style="width:0%; background: linear-gradient(90deg, ${monitor.iconColor || 'var(--purple)'}, #fff);"></div>
            </div>
            <span class="progress-label" id="custom-${monitor.id}-progress-label">0% elapsed</span>
          </div>
        </div>

        <div class="card-footer">
          <button class="btn-ghost danger" onclick="deleteCustomMonitor('${monitor.id}')">Delete</button>
          <button class="btn-secondary" onclick="sendTestAlert('custom-${monitor.name}')">Test</button>
          <button class="btn-primary" onclick="openEditModal('custom', '${monitor.id}')">Configure</button>
        </div>
      </div>
    `;
    grid.insertAdjacentHTML('beforeend', cardHTML);
  });
}

// ===== MONITORING LOGIC =====

function calculateExpiryStatus(expiryDate) {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  let level = 'ok';
  let text = 'Active';
  
  if (diffDays <= 0) {
    level = 'danger';
    text = 'Expired';
  } else if (diffDays <= state.settings.criticalDays) {
    level = 'danger';
    text = `Expires in ${diffDays}d`;
  } else if (diffDays <= state.settings.warnDays) {
    level = 'warning';
    text = `Expires in ${diffDays}d`;
  }
  
  return { level, text, diffDays, diffTime };
}

function updateCardUI(type, status) {
  const card = document.getElementById(`card-${type}`);
  const badge = document.getElementById(`${type}-badge`);
  const pulse = document.getElementById(`${type}-pulse`);
  const statusText = document.getElementById(`${type}-status-text`);
  
  if(card) card.className = `monitor-card state-${status.level} ${type.startsWith('custom') ? 'custom' : ''}`;
  if(pulse) pulse.className = `pulse-dot ${status.level}`;
  if(statusText) statusText.textContent = status.text;
  
  updateCountdown(type, status.diffTime);
}

function updateCountdown(type, diffTime) {
  const isCustom = type.startsWith('custom-');
  const pre = isCustom ? type : type[0];
  
  if (diffTime <= 0) {
    if(document.getElementById(`${pre}-days`)) {
      document.getElementById(`${pre}-days`).textContent = '00';
      document.getElementById(`${pre}-hours`).textContent = '00';
      document.getElementById(`${pre}-mins`).textContent = '00';
      document.getElementById(`${pre}-secs`).textContent = '00';
      document.getElementById(`${type}-progress`).style.width = '100%';
      document.getElementById(`${type}-progress-label`).textContent = '100% elapsed';
    }
    return;
  }
  
  const d = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const h = Math.floor((diffTime / (1000 * 60 * 60)) % 24);
  const m = Math.floor((diffTime / 1000 / 60) % 60);
  const s = Math.floor((diffTime / 1000) % 60);
  
  if(document.getElementById(`${pre}-days`)) {
    document.getElementById(`${pre}-days`).textContent = d.toString().padStart(2, '0');
    document.getElementById(`${pre}-hours`).textContent = h.toString().padStart(2, '0');
    document.getElementById(`${pre}-mins`).textContent = m.toString().padStart(2, '0');
    document.getElementById(`${pre}-secs`).textContent = s.toString().padStart(2, '0');
    
    // Progress logic
    const totalDays = 365; // Arbitrary 1 year max for progress visual
    let percent = ((totalDays - d) / totalDays) * 100;
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;
    
    document.getElementById(`${type}-progress`).style.width = `${percent}%`;
    document.getElementById(`${type}-progress-label`).textContent = `${Math.round(percent)}% elapsed`;
  }
}

function sendTestAlert(type) {
  triggerAlert(type, `Test Alert: ${type.toUpperCase()}`, `This is a test alert for your ${type} monitor.`, 'info');
}

// ===== ALERTS & NOTIFICATIONS =====

function triggerAlert(type, title, message, level = 'warning') {
  const alertEntry = {
    id: Date.now().toString(),
    type, title, message, level,
    time: new Date().toISOString()
  };
  state.history.unshift(alertEntry);
  if (state.history.length > 100) state.history.pop();
  saveData();
  
  renderAlertLog();
  if (document.getElementById('tab-history').classList.contains('active')) renderHistory();
  
  const badge = document.getElementById('notif-badge');
  badge.textContent = parseInt(badge.textContent) + 1;
  badge.style.display = 'flex';
  
  showToast(title, message, level);
  playAlertSound(level);
  
  if (state.settings.browserNotif) sendBrowserNotification(title, message);
  if (state.settings.emailNotif && state.settings.alertEmail && level === 'danger') {
    sendEmailAlert(type, title, message);
  }
}

// ===== EMAILJS INTEGRATION =====

function sendEmailAlert(type, title, message) {
  const { emailjsService, emailjsTemplate, emailjsPublicKey, alertEmail } = state.settings;
  if (!emailjsService || !emailjsTemplate || !emailjsPublicKey || !alertEmail) return;
  
  const templateParams = {
    alert_type: type.toUpperCase(),
    message: message,
    time: new Date().toLocaleString(),
    to_email: alertEmail
  };
  emailjs.send(emailjsService, emailjsTemplate, templateParams);
}

function saveEmailSettings() {
  state.settings.emailjsService = document.getElementById('emailjs-service').value.trim();
  state.settings.emailjsTemplate = document.getElementById('emailjs-template').value.trim();
  state.settings.emailjsPublicKey = document.getElementById('emailjs-public-key').value.trim();
  state.settings.alertEmail = document.getElementById('alert-email').value.trim();
  saveData();
  if (state.settings.emailjsPublicKey) emailjs.init(state.settings.emailjsPublicKey);
  showToast('Settings Saved', 'Email configuration updated.', 'success');
}

function testEmailNow() {
  saveEmailSettings();
  sendEmailAlert('test', 'Test Alert from SmartAlert', 'This is a test message to verify your EmailJS configuration is working correctly.');
  showToast('Test Sent', 'Email sent to your address.', 'info');
}

function saveThresholdSettings() {
  state.settings.warnDays = parseInt(document.getElementById('warn-days').value) || 7;
  state.settings.criticalDays = parseInt(document.getElementById('critical-days').value) || 2;
  state.settings.cameraInterval = parseInt(document.getElementById('camera-check-interval').value) || 5;
  state.settings.dailyTime = document.getElementById('daily-check-time').value || '08:00';
  state.settings.browserNotif = document.getElementById('toggle-browser-notif').checked;
  state.settings.emailNotif = document.getElementById('toggle-email-notif').checked;
  state.settings.sound = document.getElementById('toggle-sound').checked;
  
  saveData();
  updateDashboard(); 
  showToast('Settings Saved', 'Alert thresholds updated.', 'success');
}

// ===== BROWSER NOTIFICATIONS =====

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

function toggleNotifications() {
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      showToast('Notifications Enabled', 'Browser push notifications are active.', 'success');
    } else {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') showToast('Permission Granted', 'You will now receive push alerts.', 'success');
      });
    }
  }
  document.getElementById('notif-badge').style.display = 'none';
  document.getElementById('notif-badge').textContent = '0';
}

function toggleBrowserNotif(checkbox) {
  if (checkbox.checked) requestNotificationPermission();
}

function sendBrowserNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' }); 
  }
}

function playAlertSound(level) {
  if (!state.settings.sound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = level === 'danger' ? 'square' : 'sine';
    osc.frequency.value = level === 'danger' ? 440 : 880;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
    osc.stop(ctx.currentTime + 0.5);
  } catch(e) {}
}

// ===== MODAL LOGIC =====

let currentEditType = null;
let currentEditId = null;

function openEditModal(type, id = null) {
  currentEditType = type;
  currentEditId = id;
  const modalBody = document.getElementById('modal-body');
  const title = document.getElementById('modal-title');
  
  let val = '';
  if (type === 'camera') val = state.monitors.camera.expiryDate;
  else if (type === 'recharge') val = state.monitors.recharge.expiryDate;
  else if (type === 'insurance') val = state.monitors.insurance.expiryDate;
  else if (type === 'custom') {
    const mon = state.customMonitors.find(m => m.id === id);
    if(mon) val = mon.expiryDate;
  }
  
  // Format for datetime-local
  if(val && !val.includes('T') && val.includes(':')) {
    // try to convert to datetime local format
    try {
      val = new Date(val).toISOString().slice(0, 16);
    } catch(e){}
  } else if (val && val.endsWith('Z')) {
      val = val.slice(0, 16);
  }

  title.textContent = 'Set Expiry Date & Time';
  modalBody.innerHTML = `
    <div class="form-group">
      <label>Date & Time</label>
      <input type="datetime-local" id="edit-date" value="${val}" />
    </div>
  `;
  
  document.getElementById('modal-overlay').classList.add('open');
}

function openAddMonitorModal() {
  currentEditType = 'new_custom';
  const modalBody = document.getElementById('modal-body');
  const title = document.getElementById('modal-title');
  
  title.textContent = 'Add New Monitor';
  modalBody.innerHTML = `
    <div class="form-group" style="margin-bottom:12px;">
      <label>Monitor Name</label>
      <input type="text" id="new-mon-name" placeholder="e.g. Car Insurance" />
    </div>
    <div class="form-group" style="margin-bottom:12px;">
      <label>Color Tag</label>
      <input type="color" id="new-mon-color" value="#a78bfa" style="height:40px; padding:2px;" />
    </div>
    <div class="form-group">
      <label>Expiry Date & Time</label>
      <input type="datetime-local" id="new-mon-date" />
    </div>
  `;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeEditModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  currentEditType = null;
  currentEditId = null;
}

function closeModal(e) {
  if (e.target.id === 'modal-overlay') closeEditModal();
}

function saveModalData() {
  if (currentEditType === 'camera') {
    state.monitors.camera.expiryDate = document.getElementById('edit-date').value;
  } else if (currentEditType === 'recharge') {
    state.monitors.recharge.expiryDate = document.getElementById('edit-date').value;
  } else if (currentEditType === 'insurance') {
    state.monitors.insurance.expiryDate = document.getElementById('edit-date').value;
  } else if (currentEditType === 'custom') {
    const mon = state.customMonitors.find(m => m.id === currentEditId);
    if(mon) mon.expiryDate = document.getElementById('edit-date').value;
  } else if (currentEditType === 'new_custom') {
    const name = document.getElementById('new-mon-name').value.trim();
    if(!name) return showToast('Error', 'Name is required', 'error');
    const color = document.getElementById('new-mon-color').value;
    const date = document.getElementById('new-mon-date').value;
    
    state.customMonitors.push({
      id: Date.now().toString(),
      name,
      iconColor: color,
      expiryDate: date
    });
  }
  
  saveData();
  updateDashboard();
  closeEditModal();
  showToast('Saved', 'Monitor updated successfully.', 'success');
}

function deleteCustomMonitor(id) {
  if(confirm('Are you sure you want to delete this monitor?')) {
    state.customMonitors = state.customMonitors.filter(m => m.id !== id);
    saveData();
    updateDashboard();
    showToast('Deleted', 'Monitor removed.', 'info');
  }
}

// ===== HISTORY LOGS & TOASTS =====

function renderAlertLog() {
  const logContainer = document.getElementById('alert-log');
  if (state.history.length === 0) {
    logContainer.innerHTML = `
      <div class="empty-log">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <p>No alerts yet — all systems normal.</p>
      </div>`;
    return;
  }
  
  const html = state.history.slice(0, 5).map(item => `
    <div class="alert-item">
      <div class="alert-dot ${item.level}"></div>
      <div class="alert-text">
        <div style="display:flex; justify-content:space-between;">
          <strong>${item.title}</strong>
          <span class="alert-type-tag tag-${item.type}">${item.type}</span>
        </div>
        <div style="margin-top:2px; color:var(--text-muted);">${item.message}</div>
        <div class="alert-time">${new Date(item.time).toLocaleString()}</div>
      </div>
    </div>
  `).join('');
  
  logContainer.innerHTML = html;
}

function renderHistory(filter = 'all') {
  const container = document.getElementById('history-list');
  const filtered = filter === 'all' ? state.history : state.history.filter(h => h.type.includes(filter));
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-log">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <p>No alert history found.</p>
      </div>`;
    return;
  }
  
  const html = filtered.map(item => `
    <div class="history-item">
      <div class="history-icon" style="background:var(--surface); border:1px solid var(--border)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
      </div>
      <div class="history-info">
        <div class="history-title" style="color: var(--${item.level === 'danger' ? 'red' : item.level === 'warning' ? 'orange' : 'text'})">${item.title}</div>
        <div style="font-size:0.8rem; margin-bottom:4px;">${item.message}</div>
        <div class="history-meta">${new Date(item.time).toLocaleString()} • ${item.level.toUpperCase()}</div>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = html;
}

function filterHistory(type, btn) {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderHistory(type);
}

function clearAlertLog() {
  document.getElementById('alert-log').innerHTML = '<div class="empty-log"><p>Cleared from dashboard view.</p></div>';
}

function clearHistory() {
  if (confirm('Are you sure you want to delete all alert history?')) {
    state.history = [];
    saveData();
    renderAlertLog();
    renderHistory();
    showToast('History Cleared', 'All past alerts have been removed.', 'info');
  }
}

function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  let iconHtml = '';
  if (type === 'success') iconHtml = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>';
  else if (type === 'error' || type === 'danger') iconHtml = '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>';
  else if (type === 'warning') iconHtml = '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>';
  else iconHtml = '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>';

  toast.innerHTML = `
    <div class="toast-icon ${type === 'danger' ? 'error' : type}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${iconHtml}</svg>
    </div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${message}</div>
    </div>
  `;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

document.addEventListener('DOMContentLoaded', init);
