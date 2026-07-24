import 'package:flutter/material.dart';

import '../foundations/workbench_motion.dart';
import '../foundations/workbench_surface.dart';
import '../foundations/workbench_tokens.dart';

abstract final class WorkbenchTheme {
  static const Color seed = Color(0xFF7257E8);

  /// Adds Workbench semantic surfaces and motion to an existing application
  /// theme without replacing its typography or component styling.
  static ThemeData decorate(ThemeData base) {
    final scheme = base.colorScheme;
    final isDark = base.brightness == Brightness.dark;
    final surface = WorkbenchSurface(
      canvas: Color.alphaBlend(
        scheme.primary.withValues(alpha: isDark ? 0.035 : 0.018),
        scheme.surface,
      ),
      surface: scheme.surface,
      surfaceRaised: scheme.surfaceContainerLow,
      surfaceInteractive: scheme.surfaceContainerHigh,
      border: scheme.outlineVariant.withValues(alpha: isDark ? 0.72 : 0.84),
      borderStrong: scheme.outline.withValues(alpha: isDark ? 0.74 : 0.62),
      glow: scheme.primary.withValues(alpha: isDark ? 0.28 : 0.18),
      success: isDark ? const Color(0xFF66D1A3) : const Color(0xFF248A62),
      warning: isDark ? const Color(0xFFF2B36D) : const Color(0xFFB36A20),
    );
    final extensions = base.extensions.values.toList(growable: true);
    extensions.removeWhere(
      (extension) =>
          extension is WorkbenchSurface || extension is WorkbenchMotion,
    );
    extensions
      ..add(surface)
      ..add(const WorkbenchMotion.standard());
    return base.copyWith(extensions: extensions);
  }

  static ThemeData light({Color accent = seed}) {
    final scheme = ColorScheme.fromSeed(
      seedColor: accent,
      brightness: Brightness.light,
    );
    return _build(
      scheme: scheme,
      surface: const WorkbenchSurface(
        canvas: Color(0xFFF5F3FA),
        surface: Color(0xFFFBFAFE),
        surfaceRaised: Color(0xFFFFFFFF),
        surfaceInteractive: Color(0xFFF0ECFA),
        border: Color(0xFFE1DCEB),
        borderStrong: Color(0xFFC7BEDA),
        glow: Color(0x337257E8),
        success: Color(0xFF248A62),
        warning: Color(0xFFB36A20),
      ),
    );
  }

  static ThemeData dark({Color accent = const Color(0xFFB9A8FF)}) {
    final scheme = ColorScheme.fromSeed(
      seedColor: accent,
      brightness: Brightness.dark,
    );
    return _build(
      scheme: scheme,
      surface: const WorkbenchSurface(
        canvas: Color(0xFF121117),
        surface: Color(0xFF19171F),
        surfaceRaised: Color(0xFF211E29),
        surfaceInteractive: Color(0xFF292433),
        border: Color(0xFF36303F),
        borderStrong: Color(0xFF544966),
        glow: Color(0x4DB9A8FF),
        success: Color(0xFF66D1A3),
        warning: Color(0xFFF2B36D),
      ),
    );
  }

  static ThemeData _build({
    required ColorScheme scheme,
    required WorkbenchSurface surface,
  }) {
    final base = ThemeData(
      useMaterial3: true,
      brightness: scheme.brightness,
      colorScheme: scheme,
    );
    return base.copyWith(
      scaffoldBackgroundColor: surface.canvas,
      canvasColor: surface.canvas,
      splashFactory: NoSplash.splashFactory,
      textTheme: base.textTheme.apply(
        bodyColor: scheme.onSurface,
        displayColor: scheme.onSurface,
      ),
      focusColor: scheme.primary.withValues(alpha: 0.16),
      hoverColor: scheme.primary.withValues(alpha: 0.08),
      dividerColor: surface.border,
      extensions: <ThemeExtension<dynamic>>[
        surface,
        const WorkbenchMotion.standard(),
      ],
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: surface.surfaceRaised,
          borderRadius: BorderRadius.circular(WorkbenchTokens.radiusSmall),
          border: Border.all(color: surface.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.18),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        textStyle: base.textTheme.bodySmall?.copyWith(color: scheme.onSurface),
      ),
    );
  }
}
