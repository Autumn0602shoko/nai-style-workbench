import 'package:flutter/material.dart';

import '../foundations/workbench_motion.dart';
import '../foundations/workbench_surface.dart';
import '../foundations/workbench_tokens.dart';

@immutable
class WorkbenchSidebarItem {
  const WorkbenchSidebarItem({
    required this.label,
    required this.icon,
    this.selectedIcon,
    this.badge,
    this.tooltip,
  });

  final String label;
  final IconData icon;
  final IconData? selectedIcon;
  final String? badge;
  final String? tooltip;
}

class WorkbenchSidebar extends StatelessWidget {
  const WorkbenchSidebar({
    required this.items,
    required this.selectedIndex,
    required this.onSelected,
    super.key,
    this.collapsed = false,
    this.header,
    this.footer,
    this.onCollapsedChanged,
    this.width = 240,
    this.collapsedWidth = 72,
  }) : assert(selectedIndex >= -1 && selectedIndex < items.length),
       assert(width >= collapsedWidth),
       assert(collapsedWidth >= WorkbenchTokens.controlLarge);

  final List<WorkbenchSidebarItem> items;
  final int selectedIndex;
  final ValueChanged<int> onSelected;
  final bool collapsed;
  final Widget? header;
  final Widget? footer;
  final ValueChanged<bool>? onCollapsedChanged;
  final double width;
  final double collapsedWidth;

  @override
  Widget build(BuildContext context) {
    final surfaces = context.workbenchSurface;
    final motion = context.workbenchMotion;
    return AnimatedContainer(
      duration: motion.resolve(context, motion.standard),
      curve: motion.standardCurve,
      width: collapsed ? collapsedWidth : width,
      decoration: BoxDecoration(
        color: surfaces.surface,
        border: Border(right: BorderSide(color: surfaces.border)),
      ),
      child: SafeArea(
        child: Column(
          children: [
            if (header != null)
              Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: collapsed
                      ? WorkbenchTokens.space12
                      : WorkbenchTokens.space16,
                  vertical: WorkbenchTokens.space16,
                ),
                child: AnimatedSize(
                  duration: motion.resolve(context, motion.standard),
                  alignment: Alignment.centerLeft,
                  child: header,
                ),
              ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(
                  horizontal: WorkbenchTokens.space8,
                  vertical: WorkbenchTokens.space8,
                ),
                itemCount: items.length,
                separatorBuilder: (context, index) =>
                    const SizedBox(height: WorkbenchTokens.space4),
                itemBuilder: (context, index) => _SidebarTile(
                  item: items[index],
                  selected: index == selectedIndex,
                  collapsed: collapsed,
                  onTap: () => onSelected(index),
                ),
              ),
            ),
            if (footer != null)
              Padding(
                padding: const EdgeInsets.all(WorkbenchTokens.space12),
                child: footer,
              ),
            if (onCollapsedChanged != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  WorkbenchTokens.space8,
                  WorkbenchTokens.space4,
                  WorkbenchTokens.space8,
                  WorkbenchTokens.space12,
                ),
                child: _SidebarTile(
                  item: WorkbenchSidebarItem(
                    label: collapsed ? '展开侧边栏' : '收起侧边栏',
                    icon: collapsed
                        ? Icons.keyboard_double_arrow_right_rounded
                        : Icons.keyboard_double_arrow_left_rounded,
                  ),
                  selected: false,
                  collapsed: collapsed,
                  onTap: () => onCollapsedChanged!(!collapsed),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SidebarTile extends StatefulWidget {
  const _SidebarTile({
    required this.item,
    required this.selected,
    required this.collapsed,
    required this.onTap,
  });

  final WorkbenchSidebarItem item;
  final bool selected;
  final bool collapsed;
  final VoidCallback onTap;

  @override
  State<_SidebarTile> createState() => _SidebarTileState();
}

class _SidebarTileState extends State<_SidebarTile> {
  bool _hovered = false;
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final surfaces = context.workbenchSurface;
    final motion = context.workbenchMotion;
    final foreground = widget.selected
        ? theme.colorScheme.onPrimaryContainer
        : theme.colorScheme.onSurfaceVariant;
    final background = widget.selected
        ? theme.colorScheme.primaryContainer
        : _hovered
        ? surfaces.surfaceInteractive
        : Colors.transparent;

    Widget tile = Semantics(
      button: true,
      selected: widget.selected,
      label: widget.item.label,
      child: AnimatedContainer(
        height: WorkbenchTokens.controlLarge,
        duration: motion.resolve(context, motion.fast),
        curve: motion.standardCurve,
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(WorkbenchTokens.radiusMedium),
          border: Border.all(
            color: _focused ? theme.colorScheme.primary : Colors.transparent,
          ),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: widget.onTap,
            onHover: (value) => setState(() => _hovered = value),
            onFocusChange: (value) => setState(() => _focused = value),
            borderRadius: BorderRadius.circular(WorkbenchTokens.radiusMedium),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: WorkbenchTokens.space12,
              ),
              child: Row(
                mainAxisAlignment: widget.collapsed
                    ? MainAxisAlignment.center
                    : MainAxisAlignment.start,
                children: [
                  Icon(
                    widget.selected
                        ? widget.item.selectedIcon ?? widget.item.icon
                        : widget.item.icon,
                    size: WorkbenchTokens.iconMedium,
                    color: foreground,
                  ),
                  if (!widget.collapsed) ...[
                    const SizedBox(width: WorkbenchTokens.space12),
                    Expanded(
                      child: ExcludeSemantics(
                        child: Text(
                          widget.item.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.labelLarge?.copyWith(
                            color: foreground,
                            fontWeight: widget.selected
                                ? FontWeight.w700
                                : FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    if (widget.item.badge != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: WorkbenchTokens.space8,
                          vertical: WorkbenchTokens.space2,
                        ),
                        decoration: BoxDecoration(
                          color: surfaces.surfaceRaised,
                          borderRadius: BorderRadius.circular(
                            WorkbenchTokens.radiusPill,
                          ),
                          border: Border.all(color: surfaces.border),
                        ),
                        child: Text(
                          widget.item.badge!,
                          style: theme.textTheme.labelSmall,
                        ),
                      ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
    if (widget.collapsed) {
      tile = Tooltip(
        message: widget.item.tooltip ?? widget.item.label,
        child: tile,
      );
    }
    return tile;
  }
}
