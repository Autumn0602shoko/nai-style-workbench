import 'package:flutter/material.dart';

@immutable
class WorkbenchMotion extends ThemeExtension<WorkbenchMotion> {
  const WorkbenchMotion({
    required this.fast,
    required this.standard,
    required this.emphasis,
    required this.enterCurve,
    required this.exitCurve,
    required this.standardCurve,
  });

  const WorkbenchMotion.standard()
    : fast = const Duration(milliseconds: 120),
      standard = const Duration(milliseconds: 220),
      emphasis = const Duration(milliseconds: 360),
      enterCurve = const Cubic(0.2, 0, 0, 1),
      exitCurve = const Cubic(0.4, 0, 1, 1),
      standardCurve = const Cubic(0.2, 0, 0, 1);

  final Duration fast;
  final Duration standard;
  final Duration emphasis;
  final Curve enterCurve;
  final Curve exitCurve;
  final Curve standardCurve;

  Duration resolve(BuildContext context, Duration duration) {
    final mediaQuery = MediaQuery.maybeOf(context);
    return mediaQuery?.disableAnimations == true ? Duration.zero : duration;
  }

  @override
  WorkbenchMotion copyWith({
    Duration? fast,
    Duration? standard,
    Duration? emphasis,
    Curve? enterCurve,
    Curve? exitCurve,
    Curve? standardCurve,
  }) {
    return WorkbenchMotion(
      fast: fast ?? this.fast,
      standard: standard ?? this.standard,
      emphasis: emphasis ?? this.emphasis,
      enterCurve: enterCurve ?? this.enterCurve,
      exitCurve: exitCurve ?? this.exitCurve,
      standardCurve: standardCurve ?? this.standardCurve,
    );
  }

  @override
  WorkbenchMotion lerp(
    covariant ThemeExtension<WorkbenchMotion>? other,
    double t,
  ) {
    if (other is! WorkbenchMotion) {
      return this;
    }
    return WorkbenchMotion(
      fast: _lerpDuration(fast, other.fast, t),
      standard: _lerpDuration(standard, other.standard, t),
      emphasis: _lerpDuration(emphasis, other.emphasis, t),
      enterCurve: t < 0.5 ? enterCurve : other.enterCurve,
      exitCurve: t < 0.5 ? exitCurve : other.exitCurve,
      standardCurve: t < 0.5 ? standardCurve : other.standardCurve,
    );
  }

  static Duration _lerpDuration(Duration a, Duration b, double t) {
    return Duration(
      microseconds:
          (a.inMicroseconds + (b.inMicroseconds - a.inMicroseconds) * t)
              .round(),
    );
  }
}

extension WorkbenchMotionContext on BuildContext {
  WorkbenchMotion get workbenchMotion =>
      Theme.of(this).extension<WorkbenchMotion>() ??
      const WorkbenchMotion.standard();
}
