import 'package:flutter/material.dart';

import '../foundations/workbench_surface.dart';
import '../foundations/workbench_tokens.dart';

enum WorkbenchToastTone { info, success, warning, error }

class WorkbenchToast extends StatelessWidget {
  const WorkbenchToast({
    required this.message,
    super.key,
    this.tone = WorkbenchToastTone.info,
    this.actionLabel,
    this.onAction,
    this.onDismiss,
  });

  final String message;
  final WorkbenchToastTone tone;
  final String? actionLabel;
  final VoidCallback? onAction;
  final VoidCallback? onDismiss;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final surfaces = context.workbenchSurface;
    final (icon, accent) = switch (tone) {
      WorkbenchToastTone.info => (
        Icons.info_outline_rounded,
        theme.colorScheme.primary,
      ),
      WorkbenchToastTone.success => (
        Icons.check_circle_outline_rounded,
        surfaces.success,
      ),
      WorkbenchToastTone.warning => (
        Icons.warning_amber_rounded,
        surfaces.warning,
      ),
      WorkbenchToastTone.error => (
        Icons.error_outline_rounded,
        theme.colorScheme.error,
      ),
    };
    return Semantics(
      liveRegion: true,
      label: message,
      child: Material(
        color: surfaces.surfaceRaised,
        borderRadius: BorderRadius.circular(WorkbenchTokens.radiusLarge),
        clipBehavior: Clip.antiAlias,
        elevation: 0,
        child: DecoratedBox(
          decoration: BoxDecoration(
            border: Border.all(color: accent.withValues(alpha: 0.44)),
            borderRadius: BorderRadius.circular(WorkbenchTokens.radiusLarge),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.18),
                blurRadius: 26,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: WorkbenchTokens.space16,
              vertical: WorkbenchTokens.space12,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, color: accent, size: WorkbenchTokens.iconMedium),
                const SizedBox(width: WorkbenchTokens.space12),
                Flexible(
                  child: ExcludeSemantics(
                    child: Text(message, style: theme.textTheme.bodyMedium),
                  ),
                ),
                if (actionLabel != null && onAction != null) ...[
                  const SizedBox(width: WorkbenchTokens.space12),
                  TextButton(onPressed: onAction, child: Text(actionLabel!)),
                ],
                if (onDismiss != null) ...[
                  const SizedBox(width: WorkbenchTokens.space4),
                  IconButton(
                    tooltip: '关闭提示',
                    onPressed: onDismiss,
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.close_rounded),
                    iconSize: WorkbenchTokens.iconSmall,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

ScaffoldFeatureController<SnackBar, SnackBarClosedReason> showWorkbenchToast({
  required BuildContext context,
  required String message,
  WorkbenchToastTone tone = WorkbenchToastTone.info,
  String? actionLabel,
  VoidCallback? onAction,
  Duration duration = const Duration(seconds: 4),
}) {
  final messenger = ScaffoldMessenger.of(context);
  messenger.hideCurrentSnackBar();
  late ScaffoldFeatureController<SnackBar, SnackBarClosedReason> controller;
  controller = messenger.showSnackBar(
    SnackBar(
      behavior: SnackBarBehavior.floating,
      backgroundColor: Colors.transparent,
      elevation: 0,
      padding: EdgeInsets.zero,
      margin: const EdgeInsets.all(WorkbenchTokens.space16),
      duration: duration,
      content: Align(
        alignment: Alignment.bottomCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: WorkbenchToast(
            message: message,
            tone: tone,
            actionLabel: actionLabel,
            onAction: onAction,
            onDismiss: () => controller.close(),
          ),
        ),
      ),
    ),
  );
  return controller;
}
