import { readFile, writeFile, mkdir } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("./config.json", import.meta.url)));
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
if (!FIRECRAWL_API_KEY) throw new Error("Set FIRECRAWL_API_KEY");

const BOARDS = {
  ashby: { provider: "ashbyhq-com", capability: "jobs/jobs", option: "board", perPage: 25 },
  greenhouse: { provider: "greenhouse-io", capability: "jobs/jobs", option: "board_token", perPage: 200 },
};

async function fetchJobs(company) {
  const board = BOARDS[company.board];
  const jobs = [];
  let credits = 0;
  for (let page = 1; page && page <= (config.maxPagesPerCompany ?? 5); ) {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        alexandria: {
          provider: board.provider,
          capability: board.capability,
          options: { [board.option]: company.slug, page, per_page: board.perPage },
        },
      }),
    });
    const result = (await res.json()).data.alexandria[0];
    if (result.error) throw new Error(`${company.name}: ${result.error.message}`);
    credits += result.creditsCost ?? 0;
    for (const job of result.data.items ?? []) {
      jobs.push({ id: String(job.id), title: job.title, location: job.location, url: job.job_url ?? job.absolute_url });
    }
    page = result.data.next_page;
  }
  return { jobs, credits };
}

const matches = (job) => {
  const title = (job.title ?? "").toLowerCase();
  const location = (job.location ?? "").toLowerCase();
  return (
    config.keywords.some((k) => title.includes(k.toLowerCase())) &&
    (config.locations.length === 0 || config.locations.some((l) => location.includes(l.toLowerCase())))
  );
};

await mkdir(new URL("./snapshots/", import.meta.url), { recursive: true });
const sections = [];
let credits = 0;

for (const company of config.companies) {
  try {
    const { jobs, credits: cost } = await fetchJobs(company);
    credits += cost;
    const file = new URL(`./snapshots/${company.slug}.json`, import.meta.url);
    const previous = await readFile(file, "utf8").then(JSON.parse, () => null);
    await writeFile(file, JSON.stringify(jobs.map((j) => j.id)));
    const seen = new Set(previous ?? []);
    const fresh = jobs.filter((j) => matches(j) && (previous === null || !seen.has(j.id)));
    console.log(`${company.name}: ${jobs.length} open roles, ${fresh.length} new matches${previous === null ? " (first run)" : ""}`);
    if (fresh.length) sections.push({ company: company.name, jobs: fresh });
  } catch (error) {
    console.log(`Skipped ${error.message}`);
  }
}
console.log(`Firecrawl credits used: ${credits}`);

const escape = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const html = sections.length
  ? sections
      .map((s) => `<h2>${escape(s.company)}</h2><ul>${s.jobs.map((j) => `<li><a href="${escape(j.url)}">${escape(j.title)}</a>, ${escape(j.location)}</li>`).join("")}</ul>`)
      .join("")
  : "<p>No new matching roles this week.</p>";
await writeFile(new URL("./digest.html", import.meta.url), `<h1>New roles this week</h1>${html}`);

if (process.env.RESEND_API_KEY && sections.length) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: config.from, to: [config.to], subject: "New roles this week", html: `<h1>New roles this week</h1>${html}` }),
  });
  console.log("Resend:", res.status, await res.text());
}
