import 'package:artist_workbench_ui/artist_workbench_ui.dart';
import 'package:flutter/material.dart';

void main() {
  runApp(const ComponentLabApp());
}

class ComponentLabApp extends StatefulWidget {
  const ComponentLabApp({super.key});

  @override
  State<ComponentLabApp> createState() => _ComponentLabAppState();
}

class _ComponentLabAppState extends State<ComponentLabApp> {
  ThemeMode _themeMode = ThemeMode.dark;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Workbench UI Lab',
      theme: WorkbenchTheme.light(),
      darkTheme: WorkbenchTheme.dark(),
      themeMode: _themeMode,
      home: ComponentLab(
        themeMode: _themeMode,
        onThemeModeChanged: (value) => setState(() => _themeMode = value),
      ),
    );
  }
}

class ComponentLab extends StatefulWidget {
  const ComponentLab({
    required this.themeMode,
    required this.onThemeModeChanged,
    super.key,
  });

  final ThemeMode themeMode;
  final ValueChanged<ThemeMode> onThemeModeChanged;

  @override
  State<ComponentLab> createState() => _ComponentLabState();
}

class _ComponentLabState extends State<ComponentLab> {
  final Set<String> _selectedTags = {'1girl', 'blue eyes'};
  String _lastAction = '等待交互';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final surfaces = context.workbenchSurface;
    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Container(
                decoration: BoxDecoration(
                  color: surfaces.surface,
                  border: Border(bottom: BorderSide(color: surfaces.border)),
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: WorkbenchTokens.space32,
                  vertical: WorkbenchTokens.space20,
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            theme.colorScheme.primary,
                            theme.colorScheme.tertiary,
                          ],
                        ),
                        borderRadius: BorderRadius.circular(
                          WorkbenchTokens.radiusMedium,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: surfaces.glow,
                            blurRadius: 22,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: const Icon(Icons.auto_awesome_rounded),
                    ),
                    const SizedBox(width: WorkbenchTokens.space16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Workbench UI Lab',
                            style: theme.textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            '独立设计语言 · 组件状态 · 动效实验',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                    SegmentedButton<ThemeMode>(
                      showSelectedIcon: false,
                      segments: const [
                        ButtonSegment(
                          value: ThemeMode.light,
                          icon: Icon(Icons.light_mode_rounded),
                          label: Text('浅色'),
                        ),
                        ButtonSegment(
                          value: ThemeMode.dark,
                          icon: Icon(Icons.dark_mode_rounded),
                          label: Text('深色'),
                        ),
                      ],
                      selected: {widget.themeMode},
                      onSelectionChanged: (value) =>
                          widget.onThemeModeChanged(value.first),
                    ),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: WorkbenchTokens.pagePadding,
              sliver: SliverList.list(
                children: [
                  _LabIntro(lastAction: _lastAction),
                  const SizedBox(height: WorkbenchTokens.space24),
                  _LabSection(
                    number: '01',
                    title: '动作按钮',
                    description: '相同尺寸、反馈与焦点逻辑，业务页面只表达按钮意图。',
                    child: Wrap(
                      spacing: WorkbenchTokens.space12,
                      runSpacing: WorkbenchTokens.space12,
                      children: [
                        WorkbenchButton(
                          label: '生成图片',
                          icon: Icons.auto_awesome_rounded,
                          onPressed: () => setState(() => _lastAction = '生成图片'),
                        ),
                        WorkbenchButton(
                          label: '加入暂存篮',
                          icon: Icons.shopping_basket_outlined,
                          variant: WorkbenchButtonVariant.secondary,
                          onPressed: () =>
                              setState(() => _lastAction = '加入暂存篮'),
                        ),
                        WorkbenchButton(
                          label: '安静操作',
                          variant: WorkbenchButtonVariant.quiet,
                          onPressed: () => setState(() => _lastAction = '安静操作'),
                        ),
                        WorkbenchButton(
                          label: '删除',
                          icon: Icons.delete_outline_rounded,
                          variant: WorkbenchButtonVariant.danger,
                          onPressed: () => setState(() => _lastAction = '删除'),
                        ),
                        const WorkbenchButton(label: '正在同步', loading: true),
                        const WorkbenchButton(label: '不可用'),
                      ],
                    ),
                  ),
                  const SizedBox(height: WorkbenchTokens.space24),
                  _LabSection(
                    number: '02',
                    title: '提示词标签',
                    description: '翻译是辅助信息，选中、移除和键盘焦点属于组件本身。',
                    child: Wrap(
                      spacing: WorkbenchTokens.space8,
                      runSpacing: WorkbenchTokens.space8,
                      children: [
                        for (final entry in const {
                          '1girl': '1名女性',
                          'blue eyes': '蓝色眼睛',
                          'silver hair': '银发',
                          'looking at viewer': '看向观众',
                          'school uniform': '校服',
                        }.entries)
                          WorkbenchTag(
                            label: entry.key,
                            translation: entry.value,
                            selected: _selectedTags.contains(entry.key),
                            onSelected: (selected) {
                              setState(() {
                                if (selected) {
                                  _selectedTags.add(entry.key);
                                } else {
                                  _selectedTags.remove(entry.key);
                                }
                                _lastAction = selected
                                    ? '选中 ${entry.key}'
                                    : '取消 ${entry.key}';
                              });
                            },
                            onRemoved: () {
                              setState(() {
                                _selectedTags.remove(entry.key);
                                _lastAction = '移除 ${entry.key}';
                              });
                            },
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: WorkbenchTokens.space24),
                  _LabSection(
                    number: '03',
                    title: '交互卡片',
                    description: '悬停只改变层级和光感，不挤压周围布局。',
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final compact = constraints.maxWidth < 760;
                        final width = compact ? constraints.maxWidth : 300.0;
                        return Wrap(
                          spacing: WorkbenchTokens.space16,
                          runSpacing: WorkbenchTokens.space16,
                          children: [
                            _ExampleCard(
                              width: width,
                              icon: Icons.palette_outlined,
                              title: '画师串编辑器',
                              description: '调整画师、权重和质量提示词。',
                              accent: theme.colorScheme.primary,
                              onTap: () =>
                                  setState(() => _lastAction = '打开画师串编辑器'),
                            ),
                            _ExampleCard(
                              width: width,
                              icon: Icons.grid_view_rounded,
                              title: 'Danbooru 画廊',
                              description: '搜索、收藏并整理参考标签。',
                              accent: theme.colorScheme.tertiary,
                              onTap: () => setState(
                                () => _lastAction = '打开 Danbooru 画廊',
                              ),
                            ),
                            _ExampleCard(
                              width: width,
                              icon: Icons.translate_rounded,
                              title: '翻译小词典',
                              description: '联机查词与本地词典共同工作。',
                              accent: surfaces.success,
                              onTap: () =>
                                  setState(() => _lastAction = '打开翻译小词典'),
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: WorkbenchTokens.space48),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LabIntro extends StatelessWidget {
  const _LabIntro({required this.lastAction});

  final String lastAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '先把体验做成系统，\n再把系统装进产品。',
                style: theme.textTheme.headlineMedium?.copyWith(
                  height: 1.15,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: WorkbenchTokens.space12),
              Text(
                '当前版本只包含最小基础层，不携带登录、数据库或生成业务。',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
        Text(
          '最近操作：$lastAction',
          style: theme.textTheme.labelMedium?.copyWith(
            color: theme.colorScheme.primary,
          ),
        ),
      ],
    );
  }
}

class _LabSection extends StatelessWidget {
  const _LabSection({
    required this.number,
    required this.title,
    required this.description,
    required this.child,
  });

  final String number;
  final String title;
  final String description;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final surfaces = context.workbenchSurface;
    return Container(
      padding: WorkbenchTokens.cardPadding,
      decoration: BoxDecoration(
        color: surfaces.surface,
        borderRadius: BorderRadius.circular(WorkbenchTokens.radiusXLarge),
        border: Border.all(color: surfaces.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: WorkbenchTokens.space8,
                  vertical: WorkbenchTokens.space4,
                ),
                decoration: BoxDecoration(
                  color: theme.colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(
                    WorkbenchTokens.radiusSmall,
                  ),
                ),
                child: Text(
                  number,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onPrimaryContainer,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: WorkbenchTokens.space12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: WorkbenchTokens.space4),
                    Text(
                      description,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: WorkbenchTokens.space20),
          child,
        ],
      ),
    );
  }
}

class _ExampleCard extends StatelessWidget {
  const _ExampleCard({
    required this.width,
    required this.icon,
    required this.title,
    required this.description,
    required this.accent,
    required this.onTap,
  });

  final double width;
  final IconData icon;
  final String title;
  final String description;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SizedBox(
      width: width,
      child: WorkbenchCard(
        accent: accent,
        onTap: onTap,
        semanticLabel: title,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: accent),
            const SizedBox(height: WorkbenchTokens.space24),
            Text(
              title,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: WorkbenchTokens.space8),
            Text(
              description,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                height: 1.45,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
