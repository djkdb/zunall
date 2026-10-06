/**
 * Loads the on-demand data files under public/data (role question bank, company
 * question banks). The browser fetches them from /data; the server and the tests
 * read the same files from disk via setDataLoader(). Results are cached.
 */
export type DataLoader = (path: string) => Promise<unknown>;

let loader: DataLoader = async (path) => {
  const res = await fetch(`/data/${path}`);
  if (!res.ok) throw new Error(`data ${path}: ${res.status}`);
  return res.json();
};
const cache = new Map<string, Promise<unknown>>();

export function setDataLoader(l: DataLoader): void {
  loader = l;
  cache.clear();
}

export function loadData<T>(path: string): Promise<T> {
  let p = cache.get(path);
  if (!p) {
    p = loader(path).catch((e) => {
      cache.delete(path);
      throw e;
    });
    cache.set(path, p);
  }
  return p as Promise<T>;
}
