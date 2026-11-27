import React from "react";
import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";

export default function WeeklyDigest({ week = "2026-11-16", sections = [] }) {
  const total = sections.reduce((n, s) => n + s.jobs.length + (s.more ?? 0), 0);
  return (
    <Html>
      <Head />
      <Preview>{total} new roles at the companies you follow</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "-apple-system, Helvetica, Arial, sans-serif" }}>
        <Container style={{ maxWidth: "560px", padding: "24px" }}>
          <Heading style={{ fontSize: "22px" }}>New roles this week</Heading>
          <Text style={{ color: "#555" }}>
            {`Week of ${week}: ${total} new roles that match your filters.`}
          </Text>
          {sections.map((section) => (
            <Section key={section.company} style={{ marginTop: "16px" }}>
              <Heading as="h2" style={{ fontSize: "17px", marginBottom: "4px" }}>
                {section.company}
              </Heading>
              {section.jobs.map((job) => (
                <Text key={job.id} style={{ margin: "4px 0" }}>
                  <Link href={job.url}>{job.title}</Link>
                  {job.location ? ` · ${job.location}` : ""}
                </Text>
              ))}
              {section.more ? (
                <Text style={{ color: "#555", margin: "4px 0" }}>
                  Plus {section.more} more.{" "}
                  {section.boardUrl ? <Link href={section.boardUrl}>See all roles at {section.company}</Link> : null}
                </Text>
              ) : null}
            </Section>
          ))}
          <Hr />
          <Text style={{ color: "#888", fontSize: "12px" }}>
            Job data from public job boards through Firecrawl Alexandria. Sent with Resend.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

WeeklyDigest.PreviewProps = {
  week: "2026-11-16",
  sections: [
    {
      company: "Example Co",
      jobs: [{ id: "1", title: "Backend Engineer", location: "Remote", url: "https://example.com/jobs/1" }],
    },
  ],
};
