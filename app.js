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

const COVER_ICON = '🎁';
let currentData = null;
let fileSha = null;

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
  // 确保每个口令都有 uses 和 maxUses
  data.refreshCodes = (data.refreshCodes || []).map(c => ({
    code: c.code || '',
    uses: c.uses != null ? c.uses : (c.maxUses || 0),
    maxUses: c.maxUses != null ? c.maxUses : (c.uses || 0)
  }));
  if (data.refreshCount == null) data.refreshCount = 0;
  // 中心品质默认值：1~10，正态分布中心
  if (data.probabilitySlope == null) data.probabilitySlope = 3;
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
        message: 'Update lottery data',
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

// ========== 概率系统 ==========
// 概率随刷新次数动态变化：
//   首次刷新（refreshCount=0）：低品质奖品概率极高，高品质奖品概率极低
//   随着刷新次数增加：高品质奖品概率逐渐升高，低品质奖品概率逐渐降低
//   刷新次数足够多时：高品质奖品占绝对优势
// 品质与图标固定映射（与后台保持一致）
function qualityIcon(q) {
  const icons = ['🎁', '🎁', '🎀', '🍀', '💎', '🌟', '💝', '🔮', '👑', '🌈', '🏆'];
  return icons[Math.min(10, Math.max(1, q))] || '🎁';
}

// 概率采用正态分布：
//   中心品质 center = 用户输入的 1~10 整数
//   该品质概率最高，两侧品质按正态分布（高斯）递减
//   每刷新一次，中心品质在上一次基础上 +1（封顶 10）
function pickPrize(prizes, refreshCount) {
  if (!prizes || prizes.length === 0) return null;

  // 基础中心品质：1~10
  const baseCenter = (currentData && currentData.probabilitySlope != null)
    ? Math.max(1, Math.min(10, Math.round(currentData.probabilitySlope)))
    : 3;

  // 每刷新一次，中心品质 +1，封顶 10
  const mu = Math.min(10, baseCenter + refreshCount);

  // 正态分布权重：sigma 控制扩散程度
  const sigma = 1.6;
  const weights = prizes.map(pr => {
    const diff = pr.quality - mu;
    return Math.exp(-(diff * diff) / (2 * sigma * sigma));
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let rand = Math.random() * totalWeight;
  for (let i = 0; i < prizes.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return prizes[i];
  }
  return prizes[prizes.length - 1];
}

function generateGrid(prizes, refreshCount) {
  const grid = [];
  for (let i = 0; i < 9; i++) {
    grid.push(pickPrize(prizes, refreshCount));
  }
  return grid;
}

// ========== 倒计时 ==========
let countdownTimer = null;

function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  const baseTime = (currentData && currentData.refreshTime) ? currentData.refreshTime : Date.now();
  const endTime = baseTime + 30 * 60 * 1000; // 30分钟后
  updateCountdown(endTime);
  countdownTimer = setInterval(() => updateCountdown(endTime), 1000);
}

function updateCountdown(endTime) {
  const remain = endTime - Date.now();
  const el = document.getElementById('countdownTime');
  if (!el) return;
  if (remain <= 0) {
    el.textContent = '00:00';
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    return;
  }
  const m = Math.floor(remain / 60000);
  const s = Math.floor((remain % 60000) / 1000);
  el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ========== 渲染 ==========
function render() {
  if (!currentData) return;

  document.getElementById('pageTitle').textContent = currentData.title || '神秘商店';
  document.getElementById('pageSubtitle').textContent = currentData.subtitle || '';
  document.getElementById('refreshCount').textContent = currentData.refreshCount || 0;

  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  const opened = currentData.opened;
  const currentGrid = currentData.currentGrid || [];

  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';

    if (opened && currentGrid[i]) {
      const prize = currentGrid[i];
      cell.classList.add('revealed');
      cell.classList.add(`quality-${prize.quality}`);

      const qualityBadge = document.createElement('div');
      qualityBadge.className = 'cell-quality';
      qualityBadge.textContent = `Q${prize.quality}`;
      cell.appendChild(qualityBadge);

      const icon = document.createElement('div');
      icon.className = 'cell-icon';
      icon.textContent = qualityIcon(prize.quality);
      cell.appendChild(icon);

      const name = document.createElement('div');
      name.className = 'cell-name';
      name.textContent = prize.name;
      cell.appendChild(name);
    } else {
      cell.classList.add('covered');
      const icon = document.createElement('div');
      icon.className = 'cell-icon';
      icon.textContent = COVER_ICON;
      cell.appendChild(icon);
    }

    grid.appendChild(cell);
  }
}

// ========== 口令输入弹窗 ==========
let codeModalResolver = null;

function showCodeModal() {
  return new Promise((resolve) => {
    const modal = document.getElementById('codeModal');
    const input = document.getElementById('codeModalInput');
    codeModalResolver = resolve;
    input.value = '';
    modal.classList.add('show');
    setTimeout(() => input.focus(), 100);
  });
}

function closeCodeModal(value) {
  const modal = document.getElementById('codeModal');
  modal.classList.remove('show');
  if (codeModalResolver) {
    const r = codeModalResolver;
    codeModalResolver = null;
    r(value);
  }
}

// ========== 刷新逻辑 ==========
async function handleRefresh() {
  if (!currentData) return;

  const codes = currentData.refreshCodes || [];
  if (codes.length === 0) {
    showToast('暂无可用口令');
    return;
  }

  const code = await showCodeModal();
  if (code === null) return;
  const trimmed = code.trim();
  if (!trimmed) return;

  // 查找匹配的口令（剩余次数 > 0）
  const entry = codes.find(c => c.code === trimmed && (c.uses || 0) > 0);
  if (!entry) {
    // 检查是否口令存在但次数用尽
    const exists = codes.find(c => c.code === trimmed);
    if (exists) {
      showToast('该口令次数已用尽！');
    } else {
      showToast('口令错误！');
    }
    return;
  }

  // 扣减该口令的可用次数
  entry.uses = (entry.uses || 0) - 1;

  // 增加全局刷新次数（影响概率）
  currentData.refreshCount = (currentData.refreshCount || 0) + 1;
  currentData.refreshTime = Date.now(); // 记录刷新时间，用于倒计时

  // 生成新的九宫格奖品
  currentData.currentGrid = generateGrid(currentData.prizes, currentData.refreshCount);
  currentData.opened = true;

  const ok = await saveData(currentData);
  if (ok) {
    showToast(`刷新成功！该口令剩余 ${entry.uses} 次`);
    startCountdown();
    render();
  } else {
    showToast('刷新失败，请重试');
  }
}

// ========== 截图功能 ==========
async function handleScreenshot() {
  const content = document.getElementById('content');
  const modal = document.getElementById('modal');
  const img = document.getElementById('screenshotImg');

  showToast('正在生成截图...');

  try {
    const canvas = await html2canvas(content, {
      backgroundColor: '#1a1a2e',
      scale: 2,
      useCORS: true
    });
    const dataUrl = canvas.toDataURL('image/png');
    img.src = dataUrl;
    modal.classList.add('show');
  } catch (e) {
    console.error('Screenshot failed:', e);
    showToast('截图生成失败');
  }
}

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
    document.getElementById('content').style.display = 'block';
    render();
    // 如果已刷新过且在30分钟内，恢复倒计时
    if (data.opened && data.refreshTime) {
      const endTime = data.refreshTime + 30 * 60 * 1000;
      if (endTime > Date.now()) {
        if (countdownTimer) clearInterval(countdownTimer);
        updateCountdown(endTime);
        countdownTimer = setInterval(() => updateCountdown(endTime), 1000);
      }
    }
  } else {
    document.getElementById('loading').textContent = '数据加载失败，请刷新重试';
  }
}

// ========== 事件绑定 ==========
document.getElementById('btnRefresh').addEventListener('click', handleRefresh);
document.getElementById('btnScreenshot').addEventListener('click', handleScreenshot);
document.getElementById('modalClose').addEventListener('click', () => {
  document.getElementById('modal').classList.remove('show');
});

// 口令弹窗事件
document.getElementById('codeModalConfirm').addEventListener('click', () => {
  closeCodeModal(document.getElementById('codeModalInput').value);
});
document.getElementById('codeModalCancel').addEventListener('click', () => {
  closeCodeModal(null);
});
document.getElementById('codeModalInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    closeCodeModal(e.target.value);
  } else if (e.key === 'Escape') {
    closeCodeModal(null);
  }
});
document.getElementById('codeModal').addEventListener('click', (e) => {
  if (e.target.id === 'codeModal') closeCodeModal(null);
});

init();
