# 双语轻译 · Bilingual Lite v0.3.0

**自用项目，完全由 GPT-6 Astra 以 vibe coding 方式开发。** 不对可靠性、准确性、安全性、兼容性或后续维护作任何保证，也不承诺更新、问题修复或回复 Issue。现有测试记录不构成质量保证，请自行评估使用风险。

这是首次公开 GitHub 发布，采用 **GPL-3.0-only** 许可。扩展本身免费，需要自备 OpenAI 兼容 API 服务和 Key；第三方服务可能按用量收费。

## 功能

- 网页滚动／整页翻译，双语／仅译文切换，异常批次单独重试。
- 漫画整图翻译与局部框选，可拖动、缩放译文框，调整默认大小和透明度。
- 作品背景与自定义术语表，用于网页、整图及框选翻译。
- 文本和图片默认模型为 `deepseek/deepseek-v4.1-flash`；已有用户保存的模型不自动覆盖。
- 原创图标、隐私说明、GPL 和第三方 MIT 许可，以及可复现构建材料。

## 下载哪个文件

| 附件 | 用途 |
|---|---|
| `bilingual-lite-0.3.0-chrome.zip` | 解压后在 Chrome 开发者模式中加载；Edge 可使用相同包，但未单独完成 Edge 交互验收 |
| `bilingual-lite-0.3.0-firefox.zip` | 未签名 Firefox 包，当前用于临时加载或提交 Mozilla 审核 |
| `bilingual-lite-0.3.0-source.zip` | 完整对应源码、依赖锁文件、构建说明、测试和第三方许可／源码 |
| `bilingual-lite-0.3.0-SHA256.txt` | 上述三个压缩包的 SHA-256 校验值 |

**Firefox 扩展尚未上架，也尚未获得 Mozilla 签名。** 需要 Firefox 140+，可从 `about:debugging#/runtime/this-firefox` 临时加载解压后的 `manifest.json`，重启后会卸载。

安装包只含运行文件、图标和必要许可／隐私资源，不含交付说明、测试样图或 API Key。完整源码另行提供，不要把源码 ZIP 当作安装包加载。

## 验证与限制

本版本记录了 79 项自动测试、Chrome 153 和 Firefox 155 实际扩展验收；Mozilla 检查为 0 errors / 0 warnings / 0 notices；两个浏览器的运行文件已通过源码重建逐字节比对。最后的公开发布准备仅修改文档，安装包内容不变。

模型仍可能漏译、误译或定位错误；框选不保证准确率。部分受保护页面和图片不支持翻译，不在隐私窗口运行。启用翻译后，内容会发送到你设置的服务，费用和数据政策以该服务为准。

[安装和使用](https://github.com/cyreneEGO093/bilingual-lite#readme) · [隐私说明](https://github.com/cyreneEGO093/bilingual-lite/blob/v0.3.0/PRIVACY.md) · [构建说明](https://github.com/cyreneEGO093/bilingual-lite/blob/v0.3.0/BUILDING.md) · [反馈](https://github.com/cyreneEGO093/bilingual-lite/issues)
