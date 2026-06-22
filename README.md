# ApplyJob Side Panel Extension

## MVP 功能

- Chrome / Edge `Manifest V3 + Side Panel API`
- 支持上传 `PDF / DOC / DOCX`
- 保留原始文件并本地保存多份简历
- 展示 `简历原文 / 标准化字段` 双标签页
- 支持字段编辑、删除、新增、模块内拖拽排序、手动保存
- 扫描当前页面表单并执行预填充
- 列出未填项并支持滚动定位
- 记录用户手动填写字段和值，作为后续复用数据

## 启动

```bash
npm install
npm run build
```

当前仓库同时提供两套目录：

- `extension/`: 免构建版，可直接在 Chrome / Edge 加载
- `dist/`: 预留给构建版产物

优先加载 `extension/` 目录即可。

## OCR / 解析策略

- `PDF`: 使用 `pdf.js` 渲染页面，再通过 `Tesseract.js` 做中英 OCR
- `DOCX`: 使用 `Mammoth` 提取文本
- `DOC`: 当前本地插件版暂不支持，建议先转为 `DOCX / PDF`
- OCR 对接入口固定在 [extension/core/ocr-adapter.js](/Users/gsy/Documents/ApplyJob/extension/core/ocr-adapter.js)

当前前端不提供 OCR 地址配置，OCR 已直接内置在插件方案中。解析结果返回格式：

```json
{
  "text": "parsed resume text"
}
```

## 后续建议

- 接入真实后端的字段匹配接口
- 为复杂富文本编辑器补充适配器
- 针对分页表单增加跨页导航状态
