# 公司财务管理系统

一个公司财务管理网站，包含 Google / Material 风格的数据大屏、收支明细、后台录入和服务器端数据保存。

## 功能

- 数据大屏：展示总收入、总支出、结余、项目数
- 月度趋势：按月份展示收入和支出
- 项目情况：按项目汇总收入、支出和结余
- 后台录入：新增和编辑收入、支出明细
- 明细管理：筛选、编辑、删除、导出 CSV
- 服务器保存：数据写入 `data/records.json`，远程访问同一服务器即可查看同一份数据

## 本地运行

```bash
npm start
```

打开：

```text
http://localhost:3000
```

## 部署说明

这个版本需要 Node.js 服务器，不能只用 GitHub Pages 保存数据。可以部署到 Render、Railway、VPS、宝塔面板或其他支持 Node.js 的平台。

部署时建议：

- Start command: `npm start`
- Node version: 18 或更高
- 如果平台支持持久磁盘，把 `DATA_DIR` 指向持久目录，避免重启后数据丢失
