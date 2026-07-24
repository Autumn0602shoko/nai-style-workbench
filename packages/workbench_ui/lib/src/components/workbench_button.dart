import 'package:flutter/material.dart';

import '../foundations/workbench_motion.dart';
import '../foundations/workbench_surface.dart';
import '../foundations/workbench_tokens.dart';

enum WorkbenchButtonVariant { primary, secondary, quiet, danger }

enum WorkbenchButtonSize { small, medium, large }

class WorkbenchButton extends StatefulWidget {
  const WorkbenchButton({
    required this.label,
    super.key,
    this.onPressed,
    this.icon,
    this.trailing,
    this.variant = WorkbenchButtonVariant.primary,
    this.size = WorkbenchButtonSize.medium,
    this.loading = false,
    this.expand = false,
    this.tooltip,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final Widget? trailing;
  final WorkbenchButtonVariant variant;
  final WorkbenchButtonSize size;
  final bool loading;
  final bool expand;
  final String? tooltip;

  bool get enabled => onPressed != null && !loading;

  @override
  State<WorkbenchButton> createState() => _WorkbenchButtonState();
}

class _WorkbenchButtonState extends State<WorkbenchButton> {
  bool _hovered = false;
  bool _pressed = false;
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final surfaces = context.workbenchSurface;
    final motion = context.workbenchMotion;
    final visual = _resolveVisual(theme, surfaces);
    final height = switch (widget.size) {
      WorkbenchButtonSize.small => WorkbenchTokens.controlSmall,
      WorkbenchButtonSize.medium => WorkbenchTokens.controlMedium,
      WorkbenchButtonSize.large => WorkbenchTokens.controlLarge,
    };
    final horizontalPadding = switch (widget.size) {
      WorkbenchButtonSize.small => WorkbenchTokens.space12,
      WorkbenchButtonSize.medium => WorkbenchTokens.space16,
      WorkbenchButtonSize.large => WorkbenchTokens.space20,
    };

    Widget result = AnimatedScale(
      scale: _pressed && widget.enabled ? 0.975 : 1,
      duration: motion.resolve(context, motion.fast),
      curve: motion.standardCurve,
      child: AnimatedContainer(
        height: height,
        width: widget.expand ? double.infinity : null,
        duration: motion.resolve(context, motion.fast),
        curve: motion.standardCurve,
        decoration: BoxDecoration(
          color: visual.background,
          borderRadius: BorderRadius.circular(WorkbenchTokens.radiusMedium),
          border: Border.all(
            color: _focused ? theme.colorScheme.primary : visual.border,
            width: _focused ? 1.5 : 1,
          ),
          boxShadow: _hovered && widget.enabled
              ? [
                  BoxShadow(
                    color: visual.shadow,
                    blurRadius: 18,
                    offset: const Offset(0, 7),
                  ),
                ]
              : const [],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(WorkbenchTokens.radiusMedium),
            onTap: widget.enabled ? widget.onPressed : null,
            onHover: (value) => setState(() => _hovered = value),
            onHighlightChanged: (value) => setState(() => _pressed = value),
            onFocusChange: (value) => setState(() => _focused = value),
            overlayColor: WidgetStatePropertyAll(
              visual.foreground.withValues(alpha: 0.08),
            ),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
              child: Row(
                mainAxisSize: widget.expand
                    ? MainAxisSize.max
                    : MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (widget.loading)
                    SizedBox.square(
                      dimension: WorkbenchTokens.iconSmall,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: visual.foreground,
                      ),
                    )
                  else if (widget.icon != null)
                    Icon(
                      widget.icon,
                      size: WorkbenchTokens.iconSmall,
                      color: visual.foreground,
                    ),
                  if (widget.loading || widget.icon != null)
                    const SizedBox(width: WorkbenchTokens.space8),
                  Flexible(
                    child: ExcludeSemantics(
                      child: Text(
                        widget.label,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.labelLarge?.copyWith(
                          color: visual.foreground,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  if (widget.trailing != null) ...[
                    const SizedBox(width: WorkbenchTokens.space8),
                    IconTheme(
                      data: IconThemeData(
                        color: visual.foreground,
                        size: WorkbenchTokens.iconSmall,
                      ),
                      child: widget.trailing!,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );

    result = Semantics(
      button: true,
      enabled: widget.enabled,
      label: widget.label,
      child: result,
    );
    if (widget.tooltip != null) {
      result = Tooltip(message: widget.tooltip!, child: result);
    }
    return result;
  }

  _ButtonVisual _resolveVisual(ThemeData theme, WorkbenchSurface surfaces) {
    final disabled = !widget.enabled;
    final foreground = switch (widget.variant) {
      WorkbenchButtonVariant.primary => theme.colorScheme.onPrimary,
      WorkbenchButtonVariant.secondary ||
      WorkbenchButtonVariant.quiet => theme.colorScheme.onSurface,
      WorkbenchButtonVariant.danger => theme.colorScheme.onError,
    };
    final baseBackground = switch (widget.variant) {
      WorkbenchButtonVariant.primary => theme.colorScheme.primary,
      WorkbenchButtonVariant.secondary => surfaces.surfaceInteractive,
      WorkbenchButtonVariant.quiet => Colors.transparent,
      WorkbenchButtonVariant.danger => theme.colorScheme.error,
    };
    final hoverBackground = switch (widget.variant) {
      WorkbenchButtonVariant.primary => Color.lerp(
        theme.colorScheme.primary,
        Colors.white,
        0.08,
      )!,
      WorkbenchButtonVariant.secondary => surfaces.surfaceRaised,
      WorkbenchButtonVariant.quiet => surfaces.surfaceInteractive,
      WorkbenchButtonVariant.danger => Color.lerp(
        theme.colorScheme.error,
        Colors.white,
        0.08,
      )!,
    };
    final baseBorder = switch (widget.variant) {
      WorkbenchButtonVariant.primary ||
      WorkbenchButtonVariant.danger => Colors.transparent,
      WorkbenchButtonVariant.secondary => surfaces.borderStrong,
      WorkbenchButtonVariant.quiet => Colors.transparent,
    };
    return _ButtonVisual(
      background: disabled
          ? surfaces.surfaceInteractive.withValues(alpha: 0.55)
          : _hovered
          ? hoverBackground
          : baseBackground,
      foreground: disabled
          ? theme.colorScheme.onSurface.withValues(alpha: 0.38)
          : foreground,
      border: disabled ? surfaces.border : baseBorder,
      shadow: widget.variant == WorkbenchButtonVariant.primary
          ? surfaces.glow
          : Colors.black.withValues(alpha: 0.14),
    );
  }
}

class _ButtonVisual {
  const _ButtonVisual({
    required this.background,
    required this.foreground,
    required this.border,
    required this.shadow,
  });

  final Color background;
  final Color foreground;
  final Color border;
  final Color shadow;
}
