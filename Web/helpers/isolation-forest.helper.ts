// From-scratch Isolation Forest (Liu, Ting & Zhou, ICDM 2008): anomalies isolate faster under random splits, no labeled data needed.

import { shuffleArray } from "./generate.helper";

const EULER_MASCHERONI = 0.5772156649;

export const averagePathLength = (n: number): number => {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + EULER_MASCHERONI) - (2 * (n - 1)) / n;
};

const sampleWithoutReplacement = <T>(items: T[], size: number): T[] => {
  if (size >= items.length) return [...items];
  const chosen = new Set<number>();
  while (chosen.size < size) {
    chosen.add(Math.floor(Math.random() * items.length));
  }
  return Array.from(chosen, (index) => items[index]);
};

class IsolationTree {
  splitFeature = -1;
  splitValue = 0;
  left: IsolationTree | null = null;
  right: IsolationTree | null = null;
  subtreeSize: number;

  constructor(data: number[][], currentHeight: number, heightLimit: number) {
    this.subtreeSize = data.length;
    if (currentHeight >= heightLimit || data.length <= 1) return;

    const numFeatures = data[0].length;
    const candidateFeatures = shuffleArray(Array.from({ length: numFeatures }, (_, i) => i));

    for (const featureIndex of candidateFeatures) {
      let min = Infinity;
      let max = -Infinity;
      for (const row of data) {
        if (row[featureIndex] < min) min = row[featureIndex];
        if (row[featureIndex] > max) max = row[featureIndex];
      }
      if (min === max) continue;

      const splitValue = min + Math.random() * (max - min);
      const left = data.filter((row) => row[featureIndex] < splitValue);
      const right = data.filter((row) => row[featureIndex] >= splitValue);
      if (left.length === 0 || right.length === 0) continue;

      this.splitFeature = featureIndex;
      this.splitValue = splitValue;
      this.left = new IsolationTree(left, currentHeight + 1, heightLimit);
      this.right = new IsolationTree(right, currentHeight + 1, heightLimit);
      return;
    }
  }

  isExternal(): boolean {
    return this.splitFeature === -1;
  }
}

const pathLength = (tree: IsolationTree, point: number[], currentHeight = 0): number => {
  if (tree.isExternal()) {
    return currentHeight + averagePathLength(tree.subtreeSize);
  }
  return point[tree.splitFeature] < tree.splitValue
    ? pathLength(tree.left!, point, currentHeight + 1)
    : pathLength(tree.right!, point, currentHeight + 1);
};

export class IsolationForest {
  private trees: IsolationTree[] = [];
  private readonly numTrees: number;
  private readonly sampleSize: number;
  private normalization = 1;

  constructor(numTrees = 100, sampleSize = 256) {
    this.numTrees = numTrees;
    this.sampleSize = sampleSize;
  }

  fit(data: number[][]): void {
    this.trees = [];
    if (data.length === 0) return;

    const effectiveSampleSize = Math.min(this.sampleSize, data.length);
    const heightLimit = Math.ceil(Math.log2(Math.max(2, effectiveSampleSize)));
    this.normalization = averagePathLength(effectiveSampleSize);

    for (let t = 0; t < this.numTrees; t++) {
      const sample = sampleWithoutReplacement(data, effectiveSampleSize);
      this.trees.push(new IsolationTree(sample, 0, heightLimit));
    }
  }

  isTrained(): boolean {
    return this.trees.length > 0;
  }

  /** Anomaly score in (0, 1]. Liu et al.: >0.6 = likely anomaly, ~0.5 = normal, <0.5 = likely normal. */
  score(point: number[]): number {
    if (this.trees.length === 0 || this.normalization === 0) return 0.5;
    const avgPathLength = this.trees.reduce((sum, tree) => sum + pathLength(tree, point), 0) / this.trees.length;
    return Math.pow(2, -avgPathLength / this.normalization);
  }
}
