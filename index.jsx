import React from "react";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { render } from "@react-email/render";
import { Resend } from "resend";
import WeeklyDigest from "./emails/WeeklyDigest.jsx";

const config = JSON.parse(
  await readFile(new URL("./config.json", import.meta.url)),
);
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
if (!FIRECRAWL_API_KEY) throw new Error("Set FIRECRAWL_API_KEY");

const BOARDS = {
  ashby: {
    provider: "ashbyhq-com",
    capability: "jobs/jobs",
    option: "board",
    perPage: 200,
    url: (slug) => `https://jobs.ashbyhq.com/${slug}`,
  },
  greenhouse: {
    provider: "greenhouse-io",
    capability: "jobs/jobs",
    option: "board_token",
    perPage: 200,
    url: (slug) => `https://job-boards.greenhouse.io/${slug}`,
  },
};

async function fetchJobs(company) {
  const board = BOARDS[company.board];
  if (!board) {
    throw new Error(`${company.name}: unknown board "${company.board}"`);
  }
  const maxPages = config.maxPagesPerCompany ?? 5;
  const jobs = [];
  let credits = 0;
  let page = 1;
  while (page && page <= maxPages) {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        alexandria: {
          provider: board.provider,
          capability: board.capability,
          options: {
            [board.option]: company.slug,
            page,
            per_page: board.perPage,
          },
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`${company.name}: [${res.status}] ${res.statusText} ${await res.text()}`);
    }
    const result = (await res.json())?.data?.alexandria?.[0];
    if (!result) {
      throw new Error(`${company.name}: unexpected response from Firecrawl`);
    }
    if (result.error) {
      throw new Error(`${company.name}: ${result.error.message}`);
    }
    credits += result.creditsCost ?? 0;
    for (const job of result.data?.items ?? []) {
      jobs.push({
        id: String(job.id),
        title: job.title,
        location: job.location,
        url: job.job_url ?? job.absolute_url,
      });
    }
    page = result.data?.next_page;
  }
  if (page) {
    console.warn(
      `${company.name}: stopped after ${maxPages} pages, later roles were not checked`,
    );
  }
  return { jobs, credits };
}

const matches = (job) => {
  const title = (job.title ?? "").toLowerCase();
  const location = (job.location ?? "").toLowerCase();
  return (
    config.keywords.some((k) => title.includes(k.toLowerCase())) &&
    (config.locations.length === 0 ||
      config.locations.some((l) => location.includes(l.toLowerCase())))
  );
};

await mkdir(new URL("./snapshots/", import.meta.url), { recursive: true });
const sections = [];
let credits = 0;

const newSnapshots = new Map();

for (const company of config.companies) {
  try {
    const { jobs, credits: cost } = await fetchJobs(company);
    credits += cost;
    const file = new URL(`./snapshots/${company.slug}.json`, import.meta.url);
    const previous = await readFile(file, "utf8").then(JSON.parse, () => null);
    newSnapshots.set(
      file,
      jobs.map((j) => j.id),
    );
    const seen = new Set(previous ?? []);
    const fresh = jobs.filter(
      (j) => matches(j) && (previous === null || !seen.has(j.id)),
    );
    console.log(
      `${company.name}: ${jobs.length} open roles, ${fresh.length} new matches${previous === null ? " (first run)" : ""}`,
    );
    if (fresh.length)
      sections.push({
        company: company.name,
        boardUrl: BOARDS[company.board].url(company.slug),
        jobs: fresh.slice(0, config.maxPerCompany ?? 10),
        more: Math.max(0, fresh.length - (config.maxPerCompany ?? 10)),
      });
  } catch (error) {
    console.log(`Skipped ${error.message}`);
    process.exitCode = 1;
  }
}
console.log(`Firecrawl credits used: ${credits}`);

const week = new Date().toISOString().slice(0, 10);
const email = <WeeklyDigest week={week} sections={sections} />;
await writeFile(new URL("./digest.html", import.meta.url), await render(email));

async function writeSnapshots(snapshots) {
  await Promise.all(
    Array.from(snapshots.entries()).map(([file, content]) =>
      writeFile(file, JSON.stringify(content)),
    ),
  );
}

if (!sections.length) {
  console.log("No new matching roles, nothing to send.");
  await writeSnapshots(newSnapshots);
} else if (process.env.RESEND_API_KEY) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: config.from,
    to: [config.to],
    subject: "New roles this week",
    react: email,
  });
  if (error) {
    console.error(`Resend error: ${error.message}`);
    process.exitCode = 1;
  } else {
    await writeSnapshots(newSnapshots);
    console.log(`Sent with Resend, id ${data.id}`);
  }
} else {
  console.log(
    "Set RESEND_API_KEY to send. The email was written to digest.html, snapshots were not updated.",
  );
}
