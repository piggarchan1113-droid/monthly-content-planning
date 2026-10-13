import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'records.json');
const port = Number(process.env.PORT || 3000);

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try { await fs.writeFile(dataFile, '[]\n', { encoding: 'utf8', flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
}

async function readRecords() {
  await ensureDataFile();
  const records = JSON.parse(await fs.readFile(dataFile, 'utf8'));
  if (!Array.isArray(records)) throw new Error('数据文件异常，请联系维护人员');
  return records;
}

let writeQueue = Promise.resolve();
function appendRecord(record) {
  const operation = writeQueue.then(async () => {
    const records = await readRecords();
    records.unshift(record);
    const temp = `${dataFile}.tmp`;
    await fs.writeFile(temp, JSON.stringify(records, null, 2) + '\n', 'utf8');
    await fs.rename(temp, dataFile);
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function sendError(res, status, message) { sendJson(res, status, { error: message }); }

async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1024 * 1024) throw new Error('请求内容过大');
  }
  return JSON.parse(body || '{}');
}

function cleanText(value, max = 120) {
  return String(value ?? '').trim().slice(0, max);
}

function validateRecord(input) {
  if (!input || typeof input !== 'object') throw new Error('提交格式不正确');
  if (Array.isArray(input.items) && input.items.length > 200) throw new Error('每份规划最多 200 个内容类型');
  const month = cleanText(input.month, 7);
  const group = cleanText(input.group, 60);
  const planner = cleanText(input.planner, 60);
  const items = Array.isArray(input.items) ? input.items.map(item => ({
    category: cleanText(item.category, 80),
    ratio: item.ratio === null || item.ratio === '' || item.ratio === undefined ? NaN : Number(item.ratio),
    note: cleanText(item.note, 200)
  })).filter(item => item.category || item.note) : [];
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('请选择有效月份');
  if (!group) throw new Error('请填写小组');
  if (!planner) throw new Error('请填写编导姓名');
  if (!items.length) throw new Error('请至少添加一条内容规划');
  if (items.some(item => !item.category || !Number.isFinite(item.ratio) || item.ratio < 0 || item.ratio > 100)) {
    throw new Error('内容类型不能为空，比例需为 0–100 的数字');
  }
  const total = items.reduce((sum, item) => sum + item.ratio, 0);
  if (total > 100 + 1e-9) throw new Error('同一份规划的比例合计不能超过 100%');
  return { month, group, planner, items, total: Math.round(total * 100) / 100 };
}

async function handleApi(req, res, url) {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});
  if (req.method === 'GET' && url.pathname === '/api/health') {
    await readRecords();
    return sendJson(res, 200, { ok: true, service: 'monthly-content-planning' });
  }
  if (req.method === 'GET' && url.pathname === '/api/records') {
    const records = await readRecords();
    const month = cleanText(url.searchParams.get('month'), 7);
    const group = cleanText(url.searchParams.get('group'), 60);
    return sendJson(res, 200, records.filter(r => (!month || r.month === month) && (!group || r.group === group)));
  }
  if (req.method === 'POST' && url.pathname === '/api/records') {
    try {
      const record = validateRecord(await readBody(req));
      const now = new Date().toISOString();
      const saved = { id: crypto.randomUUID(), ...record, createdAt: now, updatedAt: now };
      await appendRecord(saved);
      return sendJson(res, 201, saved);
    } catch (error) { return sendError(res, 400, error.message || '提交失败'); }
  }
  sendError(res, 404, '接口不存在');
}

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
async function serveStatic(res, url) {
  const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.normalize(path.join(publicDir, requested));
  if (!file.startsWith(publicDir + path.sep)) return sendError(res, 403, '禁止访问');
  try {
    const content = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(content);
  } catch { sendError(res, 404, '页面不存在'); }
}

await ensureDataFile();
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else if (req.method === 'GET') await serveStatic(res, url);
    else sendError(res, 405, '方法不支持');
  } catch (error) { sendError(res, 500, error.message || '服务器错误'); }
}).listen(port, '0.0.0.0', () => console.log(`Monthly planning system running at http://localhost:${port}`));
