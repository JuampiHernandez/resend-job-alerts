# Job alerts with Firecrawl Alexandria and Resend

A weekly email with the new roles at the companies you follow. [Firecrawl Alexandria](https://alexandria.firecrawl.dev) reads each company's public job board ([Ashby](https://alexandria.firecrawl.dev/providers/ashbyhq-com) or [Greenhouse](https://alexandria.firecrawl.dev/providers/greenhouse-io)), the script keeps last week's role ids, a [React Email](https://react.email) template renders only the new roles that match your keywords and locations, and Resend sends it.

## Run it

1. Node 20 or later, then `npm install`.
2. Edit `config.json`: the companies and their board slugs (the part after `jobs.ashbyhq.com/` or `boards.greenhouse.io/`), title keywords, locations (empty means anywhere), how many roles to show per company, and the from and to addresses.
3. Copy the `.env.example` file to `.env`
4. Add your `FIRECRAWL_API_KEY` to `.env` and run the script with `npm start`. It fetches the roles and writes the rendered email to `digest.html`.
5. Add your `RESEND_API_KEY` to `.env` and the script will send the email. `from` must use a domain verified in Resend. For a quick test without a domain, use `onboarding@resend.dev` as `from` and your own Resend account email as `to`.

The first run that successfully sends an email stores a snapshot and lists every current match. Later runs list only new matches and skip the send when there are none. Schedule it weekly with cron or any scheduler.

## Files

- `index.jsx`: fetches the boards through Firecrawl Alexandria, compares with the last snapshot, renders and sends.
- `emails/WeeklyDigest.jsx`: the React Email template.
- `config.json`: companies, filters and addresses.

## Notes

- Each board page is billed in Firecrawl credits at the listed price (5 Firecrawl credits per page in our test). The script follows pages up to `maxPagesPerCompany` (default 5), so a board with 787 roles took 4 pages.
- Role data comes from public job boards: title, location and posting link.
