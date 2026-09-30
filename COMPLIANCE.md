# 0.3.0 发布检查：来源、许可证与 AMO

检查日期：2026-09-30。范围：本地 Git 仓库、锁定依赖、实际构建模块、Chrome / Firefox 安装产物。以下是工程审计结果，不能替代 Mozilla 最终审核或对所有互联网代码进行相似性比对。

## 代码与素材来源

| 内容 | 检查结果 | 发布处理 |
|---|---|---|
| `lib/`、`entrypoints/`、本项目脚本及测试 | 项目开发中逐步实现；导入、版权注记、外部链接检索未发现复制其他漫画／网页翻译项目的实现 | 发布为 GPL-3.0-only，保留项目版权与 SPDX 标识 |
| WXT 0.21.4 | 构建产物包含运行时及框架生成的入口代码；npm 声明 MIT，上游发布标签对应 `8fea9b4837282f4ad2a0d085ced6bee1a7de08fb` | 附原 MIT 版权和许可全文；源码包包含对应 TypeScript 源码及实际使用模块 |
| `@wxt-dev/browser` 0.3.4 | 构建产物包含跨浏览器 API 选择器；同一 WXT 仓库，npm 声明 MIT，源码直接为 JavaScript | 附原 MIT 许可及精确 npm 源码快照 |
| Vite、TypeScript、Vitest、Playwright、web-ext 等 | 构建、测试或审查工具；未整体装入扩展。Vite 的旧版 modulepreload 运行时补丁已关闭，支持范围内浏览器原生提供该能力 | 锁文件和依赖清单用于复现；不把开发工具二进制或 node_modules 发给用户 |
| 原创图标、合成漫画测试图、演示页面 | 图标为本项目手工 SVG 路径，没有图标库、商标或字体文件；测试 SVG 及 PNG 来自项目自建图形 | 原始可编辑文件随源码，GPL-3.0-only |
| manga-translator-ui | 仅在研究文档讨论其架构；源码树没有引入该项目模块、模型、Qt/Python 应用或下载的参考文件 | 不作为本扩展依赖或代码来源；不能把“架构参考”视为获得其代码／模型许可 |
| RapidOCR / ONNX 实验 | 仅保留本项目编写的可选基准脚本；Python 环境、权重和用户漫画未进入 Git 发布内容 | 不打包 OCR 依赖和样图；安装包不执行 Python |

实际纳入构建的 npm 运行时共 **2 个包、8 个模块**，均为 MIT。详见 `licenses/runtime-inventory.json`（版本、文件及 SHA-256）和 `THIRD_PARTY_NOTICES.txt`。框架生成的入口也属于 WXT，源码在第三方源代码快照内。

完整锁文件有 **533 条依赖记录**，包含平台可选包及构建／测试传递依赖；并非 533 个运行时库。`licenses/dependency-inventory.json` 记录其声明许可证。开发工具中有 MPL-2.0（Mozilla 审查工具）、Python-2.0（argparse）、双许可证等；这些工具并未分发进安装包，其许可证不会仅因构建／检查本项目就变成本项目整体许可证。不要把此结论扩展为允许将它们直接复制进运行时。`winreg` 的锁文件仅笼统声明 BSD，属于未打包的 web-ext 开发依赖，而不是已核准的运行时组件。

MIT 允许使用、修改与再分发，条件是保留相关版权与许可通知；MIT 与 GPL 兼容。本项目的 GPL 声明不抹去第三方 MIT 许可。参考 [GNU 兼容性说明](https://www.gnu.org/licenses/license-list.html.html#Expat)、[WXT 上游 MIT 许可](https://github.com/wxt-dev/wxt/blob/8fea9b4837282f4ad2a0d085ced6bee1a7de08fb/LICENSE)。

## 已补齐的发布事项

- `LICENSE` 为 GNU 官方 GPL v3 全文，项目选择 **GPL-3.0-only**；新增 `COPYRIGHT.md`、源码 SPDX 标识及设置页许可／无担保说明。
- MIT 许可和项目 GPL 全文随安装包分发，隐私说明可从设置页打开。
- 默认图片模型更改为 `deepseek/deepseek-v4.1-flash`。本次免费模型目录查询确认它声明了图像输入及结构化输出能力；这不保证每个服务路由的识别质量。已有用户主动保存的模型不覆盖，新安装／缺省配置使用新默认值。
- 新增原创图标，安装包包含 16 / 32 / 48 / 96 / 128px；256 / 512px 和 SVG 位于源码／商店资料，不增加安装包负担。
- Firefox 140+ 使用内置数据传输同意声明；Android 最低版本声明补为 142，解决检查器警告。当前验收仅涵盖桌面，不据此声称 Android 已测试。
- 设置页采用静态 HTML 模板并单独控制 Popup 按钮，消除动态 innerHTML 检查警告；模型输出仍通过 textContent 渲染。
- 禁用隐私窗口运行，避免普通与隐私窗口共享后台原文缓存。
- 远程图片下载限定 HTTPS，拒绝重定向，省去具体页面来源；本机回环 HTTP 仍支持。Pixiv 下载只附固定来源，不携带网站 Cookie 或 API Key。
- 安装包不含 README、交付说明、测试、审计报告、源码快照、OCR、浏览器测试环境或用户漫画。它们仅出现在单独源码／商店资料包中，或留在本地测试临时目录直到清理。

## 检查与边界

79 项自动测试通过，Chrome for Testing 153 和 Firefox 155 的实际扩展交互通过；包括默认模型流程、Pixiv 来源规则、框选、外观、术语、网页范围、异常恢复和原图保留。Mozilla `web-ext 10.7.0` 检查为 **0 errors / 0 warnings / 0 notices**。`npm audit` 当前报告 **0 已知漏洞**，这不等于不存在未知漏洞。

独立源码归档解压到空目录后执行 `npm ci` 和 `npm run build`，Chrome、Firefox 各 **18 个安装文件逐字节一致**。文件 SHA-256、Mozilla 检查结果和依赖审计原始结果保存在 `store/REPRODUCIBILITY.json`、`store/AMO-LINT.json`、`store/NPM-AUDIT.json`；这些报告不进入安装包。

依赖扫描、模型目录查询及本地模拟验收不产生付费推理费用。正式提交前仍需提供真实发布者信息和可公开下载的该版本源码；如果 AMO 要求真实服务验证，测试凭证应私下提供，不能出现在公开包内。不存在“本地检查通过就保证商店批准”的承诺。

AMO 的源码附件仅供审核员访问；GPL 对用户的源码提供义务需要另行履行。建议把本次源码 ZIP 与安装 ZIP 作为公开 Release 附件，并在商店描述链接到**这一版本的源码 ZIP**。参见 [Mozilla 源码提交要求](https://extensionworkshop.com/documentation/publish/source-code-submission/)、[数据同意机制](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)、[附加组件政策](https://extensionworkshop.com/documentation/publish/add-on-policies/)。

## 与之前方案的差异

除默认图片模型、原创图标与许可证外，这次增加隐私说明、运行时来源清单、审查工具和可复现源码材料；为发布检查收紧图片下载及隐私窗口行为。翻译模型接口、关闭思考、1500 输出 Token 限额、3 请求并发和原有交互保持。
