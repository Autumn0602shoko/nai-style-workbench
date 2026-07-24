import 'package:flutter/material.dart';

import '../foundations/workbench_motion.dart';
import '../foundations/workbench_surface.dart';
import '../foundations/workbench_tokens.dart';

class WorkbenchTag extends StatefulWidget {
  const WorkbenchTag({
    required this.label,
    super.key,
    this.translation,
    this.selected = false,
    this.onSelected,
    this.onRemoved,
    this.leading,
  });

  final String label;
  final String? translation;
  final bool selected;
  final ValueChanged<bool>? onSelected;
  final VoidCallback? onRemoved;
  final Widget? leading;

  @override
  State<WorkbenchTag> createState() => _WorkbenchTagState();
}

class _WorkbenchTagState extends State<WorkbenchTag> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final surfaces = context.workbenchSurface;
    final motion = context.workbenchMotion;
    final active = widget.selected;
    final background = active
        ? theme.colorScheme.primaryContainer
        : _hovered
        ? surfaces.surfaceInteractive
        : surfaces.surfaceRaised;
    final border = active ? theme.colorScheme.primary : surfaces.border;
    final foreground = active
        ? theme.colorScheme.onPrimaryContainer
        : theme.colorScheme.onSurface;

    return Semantics(
      button: widget.onSelected != null,
      selected: active,
      label: [
        widget.label,
        if (widget.translation != null) widget.translation!,
      ].join(', '),
      child: AnimatedContainer(
        duration: motion.resolve(context, motion.fast),
        curve: motion.standardCurve,
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(WorkbenchTokens.radiusMedium),
          border: Border.all(color: border),
          boxShadow: active
              ? [
                  BoxShadow(
                    color: surfaces.glow,
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ]
              : const [],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(WorkbenchTokens.radiusMedium),
            onTap: widget.onSelected == null
                ? null
                : () => widget.onSelected!(!active),
            onHover: (value) => setState(() => _hovered = value),
            child: ConstrainedBox(
              constraints: const BoxConstraints(
                minHeight: WorkbenchTokens.controlSmall,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(width: WorkbenchTokens.space8),
                  AnimatedSwitcher(
                    duration: motion.resolve(context, motion.fast),
                    child:
                        widget.leading ??
                        Icon(
                          active ? Icons.check_rounded : Icons.add_rounded,
                          key: ValueKey(active),
                          size: WorkbenchTokens.iconSmall,
                          color: active
                              ? theme.colorScheme.primary
                              : theme.colorScheme.outline,
                        ),
                  ),
                  const SizedBox(width: WorkbenchTokens.space8),
                  Text(
                    widget.label,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: foreground,
                      fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                    ),
                  ),
                  if (widget.translation != null) ...[
                    const SizedBox(width: WorkbenchTokens.space8),
                    Text(
                      widget.translation!,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: foreground.withValues(alpha: 0.58),
                      ),
                    ),
                  ],
                  if (widget.onRemoved != null) ...[
                    const SizedBox(width: WorkbenchTokens.space4),
                    IconButton(
                      tooltip: '移除 ${widget.label}',
                      visualDensity: VisualDensity.compact,
                      onPressed: widget.onRemoved,
                      icon: Icon(
                        Icons.close_rounded,
                        size: WorkbenchTokens.iconSmall,
                        color: foreground.withValues(alpha: 0.7),
                      ),
                    ),
                  ] else
                    const SizedBox(width: WorkbenchTokens.space12),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
