const STORAGE_KEY = "company-finance-records-v1";

const els = {
  navTabs: document.querySelectorAll(".nav-tab"),
  views: {
    dashboard: document.querySelector("#dashboardView"),
    records: document.querySelector("#recordsView"),
    admin: document.querySelector("#adminView"),
  },
  pageTitle: document.querySelector("#pageTitle"),
  monthFilter: document.querySelector("#monthFilter"),
  clearFilterBtn: document.querySelector("#clearFilterBtn"),
  typeFilter: document.querySelector("#typeFilter"),
  projectFilter: document.querySelector("#projectFilter"),
  recordCount: document.querySelector("#recordCount"),
  totalIncome: document.querySelector("#totalIncome"),
  totalExpense: document.querySelector("#totalExpense"),
  netBalance: document.querySelector("#netBalance"),
  projectCount: document.querySelector("#projectCount"),
  incomeHint: document.querySelector("#incomeHint"),
  expenseHint: document.querySelector("#expenseHint"),
  balanceHint: document.querySelector("#balanceHint"),
  monthlyChart: document.querySelector("#monthlyChart"),
  typeChart: document.querySelector("#typeChart"),
  projectList: document.querySelector("#projectList"),
  recordsTable: document.querySelector("#recordsTable"),
  emptyTable: document.querySelector("#emptyTable"),
  financeForm: document.querySelector("#financeForm"),
  formTitle: document.querySelector("#formTitle"),
  recordId: document.querySelector("#recordId"),
  recordType: document.querySelector("#recordType"),
  recordDate: document.querySelector("#recordDate"),
  recordProject: document.querySelector("#recordProject"),
  recordCategory: document.querySelector("#recordCategory"),
  recordAmount: document.querySelector("#recordAmount"),
  recordOwner: document.querySelector("#recordOwner"),
  recordNote: document.querySelector("#recordNote"),
  cancelEditBtn: document.querySelector("#cancelEditBtn"),
  quickAddBtn: document.querySelector("#quickAddBtn"),
  seedBtn: document.querySelector("#seedBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  clearAllBtn: document.querySelector("#clearAllBtn"),
};

const pageTitles = {
  dashboard: "数据大屏",
  records: "收支明细",
  admin: "后台录入",
};

let records = loadRecords();

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function money(value) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

function monthOf(date) {
  return String(date).slice(0, 7);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getFilteredRecords({ includeType = true, includeProject = true } = {}) {
  const month = els.monthFilter.value;
  const type = els.typeFilter.value;
  const project = els.projectFilter.value.trim().toLowerCase();

  return records.filter((record) => {
    const matchMonth = !month || monthOf(record.date) === month;
    const matchType = !includeType || type === "all" || record.type === type;
    const matchProject =
      !includeProject || !project || record.project.toLowerCase().includes(project);
    return matchMonth && matchType && matchProject;
  });
}

function sumByType(list, type) {
  return list
    .filter((record) => record.type === type)
    .reduce((total, record) => total + Number(record.amount), 0);
}

function switchView(viewName) {
  els.navTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewName);
  });
  Object.entries(els.views).forEach(([name, view]) => {
    view.classList.toggle("active", name === viewName);
  });
  els.pageTitle.textContent = pageTitles[viewName];
}

function render() {
  const dashboardRecords = getFilteredRecords({ includeType: false, includeProject: false });
  const tableRecords = getFilteredRecords();
  const income = sumByType(dashboardRecords, "income");
  const expense = sumByType(dashboardRecords, "expense");
  const projects = new Set(dashboardRecords.map((record) => record.project));
  const period = els.monthFilter.value ? `${els.monthFilter.value} 月` : "全部";

  els.totalIncome.textContent = money(income);
  els.totalExpense.textContent = money(expense);
  els.netBalance.textContent = money(income - expense);
  els.projectCount.textContent = projects.size;
  els.incomeHint.textContent = `${period}收入`;
  els.expenseHint.textContent = `${period}支出`;
  els.balanceHint.textContent = `${period}结余`;
  els.recordCount.textContent = `${tableRecords.length} 条记录`;

  renderMonthlyChart(dashboardRecords);
  renderTypeChart(income, expense);
  renderProjects(dashboardRecords);
  renderTable(tableRecords);
}

function renderMonthlyChart(list) {
  const canvas = els.monthlyChart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const grouped = new Map();
  list.forEach((record) => {
    const key = monthOf(record.date);
    if (!grouped.has(key)) grouped.set(key, { income: 0, expense: 0 });
    grouped.get(key)[record.type] += Number(record.amount);
  });

  const months = [...grouped.keys()].sort().slice(-12);
  const values = months.flatMap((month) => [grouped.get(month).income, grouped.get(month).expense]);
  const maxValue = Math.max(...values, 1);
  const chartLeft = 58;
  const chartRight = width - 24;
  const chartTop = 28;
  const chartBottom = height - 54;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;

  ctx.strokeStyle = "#d8e0dc";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#697771";
  ctx.font = "13px Microsoft YaHei, sans-serif";

  for (let i = 0; i <= 4; i += 1) {
    const y = chartBottom - (chartHeight * i) / 4;
    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartRight, y);
    ctx.stroke();
    ctx.fillText(Math.round((maxValue * i) / 4 / 10000) + "万", 10, y + 4);
  }

  if (months.length === 0) {
    drawEmptyCanvas(ctx, width, height, "暂无月度数据");
    return;
  }

  const groupWidth = chartWidth / months.length;
  const barWidth = Math.min(28, groupWidth * 0.28);

  months.forEach((month, index) => {
    const item = grouped.get(month);
    const x = chartLeft + index * groupWidth + groupWidth / 2;
    const incomeHeight = (item.income / maxValue) * chartHeight;
    const expenseHeight = (item.expense / maxValue) * chartHeight;

    ctx.fillStyle = "#167356";
    ctx.fillRect(x - barWidth - 2, chartBottom - incomeHeight, barWidth, incomeHeight);
    ctx.fillStyle = "#b5483f";
    ctx.fillRect(x + 2, chartBottom - expenseHeight, barWidth, expenseHeight);
    ctx.fillStyle = "#697771";
    ctx.textAlign = "center";
    ctx.fillText(month.slice(5), x, chartBottom + 24);
  });

  ctx.textAlign = "left";
  drawLegend(ctx, chartLeft, 16, "#167356", "收入");
  drawLegend(ctx, chartLeft + 72, 16, "#b5483f", "支出");
}

function renderTypeChart(income, expense) {
  const canvas = els.typeChart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const total = income + expense;
  if (!total) {
    drawEmptyCanvas(ctx, width, height, "暂无收支数据");
    return;
  }

  const centerX = width / 2;
  const centerY = height / 2 - 8;
  const radius = 86;
  const incomeAngle = (income / total) * Math.PI * 2;

  ctx.lineWidth = 34;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#e8eeee";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#167356";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + incomeAngle);
  ctx.stroke();

  ctx.strokeStyle = "#b5483f";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, -Math.PI / 2 + incomeAngle, Math.PI * 1.5);
  ctx.stroke();

  ctx.fillStyle = "#17211d";
  ctx.font = "700 24px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(Math.round(((income - expense) / total) * 100) + "%", centerX, centerY + 5);
  ctx.fillStyle = "#697771";
  ctx.font = "13px Microsoft YaHei, sans-serif";
  ctx.fillText("结余率", centerX, centerY + 30);

  ctx.textAlign = "left";
  drawLegend(ctx, 58, height - 26, "#167356", `收入 ${money(income)}`);
  drawLegend(ctx, 198, height - 26, "#b5483f", `支出 ${money(expense)}`);
}

function drawLegend(ctx, x, y, color, text) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y - 10, 12, 12);
  ctx.fillStyle = "#697771";
  ctx.font = "13px Microsoft YaHei, sans-serif";
  ctx.fillText(text, x + 18, y);
}

function drawEmptyCanvas(ctx, width, height, text) {
  ctx.fillStyle = "#697771";
  ctx.font = "15px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, width / 2, height / 2);
  ctx.textAlign = "left";
}

function renderProjects(list) {
  const grouped = new Map();
  list.forEach((record) => {
    if (!grouped.has(record.project)) grouped.set(record.project, { income: 0, expense: 0 });
    grouped.get(record.project)[record.type] += Number(record.amount);
  });

  const rows = [...grouped.entries()]
    .map(([name, item]) => ({ name, ...item, balance: item.income - item.expense }))
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

  if (!rows.length) {
    els.projectList.innerHTML = '<div class="empty-table" style="display:block">暂无项目数据</div>';
    return;
  }

  els.projectList.innerHTML = rows
    .map(
      (row) => `
        <article class="project-row">
          <header>
            <span>${escapeHtml(row.name)}</span>
            <span>${money(row.balance)}</span>
          </header>
          <div class="project-values">
            <span>收入<strong>${money(row.income)}</strong></span>
            <span>支出<strong>${money(row.expense)}</strong></span>
            <span>结余<strong>${money(row.balance)}</strong></span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderTable(list) {
  els.emptyTable.style.display = list.length ? "none" : "block";
  els.recordsTable.innerHTML = list
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(
      (record) => `
        <tr>
          <td>${record.date}</td>
          <td><span class="type-pill ${record.type}">${record.type === "income" ? "收入" : "支出"}</span></td>
          <td>${escapeHtml(record.project)}</td>
          <td>${escapeHtml(record.category)}</td>
          <td>${escapeHtml(record.note || record.owner || "-")}</td>
          <td class="number">${money(record.amount)}</td>
          <td>
            <div class="row-actions">
              <button data-action="edit" data-id="${record.id}">编辑</button>
              <button data-action="delete" data-id="${record.id}" class="danger-btn">删除</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetForm() {
  els.formTitle.textContent = "新增收支数据";
  els.recordId.value = "";
  els.recordType.value = "income";
  els.recordDate.value = today();
  els.recordProject.value = "";
  els.recordCategory.value = "";
  els.recordAmount.value = "";
  els.recordOwner.value = "";
  els.recordNote.value = "";
}

function editRecord(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  switchView("admin");
  els.formTitle.textContent = "编辑收支数据";
  els.recordId.value = record.id;
  els.recordType.value = record.type;
  els.recordDate.value = record.date;
  els.recordProject.value = record.project;
  els.recordCategory.value = record.category;
  els.recordAmount.value = record.amount;
  els.recordOwner.value = record.owner || "";
  els.recordNote.value = record.note || "";
}

function deleteRecord(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  if (!confirm(`确定删除「${record.project}」的这条${record.type === "income" ? "收入" : "支出"}记录吗？`)) {
    return;
  }
  records = records.filter((item) => item.id !== id);
  saveRecords();
  render();
}

function seedRecords() {
  const demo = [
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
  ].map(([type, date, project, category, amount, owner, note]) => ({
    id: crypto.randomUUID(),
    type,
    date,
    project,
    category,
    amount,
    owner,
    note,
  }));

  records = [...demo, ...records];
  saveRecords();
  render();
}

function exportCsv() {
  const header = ["日期", "类型", "项目", "分类", "金额", "经办人", "备注"];
  const rows = records.map((record) => [
    record.date,
    record.type === "income" ? "收入" : "支出",
    record.project,
    record.category,
    record.amount,
    record.owner || "",
    record.note || "",
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `finance-records-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

els.navTabs.forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

els.quickAddBtn.addEventListener("click", () => {
  resetForm();
  switchView("admin");
});

els.clearFilterBtn.addEventListener("click", () => {
  els.monthFilter.value = "";
  render();
});

els.monthFilter.addEventListener("input", render);
els.typeFilter.addEventListener("change", render);
els.projectFilter.addEventListener("input", render);

els.financeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const record = {
    id: els.recordId.value || crypto.randomUUID(),
    type: els.recordType.value,
    date: els.recordDate.value,
    project: els.recordProject.value.trim(),
    category: els.recordCategory.value.trim(),
    amount: Number(els.recordAmount.value),
    owner: els.recordOwner.value.trim(),
    note: els.recordNote.value.trim(),
  };

  if (els.recordId.value) {
    records = records.map((item) => (item.id === record.id ? record : item));
  } else {
    records.push(record);
  }

  saveRecords();
  resetForm();
  switchView("dashboard");
  render();
});

els.cancelEditBtn.addEventListener("click", resetForm);

els.recordsTable.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const id = button.dataset.id;
  if (button.dataset.action === "edit") editRecord(id);
  if (button.dataset.action === "delete") deleteRecord(id);
});

els.seedBtn.addEventListener("click", seedRecords);
els.exportBtn.addEventListener("click", exportCsv);
els.clearAllBtn.addEventListener("click", () => {
  if (!confirm("确定清空所有本地财务数据吗？")) return;
  records = [];
  saveRecords();
  resetForm();
  render();
});

els.monthFilter.value = currentMonth();
resetForm();
render();
