# 每月内容比例规划系统

这是一个可公开部署的月度内容比例规划系统。它将数据保存在服务器端的 `data/records.json`，因此不同浏览器、不同设备访问同一个网址时都能看到同一份数据。

## 本地运行

需要 Node.js 18 或更高版本：

```bash
npm start
```

打开 `http://localhost:3000`。生产环境把整个目录部署到支持 Node.js 的主机（如 Render、Railway、Fly.io 或自有服务器），并将 `PORT` 交给平台设置。部署时要为 `data/` 配置持久化磁盘，否则平台重启后 JSON 数据会被清空。项目已附带 `render.yaml`（Render Starter + 1GB 持久化磁盘）和 `Dockerfile`，可直接部署。

## Render 部署

1. 将本目录上传到 GitHub 仓库。
2. 在 Render 选择 **New → Blueprint**，连接该仓库并使用 `render.yaml`。
3. 部署完成后，Render 会提供一个 `https://...onrender.com` 公网链接。把该链接发给填写者即可，填写者无需飞书账号。
4. 需要长期保存数据时不要删除 Render 的持久化磁盘；Starter 方案用于保证 JSON 数据跨重启保存。

Render 的 Starter 实例和持久化磁盘为付费资源，创建前请在平台确认当前价格。这里提供的是部署配置，尚未创建云端服务或产生公网网址。

## 自有服务器 / Docker

```bash
docker build -t monthly-content-planning .
docker run -d --name monthly-content-planning --restart unless-stopped -p 3000:3000 -v monthly-content-data:/var/data monthly-content-planning
```

再使用服务器上的反向代理配置 HTTPS 域名。命名卷保存数据，更新容器时复用同一个卷。当前文件存储适用于单实例运行，多实例需换共享数据库。

## 公开范围

填写和汇总均无需登录，持有网址的人都能提交，也能查看包括编导姓名的全部规划。当前版本不提供公开删除接口。服务器维护人员应定期备份 `DATA_DIR/records.json`。当前内容类型为可修改示例，原飞书页面尚未成功进入核对，原表的其他字段和汇总规则需要核对后再迁移。

## 已按需求调整

- 移除“本期成片数量（选填）”字段。
- 标题改为“每月内容比例规划”，新增“规划月份”月份选择器。
- 新增“数据汇总”页：可按月份、按小组筛选；关闭对比模式时查看单个筛选结果，开启后可比较多个小组的内容比例。
- 后端接口使用服务端文件持久化，提交后所有浏览器都能读取。

## 字段说明

每份规划包括月份、编导小组、编导姓名，以及任意数量的内容类型、规划比例和备注。比例总和允许小于 100%，但不能超过 100%。
