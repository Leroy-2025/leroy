const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "records.json");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf8");
  }
}

async function readRecords() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const records = JSON.parse(raw || "[]");
  return Array.isArray(records) ? records : [];
}

async function writeRecords(records) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2), "utf8");
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

function cleanRecord(input, existingId) {
  const type = input.type === "expense" ? "expense" : "income";
  const amount = Number(input.amount);
  if (!input.date || !input.project || !input.category || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("请填写日期、项目、分类和有效金额。");
  }

  return {
    id: existingId || input.id || randomUUID(),
    type,
    date: String(input.date).slice(0, 10),
    project: String(input.project).trim(),
    category: String(input.category).trim(),
    amount,
    owner: String(input.owner || "").trim(),
    note: String(input.note || "").trim(),
    updatedAt: new Date().toISOString(),
  };
}

function demoRecords() {
  return [
    ["income", "2026-01-12", "华东实施项目", "合同款", 186000, "张敏", "一期回款"],
    ["expense", "2026-01-20", "华东实施项目", "人力成本", 52000, "李雷", "实施团队费用"],
    ["income", "2026-02-08", "云平台订阅", "订阅收入", 96000, "王宁", "年度订阅"],
    ["expense", "2026-02-15", "云平台订阅", "服务器", 18000, "赵洁", "云资源费用"],
    ["income", "2026-03-05", "西南运维项目", "服务费", 72000, "陈航", "季度服务费"],
    ["expense", "2026-03-21", "西南运维项目", "差旅", 12600, "陈航", "客户现场支持"],
    ["income", "2026-04-10", "华东实施项目", "验收款", 128000, "张敏", "验收回款"],
    ["expense", "2026-04-18", "总部运营", "办公费用", 24800, "行政部", "办公采购"],
    ["income", "2026-05-06", "数据治理项目", "合同款", 214000, "周扬", "首付款"],
    ["expense", "2026-05-14", "数据治理项目", "外包服务", 66000, "周扬", "数据清洗服务"],
  ].map(([type, date, project, category, amount, owner, note]) =>
    cleanRecord({ type, date, project, category, amount, owner, note }),
  );
}

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, storage: DATA_FILE });
    return;
  }

  if (url.pathname === "/api/records" && req.method === "GET") {
    sendJson(res, 200, { records: await readRecords() });
    return;
  }

  if (url.pathname === "/api/records" && req.method === "POST") {
    const body = await parseBody(req);
    const records = await readRecords();
    const record = cleanRecord(body);
    records.push(record);
    await writeRecords(records);
    sendJson(res, 201, { record });
    return;
  }

  if (url.pathname === "/api/records" && req.method === "DELETE") {
    await writeRecords([]);
    sendJson(res, 200, { records: [] });
    return;
  }

  if (url.pathname === "/api/records/seed" && req.method === "POST") {
    const records = [...demoRecords(), ...(await readRecords())];
    await writeRecords(records);
    sendJson(res, 201, { records });
    return;
  }

  const recordMatch = url.pathname.match(/^\/api\/records\/([^/]+)$/);
  if (recordMatch && req.method === "PUT") {
    const id = decodeURIComponent(recordMatch[1]);
    const body = await parseBody(req);
    const records = await readRecords();
    const index = records.findIndex((record) => record.id === id);
    if (index === -1) {
      sendError(res, 404, "记录不存在。");
      return;
    }
    records[index] = cleanRecord(body, id);
    await writeRecords(records);
    sendJson(res, 200, { record: records[index] });
    return;
  }

  if (recordMatch && req.method === "DELETE") {
    const id = decodeURIComponent(recordMatch[1]);
    const records = (await readRecords()).filter((record) => record.id !== id);
    await writeRecords(records);
    sendJson(res, 200, { records });
    return;
  }

  sendError(res, 404, "接口不存在。");
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.normalize(path.join(ROOT, pathname));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    sendError(res, 500, error.message || "服务器错误。");
  }
});

ensureDataFile().then(() => {
  server.listen(PORT, HOST, () => {
    console.log(`Finance server running at http://${HOST}:${PORT}`);
    console.log(`Data file: ${DATA_FILE}`);
  });
});
