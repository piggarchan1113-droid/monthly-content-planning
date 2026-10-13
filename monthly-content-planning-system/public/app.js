const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const colors = ['#6d4aff', '#e879a8', '#f3a84f', '#28a88b', '#5686ed', '#9b71d1'];
let records = [];

function addRow(data = {}) {
  const fragment = $('#rowTemplate').content.cloneNode(true);
  const row = fragment.querySelector('.planning-row');
  $('.category', row).value = data.category || '';
  $('.ratio', row).value = data.ratio ?? '';
  $('.note', row).value = data.note || '';
  $('.remove-row', row).addEventListener('click', () => { row.remove(); updateTotal(); });
  $$('.ratio', row).forEach(input => input.addEventListener('input', updateTotal));
  $('#rows').append(row);
}

function updateTotal() {
  const total = $$('.ratio').reduce((sum, el) => sum + (Number(el.value) || 0), 0);
  $('#totalRatio').textContent = `${total.toFixed(1).replace('.0', '')}%`;
  $('#totalHint').textContent = total > 100 ? '已超过 100%' : `还可以规划 ${(100 - total).toFixed(1).replace('.0', '')}%`;
  $('#totalHint').style.color = total > 100 ? 'var(--red)' : 'var(--green)';
}

function getFormData() {
  return { month: $('#month').value, group: $('#group').value, planner: $('#planner').value, items: $$('.planning-row').map(row => ({ category: $('.category', row).value, ratio: $('.ratio', row).value === '' ? null : Number($('.ratio', row).value), note: $('.note', row).value })).filter(item => item.category || item.note) };
}

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '请求失败');
  return data;
}

function message(text, type = '') { const el = $('#formMessage'); el.textContent = text; el.className = `form-message ${type}`; }

async function submitForm(event) {
  event.preventDefault(); message('');
  const data = getFormData();
  try {
    $('#saveStatus').textContent = '正在保存…';
    await api('/api/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    $('#saveStatus').textContent = '数据实时保存';
    message('已保存本月规划，所有浏览器都可以在汇总页查看。', 'success');
    await loadRecords();
  } catch (error) { $('#saveStatus').textContent = '数据实时保存'; message(error.message, 'error'); }
}

function setView(name) {
  $$('.nav-button').forEach(btn => btn.classList.toggle('active', btn.dataset.view === name));
  $('#formView').classList.toggle('active-view', name === 'form');
  $('#summaryView').classList.toggle('active-view', name === 'summary');
  if (name === 'summary') renderSummary();
}

function unique(key) { return [...new Set(records.map(record => record[key]).filter(Boolean))].sort(); }
function populateFilters() {
  const currentMonth = $('#monthFilter').value, currentGroup = $('#groupFilter').value;
  $('#monthFilter').innerHTML = '<option value="">全部月份</option>' + unique('month').map(v => `<option value="${v}">${v}</option>`).join('');
  $('#groupFilter').innerHTML = '<option value="">全部小组</option>' + unique('group').map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  $('#monthFilter').value = currentMonth; $('#groupFilter').value = currentGroup;
  $('#groupOptions').innerHTML = unique('group').map(v => `<option value="${escapeHtml(v)}">`).join('');
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char])); }
function filteredRecords() { const month = $('#monthFilter').value, group = $('#groupFilter').value; return records.filter(r => (!month || r.month === month) && (!group || r.group === group)); }

function renderSingle(data) {
  const totals = {};
  data.forEach(record => record.items.forEach(item => { totals[item.category] = (totals[item.category] || 0) + item.ratio; }));
  const count = data.length || 1;
  const rows = Object.entries(totals).sort((a,b) => b[1]-a[1]).map(([category, value], i) => `<div class="chart-row"><span>${escapeHtml(category)}</span><div class="bar-track"><div class="bar" style="width:${Math.min(value / count, 100)}%;background:${colors[i % colors.length]}"></div></div><strong>${(value / count).toFixed(1).replace('.0','')}%</strong></div>`).join('');
  const total = data.reduce((sum, r) => sum + r.total, 0);
  return `<div class="summary-grid"><div class="summary-card"><h3>当前概览</h3><div class="metric">${data.length}<small> 份规划</small></div><p>平均每份规划已填写 <strong>${(total / count).toFixed(1).replace('.0','')}%</strong> 的内容比例。</p><div class="record-list">${data.slice(0,5).map(record => `<div class="record"><div><strong>${escapeHtml(record.group)} <span class="pill">${record.month}</span></strong><small>${escapeHtml(record.planner)} · ${record.items.length} 个内容类型</small></div><span class="record-total">${record.total}%</span></div>`).join('')}</div></div><div class="summary-card"><h3>内容类型比例</h3><div class="chart">${rows || '<div class="empty-state">暂无可视化数据</div>'}</div></div></div>`;
}

function renderCompare(data) {
  const dimension = $('#compareDimension').value;
  const groups = [...new Set(data.map(r => r[dimension]))].sort();
  const categories = [...new Set(data.flatMap(r => r.items.map(i => i.category)))];
  const average = (category, group) => {
    const subset = data.filter(r => r[dimension] === group);
    return subset.reduce((sum, r) => sum + r.items.filter(i => i.category === category).reduce((s, i) => s + i.ratio, 0), 0) / subset.length;
  };
  const chart = categories.map(category => `<div><div class="compare-category">${escapeHtml(category)}</div>${groups.map((group,i) => { const value = average(category,group); return `<div class="chart-row"><span>${escapeHtml(group)}</span><div class="bar-track"><div class="bar" style="width:${value}%;background:${colors[i % colors.length]}"></div></div><strong>${value.toFixed(1).replace('.0','')}%</strong></div>`; }).join('')}</div>`).join('');
  const headers = groups.map(g => `<th>${escapeHtml(g)}</th>`).join('');
  const rows = categories.map(category => `<tr><td>${escapeHtml(category)}</td>${groups.map(group => `<td>${average(category,group).toFixed(1).replace('.0','')}%</td>`).join('')}</tr>`).join('');
  return `<div class="summary-card"><h3>${dimension === 'group' ? '小组' : '月份'}对比</h3><p>按每份规划等权平均；未规划的内容类型按 0% 计入。</p><div class="comparison-chart">${chart}</div><div class="table-scroll"><table class="compare-table"><thead><tr><th>内容类型</th>${headers}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

function renderSummary() { const data = filteredRecords(); if (!data.length) { $('#summaryContent').innerHTML = '<div class="empty-state">当前筛选条件下还没有规划数据。</div>'; return; } $('#summaryContent').innerHTML = $('#compareMode').checked ? renderCompare(data) : renderSingle(data); }

async function loadRecords() { records = await api('/api/records'); populateFilters(); if ($('#summaryView').classList.contains('active-view')) renderSummary(); }

$('#addRow').addEventListener('click', () => addRow());
$('#planningForm').addEventListener('submit', submitForm);
$$('.nav-button').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
['monthFilter','groupFilter','compareMode','compareDimension'].forEach(id => $(`#${id}`).addEventListener('change', renderSummary));
$('#refreshSummary').addEventListener('click', async () => { await loadRecords(); });
addRow({ category: '测评', ratio: 0 }); addRow({ category: '教程', ratio: 0 }); addRow({ category: '种草', ratio: 0 });
const now = new Date(); $('#month').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
loadRecords().catch(error => message(error.message, 'error'));
