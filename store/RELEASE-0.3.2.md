# 双语轻译 · Bilingual Lite v0.3.2

本项目为自用项目，完全由 GPT-6 Astra 以 vibe coding 方式开发，不保证可靠性或后续维护。

本版本为 Firefox 配置新的 UUID 扩展标识，用于以独立附加组件身份提交商店。它不是 0.3.0 / 0.3.1 旧标识的自动更新版本；旧扩展的本机配置不会自动迁移，请在新扩展中重新填写设置，不要公开分享 API Key。

此后应固定使用本版本的扩展 ID，在同一商店项目内上传后续版本，不要通过删除项目来更新扩展。已删除项目的 ID 无法复用。

保留“用户自备 API Key”的正确描述，翻译功能未变更。Firefox 测试脚本改为从构建清单读取 ID，避免硬编码旧标识。

验证：类型检查、双端打包与 Firefox 检查通过（0 errors / 0 warnings / 0 notices）；Firefox 155 在新标识下完成实际扩展验收，包括网页、图片、框选、来源规则和异常恢复。与 0.3.1 相比，安装包只改变 manifest 中的版本号和扩展 ID，其余运行文件逐字节一致。

- `bilingual-lite-0.3.2-firefox.zip`：使用新标识的 Firefox 提交包，尚未由 Mozilla 签名。
- `bilingual-lite-0.3.2-chrome.zip`：Chrome / Chromium 包。
- `bilingual-lite-0.3.2-source.zip`：完整对应源码及构建材料。
- `bilingual-lite-0.3.2-SHA256.txt`：以上附件校验值。

许可：GPL-3.0-only。项目与使用说明：https://github.com/cyreneEGO093/bilingual-lite
