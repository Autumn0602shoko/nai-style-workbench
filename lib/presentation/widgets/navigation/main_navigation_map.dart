/// Single source of truth for the StatefulShellRoute branch order.
///
/// Route declarations, desktop navigation, mobile navigation, and shortcuts
/// must use these names instead of repeating numeric branch indexes.
abstract final class MainNavigationMap {
  static const int generation = 0;
  static const int localGallery = 1;
  static const int onlineGallery = 2;
  static const int settings = 3;
  static const int promptConfig = 4;
  static const int statistics = 5;
  static const int tagLibrary = 6;
  static const int vibeLibrary = 7;
  static const int artistWorkbench = 8;

  /// Display order in the desktop sidebar.
  static const List<int> sidebarBranches = [
    generation,
    artistWorkbench,
    localGallery,
    onlineGallery,
    vibeLibrary,
    promptConfig,
    tagLibrary,
    statistics,
    settings,
  ];

  static int sidebarIndexForBranch(int branchIndex) {
    final index = sidebarBranches.indexOf(branchIndex);
    return index < 0 ? 0 : index;
  }

  static int branchForSidebarIndex(int navigationIndex) {
    assert(
      navigationIndex >= 0 && navigationIndex < sidebarBranches.length,
      'Navigation index is outside the sidebar range.',
    );
    return sidebarBranches[navigationIndex];
  }
}
