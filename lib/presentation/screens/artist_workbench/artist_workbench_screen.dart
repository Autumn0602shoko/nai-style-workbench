import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../features/artist_workbench/domain/artist_tag_parser.dart';
import '../../providers/pending_prompt_provider.dart';

class ArtistWorkbenchScreen extends ConsumerStatefulWidget {
  const ArtistWorkbenchScreen({super.key});

  @override
  ConsumerState<ArtistWorkbenchScreen> createState() =>
      _ArtistWorkbenchScreenState();
}

class _ArtistWorkbenchScreenState extends ConsumerState<ArtistWorkbenchScreen> {
  final _sourceController = TextEditingController();
  final _newArtistController = TextEditingController();
  final _scrollController = ScrollController();
  var _artists = <ArtistTag>[];

  @override
  void dispose() {
    _sourceController.dispose();
    _newArtistController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _parseSource() {
    final parsed = parseArtistTags(_sourceController.text);
    if (parsed.isEmpty) {
      _showMessage('没有识别到 artist: 标签，请检查输入格式');
      return;
    }
    setState(() => _artists = _mergeArtists(_artists, parsed));
  }

  Future<void> _importLegacyJson() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['json'],
      dialogTitle: '导入旧版画师串 JSON',
    );
    final path = result?.files.single.path;
    if (path == null || !mounted) return;

    try {
      final source = await File(path).readAsString();
      final imported = parseArtistsFromLegacyJson(source);
      if (!mounted) return;
      if (imported.isEmpty) {
        _showMessage('文件中没有找到可导入的画师标签');
        return;
      }
      setState(() => _artists = _mergeArtists(_artists, imported));
      _showMessage('已导入 ${imported.length} 个画师');
    } on FormatException {
      if (mounted) _showMessage('这个文件不是有效的 JSON');
    } on FileSystemException {
      if (mounted) _showMessage('无法读取这个文件');
    }
  }

  List<ArtistTag> _mergeArtists(
    Iterable<ArtistTag> current,
    Iterable<ArtistTag> incoming,
  ) {
    final merged = <ArtistTag>[];
    final names = <String>{};
    for (final artist in [...current, ...incoming]) {
      if (names.add(artist.name.toLowerCase())) merged.add(artist);
    }
    return merged;
  }

  void _addArtist() {
    final name = _newArtistController.text.trim();
    if (name.isEmpty) return;
    setState(() {
      _artists = _mergeArtists(_artists, [ArtistTag(name: name, weight: 1)]);
      _newArtistController.clear();
    });
  }

  void _updateArtist(int index, ArtistTag artist) {
    setState(() {
      final updated = [..._artists];
      updated[index] = artist;
      _artists = updated;
    });
  }

  void _removeArtist(int index) {
    setState(() {
      final updated = [..._artists]..removeAt(index);
      _artists = updated;
    });
  }

  void _reorderArtists(int oldIndex, int newIndex) {
    setState(() {
      final updated = [..._artists];
      final artist = updated.removeAt(oldIndex);
      updated.insert(newIndex, artist);
      _artists = updated;
    });
  }

  Future<void> _copyPrompt() async {
    final prompt = buildArtistPrompt(_artists);
    if (prompt.isEmpty) {
      _showMessage('请先启用至少一个画师');
      return;
    }
    await Clipboard.setData(ClipboardData(text: prompt));
    if (mounted) _showMessage('画师串已复制');
  }

  void _sendToGeneration() {
    final prompt = buildArtistPrompt(_artists);
    if (prompt.isEmpty) {
      _showMessage('请先启用至少一个画师');
      return;
    }
    ref
        .read(pendingPromptNotifierProvider.notifier)
        .set(prompt: prompt, targetType: SendTargetType.mainPrompt);
    context.go('/');
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final output = buildArtistPrompt(_artists);

    return Scaffold(
      body: SafeArea(
        child: Scrollbar(
          controller: _scrollController,
          thumbVisibility: true,
          child: SingleChildScrollView(
            controller: _scrollController,
            padding: const EdgeInsets.fromLTRB(28, 24, 36, 40),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1180),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildHeader(theme),
                    const SizedBox(height: 22),
                    _buildSourceCard(theme),
                    const SizedBox(height: 18),
                    _buildEditorCard(theme),
                    const SizedBox(height: 18),
                    _buildOutputCard(theme, output),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(ThemeData theme) {
    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      runSpacing: 12,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.palette_outlined, color: theme.colorScheme.primary),
                const SizedBox(width: 10),
                Text('画师工作台', style: theme.textTheme.headlineMedium),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              '解析、调整并复用 NovelAI 画师串',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
        Chip(
          avatar: const Icon(Icons.desktop_windows_outlined, size: 18),
          label: const Text('桌面端 2.0'),
          side: BorderSide(color: theme.colorScheme.outlineVariant),
        ),
      ],
    );
  }

  Widget _buildSourceCard(ThemeData theme) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('01  导入与解析', style: theme.textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(
              '支持 NovelAI 权重、括号强调、复制的元数据和旧版工作台 JSON。',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _sourceController,
              minLines: 4,
              maxLines: 8,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: '例如：1.1::artist:yd (orange maru)::, artist:henreader',
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                FilledButton.icon(
                  onPressed: _parseSource,
                  icon: const Icon(Icons.auto_fix_high),
                  label: const Text('解析画师串'),
                ),
                OutlinedButton.icon(
                  onPressed: _importLegacyJson,
                  icon: const Icon(Icons.file_open_outlined),
                  label: const Text('导入旧版 JSON'),
                ),
                TextButton.icon(
                  onPressed: () => _sourceController.clear(),
                  icon: const Icon(Icons.backspace_outlined),
                  label: const Text('清空输入'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEditorCard(ThemeData theme) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text('02  画师与权重', style: theme.textTheme.titleMedium),
                ),
                Text(
                  '${_artists.where((artist) => artist.enabled).length}'
                  ' / ${_artists.length} 已启用',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _newArtistController,
                    onSubmitted: (_) => _addArtist(),
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      labelText: '手动添加画师',
                      hintText: '输入 Danbooru 画师标签',
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                FilledButton.tonalIcon(
                  onPressed: _addArtist,
                  icon: const Icon(Icons.add),
                  label: const Text('添加'),
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (_artists.isEmpty)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 42),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerLowest,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: theme.colorScheme.outlineVariant),
                ),
                child: Column(
                  children: [
                    Icon(
                      Icons.palette_outlined,
                      size: 42,
                      color: theme.colorScheme.outline,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      '解析画师串或手动添加一个画师',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              )
            else
              ReorderableListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                buildDefaultDragHandles: false,
                itemCount: _artists.length,
                onReorderItem: _reorderArtists,
                itemBuilder: (context, index) {
                  final artist = _artists[index];
                  return _ArtistRow(
                    key: ValueKey('${artist.name}-$index'),
                    index: index,
                    artist: artist,
                    onChanged: (value) => _updateArtist(index, value),
                    onDelete: () => _removeArtist(index),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildOutputCard(ThemeData theme, String output) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('03  NovelAI 输出', style: theme.textTheme.titleMedium),
            const SizedBox(height: 14),
            Container(
              constraints: const BoxConstraints(minHeight: 92),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(12),
              ),
              child: SelectableText(
                output.isEmpty ? '启用的画师串会显示在这里' : output,
                style: theme.textTheme.bodyLarge?.copyWith(
                  fontFamily: 'monospace',
                  color: output.isEmpty
                      ? theme.colorScheme.onSurfaceVariant
                      : null,
                ),
              ),
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              alignment: WrapAlignment.end,
              children: [
                OutlinedButton.icon(
                  onPressed: _copyPrompt,
                  icon: const Icon(Icons.copy_outlined),
                  label: const Text('复制画师串'),
                ),
                FilledButton.icon(
                  onPressed: _sendToGeneration,
                  icon: const Icon(Icons.send_outlined),
                  label: const Text('送入 NovelAI 生成页'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ArtistRow extends StatelessWidget {
  const _ArtistRow({
    super.key,
    required this.index,
    required this.artist,
    required this.onChanged,
    required this.onDelete,
  });

  final int index;
  final ArtistTag artist;
  final ValueChanged<ArtistTag> onChanged;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      color: theme.colorScheme.surfaceContainerLowest,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(10, 8, 8, 8),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final compact = constraints.maxWidth < 760;
            final nameField = TextFormField(
              key: ValueKey('name-${artist.name}-$index'),
              initialValue: artist.name,
              enabled: artist.enabled,
              onChanged: (value) => onChanged(artist.copyWith(name: value)),
              decoration: const InputDecoration(
                border: InputBorder.none,
                isDense: true,
              ),
            );
            final weightControl = Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: compact ? 160 : 220,
                  child: Slider(
                    value: artist.weight.clamp(0.1, 2.0).toDouble(),
                    min: 0.1,
                    max: 2,
                    divisions: 38,
                    onChanged: artist.enabled
                        ? (value) => onChanged(artist.copyWith(weight: value))
                        : null,
                  ),
                ),
                SizedBox(
                  width: 46,
                  child: Text(
                    artist.weight.toStringAsFixed(2),
                    textAlign: TextAlign.center,
                    style: theme.textTheme.labelLarge,
                  ),
                ),
              ],
            );
            final controls = Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                ReorderableDragStartListener(
                  index: index,
                  child: const Padding(
                    padding: EdgeInsets.all(10),
                    child: Icon(Icons.drag_indicator),
                  ),
                ),
                IconButton(
                  tooltip: '删除',
                  onPressed: onDelete,
                  icon: const Icon(Icons.close),
                ),
              ],
            );

            if (compact) {
              return Column(
                children: [
                  Row(
                    children: [
                      Checkbox(
                        value: artist.enabled,
                        onChanged: (value) =>
                            onChanged(artist.copyWith(enabled: value ?? true)),
                      ),
                      Expanded(child: nameField),
                      controls,
                    ],
                  ),
                  Align(alignment: Alignment.centerRight, child: weightControl),
                ],
              );
            }

            return Row(
              children: [
                Checkbox(
                  value: artist.enabled,
                  onChanged: (value) =>
                      onChanged(artist.copyWith(enabled: value ?? true)),
                ),
                SizedBox(
                  width: 34,
                  child: Text(
                    '${index + 1}'.padLeft(2, '0'),
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
                Expanded(child: nameField),
                weightControl,
                controls,
              ],
            );
          },
        ),
      ),
    );
  }
}
