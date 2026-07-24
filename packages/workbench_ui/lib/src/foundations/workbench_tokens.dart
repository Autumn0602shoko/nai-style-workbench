import 'package:flutter/widgets.dart';

/// Stable visual constants shared by every Workbench product.
///
/// Components should consume these values instead of introducing page-local
/// spacing, radius, or animation constants.
abstract final class WorkbenchTokens {
  static const double space2 = 2;
  static const double space4 = 4;
  static const double space8 = 8;
  static const double space12 = 12;
  static const double space16 = 16;
  static const double space20 = 20;
  static const double space24 = 24;
  static const double space32 = 32;
  static const double space40 = 40;
  static const double space48 = 48;

  static const double radiusSmall = 8;
  static const double radiusMedium = 12;
  static const double radiusLarge = 18;
  static const double radiusXLarge = 24;
  static const double radiusPill = 999;

  static const double controlSmall = 32;
  static const double controlMedium = 40;
  static const double controlLarge = 48;

  static const double iconSmall = 16;
  static const double iconMedium = 20;
  static const double iconLarge = 24;

  static const double contentCompact = 680;
  static const double contentComfortable = 960;
  static const double contentWide = 1280;

  static const EdgeInsets pagePadding = EdgeInsets.all(space24);
  static const EdgeInsets cardPadding = EdgeInsets.all(space20);
}
