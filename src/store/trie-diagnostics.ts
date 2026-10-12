import type { NormalizedScalar, TrieNode, TrieSnapshot } from "./types.js";

function formatKey(key: NormalizedScalar | null): string {
  if (key === null) {
    return "null";
  }

  if (typeof key === "number") {
    return Number.isFinite(key) ? key.toFixed(2) : String(key);
  }

  if (typeof key === "bigint") {
    return `${key.toString()}.00`;
  }

  return String(key);
}

function rowMarker(rowIds: readonly number[]): string {
  if (rowIds.length === 0) {
    return "~";
  }
  return `~${rowIds.join(",")}`;
}

function toLine(node: TrieNode): string {
  const parent = node.parentId === null ? "null" : String(node.parentId);
  const fieldName = node.fieldName ?? "null";
  const key = formatKey(node.key);
  return `#${node.id}|${parent}|${fieldName}|${key}|${rowMarker(node.rowIds)}`;
}

function bfsOrder(trie: TrieSnapshot): TrieNode[] {
  const nodeById = new Map<number, TrieNode>();
  for (const node of trie.nodes) {
    nodeById.set(node.id, node);
  }

  const order: TrieNode[] = [];
  const visited = new Set<number>();

  const roots = trie.nodes
    .filter((node) => node.parentId === null)
    .sort((left, right) => left.id - right.id);

  const queue: TrieNode[] = [...roots];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || visited.has(current.id)) {
      continue;
    }
    visited.add(current.id);
    order.push(current);

    const children = [...current.childIds.values()]
      .map((id) => nodeById.get(id))
      .filter((node): node is TrieNode => node !== undefined)
      .sort((left, right) => left.id - right.id);
    queue.push(...children);
  }

  if (visited.size !== trie.nodes.length) {
    const remaining = trie.nodes
      .filter((node) => !visited.has(node.id))
      .sort((left, right) => left.id - right.id);
    for (const node of remaining) {
      order.push(node);
    }
  }

  return order;
}

export function serializeTrieSnapshot(trie: TrieSnapshot): string {
  return bfsOrder(trie)
    .map((node) => toLine(node))
    .join("\n");
}
