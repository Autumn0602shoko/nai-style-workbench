import 'package:artist_workbench_ui/artist_workbench_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Widget host(Widget child) {
    return MaterialApp(
      theme: WorkbenchTheme.light(),
      home: Scaffold(body: Center(child: child)),
    );
  }

  testWidgets('theme installs reusable surface and motion extensions', (
    tester,
  ) async {
    late WorkbenchSurface surface;
    late WorkbenchMotion motion;

    await tester.pumpWidget(
      host(
        Builder(
          builder: (context) {
            surface = context.workbenchSurface;
            motion = context.workbenchMotion;
            return const SizedBox();
          },
        ),
      ),
    );

    expect(surface.canvas, isNot(equals(surface.surfaceRaised)));
    expect(motion.fast, lessThan(motion.standard));
    expect(motion.standard, lessThan(motion.emphasis));
  });

  testWidgets('button exposes intent and invokes its callback', (tester) async {
    var presses = 0;
    await tester.pumpWidget(
      host(WorkbenchButton(label: '生成图片', onPressed: () => presses++)),
    );

    await tester.tap(find.text('生成图片'));
    await tester.pumpAndSettle();

    expect(presses, 1);
    expect(
      tester.getSemantics(find.byType(WorkbenchButton)),
      matchesSemantics(
        label: '生成图片',
        isButton: true,
        isEnabled: true,
        hasEnabledState: true,
        isFocusable: true,
        hasTapAction: true,
        hasFocusAction: true,
      ),
    );
  });

  testWidgets('loading button is disabled', (tester) async {
    var presses = 0;
    await tester.pumpWidget(
      host(
        WorkbenchButton(
          label: '正在同步',
          loading: true,
          onPressed: () => presses++,
        ),
      ),
    );

    await tester.tap(find.text('正在同步'));
    await tester.pump();

    expect(presses, 0);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('tag reports selection and removal separately', (tester) async {
    bool? selected;
    var removals = 0;
    await tester.pumpWidget(
      host(
        WorkbenchTag(
          label: 'blue eyes',
          translation: '蓝色眼睛',
          onSelected: (value) => selected = value,
          onRemoved: () => removals++,
        ),
      ),
    );

    await tester.tap(find.text('blue eyes'));
    await tester.pumpAndSettle();
    expect(selected, isTrue);

    await tester.tap(find.byTooltip('移除 blue eyes'));
    await tester.pumpAndSettle();
    expect(removals, 1);
  });

  testWidgets('interactive card invokes its callback', (tester) async {
    var taps = 0;
    await tester.pumpWidget(
      host(
        WorkbenchCard(
          onTap: () => taps++,
          semanticLabel: '画师串编辑器',
          child: const Text('打开'),
        ),
      ),
    );

    await tester.tap(find.text('打开'));
    await tester.pumpAndSettle();

    expect(taps, 1);
  });
}
