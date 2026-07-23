import 'dart:convert';

class ArtistTag {
  const ArtistTag({
    required this.name,
    required this.weight,
    this.enabled = true,
  });

  final String name;
  final double weight;
  final bool enabled;

  ArtistTag copyWith({String? name, double? weight, bool? enabled}) {
    return ArtistTag(
      name: name ?? this.name,
      weight: weight ?? this.weight,
      enabled: enabled ?? this.enabled,
    );
  }

  String toPromptTag() {
    if ((weight - 1).abs() < 0.0001) {
      return 'artist:$name';
    }
    return '${_formatWeight(weight)}::artist:$name::';
  }
}

class _ArtistCandidate {
  const _ArtistCandidate({
    required this.start,
    required this.end,
    required this.tag,
  });

  final int start;
  final int end;
  final ArtistTag tag;
}

String _cleanName(String value) {
  return value
      .replaceAll(r'\,', ',')
      .trim()
      .replaceAll(RegExp(r'''^['"\\\s]+|['"\\\s]+$'''), '');
}

String _formatWeight(double value) {
  return value
      .toStringAsFixed(4)
      .replaceFirst(RegExp(r'0+$'), '')
      .replaceFirst(RegExp(r'\.$'), '');
}

double _bracketWeight(String opening, String closing) {
  final strong = [
    '{'.allMatches(opening).length,
    '}'.allMatches(closing).length,
  ].reduce((a, b) => a < b ? a : b);
  final weak = [
    '['.allMatches(opening).length,
    ']'.allMatches(closing).length,
  ].reduce((a, b) => a < b ? a : b);
  return _roundWeight(_pow(1.05, strong - weak));
}

double _pow(double base, int exponent) {
  var result = 1.0;
  if (exponent >= 0) {
    for (var index = 0; index < exponent; index++) {
      result *= base;
    }
    return result;
  }
  for (var index = 0; index > exponent; index--) {
    result /= base;
  }
  return result;
}

double _roundWeight(double value) {
  return double.parse(value.toStringAsFixed(4));
}

List<ArtistTag> parseArtistTags(String input) {
  final candidates = <_ArtistCandidate>[];
  final occupied = <({int start, int end})>[];

  void add(Match match, String rawName, double weight) {
    final name = _cleanName(rawName);
    if (name.isEmpty) return;
    final overlaps = occupied.any(
      (range) => match.start < range.end && match.end > range.start,
    );
    if (overlaps) return;
    candidates.add(
      _ArtistCandidate(
        start: match.start,
        end: match.end,
        tag: ArtistTag(name: name, weight: _roundWeight(weight)),
      ),
    );
    occupied.add((start: match.start, end: match.end));
  }

  final numeric = RegExp(
    r'(-?\d+(?:\.\d+)?)::\s*artist:((?:\\,|[^,:\n])+?)\s*::',
    caseSensitive: false,
  );
  for (final match in numeric.allMatches(input)) {
    add(match, match.group(2)!, double.parse(match.group(1)!));
  }

  final bracketed = RegExp(
    r'([\[{]+)\s*artist:((?:\\,|[^,:\n\]}])+?)\s*([\]}]+)',
    caseSensitive: false,
  );
  for (final match in bracketed.allMatches(input)) {
    add(
      match,
      match.group(2)!,
      _bracketWeight(match.group(1)!, match.group(3)!),
    );
  }

  final plain = RegExp(r'artist:((?:\\,|[^,:\n\]}])+)', caseSensitive: false);
  for (final match in plain.allMatches(input)) {
    add(match, match.group(1)!, 1);
  }

  candidates.sort((a, b) => a.start.compareTo(b.start));
  final unique = <String, ArtistTag>{};
  for (final candidate in candidates) {
    unique.putIfAbsent(candidate.tag.name.toLowerCase(), () => candidate.tag);
  }
  return unique.values.toList(growable: false);
}

List<ArtistTag> parseArtistsFromLegacyJson(String source) {
  final decoded = jsonDecode(source);
  final found = <ArtistTag>[];

  void addAll(Iterable<ArtistTag> tags) {
    final known = found.map((tag) => tag.name.toLowerCase()).toSet();
    for (final tag in tags) {
      if (known.add(tag.name.toLowerCase())) {
        found.add(tag);
      }
    }
  }

  void visit(Object? value, {bool artistContext = false}) {
    if (value is String) {
      final parsed = parseArtistTags(value);
      if (parsed.isNotEmpty) {
        addAll(parsed);
      } else if (artistContext) {
        final name = _cleanName(value);
        if (name.isNotEmpty) {
          addAll([ArtistTag(name: name, weight: 1)]);
        }
      }
      return;
    }

    if (value is List) {
      for (final item in value) {
        visit(item, artistContext: artistContext);
      }
      return;
    }

    if (value is Map) {
      if (artistContext && value['name'] is String) {
        final weightValue = value['weight'];
        final weight = weightValue is num ? weightValue.toDouble() : 1.0;
        addAll([
          ArtistTag(
            name: _cleanName(value['name'] as String),
            weight: _roundWeight(weight),
            enabled: value['enabled'] is bool ? value['enabled'] as bool : true,
          ),
        ]);
      }

      for (final entry in value.entries) {
        final key = entry.key.toString().toLowerCase();
        visit(
          entry.value,
          artistContext:
              artistContext ||
              key == 'artists' ||
              key == 'artistrows' ||
              key == 'artist_tags',
        );
      }
    }
  }

  visit(decoded);
  return found;
}

String buildArtistPrompt(Iterable<ArtistTag> artists) {
  return artists
      .where((artist) => artist.enabled && artist.name.trim().isNotEmpty)
      .map((artist) => artist.toPromptTag())
      .join(', ');
}
