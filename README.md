# Job alerts with Firecrawl Alexandria and Resend

A weekly email with the new roles at the companies you follow. [Firecrawl Alexandria](https://alexandria.firecrawl.dev) reads each company's public job board ([Ashby](https://alexandria.firecrawl.dev/providers/ashbyhq-com) or [Greenhouse](https://alexandria.firecrawl.dev/providers/greenhouse-io)), the script keeps last week's role ids, and Resend emails only the new roles that match your keywords and locations.

## Run it

1. Node 20 or later. No dependencies.
2. Edit `config.json`: the companies and their board slugs (the part after `jobs.ashbyhq.com/` or `boards.greenhouse.io/`), title keywords, locations (empty means anywhere), and the from and to addresses.
3. `FIRECRAWL_API_KEY=fc-... node index.mjs`
4. To send the email, also set `RESEND_API_KEY` and use a verified domain in `from`.

The first run stores a snapshot and lists every current match. Later runs list only new matches. Schedule it weekly with cron or any scheduler.

## Notes

- Each board page is billed in Firecrawl credits at the listed price (5 Firecrawl credits per page in our test). The script follows pages up to `maxPagesPerCompany` (default 5), so a board with 787 roles took 4 pages.
- `digest.html` is written on every run so you can check the email before sending.
- Not tested yet: the Resend send step.
