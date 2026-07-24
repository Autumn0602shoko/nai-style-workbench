import 'package:flutter/material.dart';

import '../foundations/workbench_motion.dart';
import '../foundations/workbench_surface.dart';
import '../foundations/workbench_tokens.dart';

abstract final class WorkbenchTheme {
  static const Color seed = Color(0xFF7257E8);

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
