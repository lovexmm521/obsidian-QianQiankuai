// AIView.ts
import { ItemView, WorkspaceLeaf } from "obsidian";
import MyPlugin, { MyPluginSettings } from "./main"; // 导入主插件和设置

// 定义一个唯一的视图类型
export const AI_VIEW_TYPE = "ai-sidebar-view";

export class AIView extends ItemView {
	plugin: MyPlugin;
	selectElement: HTMLSelectElement;
	currentElement: HTMLElement | null; // <--- 修复 Error 2 (声明处)
	wrapper: HTMLElement;
	previousUrl: string | null = null; // <--- 修复 Error 1

	constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	// 视图的唯一标识
	getViewType() {
		return AI_VIEW_TYPE;
	}

	// 视图在标签页上显示的名称
	getDisplayText() {
		return "AI 助手";
	}

	// 视图的图标 (修改为 'heart' -> 爱心)
	getIcon() {
		return "heart";
	}

	// 当视图被打开时执行 (替代 Siyuan 的 render)
	async onOpen() {
		// 获取视图的内容容器
		// this.containerEl 是 Obsidian 提供的视图根元素
		// this.containerEl.children[1] 是可滚动的内容区域
		const contentEl = this.containerEl.children[1];
		contentEl.empty(); // 清空内容

		// --- 几乎所有 render() 逻辑都移到这里 ---

		const wrapper = document.createElement('div');
		wrapper.style.position = 'relative';
		wrapper.style.width = '100%';
		wrapper.style.height = '100%';
		wrapper.style.overflow = 'hidden'; // Y 轴也隐藏, webview 内部自己滚动
		this.wrapper = wrapper;
		contentEl.appendChild(wrapper);

		// User Agents (保持不变)
		const iphoneUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
		const desktopUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';

		// 仅保留 createWebview, 移除 createIframe
		const createWebview = (url: string, userAgent: string, minWidth = '300px'): HTMLElement => {
			const webview = document.createElement('webview') as any;
			webview.src = url;
			webview.setAttribute('useragent', userAgent);
			// 注意: Obsidian 的 webview 权限可能更严格
			// 'contextIsolation' 可能需要调整, 但我們先保留
			webview.setAttribute('webpreferences', 'contextIsolation, javascript=yes');
			webview.setAttribute('allowpopups', '');
			webview.style.width = '100%';
			webview.style.height = '100%';
			webview.style.border = 'none';
			webview.style.minWidth = minWidth;
			return webview;
		};

		const controlsContainer = document.createElement('div');
		controlsContainer.style.position = 'absolute';
		controlsContainer.style.top = '10px';
		controlsContainer.style.right = '10px'; // 默认在右上角
		controlsContainer.style.zIndex = '10';
		controlsContainer.style.display = 'flex';
		controlsContainer.style.alignItems = 'center';

		controlsContainer.style.opacity = '0.3';
		controlsContainer.style.transition = 'opacity 0.3s ease-in-out';
		wrapper.appendChild(controlsContainer);

		controlsContainer.addEventListener('mouseenter', () => controlsContainer.style.opacity = '1');
		controlsContainer.addEventListener('mouseleave', () => controlsContainer.style.opacity = '0.3');

		const select = document.createElement('select');
		select.className = "dropdown"; // Obsidian 中使用 .dropdown 样式
		select.style.cursor = 'pointer';
		this.selectElement = select;
		controlsContainer.appendChild(select);

		select.addEventListener('mousedown', (e: MouseEvent) => {
			e.stopPropagation();
		});

		select.addEventListener('change', (event) => {
			const selectedOption = (event.target as HTMLSelectElement).selectedOptions[0];
			if (!selectedOption) {
				return;
			}
			const siteKey = selectedOption.dataset.key;
			const newUrl = selectedOption.value;

			// 切换位置逻辑 (保持不变)
			if (newUrl === 'local::toggle-position') {
				if (controlsContainer.style.left === 'auto' || controlsContainer.style.left === '') {
					controlsContainer.style.left = '10px';
					controlsContainer.style.right = 'auto';
				} else {
					controlsContainer.style.left = 'auto';
					controlsContainer.style.right = '10px';
				}

				if (this.previousUrl) {
					this.selectElement.value = this.previousUrl;
				}
				return;
			}

			// 移除旧的 webview
			if (this.currentElement) {
				this.wrapper.removeChild(this.currentElement);
				this.currentElement = null; // <--- 修复 Error 2 (赋值处)
			}

			// --- 核心修改 ---
			// 移除了 'local::minimalist-ai' 的判断
			// 移除了 isMobile 和 iframe 的判断

			const minWidth = siteKey === '当贝ai' ? '408px' : '300px';
			const specialUserAgents: { [key: string]: string } = {
				'谷歌登录': iphoneUserAgent,
				'秘塔ai': desktopUserAgent,
			};

			// <--- 修复 Error 3 ---
			// 我们需要检查 siteKey 是否为 undefined (即使它来自 dataset)
			// 如果 siteKey 存在 (truthy), 尝试在 specialUserAgents 中查找
			// 如果找不到, 或者 siteKey 不存在, 就使用 desktopUserAgent
			const userAgent = (siteKey ? specialUserAgents[siteKey] : undefined) || desktopUserAgent;
			// <--- 修复 Error 3 结束 ---

			// 总是使用 webview
			this.currentElement = createWebview(newUrl, userAgent, minWidth);

			// --- 修改结束 ---

			this.previousUrl = newUrl;
			this.wrapper.appendChild(this.currentElement);
		});

		// 移除 Siyuan 特定的 .layout__dockr 逻辑
		// --- vvv 这里是修复 ---
		// 监听全局的 mousedown 事件
		window.addEventListener('mousedown', (e: MouseEvent) => {
			// 检查点击的是否是 Obsidian 的侧边栏拉动条
			if ((e.target as HTMLElement).classList.contains('workspace-leaf-resize-handle')) {
				if (this.currentElement) {
					// 如果是，则临时禁用 webview 的鼠标事件
					this.currentElement.style.pointerEvents = 'none';
				}
			}
		});

		// 监听全局的 mouseup 事件（这个你已经有了，保持不变）
		window.addEventListener('mouseup', () => {
			if (this.currentElement) {
				// 鼠标松开时，恢复 webview 的鼠标事件
				this.currentElement.style.pointerEvents = 'auto';
			}
		});
		// --- ^^^ 修复结束 ---

		// 使用主插件的 settings 来填充选项
		this.populateSelectWithOptions(this.plugin.settings);
	}

	// 当视图关闭时
	async onClose() {
		// 清理工作 (如果需要)
	}

	/**
	 * 根据设置填充下拉列表选项
	 * @param settings The current plugin settings.
	 */
	private populateSelectWithOptions(settings: MyPluginSettings) {
		// 移除了 '极简ai'
		const baseUrls = {
			'免费ai': 'https://e12.free-chat.asia/',
			'当贝ai': 'https://ai.dangbei.com/chat',
			'深度ai': 'https://chat.deepseek.com/sign_in',
			'豆包ai': 'https://www.doubao.com/chat/',
			'通义ai': 'https://www.tongyi.com/',
			'千问ai': 'https://chat.qwen.ai/',
			'智谱ai': 'https://chatglm.cn/main/alltoolsdetail?lang=zh',
			'月之ai': 'https://www.kimi.com/',
			'秘塔ai': 'https://metaso.cn/',
			'迷你ai': 'https://agent.minimaxi.com/',
			'接口ai': 'https://web.chatboxai.app/',
			'无限ai': 'https://g4f.dev/chat',
			'发现ai': 'https://www.faxianai.com/',
			'知识ai': 'https://ima.qq.com/',
			'知识库': 'https://ima.qq.com/wikis',
			'提示词': 'https://prompt.always200.com/',
			'换位置': 'local::toggle-position',
			'Notion': 'https://www.notion.com/zh-cn',
			'n8n工作流': 'http://localhost:5678/',
			'Dify工作流': 'http://localhost/apps',
		};

		const advancedUrls = {
			'Gemini': 'https://gemini.google.com/app',
			'ChatGPT': 'https://sharedchat.fun/',
			'chatgpt': 'https://chatgpt.com/?model=auto',
			'grok': 'https://grok.com/',
			'香蕉ai': 'https://labs.google/fx/tools/whisk',
			'即梦ai': 'https://jimeng.jianying.com/ai-tool/home',
			'图书馆': 'https://vxc3hj17dym.feishu.cn/wiki/VDb1wMKDNiNj0mkJn6VcFgRenVc',
			'AGI之路': 'https://waytoagi.feishu.cn/wiki/QPe5w5g7UisbEkkow8XcDmOpn8e',
			'n8n社区': 'https://n8ncn.io/',
			'谷歌登录': 'https://accounts.google.com/ServiceLogin?passive=1209600&continue=https://gemini.google.com/app&followup=https://gemini.google.com/app&ec=GAZAkgU',
			'即梦登录': 'https://open.douyin.com/platform/oauth/connect?client_key=aw97st49sighch6k&response_type=code&scope=user_info&state=7742f5c93gAToVCgoVPZIDA5NDFmOWYxMjRmZWFkZTdkM2MwYzY4ZWJlZjNmMGQzoU7ZOGh0dHBzOi8vamltZW5nLmplYW55aW5nLmNvbS9haS10b29sL3RoaXJkLXBhcnR5LWNhbGxiYWNroVYBoUkAoUQAoUHSAAfWn6FNAKFIs2ppbWVuZy5qaWFueWluZy5jb22hUgKiUEzROl6mQUNUSU9OoKFMoKFU2SBhODIxMzc5Zjg5OWZkNjU1ZDMxMjQxOWZiZGVkODZhYaFXAKFGAKJTQQChVcKiTUzC&redirect_uri=https://jimeng.jianying.com/passport/web/web_login_success',
			'grok登录': 'https://accounts.x.ai/sign-in',
		};

		// 步骤 1: 根据设置确定总列表
		let finalUrls = { ...baseUrls };
		// 使用 'isAdvancedMember' 检查
		if (settings.isAdvancedMember) {
			finalUrls = { ...baseUrls, ...advancedUrls };
		}

		// 步骤 2: 移除了 isMobile 的判断逻辑

		this.selectElement.innerHTML = ''; // 清空选项
		Object.keys(finalUrls).forEach(key => {
			const option = document.createElement('option');
			option.value = finalUrls[key as keyof typeof finalUrls];
			option.dataset.key = key;
			option.textContent = key;
			this.selectElement.appendChild(option);
		});

		// 触发 change 来加载第一个项目
		// 确保 selectElement 中至少有一个选项，否则 .dispatchEvent 可能会出错（虽然在这里基本不可能）
		if (this.selectElement.options.length > 0) {
			this.selectElement.dispatchEvent(new Event('change'));
		}
	}

	/**
	 * 公共方法, 用于在设置更改时从 main.ts 更新 UI
	 * @param settings The new settings from the plugin.
	 */
	public update(settings: MyPluginSettings) {
		this.populateSelectWithOptions(settings);
	}
}
