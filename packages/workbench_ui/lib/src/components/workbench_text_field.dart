import 'package:flutter/material.dart';

import '../foundations/workbench_motion.dart';
import '../foundations/workbench_surface.dart';
import '../foundations/workbench_tokens.dart';

class WorkbenchTextField extends StatefulWidget {
  const WorkbenchTextField({
    super.key,
    this.controller,
    this.focusNode,
    this.initialValue,
    this.label,
    this.hint,
    this.helperText,
    this.errorText,
    this.prefixIcon,
    this.suffix,
    this.clearable = false,
    this.enabled = true,
    this.obscureText = false,
    this.autofocus = false,
    this.minLines,
    this.maxLines = 1,
    this.keyboardType,
    this.textInputAction,
    this.onChanged,
    this.onSubmitted,
  }) : assert(
         controller == null || initialValue == null,
         'initialValue cannot be used with a controller.',
       );

  final TextEditingController? controller;
  final FocusNode? focusNode;
  final String? initialValue;
  final String? label;
  final String? hint;
  final String? helperText;
  final String? errorText;
  final IconData? prefixIcon;
  final Widget? suffix;
  final bool clearable;
  final bool enabled;
  final bool obscureText;
  final bool autofocus;
  final int? minLines;
  final int? maxLines;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  @override
  State<WorkbenchTextField> createState() => _WorkbenchTextFieldState();
}

class _WorkbenchTextFieldState extends State<WorkbenchTextField> {
  late TextEditingController _controller;
  late FocusNode _focusNode;
  late bool _ownsController;
  late bool _ownsFocusNode;
  bool _hovered = false;

  @override
  void initState() {
    super.initState();
    _attachController();
    _attachFocusNode();
  }

  @override
  void didUpdateWidget(covariant WorkbenchTextField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      _controller.removeListener(_handleControllerChanged);
      if (_ownsController) {
        _controller.dispose();
      }
      _attachController();
    }
    if (oldWidget.focusNode != widget.focusNode) {
      _focusNode.removeListener(_handleFocusChanged);
      if (_ownsFocusNode) {
        _focusNode.dispose();
      }
      _attachFocusNode();
    }
  }

  void _attachController() {
    _ownsController = widget.controller == null;
    _controller =
        widget.controller ??
        TextEditingController(text: widget.initialValue ?? '');
    _controller.addListener(_handleControllerChanged);
  }

  void _attachFocusNode() {
    _ownsFocusNode = widget.focusNode == null;
    _focusNode = widget.focusNode ?? FocusNode();
    _focusNode.addListener(_handleFocusChanged);
  }

  void _handleControllerChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  void _handleFocusChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_handleControllerChanged);
    _focusNode.removeListener(_handleFocusChanged);
    if (_ownsController) {
      _controller.dispose();
    }
    if (_ownsFocusNode) {
      _focusNode.dispose();
    }
    super.dispose();
  }

  void _clear() {
    _controller.clear();
    widget.onChanged?.call('');
    _focusNode.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final surfaces = context.workbenchSurface;
    final motion = context.workbenchMotion;
    final hasError = widget.errorText != null;
    final focused = _focusNode.hasFocus;
    final borderColor = hasError
        ? theme.colorScheme.error
        : focused
        ? theme.colorScheme.primary
        : _hovered && widget.enabled
        ? surfaces.borderStrong
        : surfaces.border;

    final trailingChildren = <Widget>[
      if (widget.suffix != null)
        Padding(
          padding: const EdgeInsets.only(right: WorkbenchTokens.space4),
          child: widget.suffix,
        ),
      if (widget.clearable && widget.enabled && _controller.text.isNotEmpty)
        IconButton(
          tooltip: '清空${widget.label == null ? '输入内容' : widget.label!}',
          onPressed: _clear,
          icon: const Icon(Icons.close_rounded),
          iconSize: WorkbenchTokens.iconSmall,
          visualDensity: VisualDensity.compact,
        ),
    ];

    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (widget.label != null) ...[
            Text(
              widget.label!,
              style: theme.textTheme.labelMedium?.copyWith(
                color: hasError
                    ? theme.colorScheme.error
                    : theme.colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: WorkbenchTokens.space8),
          ],
          AnimatedContainer(
            duration: motion.resolve(context, motion.fast),
            curve: motion.standardCurve,
            decoration: BoxDecoration(
              color: widget.enabled
                  ? surfaces.surfaceRaised
                  : surfaces.surfaceInteractive.withValues(alpha: 0.55),
              borderRadius: BorderRadius.circular(WorkbenchTokens.radiusMedium),
              border: Border.all(
                color: borderColor,
                width: focused || hasError ? 1.5 : 1,
              ),
              boxShadow: focused && !hasError
                  ? [
                      BoxShadow(
                        color: surfaces.glow,
                        blurRadius: 16,
                        offset: const Offset(0, 5),
                      ),
                    ]
                  : const [],
            ),
            child: TextField(
              controller: _controller,
              focusNode: _focusNode,
              enabled: widget.enabled,
              obscureText: widget.obscureText,
              autofocus: widget.autofocus,
              minLines: widget.obscureText ? 1 : widget.minLines,
              maxLines: widget.obscureText ? 1 : widget.maxLines,
              keyboardType: widget.keyboardType,
              textInputAction: widget.textInputAction,
              onChanged: widget.onChanged,
              onSubmitted: widget.onSubmitted,
              style: theme.textTheme.bodyMedium,
              decoration: InputDecoration(
                isDense: true,
                hintText: widget.hint,
                hintStyle: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant.withValues(
                    alpha: 0.68,
                  ),
                ),
                prefixIcon: widget.prefixIcon == null
                    ? null
                    : Icon(widget.prefixIcon, size: WorkbenchTokens.iconMedium),
                suffixIcon: trailingChildren.isEmpty
                    ? null
                    : Row(
                        mainAxisSize: MainAxisSize.min,
                        children: trailingChildren,
                      ),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                disabledBorder: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: WorkbenchTokens.space16,
                  vertical: WorkbenchTokens.space12,
                ),
              ),
            ),
          ),
          AnimatedSize(
            duration: motion.resolve(context, motion.fast),
            curve: motion.standardCurve,
            alignment: Alignment.topLeft,
            child: widget.errorText != null || widget.helperText != null
                ? Padding(
                    padding: const EdgeInsets.only(
                      top: WorkbenchTokens.space8,
                      left: WorkbenchTokens.space4,
                    ),
                    child: Text(
                      widget.errorText ?? widget.helperText!,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: hasError
                            ? theme.colorScheme.error
                            : theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}
