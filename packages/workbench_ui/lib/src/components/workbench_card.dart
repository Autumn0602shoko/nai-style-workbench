import 'package:flutter/material.dart';

import '../foundations/workbench_motion.dart';
import '../foundations/workbench_surface.dart';
import '../foundations/workbench_tokens.dart';

class WorkbenchCard extends StatefulWidget {
  const WorkbenchCard({
    required this.child,
    super.key,
    this.onTap,
    this.padding = WorkbenchTokens.cardPadding,
    this.accent,
    this.selected = false,
    this.semanticLabel,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final Color? accent;
  final bool selected;
  final String? semanticLabel;

  @override
  State<WorkbenchCard> createState() => _WorkbenchCardState();
}

class _WorkbenchCardState extends State<WorkbenchCard> {
  bool _hovered = false;
  bool _pressed = false;
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final surfaces = context.workbenchSurface;
    final motion = context.workbenchMotion;
    final interactive = widget.onTap != null;
    final accent = widget.accent ?? theme.colorScheme.primary;
    final highlighted = widget.selected || (_hovered && interactive);

    return Semantics(
      button: interactive,
      selected: widget.selected,
      label: widget.semanticLabel,
      child: AnimatedScale(
        scale: _pressed && interactive ? 0.992 : 1,
        duration: motion.resolve(context, motion.fast),
        curve: motion.standardCurve,
        child: AnimatedContainer(
          transform: Matrix4.translationValues(
            0,
            highlighted && interactive ? -3 : 0,
            0,
          ),
          duration: motion.resolve(context, motion.standard),
          curve: motion.enterCurve,
          decoration: BoxDecoration(
            color: highlighted ? surfaces.surfaceRaised : surfaces.surface,
            borderRadius: BorderRadius.circular(WorkbenchTokens.radiusLarge),
            border: Border.all(
              color: _focused || widget.selected
                  ? accent
                  : highlighted
                  ? surfaces.borderStrong
                  : surfaces.border,
              width: _focused || widget.selected ? 1.5 : 1,
            ),
            boxShadow: highlighted
                ? [
                    BoxShadow(
                      color: accent.withValues(alpha: 0.12),
                      blurRadius: 28,
                      offset: const Offset(0, 12),
                    ),
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.12),
                      blurRadius: 16,
                      offset: const Offset(0, 8),
                    ),
                  ]
                : [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.06),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(WorkbenchTokens.radiusLarge),
              onTap: widget.onTap,
              onHover: (value) => setState(() => _hovered = value),
              onHighlightChanged: (value) => setState(() => _pressed = value),
              onFocusChange: (value) => setState(() => _focused = value),
              overlayColor: WidgetStatePropertyAll(
                accent.withValues(alpha: 0.05),
              ),
              child: Padding(padding: widget.padding, child: widget.child),
            ),
          ),
        ),
      ),
    );
  }
}
