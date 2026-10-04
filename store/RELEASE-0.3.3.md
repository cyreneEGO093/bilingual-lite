# 双语轻译 · Bilingual Lite v0.3.3

修复图片顶部的工具栏遮住译文框手柄、导致无法拖动的问题。

- 工具栏优先放在图片外侧；空间不足时避开译文框，随滚动、窗口缩放及框位调整重新定位。
- 增加“收起”按钮，按 Esc 也可收起，再点“图片工具”展开；框选期间 Esc 仍优先取消选区。
- 空间拥挤时自动收起，窄窗口下按钮可换行。
- README 添加 Firefox 商店安装入口。0.3.3 沿用 0.3.2 的扩展 ID，在原商店项目内提交更新。

验证：85 项自动测试通过；Chrome 153 / Firefox 155 完成真实扩展交互测试，包括顶部气泡拖动与缩放、长图滚动、窄窗口、工具栏收起／展开及框选取消；Mozilla 检查为 0 errors / 0 warnings / 0 notices。拖动、工具栏操作不增加模型请求。运行时依赖未变更，保留第三方 MIT 许可声明。

- `bilingual-lite-0.3.3-firefox.zip`：未签名的 Firefox 商店提交／临时加载包。
- `bilingual-lite-0.3.3-chrome.zip`：Chrome / Chromium 包。
- `bilingual-lite-0.3.3-source.zip`：对应完整源码、锁文件和构建说明，审核时单独上传。
- `bilingual-lite-0.3.3-SHA256.txt`：以上附件校验值。

日常安装请使用 [Firefox 商店](https://addons.mozilla.org/zh-CN/firefox/addon/bilingual-lite/)。GitHub 发布不等于商店更新已审核，以商店显示的版本号为准。

本项目为自用项目，完全由 GPT-6 Astra 以 vibe coding 方式开发，不保证可靠性或后续维护。许可：GPL-3.0-only。项目与使用说明：https://github.com/cyreneEGO093/bilingual-lite
