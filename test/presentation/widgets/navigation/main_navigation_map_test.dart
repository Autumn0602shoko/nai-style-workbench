import 'package:flutter_test/flutter_test.dart';
import 'package:nai_launcher/presentation/widgets/navigation/main_navigation_map.dart';

void main() {
  test('desktop navigation maps every branch exactly once', () {
    expect(MainNavigationMap.sidebarBranches, hasLength(9));
    expect(MainNavigationMap.sidebarBranches.toSet(), hasLength(9));
  });

  test('desktop navigation mapping is reversible', () {
    for (
      var index = 0;
      index < MainNavigationMap.sidebarBranches.length;
      index++
    ) {
      final branch = MainNavigationMap.branchForSidebarIndex(index);
      expect(MainNavigationMap.sidebarIndexForBranch(branch), index);
    }
  });

  test('unknown branch falls back to generation navigation', () {
    expect(MainNavigationMap.sidebarIndexForBranch(99), 0);
  });
}
