// main.ts
import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, Modal, Notice } from 'obsidian'; // <--- 导入 Modal 和 Notice
import { AIView, AI_VIEW_TYPE } from './AIView'; // 导入你的视图

// --- 你的设置 ---
export interface MyPluginSettings {
	isAdvancedMember: boolean; // <-- Siyuan 的 'isActivated' 对应这个
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	isAdvancedMember: false,
}
// --- 设置结束 ---


// --- 主插件类 ---
export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	view: AIView; // 保存视图实例的引用

	async onload() {
		console.log('正在加载 AI 助手插件...');

		// 加载设置
		await this.loadSettings();

		// 注册你的视图
		this.registerView(
			AI_VIEW_TYPE,
			(leaf) => {
				this.view = new AIView(leaf, this);
				return this.view;
			}
		);

		// 添加一个功能区图标 (Ribbon Icon)
		// 这就是你要求的 "爱心" SVG 图标 (Obsidian 内置的 'heart' 图标)
		this.addRibbonIcon('heart', '打开 AI 助手', () => {
			this.activateView();
		});

		// 添加设置页面
		this.addSettingTab(new MySettingTab(this.app, this));

		console.log('AI 助手插件已加载。');
	}

	onunload() {
		console.log('正在卸载 AI 助手插件...');
	}

	// 激活并显示视图
	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null; // <--- 修复 Error 4, 5, 6
		const leaves = workspace.getLeavesOfType(AI_VIEW_TYPE);

		if (leaves.length > 0) {
			// 视图已经存在
			leaf = leaves[0];
		} else {
			// 视图不存在, 在右侧边栏创建
			leaf = workspace.getRightLeaf(false); // false 表示不拆分
			if (!leaf) {
				// 如果右侧边栏不可用, 尝试左侧
				leaf = workspace.getLeftLeaf(false);
			}
			// 避免 leaf 为 null 的情况 (虽然很少见)
			if (leaf) {
				await leaf.setViewState({
					type: AI_VIEW_TYPE,
					active: true,
				});
			}
		}

		// 激活视图
		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);

		// 当设置保存时, 通知视图更新
		// 检查 this.view 是否存在, 因为设置可能在视图打开前就被更改
		if (this.view) {
			this.view.update(this.settings);
		}
	}
}
// --- 主插件类结束 ---


// --- 设置页面类 (已修改) ---
class MySettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'AI 助手设置' });

		// 1. 显示当前状态 (替换 Siyuan 的 .b3-chip)
		new Setting(containerEl)
			.setName('当前状态')
			.setDesc(this.plugin.settings.isAdvancedMember ? '已激活' : '未激活')
			// 添加一些视觉提示
			.then(setting => {
				const descEl = setting.descEl;
				if (this.plugin.settings.isAdvancedMember) {
					descEl.addClass('text-success'); // Obsidian 内置 helper class
					descEl.style.fontWeight = 'bold';
				} else {
					descEl.addClass('text-error'); // Obsidian 内置 helper class
				}
			});


		// 2. 添加一个按钮来打开激活码弹窗
		new Setting(containerEl)
			.setName('激活高级版')
			.setDesc('输入激活码以解锁高级功能。')
			.addButton(button => button
				.setButtonText('输入激活码')
				.onClick(() => {
					// 打开弹窗, 并传入一个回调函数, 让弹窗在激活成功后
					// 可以调用 this.display() 来刷新设置页面的状态
					new ActivationModal(this.app, this.plugin, () => this.display()).open();
				}));
	}
}
// --- 设置页面类结束 ---


// --- vvv 新增: 激活码弹窗 (替代 Siyuan 的 Dialog) vvv ---
class ActivationModal extends Modal {
	plugin: MyPlugin;
	onSuccessCallback: () => void; // 用于刷新设置页面的回调

	constructor(app: App, plugin: MyPlugin, callback: () => void) {
		super(app);
		this.plugin = plugin;
		this.onSuccessCallback = callback;
	}

	// 当弹窗打开时
	onOpen() {
		const { contentEl } = this;

		// 设置弹窗标题
		this.setTitle('千千·遇见版');

		// --- vvv 修复“已激活”状态的逻辑 vvv ---

		// 步骤 1: 检查是否已经激活
		if (this.plugin.settings.isAdvancedMember) {

			// 如果已激活, 只显示状态和关闭按钮
			contentEl.createEl('h3', { text: '已激活' });
			contentEl.createEl('p', { text: '高级版已激活，无需重复输入激活码。' });

			// 按钮容器
			const buttonContainer = contentEl.createDiv();
			buttonContainer.style.marginTop = '2rem';
			buttonContainer.style.textAlign = 'right';

			// 关闭按钮
			const closeBtn = buttonContainer.createEl('button', {
				text: '关闭',
				cls: 'mod-cta' // 激活状态下, 关闭是主要操作
			});
			closeBtn.addEventListener('click', () => {
				this.close();
			});

		} else {
			// 步骤 2: 如果未激活, 才显示输入框 (粘贴原有逻辑)

			// 复制 Siyuan 的 UI 结构
			// 1. 当前状态
			const statusDiv = contentEl.createDiv();
			statusDiv.style.marginBottom = '1rem';
			statusDiv.setText('当前状态: ');
			const statusChip = statusDiv.createSpan({
				text: '未激活' // 明确是未激活
			});
			statusChip.addClass('text-error');
			statusChip.style.fontWeight = 'bold';

			// 2. 标签
			contentEl.createEl('label', {
				text: '请输入激活码:',
				attr: { 'for': 'activationCode' }
			});

			// 3. 输入框
			const inputElement = contentEl.createEl('input', {
				attr: {
					id: 'activationCode',
					placeholder: '输入激活码'
				}
			});
			inputElement.type = 'password'; // 使用密码类型
			inputElement.style.display = 'block';
			inputElement.style.width = '100%';
			inputElement.style.marginTop = '0.5rem';

			// 4. 描述文字
			contentEl.createEl('small', {
				text: '输入正确的激活码即可激活。',
				cls: 'setting-item-description'
			});

			// 5. 按钮容器 (Siyuan: b3-dialog__action)
			const buttonContainer = contentEl.createDiv();
			buttonContainer.style.marginTop = '2rem';
			buttonContainer.style.textAlign = 'right';

			// 6. 关闭按钮 (Siyuan: b3-button--cancel)
			const cancelBtn = buttonContainer.createEl('button', { text: '关闭' });
			cancelBtn.addEventListener('click', () => {
				this.close();
			});

			// 7. 激活按钮 (Siyuan: b3-button--text)
			const saveBtn = buttonContainer.createEl('button', {
				text: '激活',
				cls: 'mod-cta' // Obsidian 的 "Call to Action" 样式
			});
			saveBtn.style.marginLeft = '0.5rem';

			// 激活逻辑 (完全复制 Siyuan 的)
			saveBtn.addEventListener('click', async () => {
				// Siyuan 的激活码计算逻辑
				const correctCode = 'W'.charCodeAt(0) + 'Y'.charCodeAt(0) + 'Q'.charCodeAt(0) + Math.pow(2, 7) + Math.pow(2, 1) + Math.pow(2, 2) + Math.pow(2, 7) - Math.pow(2, 1);
				// correctCode 结果为 517

				if (parseInt(inputElement.value, 10) === correctCode) {
					// 激活成功
					this.plugin.settings.isAdvancedMember = true;
					await this.plugin.saveSettings();

					new Notice("激活成功！"); // 替换 Siyuan 的 showMessage

					this.onSuccessCallback(); // 调用回调, 刷新设置页面
					this.close();
				} else {
					// 激活失败
					new Notice("激活码错误", 3000); // 替换 Siyuan 的 showMessage
				}
			});
		}
		// --- ^^^ 修复“已激活”状态的逻辑 ^^^ ---
	}

	// 当弹窗关闭时
	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
// --- ^^^ 新增: 激活码弹窗 ^^^ ---
