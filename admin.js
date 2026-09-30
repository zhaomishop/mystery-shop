// ========== 配置 ==========
const _t1 = 'ghp_z41nzQUZn';
const _t2 = 'JaUX399GS9Aeh5';
const _t3 = 'd7oyn1G3Wl47y';
const CONFIG = {
  owner: 'zhaomishop',
  repo: 'mystery-shop',
  branch: 'main',
  token: _t1 + _t2 + _t3
};

let currentData = null;
let fileSha = null;

// 管理员后台密码
const ADMIN_PASSWORD = 'yg666';
const AUTH_KEY = 'mystery_shop_admin_auth';

// 数据迁移：旧格式 refreshCode -> 新格式 refreshCodes 数组
function migrateData(data) {
  if (!data.refreshCodes) {
    if (data.refreshCode) {
      const cnt = data.refreshCount || 0;
      data.refreshCodes = [{ code: data.refreshCode, uses: Math.max(0, 10 - cnt), maxUses: Math.max(0, 10 - cnt) }];
    } else {
      data.refreshCodes = [];
    }
    delete data.refreshCode;
  }
  data.refreshCodes = (data.refreshCodes || []).map(c => ({
    code: c.code || '',
    uses: c.uses != null ? c.uses : (c.maxUses || 0),
    maxUses: c.maxUses != null ? c.maxUses : (c.uses || 0)
  }));
  if (data.refreshCount == null) data.refreshCount = 0;
}

// ========== GitHub API ==========
async function fetchData() {
  try {
    const res = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/data.json`, {
      headers: { 'Authorization': `token ${CONFIG.token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    const json = await res.json();
    if (json.content) {
      const decoded = atob(json.content.replace(/\n/g, ''));
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      currentData = JSON.parse(new TextDecoder('utf-8').decode(bytes));
      fileSha = json.sha;
      migrateData(currentData);
      return currentData;
    }
  } catch (e) {
    console.error('Failed to fetch data:', e);
  }
  return null;
}

async function saveData(data) {
  try {
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const res = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/data.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${CONFIG.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Update lottery admin data',
        content: content,
        sha: fileSha,
        branch: CONFIG.branch
      })
    });
    const json = await res.json();
    if (json.content && json.content.sha) {
      fileSha = json.content.sha;
      currentData = data;
      return true;
    }
  } catch (e) {
    console.error('Failed to save data:', e);
  }
  return false;
}

// ========== 渲染 ==========
function render() {
  if (!currentData) return;

  document.getElementById('titleInput').value = currentData.title || '';
  document.getElementById('subtitleInput').value = currentData.subtitle || '';
  document.getElementById('countDisplay').textContent = currentData.refreshCount || 0;
  document.getElementById('slopeInput').value = currentData.probabilitySlope != null ? Math.round(currentData.probabilitySlope) : 3;

  renderPrizeList();
  renderCodeList();
}

function renderCodeList() {
  const list = document.getElementById('codeList');
  list.innerHTML = '';

  // 表头
  const header = document.createElement('div');
  header.className = 'prize-header';
  header.innerHTML = `
    <span class="col-code">口令</span>
    <span class="col-max">次数</span>
    <span class="col-add">增加次数</span>
    <span class="col-actions">操作</span>
  `;
  list.appendChild(header);

  const codes = currentData.refreshCodes || [];
  codes.forEach((c, idx) => {
    const item = document.createElement('div');
    item.className = 'code-item';
    item.innerHTML = `
      <input type="text" class="code-text" value="${c.code || ''}" placeholder="输入口令">
      <input type="number" class="code-uses" value="${c.uses || 0}" min="0" placeholder="0">
      <div class="code-add-wrap">
        <input type="number" class="code-add-input" min="1" placeholder="+">
        <button class="btn-small btn-add-count" data-idx="${idx}" title="增加">+</button>
      </div>
      <button class="btn-small btn-del" data-idx="${idx}" title="删除">✕</button>
    `;
    list.appendChild(item);
  });

  // 删除口令
  list.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      currentData.refreshCodes.splice(idx, 1);
      renderCodeList();
      autoSave();
    });
  });

  // 增加次数按钮
  list.querySelectorAll('.btn-add-count').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      const addInput = e.target.parentElement.querySelector('.code-add-input');
      const addVal = parseInt(addInput.value) || 0;
      if (addVal > 0) {
        currentData.refreshCodes[idx].uses = (currentData.refreshCodes[idx].uses || 0) + addVal;
        addInput.value = '';
        renderCodeList();
        autoSave();
      }
    });
  });

  // 口令和次数输入失焦自动保存
  list.querySelectorAll('.code-text, .code-uses').forEach(input => {
    input.addEventListener('blur', autoSave);
  });
}

function qualityColor(q) {
  const colors = ['#888', '#9ca3af', '#6b7280', '#4ade80', '#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#ec4899', '#fbbf24'];
  return colors[Math.min(10, Math.max(0, q))] || '#888';
}

// 品质与图标固定映射
function qualityIcon(q) {
  const icons = ['🎁', '🎁', '🎀', '🍀', '💎', '🌟', '💝', '🔮', '👑', '🌈', '🏆'];
  return icons[Math.min(10, Math.max(1, q))] || '🎁';
}

function renderPrizeList() {
  const list = document.getElementById('prizeList');
  list.innerHTML = '';

  const prizes = currentData.prizes || [];
  prizes.forEach((prize, idx) => {
    const q = Math.min(10, Math.max(1, prize.quality || 1));
    const item = document.createElement('div');
    item.className = 'prize-item';
    item.innerHTML = `
      <div class="prize-icon-box" style="background:${qualityColor(q)}33;">
        <span class="prize-icon-fixed">${qualityIcon(q)}</span>
      </div>
      <input type="text" class="prize-name" value="${(prize.name || '').replace(/"/g, '&quot;')}" placeholder="奖品名称">
      <div class="prize-quality-wrap">
        <input type="number" class="prize-quality" value="${q}" min="1" max="10" placeholder="1">
        <span class="quality-badge" style="background:${qualityColor(q)}">Q${q}</span>
      </div>
      <button class="btn-small btn-del" data-idx="${idx}" title="删除">✕</button>
    `;
    list.appendChild(item);
  });

  // 删除
  list.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      currentData.prizes.splice(idx, 1);
      renderPrizeList();
      autoSave();
    });
  });

  // 品质变化：实时更新图标和徽章
  list.querySelectorAll('.prize-quality').forEach(input => {
    input.addEventListener('input', (e) => {
      const val = Math.min(10, Math.max(1, parseInt(e.target.value) || 1));
      const item = e.target.closest('.prize-item');
      const badge = item.querySelector('.quality-badge');
      const iconBox = item.querySelector('.prize-icon-box');
      const iconFixed = item.querySelector('.prize-icon-fixed');
      badge.style.background = qualityColor(val);
      badge.textContent = 'Q' + val;
      iconBox.style.background = qualityColor(val) + '33';
      iconFixed.textContent = qualityIcon(val);
    });
    input.addEventListener('blur', autoSave);
  });

  // 名称输入：失焦自动保存
  list.querySelectorAll('.prize-name').forEach(input => {
    input.addEventListener('blur', autoSave);
  });
}

// ========== 收集表单数据 ==========
function collectFormData() {
  currentData.title = document.getElementById('titleInput').value.trim() || '神秘商店';
  currentData.subtitle = document.getElementById('subtitleInput').value.trim();

  // 中心品质：1~10 整数
  const slopeVal = parseInt(document.getElementById('slopeInput').value);
  currentData.probabilitySlope = isNaN(slopeVal) ? 3 : Math.max(1, Math.min(10, slopeVal));

  // 收集奖品列表（图标由品质自动决定）
  const items = document.querySelectorAll('.prize-item');
  currentData.prizes = Array.from(items).map((item, idx) => {
    const q = Math.min(10, Math.max(1, parseInt(item.querySelector('.prize-quality').value) || 1));
    return {
      id: idx + 1,
      icon: qualityIcon(q),
      name: item.querySelector('.prize-name').value.trim() || `奖品${idx + 1}`,
      quality: q
    };
  });

  // 收集口令列表（次数直接从输入框读取）
  const codeItems = document.querySelectorAll('.code-item');
  currentData.refreshCodes = Array.from(codeItems).map((item) => {
    const code = item.querySelector('.code-text').value.trim();
    const uses = Math.max(0, parseInt(item.querySelector('.code-uses').value) || 0);
    return { code, uses, maxUses: uses };
  }).filter(c => c.code); // 过滤掉空口令

  return currentData;
}

// ========== 自动保存（防抖） ==========
let autoSaveTimer = null;
function autoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    collectFormData();
    const ok = await saveData(currentData);
    if (ok) showToast('已自动保存');
  }, 400);
}

// ========== 事件 ==========
document.getElementById('btnAddPrize').addEventListener('click', () => {
  currentData.prizes.push({
    id: (currentData.prizes.length || 0) + 1,
    name: '新奖品',
    icon: '🎁',
    quality: 1
  });
  renderPrizeList();
  autoSave();
});

// 标题/副标题失焦自动保存
['titleInput', 'subtitleInput', 'slopeInput'].forEach(id => {
  document.getElementById(id).addEventListener('blur', autoSave);
});

// 添加口令
document.getElementById('btnAddCode').addEventListener('click', () => {
  if (!currentData.refreshCodes) currentData.refreshCodes = [];
  currentData.refreshCodes.push({ code: '', uses: 1, maxUses: 1 });
  renderCodeList();
  autoSave();
});

document.getElementById('btnAddCount').addEventListener('click', () => {
  currentData.refreshCount = (currentData.refreshCount || 0) + 1;
  document.getElementById('countDisplay').textContent = currentData.refreshCount;
  autoSave();
});

document.getElementById('btnAddCount5').addEventListener('click', () => {
  currentData.refreshCount = (currentData.refreshCount || 0) + 5;
  document.getElementById('countDisplay').textContent = currentData.refreshCount;
  autoSave();
});

document.getElementById('btnResetCount').addEventListener('click', () => {
  if (confirm('确定要将累计刷新次数清零吗？')) {
    currentData.refreshCount = 0;
    document.getElementById('countDisplay').textContent = 0;
    autoSave();
  }
});

// 重置奖池：九宫格恢复未开启 + 刷新次数清零（不影响口令）
document.getElementById('btnResetPool').addEventListener('click', async () => {
  if (!confirm('确定要重置奖池吗？\n\n九宫格将恢复未开启状态，\n累计刷新次数清零。\n（口令次数不受影响）')) return;

  collectFormData();
  currentData.opened = false;
  currentData.currentGrid = [null, null, null, null, null, null, null, null, null];
  currentData.refreshCount = 0;

  const ok = await saveData(currentData);
  if (ok) {
    showToast('奖池已重置');
    render();
  } else {
    showToast('重置失败');
  }
});

document.getElementById('btnSave').addEventListener('click', async () => {
  collectFormData();
  const ok = await saveData(currentData);
  if (ok) showToast('保存成功！');
  else showToast('保存失败，请重试');
});

// ========== Toast ==========
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ========== 登录验证 ==========
function isAuthed() {
  return sessionStorage.getItem(AUTH_KEY) === '1';
}

function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminContent').style.display = 'none';
  document.getElementById('loading').style.display = 'none';
}

function hideLogin() {
  document.getElementById('loginScreen').style.display = 'none';
}

function handleLogin() {
  const input = document.getElementById('adminPassword');
  const err = document.getElementById('loginError');
  if (input.value === ADMIN_PASSWORD) {
    sessionStorage.setItem(AUTH_KEY, '1');
    err.textContent = '';
    hideLogin();
    enterAdmin();
  } else {
    err.textContent = '密码错误，请重试';
    input.value = '';
    input.focus();
  }
}

function handleLogout() {
  sessionStorage.removeItem(AUTH_KEY);
  showLogin();
  document.getElementById('adminPassword').value = '';
}

// ========== 初始化 ==========
async function enterAdmin() {
  document.getElementById('loading').style.display = 'block';
  const data = await fetchData();
  document.getElementById('loading').style.display = 'none';
  if (data) {
    document.getElementById('adminContent').style.display = 'block';
    render();
  } else {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('loading').textContent = '数据加载失败，请刷新重试';
  }
}

async function init() {
  // 绑定登录事件
  document.getElementById('btnLogin').addEventListener('click', handleLogin);
  document.getElementById('adminPassword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('btnLogout').addEventListener('click', handleLogout);

  if (isAuthed()) {
    hideLogin();
    enterAdmin();
  } else {
    showLogin();
  }
}

init();
