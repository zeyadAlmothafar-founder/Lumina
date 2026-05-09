const BASE = 'https://en.wikipedia.org/w/api.php';

export async function searchWikipedia(topic) {
  const url = `${BASE}?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&origin=*&srlimit=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikipedia search failed: ${res.status}`);
  const data = await res.json();
  return (data.query?.search ?? []).map(r => r.title);
}

export async function fetchExtracts(titles) {
  if (!titles.length) return [];
  const results = await Promise.all(
    titles.map(async (title) => {
      const url = `${BASE}?action=query&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(title)}&format=json&origin=*`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const page = Object.values(data.query?.pages ?? {})[0];
      if (!page?.extract) return null;
      return { title: page.title, extract: page.extract.slice(0, 1500) };
    })
  );
  return results.filter(Boolean);
}
