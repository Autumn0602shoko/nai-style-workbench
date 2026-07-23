import 'package:flutter_test/flutter_test.dart';
import 'package:nai_launcher/features/artist_workbench/domain/artist_tag_parser.dart';

void main() {
  group('parseArtistTags', () {
    test('parses numeric, plain, and escaped artist tags', () {
      final result = parseArtistTags(
        r'1.25::artist:satou kuuki::, artist:jackdempa, '
        r'artist:last\, first',
      );

      expect(result.map((tag) => (tag.name, tag.weight)), [
        ('satou kuuki', 1.25),
        ('jackdempa', 1),
        ('last, first', 1),
      ]);
    });

    test('converts balanced NovelAI emphasis brackets into weights', () {
      final result = parseArtistTags('{{artist:strong}}, [[artist:soft]]');

      expect(result.map((tag) => (tag.name, tag.weight)), [
        ('strong', 1.1025),
        ('soft', 0.907),
      ]);
    });

    test('keeps meaningful parentheses inside artist names', () {
      final result = parseArtistTags('1.10::artist:yd (orange maru)::');

      expect(result.single.name, 'yd (orange maru)');
      expect(result.single.weight, 1.1);
    });

    test('removes duplicates case-insensitively', () {
      final result = parseArtistTags(
        'artist:Honashi, 0.8::artist:dk.senie::, artist:honashi',
      );

      expect(result.map((tag) => tag.name), ['Honashi', 'dk.senie']);
    });
  });

  group('legacy import', () {
    test('reads artist rows and prompt strings from old JSON', () {
      final result = parseArtistsFromLegacyJson('''
        {
          "artists": [
            {"name": "honashi", "weight": 1.2},
            {"name": "yd (orange maru)", "weight": 1.1}
          ],
          "prompt": "0.9::artist:hyuuma::"
        }
        ''');

      expect(result.map((tag) => (tag.name, tag.weight)), [
        ('honashi', 1.2),
        ('yd (orange maru)', 1.1),
        ('hyuuma', 0.9),
      ]);
    });
  });

  test('buildArtistPrompt skips disabled artists', () {
    final prompt = buildArtistPrompt([
      const ArtistTag(name: 'honashi', weight: 1.2),
      const ArtistTag(name: 'disabled', weight: 1, enabled: false),
      const ArtistTag(name: 'yd (orange maru)', weight: 1),
    ]);

    expect(prompt, '1.2::artist:honashi::, artist:yd (orange maru)');
  });
}
