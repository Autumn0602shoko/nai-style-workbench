import 'package:flutter/material.dart';

import '../foundations/workbench_motion.dart';
import '../foundations/workbench_surface.dart';
import '../foundations/workbench_tokens.dart';
import 'workbench_button.dart';

enum WorkbenchDialogTone { neutral, danger }

class WorkbenchDialog extends StatelessWidget {
  const WorkbenchDialog({
    required this.title,
    required this.body,
    super.key,
    this.icon,
    this.tone = WorkbenchDialogTone.neutral,
    this.actions = const [],
    this.onClose,
    this.maxWidth = 480,
  });

  final String title;
  final Widget body;
  final IconData? icon;
  final WorkbenchDialogTone tone;
  final List<Widget> actions;
  final VoidCallback? onClose;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final surfaces = context.workbenchSurface;
    final accent = tone == WorkbenchDialogTone.danger
        ? theme.colorScheme.error
        : theme.colorScheme.primary;
    return Dialog(
      elevation: 0,
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(WorkbenchTokens.space24),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: Material(
          color: surfaces.surfaceRaised,
          borderRadius: BorderRadius.circular(WorkbenchTokens.radiusXLarge),
          clipBehavior: Clip.antiAlias,
          child: DecoratedBox(
            decoration: BoxDecoration(
              border: Border.all(color: surfaces.border),
              borderRadius: BorderRadius.circular(WorkbenchTokens.radiusXLarge),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.24),
                  blurRadius: 42,
                  offset: const Offset(0, 18),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.all(WorkbenchTokens.space24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (icon != null) ...[
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: accent.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(
                              WorkbenchTokens.radiusMedium,
                            ),
                          ),
                          child: Icon(icon, color: accent),
                        ),
                        const SizedBox(width: WorkbenchTokens.space12),
                      ],
                      Expanded(
                        child: Text(
                          title,
                          style: theme.textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      if (onClose != null)
                        IconButton(
                          tooltip: '关闭',
                          onPressed: onClose,
                          icon: const Icon(Icons.close_rounded),
                        ),
                    ],
                  ),
                  const SizedBox(height: WorkbenchTokens.space16),
                  DefaultTextStyle.merge(
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                      height: 1.5,
                    ),
                    child: body,
                  ),
                  if (actions.isNotEmpty) ...[
                    const SizedBox(height: WorkbenchTokens.space24),
                    Align(
                      alignment: Alignment.centerRight,
                      child: Wrap(
                        spacing: WorkbenchTokens.space8,
                        runSpacing: WorkbenchTokens.space8,
                        children: actions,
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
  }
}

Future<T?> showWorkbenchModal<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool barrierDismissible = true,
  String barrierLabel = '关闭对话框',
}) {
  final motion = context.workbenchMotion;
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: barrierDismissible,
    barrierLabel: barrierLabel,
    barrierColor: Colors.black.withValues(alpha: 0.56),
    transitionDuration: motion.resolve(context, motion.standard),
    pageBuilder: (context, animation, secondaryAnimation) => builder(context),
    transitionBuilder: (context, animation, secondaryAnimation, child) {
      final curved = CurvedAnimation(
        parent: animation,
        curve: motion.enterCurve,
        reverseCurve: motion.exitCurve,
      );
      return FadeTransition(
        opacity: curved,
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.97, end: 1).animate(curved),
          child: child,
        ),
      );
    },
  );
}

Future<bool> showWorkbenchConfirmDialog({
  required BuildContext context,
  required String title,
  required String message,
  String confirmLabel = '确认',
  String cancelLabel = '取消',
  IconData? icon,
  bool dangerous = false,
  bool barrierDismissible = true,
}) async {
  final result = await showWorkbenchModal<bool>(
    context: context,
    barrierDismissible: barrierDismissible,
    builder: (dialogContext) => WorkbenchDialog(
      title: title,
      icon: icon,
      tone: dangerous
          ? WorkbenchDialogTone.danger
          : WorkbenchDialogTone.neutral,
      onClose: () => Navigator.of(dialogContext).pop(false),
      body: Text(message),
      actions: [
        WorkbenchButton(
          label: cancelLabel,
          variant: WorkbenchButtonVariant.quiet,
          onPressed: () => Navigator.of(dialogContext).pop(false),
        ),
        WorkbenchButton(
          label: confirmLabel,
          variant: dangerous
              ? WorkbenchButtonVariant.danger
              : WorkbenchButtonVariant.primary,
          onPressed: () => Navigator.of(dialogContext).pop(true),
        ),
      ],
    ),
  );
  return result ?? false;
}
