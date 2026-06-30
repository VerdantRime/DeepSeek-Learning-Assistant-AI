# 更新记录 (CHANGELOG)

## v7.6.0 — 2026-06-30

### 🎨 UI 全面重设计（靛蓝玻璃态）
- **色彩系统焕新**：从 Claude Design System 的棕珊瑚(`#cc785c`)+黑(`#252523`) 切换为现代靛蓝渐变(`#4f6ef7`→`#6366f1`→`#7c3aed`)
- **玻璃态面板**：`rgba(255,255,255,0.88)` + `backdrop-filter: blur(32px)` 毛玻璃效果
- **渐变头部**：蓝紫渐变 + 装饰光晕伪元素
- **动画系统**：面板滑入(`ds-slideIn`)、Tab淡入(`ds-fadeIn`)、徽章弹出(`ds-badgePop`)
- **结果卡片**：白底 + 左侧渐变彩条(hover显示) + 多色题型标签
- **Toast**：渐变深色气泡 + 弹入动画
- **面板宽度**：380px → 400px
- **字体**：系统原生字体栈替换 Inter/SF Pro

---

## v7.5.1 — 2026-06-30

### 🔧 测验提交确认弹窗完善
- **四步提交流程**：
  1. 调用 `btnBlueSubmit()` 平台内置提交函数
  2. DOM 按钮兜底（遍历 doc/top/parent 文档）
  3. `setInterval` 轮询确认弹窗（800ms × 20次，跨 qWin/top/parent 窗口）
  4. `$('#workpop').hide()` 清理残留弹窗
- **确认按钮选择器**：`.layui-layer-btn0` / `#okBtn` / `.confirm-btn` / `.workpop .Btn_blue_1` / `.ui-dialog-btn-ok` 等 8+ 种
- **文字匹配**：确定/是/提交/确认 / 排除取消/否/关闭

---

## v7.5.0 — 2026-06-30

### ✨ 后台答案捕获
- **JSON.parse Hook**：拦截 `JSON.parse` 递归搜索 API 响应中的 `answer`/`rightAnswer`/`correctAnswer` 字段
- **双重缓存命中**：后台缓存 → 本地缓存 → DeepSeek API，优先级依次降低
- **datas 数组解析**：超星 `datas[].answer` 模式专门处理

### 🔧 图片题目优化
- `<img>` 标签转换为 `[图片:alt文本]` 标记，让 DeepSeek 理解图片内容
- `clean` 和 `cleanQ` 函数分离：`cleanQ` 额外去除题号前缀和分值后缀

### 🔧 PPT 完成策略加强
- 策略1：立即滚动到底部 + 派发 scroll 事件
- 策略2：读取 iframe `data` 属性获取 jobid → 标记 `attachments[].isPassed = true`
- 策略3：调用 `_jobFinish()` / `submitJob()` 全局函数
- 策略4：轮询滚动（2s × 8次）作为兜底

---

## v7.4.0 — 2026-06-29

### 🔧 测验提交流程
- 新增测验提交按钮查找和点击
- 暂存/取消按钮过滤（避免误点）
- 提交后等待弹窗处理

### 🔧 图片识别
- 题目文本中 `<img>` 标签转换为 `[图片]` 标记

---

## v7.3.1 — 2026-06-29

### 🐛 章节测验选择器修复
- **问题**：`ul:eq(0) li .after` — `:eq(0)` 是 jQuery 专用选择器，`querySelectorAll` 抛出 DOMException
- **修复**：将 chapterTest 配置中的 `optTextSel` 改为 `ul li .after`，`optClickSel` 改为 `ul li .num_option, ul li .num_option_dx`
- 所有 CSS 选择器均兼容原生 DOM API

---

## v7.3.0 — 2026-06-29

### 🔧 测验在刷课中无法检测到题目
- **问题**：`sHandleQuiz` 仅检查 `.clearfix .TiMu` 根选择器
- **修复**：多选择器回退 `.TiMu` → `.questionLi` → `.clearfix .TiMu`
- **嵌套 iframe 搜索**：递归搜索测验 iframe 内的 iframe

### 🔧 任务类型检测增强
- OCS 模式：进入 iframe DOM 内部检测元素 (`#video`, `.TiMu`, `.swiper-container`)
- URL 模式兜底：通过 iframe src 正则匹配

### 🔧 PPT 处理改进
- 从点击翻页改为滚动策略
- 多容器选择器：`#readArea` / `.docBox` / `.pptBox` / `.reader-container`
- 滚动到底 + 事件派发

---

## v7.2.0 — 2026-06-29

### 🔧 重做模式优化
- 重做时先清除旧选择：取消 check_answer 类、取消 checked 状态、派发 change 事件
- 清除逻辑覆盖：clickable element、inner input、parent element
- 缩短重做延迟：轮询 100ms 替代 300ms

### 🔧 选项点击加速
- 纯索引匹配 (A→index 0, B→index 1) 替代文本正则
- 已选中跳过检查：`targetEl.checked` + `check_answer` 类 + parent 检测
- 点击间隔 150ms 替代 500ms

---

## v7.1.0 — 2026-06-28

### ✨ 结果面板整合
- 将原有独立结果面板合并到答题主界面
- 结果顺序反转（最新在上 → 原始顺序）
- 每个结果卡片包含：题号、题型标签、状态标签、复制按钮
- 复制按钮带视觉反馈（✓ 已复制 + 绿色边框）

### 🔧 移除"仅标记不点击"
- 该功能无效，已删除相关代码和 UI

---

## v7.0.0 — 2026-06-28

### 🐛 重大 Bug 修复：Boolean 存储
- **问题**：`GM_setValue('ds_redo8', true)` 存储 JS boolean，但 `gv(...) === 'true'` 字符串比较永远为 false
- **修复**：所有布尔配置使用 `Boolean(gv(key, false))` 包装，存储键升级到 `_9` 后缀
- **受影响配置**：redo, alterTitle, doVideo, doAudio, doQuiz, doPPT

### 🐛 作业页面只找到 1 题
- **问题**：`answerAll` 每题后检查下一页按钮，无按钮则停止
- **修复**：`answerAllVisible` 先处理所有可见题目，全部完成后才检查翻页

### 🔧 选项偏移修复
- 从文本正则匹配 + 未选中元素索引回退 → 纯索引匹配 (A→0, B→1 直接映射 DOM 数组)

### 🔧 jQuery 依赖移除
- 自定义轻量 `$()` 包装器（`querySelectorAll` 原生实现）
- `find` / `each` / `eq` / `text` / `val` / `is` / `offset` 等常用方法

---

## 初始版本 (v1.0–v6.x)

### 核心功能建立
- DeepSeek API 集成 (V3/R1 双模型)
- Tampermonkey GM API 配置持久化
- OCS `getQuestionType` 类型映射 (0=single, 1=multiple, 3=judgement, 2/4-10=completion)
- 多页面检测 (homework/oldExam/newExam/chapterTest)
- 视频/音频/PPT 自动播放与调速
- OCS `searchJobElement` 风格任务检测
- UEditor 富文本答案填充
- F9 面板显隐、面板拖拽

---

## 版本索引

| 版本 | 日期 | 关键变更 |
|------|------|----------|
| v7.6.0 | 2026-06-30 | 🎨 靛蓝玻璃态 UI 重设计 |
| v7.5.1 | 2026-06-30 | 🔧 测验确认弹窗轮询 |
| v7.5.0 | 2026-06-30 | ✨ 后台答案捕获 + 图片识别 |
| v7.4.0 | 2026-06-29 | 🔧 测验提交 + 图片标记 |
| v7.3.1 | 2026-06-29 | 🐛 `:eq(0)` jQuery 选择器修复 |
| v7.3.0 | 2026-06-29 | 🔧 测验检测 + PPT 滚动 |
| v7.2.0 | 2026-06-29 | 🔧 重做加速 + 选项加速 |
| v7.1.0 | 2026-06-28 | ✨ 结果面板整合 + 移除标记 |
| v7.0.0 | 2026-06-28 | 🐛 Boolean 存储 + 作业翻页 |
| v1–6 | 2026-06 | 核心功能建立 |
