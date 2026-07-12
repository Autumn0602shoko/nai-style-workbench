export type ExperimentArtist = {
  weight: number;
  locked?: boolean;
};

export type WeightExperiment = {
  id: string;
  name: string;
  description: string;
  weights: number[];
};

const round = (value: number) => Math.max(-2, Math.min(2, Number(value.toFixed(2))));

export function createWeightExperiments(
  artists: ExperimentArtist[],
  amplitude: number,
): WeightExperiment[] {
  const change = (artist: ExperimentArtist, value: number) =>
    artist.locked ? round(artist.weight) : round(value);

  return [
    {
      id: "balanced",
      name: "均衡收束",
      description: "把权重轻轻拉回 1，适合检查组合的基础气质。",
      weights: artists.map((artist) => change(artist, artist.weight + (1 - artist.weight) * amplitude)),
    },
    {
      id: "contrast",
      name: "交错对比",
      description: "交替增强与减弱画师影响，寻找更鲜明的混合关系。",
      weights: artists.map((artist, index) => change(artist, artist.weight + (index % 2 === 0 ? amplitude : -amplitude))),
    },
    {
      id: "lead",
      name: "主画师突出",
      description: "突出第一位画师，并稍微降低其余画师的影响。",
      weights: artists.map((artist, index) => change(artist, artist.weight + (index === 0 ? amplitude : -amplitude / 2))),
    },
    {
      id: "explore",
      name: "层次探索",
      description: "按渐进幅度重新分配影响，适合寻找意外但可复现的方向。",
      weights: artists.map((artist, index) => {
        const position = artists.length <= 1 ? 0 : index / (artists.length - 1);
        return change(artist, artist.weight + amplitude * (1 - position * 2));
      }),
    },
  ];
}

