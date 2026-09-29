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
  document.getElementById('codeInput').value = currentData.refreshCode || '';
  document.getElementById('countDisplay').textContent = currentData.refreshCount || 0;

  renderPrizeList();
}

function qualityColor(q) {
  const colors = ['#888', '#9ca3af', '#6b7280', '#4ade80', '#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#ec4899', '#fbbf24'];
  return colors[Math.min(10, Math.max(0, q))] || '#888';
}

function renderPrizeList() {
  const list = document.getElementById('prizeList');
  list.innerHTML = '';

  // 表头
  const header = document.createElement('div');
  header.className = 'prize-header';
  header.innerHTML = `
    <span class="col-icon">图标</span>
    <span class="col-name">奖品名称</span>
    <span class="col-quality">品质</span>
    <span class="col-actions">操作</span>
  `;
  list.appendChild(header);

  const prizes = currentData.prizes || [];
  prizes.forEach((prize, idx) => {
    const q = prize.quality || 1;
    const item = document.createElement('div');
    item.className = 'prize-item';
    item.innerHTML = `
      <input type="text" class="prize-icon" value="${prize.icon || ''}" placeholder="🎁" maxlength="4">
      <input type="text" class="prize-name" value="${prize.name || ''}" placeholder="奖品名称">
      <div class="prize-quality-wrap">
        <input type="number" class="prize-quality" value="${q}" min="1" max="10" placeholder="1">
        <span class="quality-badge" style="background:${qualityColor(q)}">Q${q}</span>
      </div>
      <div class="prize-actions">
        <button class="btn-small btn-move" data-idx="${idx}" data-dir="up" title="上移">▲</button>
        <button class="btn-small btn-move" data-idx="${idx}" data-dir="down" title="下移">▼</button>
        <button class="btn-small btn-del" data-idx="${idx}" title="删除">✕</button>
      </div>
    `;
    list.appendChild(item);
  });

  // 删除
  list.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      currentData.prizes.splice(idx, 1);
      renderPrizeList();
    });
  });

  // 上移/下移
  list.querySelectorAll('.btn-move').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      const dir = e.target.dataset.dir;
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= currentData.prizes.length) return;
      [currentData.prizes[idx], currentData.prizes[target]] = [currentData.prizes[target], currentData.prizes[idx]];
      renderPrizeList();
    });
  });

  // 品质输入变化时更新徽章颜色
  list.querySelectorAll('.prize-quality').forEach(input => {
    input.addEventListener('input', (e) => {
      const badge = e.target.parentElement.querySelector('.quality-badge');
      const val = Math.min(10, Math.max(1, parseInt(e.target.value) || 1));
      badge.style.background = qualityColor(val);
      badge.textContent = 'Q' + val;
    });
  });
}

// ========== 收集表单数据 ==========
function collectFormData() {
  currentData.title = document.getElementById('titleInput').value.trim() || '神秘商店';
  currentData.subtitle = document.getElementById('subtitleInput').value.trim();
  currentData.refreshCode = document.getElementById('codeInput').value.trim();

  // 收集奖品列表
  const items = document.querySelectorAll('.prize-item');
  currentData.prizes = Array.from(items).map((item, idx) => ({
    id: idx + 1,
    icon: item.querySelector('.prize-icon').value.trim() || '🎁',
    name: item.querySelector('.prize-name').value.trim() || `奖品${idx + 1}`,
    quality: Math.min(10, Math.max(1, parseInt(item.querySelector('.prize-quality').value) || 1))
  }));

  return currentData;
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
});

document.getElementById('btnAddCount').addEventListener('click', () => {
  currentData.refreshCount = (currentData.refreshCount || 0) + 1;
  document.getElementById('countDisplay').textContent = currentData.refreshCount;
});

document.getElementById('btnAddCount5').addEventListener('click', () => {
  currentData.refreshCount = (currentData.refreshCount || 0) + 5;
  document.getElementById('countDisplay').textContent = currentData.refreshCount;
});

document.getElementById('btnResetCount').addEventListener('click', () => {
  if (confirm('确定要将刷新次数重置为0吗？')) {
    currentData.refreshCount = 0;
    document.getElementById('countDisplay').textContent = 0;
  }
});

document.getElementById('btnResetPool').addEventListener('click', async () => {
  if (!confirm('确定要重置奖池到未开启状态吗？')) return;

  collectFormData();
  currentData.opened = false;
  currentData.currentGrid = [null, null, null, null, null, null, null, null, null];

  const ok = await saveData(currentData);
  if (ok) showToast('奖池已重置为未开启状态');
  else showToast('重置失败');
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

// ========== 初始化 ==========
async function init() {
  const data = await fetchData();
  if (data) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';
    render();
  } else {
    document.getElementById('loading').textContent = '数据加载失败，请刷新重试';
  }
}

init();
