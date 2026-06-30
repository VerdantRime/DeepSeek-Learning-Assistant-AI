# DeepSeek 学习通全能助手

[![Version](https://img.shields.io/badge/version-7.6.0-indigo?style=flat-square)](https://github.com)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-v5%2B-orange?style=flat-square&logo=tampermonkey)](https://www.tampermonkey.net/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![GreasyFork](https://img.shields.io/badge/GreasyFork-install-blue?style=flat-square)](https://greasyfork.org)

> 🎓 基于 DeepSeek API 的超星学习通全能自动答题 + 智能刷课助手  
> 采用 OCS + 万能脚本检测引擎 | Indigo-Blue Modern UI

---

## ✨ 功能

### 🧠 AI 智能答题
- **DeepSeek-V3 / R1** 双模型驱动，精准回答单选、多选、判断、填空、简答
- **多页面适配**：自动识别作业、旧版考试、新版考试、章节测验、随堂测验
- **后台答案捕获**：拦截 `JSON.parse` 自动缓存 API 返回的正确答案，命中后秒答
- **本地缓存**：所有 AI 回答自动缓存，重启不丢，重复题秒出
- **重做模式**：清除旧选择后重新答题
- **页内显答案**：直接在题目上注入答案徽章
- **结果面板**：完整答题记录，一键复制题目+答案

### 📚 智能刷课
- **视频/音频**：自动播放、静音、调速 (1×/1.5×/2×)
- **PPT/文档**：自动滚动到底 + 后台强制标记完成
- **章节测验**：刷课中自动检测并答题 + 提交（含确认弹窗处理）
- **自动跳转**：完成当前任务后自动跳转下一节
- **任务识别**：DOM 检测 + URL 模式匹配双保险

### 🎨 现代 UI
- **靛蓝玻璃态面板**：半透明磨砂背景，蓝紫渐变头部
- **流畅动画**：面板滑入、Tab 淡入、按钮悬停、徽章弹出
- **可拖拽面板**：自由拖动，F9 一键显隐
- **三级 Tab**：答题 / 刷课 / 设置，切换平滑

---

## 📋 环境要求

| 依赖 | 版本 |
|------|------|
| Tampermonkey | v5.0+ |
| 浏览器 | Chrome / Edge / Firefox |
| DeepSeek API Key | `sk-...` |

> **API Key 获取**：前往 [platform.deepseek.com](https://platform.deepseek.com) 注册并创建 API Key。

---

## 🔧 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 打开 `DeepSeek学习通AI助手.user.js` → 点击 **安装**
3. 访问超星学习通 (chaoxing.com)，按 `F9` 打开面板
4. 在 **设置** Tab 中填入 DeepSeek API Key → 保存

---

## 🎮 使用

### 快捷键
| 按键 | 功能 |
|------|------|
| `F9` | 显示 / 隐藏面板 |

### 答题模式
1. 打开作业或考试页面
2. 点击 **▶ 开始答题** — AI 自动读取题目、调用 DeepSeek、填写答案
3. 查看结果面板，点击 **📋 复制** 可复制题目去查证

### 刷课模式
1. 进入课程章节页
2. 点击 **🎬 开始刷课** — 自动播放视频、完成 PPT、答题测验
3. 通过速度按钮调节播放倍速

---

## 🏗️ 架构

```
┌─────────────────────────────────────────┐
│   页面检测 (detectMode)                   │
│   ├─ homework    /mooc2/work/dowork     │
│   ├─ oldExam     /exam/test (旧版)      │
│   ├─ newExam     /exam/test (newMooc)   │
│   ├─ chapterTest /work/doHomeWorkNew    │
│   └─ inClassQuiz /knowledge/cards       │
├─────────────────────────────────────────┤
│   题目检测 (getModeConfig)                │
│   ├─ root: .questionLi / .TiMu          │
│   ├─ title: 多选择器回退                  │
│   ├─ options: .answerBg / .num_option   │
│   └─ type: OCS getQuestionType 映射      │
├─────────────────────────────────────────┤
│   AI 答题 (askAI → DeepSeek API)         │
│   ├─ 缓存: 本地 + 后台答案双重命中         │
│   ├─ Prompt: 按题型差异化生成              │
│   └─ 解析: 字母索引直接映射 DOM            │
├─────────────────────────────────────────┤
│   刷课引擎 (sProcNext → OCS 检测)         │
│   ├─ media: 视频/音频自动播放              │
│   ├─ ppt: 滚动+后台标记+函数调用           │
│   ├─ quiz: 自动答题+提交+确认弹窗          │
│   └─ skip: 自动跳转下一节                 │
├─────────────────────────────────────────┤
│   后台捕获 (JSON.parse Hook)              │
│   └─ 拦截 API 响应 → 缓存正确答案          │
└─────────────────────────────────────────┘
```

---

## 🎨 设计参考

UI 设计参考 [awesome-design-md](https://github.com/anthropics/awesome-design-md) 的 Claude Design System 并结合现代玻璃态风格：

| Token | 值 |
|-------|-----|
| **主色** | `#4f6ef7` → `#6366f1` → `#7c3aed` (靛蓝-紫渐变) |
| **面板** | `rgba(255,255,255,0.88)` + `backdrop-filter: blur(32px)` |
| **深色背景** | `#1e1f2b` (日志区) |
| **成功色** | `#4ade80` |
| **错误色** | `#f87171` |
| **字体** | `-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif` |
| **等宽** | `JetBrains Mono, "SF Mono", monospace` |

---

## 📝 技术参考

本脚本的题目检测和答案填充逻辑大量参考了以下开源脚本：

- **OCS 网课助手 v4.14.3** — `getQuestionType` 映射、`searchJobElement` 任务检测、`btnBlueSubmit` 提交模式
- **万能全平台自动答题 v5.3.0.1** — 多模式页面配置、`JSONParseHook` 后台答案捕获、`answerBg` 点击策略

---

## 📄 更新记录

详见 [CHANGELOG.md](CHANGELOG.md)

### 最近更新

**v7.6.0** (2026-06-30)
- 🎨 **UI 全面重设计**：从棕色珊瑚色系切换到靛蓝玻璃态
- ✨ 面板滑入动画、Tab 淡入过渡、悬停效果
- 🔧 扩大面板宽度 380→400px

**v7.5.1** (2026-06-30)
- 🔧 测验提交确认弹窗处理完善
- 🔧 多窗口轮询检测确认按钮

**v7.5.0** (2026-06-30)
- ✨ 新增后台答案捕获 (JSON.parse Hook)
- 🔧 图片题目 alt 文本提取
- 🔧 PPT 后台强制完成

---

## ⚠️ 免责声明

本脚本仅用于学习和技术研究目的。使用本脚本产生的任何后果由用户自行承担。请遵守学校和平台的相关规定。

---

## 📜 License

MIT License © 2026
