import 'package:flutter/material.dart';

@immutable
class WorkbenchSurface extends ThemeExtension<WorkbenchSurface> {
  const WorkbenchSurface({
    required this.canvas,
    required this.surface,
    required this.surfaceRaised,
    required this.surfaceInteractive,
    required this.border,
    required this.borderStrong,
    required this.glow,
    required this.success,
    required this.warning,
  });

  final Color canvas;
  final Color surface;
  final Color surfaceRaised;
  final Color surfaceInteractive;
  final Color border;
  final Color borderStrong;
  final Color glow;
  final Color success;
  final Color warning;

  @override
  WorkbenchSurface copyWith({
    Color? canvas,
    Color? surface,
    Color? surfaceRaised,
    Color? surfaceInteractive,
    Color? border,
    Color? borderStrong,
    Color? glow,
    Color? success,
    Color? warning,
  }) {
    return WorkbenchSurface(
      canvas: canvas ?? this.canvas,
      surface: surface ?? this.surface,
      surfaceRaised: surfaceRaised ?? this.surfaceRaised,
      surfaceInteractive: surfaceInteractive ?? this.surfaceInteractive,
      border: border ?? this.border,
      borderStrong: borderStrong ?? this.borderStrong,
      glow: glow ?? this.glow,
      success: success ?? this.success,
      warning: warning ?? this.warning,
    );
  }

  @override
  WorkbenchSurface lerp(
    covariant ThemeExtension<WorkbenchSurface>? other,
    double t,
  ) {
    if (other is! WorkbenchSurface) {
      return this;
    }
    return WorkbenchSurface(
      canvas: Color.lerp(canvas, other.canvas, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceRaised: Color.lerp(surfaceRaised, other.surfaceRaised, t)!,
      surfaceInteractive: Color.lerp(
        surfaceInteractive,
        other.surfaceInteractive,
        t,
      )!,
      border: Color.lerp(border, other.border, t)!,
      borderStrong: Color.lerp(borderStrong, other.borderStrong, t)!,
      glow: Color.lerp(glow, other.glow, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
    );
  }
}

extension WorkbenchSurfaceContext on BuildContext {
  WorkbenchSurface get workbenchSurface {
    final extension = Theme.of(this).extension<WorkbenchSurface>();
    assert(extension != null, 'WorkbenchTheme must install WorkbenchSurface.');
    return extension!;
  }
}
