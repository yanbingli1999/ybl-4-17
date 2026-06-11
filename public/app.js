let fitChart = null;
let residualChart = null;
let currentResultId = null;
let currentDatasetId = null;
let isDirty = false;
let currentDesensitizeDatasetId = null;
let allDatasetsCache = [];
let currentPreviewComparison = null;

const modelTypeLabels = {
  linear: '线性模型',
  exponential: '指数模型',
  quadratic: '二次曲线'
};

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.className = `toast ${type} show`;
  toast.textContent = message;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function updateDatasetButtons() {
  const updateBtn = document.getElementById('updateDatasetBtn');
  if (currentDatasetId) {
    updateBtn.style.display = 'block';
    if (isDirty) {
      updateBtn.textContent = '💾 更新当前数据集 *';
    } else {
      updateBtn.textContent = '💾 更新当前数据集';
    }
  } else {
    updateBtn.style.display = 'none';
  }
}

function markDirty() {
  isDirty = true;
  updateDatasetButtons();
}

function clearDirty() {
  isDirty = false;
  updateDatasetButtons();
}

function initCharts() {
  const fitCtx = document.getElementById('fitChart').getContext('2d');
  const residualCtx = document.getElementById('residualChart').getContext('2d');

  fitChart = new Chart(fitCtx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: '原始数据',
          data: [],
          backgroundColor: '#3b82f6',
          borderColor: '#3b82f6',
          pointRadius: 7,
          pointHoverRadius: 9,
          showLine: false
        },
        {
          label: '拟合曲线',
          data: [],
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 3,
          pointRadius: 0,
          showLine: true,
          tension: 0.1,
          fill: false
        },
        {
          label: '异常点',
          data: [],
          backgroundColor: '#f59e0b',
          borderColor: '#d97706',
          pointRadius: 9,
          pointStyle: 'triangle',
          showLine: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          titleFont: { size: 13 },
          bodyFont: { size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const x = context.parsed.x?.toFixed(4) || 0;
              const y = context.parsed.y?.toFixed(4) || 0;
              return `(${x}, ${y})`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          ticks: { font: { size: 12 }, color: '#64748b' },
          title: { display: true, text: 'X 轴', font: { size: 13, weight: '600' }, color: '#475569' }
        },
        y: {
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          ticks: { font: { size: 12 }, color: '#64748b' },
          title: { display: true, text: 'Y 轴', font: { size: 13, weight: '600' }, color: '#475569' }
        }
      }
    }
  });

  residualChart = new Chart(residualCtx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: '残差',
          data: [],
          backgroundColor: '#8b5cf6',
          borderColor: '#8b5cf6',
          pointRadius: 6,
          pointHoverRadius: 8,
          showLine: false
        },
        {
          label: '零参考线',
          data: [],
          borderColor: '#10b981',
          borderWidth: 2,
          borderDash: [8, 4],
          pointRadius: 0,
          showLine: true,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          titleFont: { size: 13 },
          bodyFont: { size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              if (context.datasetIndex === 0) {
                const x = context.parsed.x?.toFixed(4) || 0;
                const y = context.parsed.y?.toFixed(6) || 0;
                return `x=${x}, 残差=${y}`;
              }
              return '';
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          ticks: { font: { size: 12 }, color: '#64748b' },
          title: { display: true, text: 'X 轴', font: { size: 13, weight: '600' }, color: '#475569' }
        },
        y: {
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          ticks: { font: { size: 12 }, color: '#64748b' },
          title: { display: true, text: '残差 (观测值 - 预测值)', font: { size: 13, weight: '600' }, color: '#475569' }
        }
      }
    }
  });
}

function addDataRow(x = '', y = '') {
  const tbody = document.getElementById('dataTableBody');
  const rowIndex = tbody.children.length + 1;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${rowIndex}</td>
    <td><input type="number" step="any" class="x-input" value="${x}" placeholder="X"></td>
    <td><input type="number" step="any" class="y-input" value="${y}" placeholder="Y"></td>
    <td><button class="delete-row-btn" title="删除">✕</button></td>
  `;
  tr.querySelector('.delete-row-btn').addEventListener('click', () => {
    tr.remove();
    updateRowNumbers();
    markDirty();
  });
  tr.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', markDirty);
  });
  tbody.appendChild(tr);
}

function updateRowNumbers() {
  const tbody = document.getElementById('dataTableBody');
  Array.from(tbody.children).forEach((tr, idx) => {
    tr.querySelector('td:first-child').textContent = idx + 1;
  });
}

function clearDataTable() {
  const tbody = document.getElementById('dataTableBody');
  tbody.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    addDataRow();
  }
  document.getElementById('datasetName').value = '我的实验数据';
  document.getElementById('sampleName').value = '';
  document.getElementById('batchNumber').value = '';
  document.getElementById('remarks').value = '';
  currentDatasetId = null;
  currentResultId = null;
  clearDirty();
  resetDisplay();
}

function resetDisplay() {
  document.getElementById('metricR2').textContent = '—';
  document.getElementById('metricMSE').textContent = '—';
  document.getElementById('metricRMSE').textContent = '—';
  document.getElementById('metricMAE').textContent = '—';
  document.getElementById('eqFormula').textContent = '等待拟合...';
  document.getElementById('outliersSection').style.display = 'none';

  if (fitChart) {
    fitChart.data.datasets.forEach(ds => ds.data = []);
    fitChart.update();
  }
  if (residualChart) {
    residualChart.data.datasets.forEach(ds => ds.data = []);
    residualChart.update();
  }
}

function getTableData() {
  const tbody = document.getElementById('dataTableBody');
  const points = [];
  Array.from(tbody.children).forEach(tr => {
    const xInput = tr.querySelector('.x-input');
    const yInput = tr.querySelector('.y-input');
    const x = parseFloat(xInput.value);
    const y = parseFloat(yInput.value);
    if (!isNaN(x) && !isNaN(y)) {
      points.push({ x, y });
    }
  });
  return points;
}

function setTableData(points) {
  const tbody = document.getElementById('dataTableBody');
  tbody.innerHTML = '';
  points.forEach(p => {
    addDataRow(p.x, p.y);
  });
}

function loadSampleData() {
  const samples = [
    { x: 1, y: 2.1 },
    { x: 2, y: 3.8 },
    { x: 3, y: 6.2 },
    { x: 4, y: 7.9 },
    { x: 5, y: 10.3 },
    { x: 6, y: 11.8 },
    { x: 7, y: 14.5 },
    { x: 8, y: 25.0 },
    { x: 9, y: 18.2 },
    { x: 10, y: 20.1 }
  ];
  setTableData(samples);
  document.getElementById('datasetName').value = '示例实验数据';
  document.getElementById('sampleName').value = '样品A-标准溶液';
  document.getElementById('batchNumber').value = 'BATCH-2026-0612-001';
  document.getElementById('remarks').value = '校准曲线实验，室温25℃，湿度60%';
  currentDatasetId = null;
  currentResultId = null;
  resetDisplay();
  clearDirty();
  showToast('已加载示例数据', 'success');
}

async function performFit() {
  const points = getTableData();
  if (points.length < 2) {
    showToast('请至少输入2个有效数据点', 'error');
    return;
  }

  const modelType = document.querySelector('input[name="modelType"]:checked').value;
  const datasetName = document.getElementById('datasetName').value || '未命名数据集';

  const fitBtn = document.getElementById('fitBtn');
  const originalText = fitBtn.textContent;
  fitBtn.textContent = '⏳ 计算中...';
  fitBtn.disabled = true;

  try {
    const res = await fetch('/api/fit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points, modelType, datasetName, datasetId: currentDatasetId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '拟合失败');

    displayFitResult(data);
    currentResultId = data.id;
    showToast('拟合完成！', 'success');
    loadHistory();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    fitBtn.textContent = originalText;
    fitBtn.disabled = false;
  }
}

function displayFitResult(result) {
  document.getElementById('metricR2').textContent = result.metrics.rSquared.toFixed(6);
  document.getElementById('metricMSE').textContent = result.metrics.mse.toFixed(6);
  document.getElementById('metricRMSE').textContent = result.metrics.rmse.toFixed(6);
  document.getElementById('metricMAE').textContent = result.metrics.mae.toFixed(6);
  document.getElementById('eqFormula').textContent = result.modelEquation;

  const normalPoints = [];
  const outlierPoints = [];
  const outlierIndices = new Set(result.outliers.filter(o => o.isOutlier).map(o => o.index));

  result.points.forEach((p, i) => {
    if (outlierIndices.has(i)) {
      outlierPoints.push(p);
    } else {
      normalPoints.push(p);
    }
  });

  fitChart.data.datasets[0].data = normalPoints;
  fitChart.data.datasets[1].data = result.curvePoints;
  fitChart.data.datasets[2].data = outlierPoints;
  fitChart.update();

  const residualData = result.points.map((p, i) => ({
    x: p.x,
    y: result.residuals[i]
  }));

  const xs = result.points.map(p => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const range = maxX - minX || 1;
  const zeroLine = [
    { x: minX - range * 0.1, y: 0 },
    { x: maxX + range * 0.1, y: 0 }
  ];

  residualChart.data.datasets[0].data = residualData;
  residualChart.data.datasets[1].data = zeroLine;
  residualChart.update();

  const outliersSection = document.getElementById('outliersSection');
  const outliersList = document.getElementById('outliersList');
  const actualOutliers = result.outliers.filter(o => o.isOutlier);

  if (actualOutliers.length > 0) {
    outliersSection.style.display = 'block';
    outliersList.innerHTML = actualOutliers.map(o => `
      <span class="outlier-badge">
        #${o.index + 1} (x=${result.points[o.index].x.toFixed(3)}, y=${result.points[o.index].y.toFixed(3)})
        Z=${o.zScore.toFixed(2)}
      </span>
    `).join('');
  } else {
    outliersSection.style.display = 'none';
  }
}

async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const history = await res.json();
    const historyList = document.getElementById('historyList');

    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty-state">暂无历史记录</div>';
      return;
    }

    historyList.innerHTML = history.map(h => `
      <div class="history-item" data-id="${h.id}">
        <div class="history-title">${h.datasetName}</div>
        <span class="history-model">${modelTypeLabels[h.modelType] || h.modelType}</span>
        <div class="history-meta">
          <span>${h.pointsCount} 个点 · R²=${h.metrics.rSquared.toFixed(4)}</span>
          <span>${new Date(h.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="history-actions">
          <button class="btn-load" onclick="loadHistoryItem('${h.id}')">查看</button>
          <button class="btn-delete" onclick="deleteHistoryItem('${h.id}')">删除</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('加载历史失败:', err);
  }
}

async function loadHistoryItem(id) {
  try {
    const res = await fetch(`/api/history/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    document.getElementById('datasetName').value = data.datasetName;
    document.querySelector(`input[name="modelType"][value="${data.modelType}"]`).checked = true;
    setTableData(data.points);
    displayFitResult(data);
    currentResultId = id;
    currentDatasetId = data.datasetId || null;
    clearDirty();
    showToast('已加载历史记录', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteHistoryItem(id) {
  if (!confirm('确定删除这条历史记录吗？')) return;
  try {
    const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('删除失败');
    if (currentResultId === id) {
      currentResultId = null;
    }
    showToast('已删除', 'success');
    loadHistory();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadDatasets() {
  try {
    const res = await fetch('/api/datasets');
    const datasets = await res.json();
    allDatasetsCache = datasets;
    const datasetsList = document.getElementById('datasetsList');

    if (datasets.length === 0) {
      datasetsList.innerHTML = '<div class="empty-state">暂无保存的数据集</div>';
    } else {
      datasetsList.innerHTML = datasets.map(d => `
        <div class="dataset-item" data-id="${d.id}">
          <div class="history-title">${d.name}</div>
          <div class="history-meta">
            <span>${d.points.length} 个点</span>
            <span>${new Date(d.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="history-actions">
            <button class="btn-load" onclick="loadDataset('${d.id}')">加载</button>
            <button class="btn-delete" onclick="deleteDataset('${d.id}')">删除</button>
          </div>
        </div>
      `).join('');
    }

    populateDesensitizeSelect(datasets);
  } catch (err) {
    console.error('加载数据集失败:', err);
  }
}

function populateDesensitizeSelect(datasets) {
  const select = document.getElementById('desensitizeDatasetSelect');
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = '<option value="">-- 请选择数据集 --</option>' +
    datasets.map(d => `<option value="${d.id}">${d.name} (${d.points.length} 点)</option>`).join('');
  if (currentValue && datasets.find(d => d.id === currentValue)) {
    select.value = currentValue;
  }
}

async function saveCurrentDataset() {
  const points = getTableData();
  const name = document.getElementById('datasetName').value || '未命名数据集';
  const sampleName = document.getElementById('sampleName').value;
  const batchNumber = document.getElementById('batchNumber').value;
  const remarks = document.getElementById('remarks').value;

  if (points.length < 2) {
    showToast('请至少输入2个有效数据点', 'error');
    return;
  }

  try {
    const res = await fetch('/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, points, sampleName, batchNumber, remarks })
    });
    if (!res.ok) throw new Error('保存失败');
    const dataset = await res.json();
    currentDatasetId = dataset.id;
    clearDirty();
    showToast('已另存为新数据集', 'success');
    loadDatasets();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function updateCurrentDataset() {
  if (!currentDatasetId) {
    showToast('没有可更新的数据集，请先加载或另存为', 'error');
    return;
  }

  const points = getTableData();
  const name = document.getElementById('datasetName').value || '未命名数据集';
  const sampleName = document.getElementById('sampleName').value;
  const batchNumber = document.getElementById('batchNumber').value;
  const remarks = document.getElementById('remarks').value;

  if (points.length < 2) {
    showToast('请至少输入2个有效数据点', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/datasets/${currentDatasetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, points, sampleName, batchNumber, remarks })
    });
    if (!res.ok) throw new Error('更新失败');
    clearDirty();
    showToast('数据集已更新', 'success');
    loadDatasets();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadDataset(id) {
  try {
    const res = await fetch('/api/datasets');
    const datasets = await res.json();
    const dataset = datasets.find(d => d.id === id);
    if (!dataset) throw new Error('数据集不存在');

    document.getElementById('datasetName').value = dataset.name;
    document.getElementById('sampleName').value = dataset.sampleName || '';
    document.getElementById('batchNumber').value = dataset.batchNumber || '';
    document.getElementById('remarks').value = dataset.remarks || '';
    setTableData(dataset.points);
    currentDatasetId = id;
    currentResultId = null;
    resetDisplay();
    clearDirty();
    showToast('已加载数据集', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteDataset(id) {
  if (!confirm('确定删除这个数据集吗？')) return;
  try {
    const res = await fetch(`/api/datasets/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('删除失败');
    if (currentDatasetId === id) {
      currentDatasetId = null;
      updateDatasetButtons();
    }
    showToast('已删除', 'success');
    loadDatasets();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      document.getElementById('tab-history').style.display = tab === 'history' ? 'block' : 'none';
      document.getElementById('tab-datasets').style.display = tab === 'datasets' ? 'block' : 'none';
      document.getElementById('tab-desensitize').style.display = tab === 'desensitize' ? 'block' : 'none';
      if (tab === 'desensitize') {
        loadSharedCopies();
      }
    });
  });
}

function initEventListeners() {
  document.getElementById('addRowBtn').addEventListener('click', () => {
    addDataRow();
    markDirty();
  });
  document.getElementById('clearDataBtn').addEventListener('click', () => {
    if (confirm('确定清空所有数据吗？')) clearDataTable();
  });
  document.getElementById('loadSampleBtn').addEventListener('click', loadSampleData);
  document.getElementById('fitBtn').addEventListener('click', performFit);
  document.getElementById('saveDatasetBtn').addEventListener('click', saveCurrentDataset);
  document.getElementById('updateDatasetBtn').addEventListener('click', updateCurrentDataset);
  document.getElementById('datasetName').addEventListener('input', markDirty);
  document.getElementById('sampleName').addEventListener('input', markDirty);
  document.getElementById('batchNumber').addEventListener('input', markDirty);
  document.getElementById('remarks').addEventListener('input', markDirty);

  document.getElementById('desensitizeDatasetSelect').addEventListener('change', (e) => {
    handleDatasetSelectForDesensitize(e.target.value);
  });

  document.getElementById('createSharedCopyBtn').addEventListener('click', createSharedCopy);

  document.getElementById('closeSharedCopyModal').addEventListener('click', closeSharedCopyModal);
  document.getElementById('sharedCopyModal').addEventListener('click', (e) => {
    if (e.target.id === 'sharedCopyModal') {
      closeSharedCopyModal();
    }
  });
}

async function handleDatasetSelectForDesensitize(datasetId) {
  currentDesensitizeDatasetId = datasetId || null;
  const previewSection = document.getElementById('desensitizePreview');

  if (!datasetId) {
    previewSection.style.display = 'none';
    currentPreviewComparison = null;
    return;
  }

  const dataset = allDatasetsCache.find(d => d.id === datasetId);
  if (!dataset) {
    previewSection.style.display = 'none';
    currentPreviewComparison = null;
    return;
  }

  let history = [];
  try {
    const res = await fetch('/api/history');
    history = await res.json();
  } catch (err) {
    console.error('获取历史记录失败:', err);
  }
  const comparison = buildFieldComparison(dataset, history);
  currentPreviewComparison = comparison;
  renderFieldComparison(comparison);
  previewSection.style.display = 'block';
}

function buildFieldComparison(dataset, history) {
  const latestFit = history.find(h => h.datasetId === dataset.id) || null;
  const fitSummary = latestFit
    ? `${modelTypeLabels[latestFit.modelType] || latestFit.modelType} · R²=${latestFit.metrics.rSquared.toFixed(4)}`
    : '未拟合';

  return [
    { field: '数据集名称', original: '******（原始名称已脱敏）', desensitized: dataset.anonymousId || '已脱敏', status: 'replaced' },
    { field: '样品名', original: '******（已隐藏）', desensitized: '已隐藏', status: 'hidden' },
    { field: '批次号', original: '******（已隐藏）', desensitized: '已隐藏', status: 'hidden' },
    { field: '备注', original: '******（已隐藏）', desensitized: '已隐藏', status: 'hidden' },
    { field: '匿名编号', original: dataset.anonymousId || '(无)', desensitized: dataset.anonymousId || '保留', status: 'kept' },
    { field: '数据点位', original: `${dataset.points.length} 个点`, desensitized: `${dataset.points.length} 个点`, status: 'kept' },
    { field: '拟合摘要', original: fitSummary, desensitized: fitSummary, status: 'kept' }
  ];
}

function renderFieldComparison(comparison) {
  const table = document.getElementById('fieldComparisonTable');
  const headerRow = `
    <div class="field-comparison-row field-comparison-header">
      <span class="field-name">字段</span>
      <span class="field-original">原始值</span>
      <span class="field-desensitized">脱敏后</span>
    </div>
  `;
  const rows = comparison.map(item => {
    let statusClass = '';
    if (item.status === 'kept') statusClass = 'status-kept';
    else if (item.status === 'hidden') statusClass = 'status-hidden';
    else if (item.status === 'replaced') statusClass = 'status-replaced';

    const statusIcon = item.status === 'kept' ? '✓' : item.status === 'hidden' ? '✕' : '↻';

    return `
      <div class="field-comparison-row">
        <span class="field-name">${item.field}</span>
        <span class="field-original">${item.original}</span>
        <span class="field-desensitized ${statusClass}">${statusIcon} ${item.desensitized}</span>
      </div>
    `;
  }).join('');

  table.innerHTML = headerRow + rows;
}

async function createSharedCopy() {
  if (!currentDesensitizeDatasetId) {
    showToast('请先选择要脱敏的数据集', 'error');
    return;
  }

  const btn = document.getElementById('createSharedCopyBtn');
  const originalText = btn.textContent;
  btn.textContent = '⏳ 生成中...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/shared-copies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetId: currentDesensitizeDatasetId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '生成失败');
    }
    const copy = await res.json();
    showToast(`脱敏副本已生成！匿名编号：${copy.anonymousId}`, 'success');
    loadSharedCopies();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function loadSharedCopies() {
  try {
    const res = await fetch('/api/shared-copies');
    const copies = await res.json();
    const list = document.getElementById('sharedCopiesList');

    if (copies.length === 0) {
      list.innerHTML = '<div class="empty-state">暂无脱敏副本</div>';
      return;
    }

    list.innerHTML = copies.map(c => {
      const fitText = c.fitSummary
        ? `${modelTypeLabels[c.fitSummary.modelType] || c.fitSummary.modelType} · R²=${c.fitSummary.metrics.rSquared.toFixed(4)}`
        : '未拟合';
      return `
        <div class="shared-copy-item">
          <div class="shared-copy-anonymous">${c.anonymousId}</div>
          <span class="shared-copy-badge">只读副本</span>
          <div class="shared-copy-fit">${fitText}</div>
          <div class="shared-copy-meta">
            <span>${c.pointsCount} 个点</span>
            <span>${new Date(c.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="shared-copy-actions">
            <button class="btn-view-copy" onclick="viewSharedCopy('${c.id}')">查看副本</button>
            <button class="btn-delete-copy" onclick="deleteSharedCopy('${c.id}')">删除</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('加载脱敏副本失败:', err);
  }
}

async function viewSharedCopy(id) {
  try {
    const res = await fetch(`/api/shared-copies/${id}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '加载失败');
    }
    const copy = await res.json();
    renderSharedCopyModal(copy);
    document.getElementById('sharedCopyModal').style.display = 'flex';
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderSharedCopyModal(copy) {
  const body = document.getElementById('sharedCopyModalBody');

  const fitSummary = copy.fitSummary ? `
    <div class="readonly-section">
      <h3>📊 拟合摘要</h3>
      <div class="fit-summary-card">
        <div class="fit-equation">${copy.fitSummary.modelEquation}</div>
        <div class="fit-metrics-grid">
          <div class="fit-metric-item">
            <div class="fit-metric-label">R²</div>
            <div class="fit-metric-value">${copy.fitSummary.metrics.rSquared.toFixed(6)}</div>
          </div>
          <div class="fit-metric-item">
            <div class="fit-metric-label">MSE</div>
            <div class="fit-metric-value">${copy.fitSummary.metrics.mse.toFixed(6)}</div>
          </div>
          <div class="fit-metric-item">
            <div class="fit-metric-label">RMSE</div>
            <div class="fit-metric-value">${copy.fitSummary.metrics.rmse.toFixed(6)}</div>
          </div>
          <div class="fit-metric-item">
            <div class="fit-metric-label">MAE</div>
            <div class="fit-metric-value">${copy.fitSummary.metrics.mae.toFixed(6)}</div>
          </div>
        </div>
      </div>
    </div>
  ` : '<div class="readonly-section"><h3>📊 拟合摘要</h3><div class="empty-state">该数据集尚未进行拟合</div></div>';

  const comparisonRows = copy.fieldComparison.map(item => {
    let statusClass = '';
    if (item.status === 'kept') statusClass = 'status-kept';
    else if (item.status === 'hidden') statusClass = 'status-hidden';
    else if (item.status === 'replaced') statusClass = 'status-replaced';

    const statusIcon = item.status === 'kept' ? '✓ 保留' : item.status === 'hidden' ? '✕ 已隐藏' : '↻ 已替换';

    return `
      <div class="field-comparison-row">
        <span class="field-name">${item.field}</span>
        <span class="field-original">${item.original}</span>
        <span class="field-desensitized ${statusClass}">${statusIcon} · ${item.desensitized}</span>
      </div>
    `;
  }).join('');

  const comparisonHeader = `
    <div class="field-comparison-row field-comparison-header">
      <span class="field-name">字段</span>
      <span class="field-original">原始值</span>
      <span class="field-desensitized">脱敏后</span>
    </div>
  `;

  const pointsRows = copy.points.map((p, i) => `
    <tr>
      <td>#${i + 1}</td>
      <td>${p.x}</td>
      <td>${p.y}</td>
    </tr>
  `).join('');

  body.innerHTML = `
    <div class="modal-warning">
      ⚠️ 此为只读脱敏共享副本，样品名、批次号和备注信息已被隐藏或替换。副本独立于原始数据集，不会影响原始数据和历史记录。
    </div>

    <div class="readonly-section">
      <h3>📋 脱敏后信息</h3>
      <div class="readonly-info-grid">
        <div class="readonly-info-item">
          <div class="readonly-info-label">匿名编号</div>
          <div class="readonly-info-value">${copy.anonymousId}</div>
        </div>
        <div class="readonly-info-item">
          <div class="readonly-info-label">只读状态</div>
          <div class="readonly-info-value status-kept">${copy.readOnly ? '✓ 已锁定' : '未锁定'}</div>
        </div>
        <div class="readonly-info-item">
          <div class="readonly-info-label">样品名</div>
          <div class="readonly-info-value hidden-field">已隐藏</div>
        </div>
        <div class="readonly-info-item">
          <div class="readonly-info-label">批次号</div>
          <div class="readonly-info-value hidden-field">已隐藏</div>
        </div>
        <div class="readonly-info-item">
          <div class="readonly-info-label">备注</div>
          <div class="readonly-info-value hidden-field">已隐藏</div>
        </div>
        <div class="readonly-info-item">
          <div class="readonly-info-label">数据点数</div>
          <div class="readonly-info-value">${copy.points.length} 个</div>
        </div>
      </div>
    </div>

    ${fitSummary}

    <div class="readonly-section">
      <h3>🔍 脱敏前后字段对比</h3>
      <div class="field-comparison-table">
        ${comparisonHeader}
        ${comparisonRows}
      </div>
    </div>

    <div class="readonly-section">
      <h3>📈 数据点位（保留）</h3>
      <div class="readonly-table-wrapper">
        <table class="readonly-table">
          <thead>
            <tr>
              <th style="width:60px">#</th>
              <th>X 轴</th>
              <th>Y 轴</th>
            </tr>
          </thead>
          <tbody>
            ${pointsRows}
          </tbody>
        </table>
      </div>
    </div>

    <div class="readonly-section">
      <h3>📝 元信息</h3>
      <div class="readonly-info-grid">
        <div class="readonly-info-item">
          <div class="readonly-info-label">副本ID</div>
          <div class="readonly-info-value" style="font-size:11px">${copy.id}</div>
        </div>
        <div class="readonly-info-item">
          <div class="readonly-info-label">生成时间</div>
          <div class="readonly-info-value">${new Date(copy.createdAt).toLocaleString('zh-CN')}</div>
        </div>
      </div>
    </div>
  `;
}

function closeSharedCopyModal() {
  document.getElementById('sharedCopyModal').style.display = 'none';
}

async function deleteSharedCopy(id) {
  if (!confirm('确定删除这个脱敏副本吗？这不会影响原始数据集。')) return;
  try {
    const res = await fetch(`/api/shared-copies/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('删除失败');
    showToast('脱敏副本已删除', 'success');
    loadSharedCopies();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function init() {
  initCharts();
  initTabs();
  initEventListeners();
  clearDataTable();
  loadHistory();
  loadDatasets();
  loadSharedCopies();
  updateDatasetButtons();
}

document.addEventListener('DOMContentLoaded', init);
