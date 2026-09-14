import test from "node:test";
import assert from "node:assert/strict";
import { buildReport, validPublicUrl } from "../api/analyze.js";

test("accepts public pages and rejects private/local URLs", () => {
  assert.equal(validPublicUrl("https://example.com/service"), true);
  assert.equal(validPublicUrl("http://localhost:3000"), false);
  assert.equal(validPublicUrl("http://192.168.1.10"), false);
  assert.equal(validPublicUrl("javascript:alert(1)"), false);
});

test("maps a healthy provider item into the checker report", () => {
  const report = buildReport(
    {
      status_code: 200,
      is_https: true,
      meta: {
        title: "London Dental Clinic | Example Dental Care",
        description: "Book trusted private dental treatment in London with an experienced clinical team, clear pricing and convenient appointment options.",
        canonical: "https://example.com/dentist-london",
        htags: { h1: ["Trusted Dentist London"] },
        content: { plain_text_word_count: 700, schema_types: ["Dentist", "LocalBusiness"] },
      },
      checks: {},
    },
    "dentist london",
  );

  assert.equal(report.critical.length, 0);
  assert.ok(report.passed.some((item) => item.title === "HTTPS is enabled"));
  assert.ok(report.passed.some((item) => item.title === "Target keyword appears in the H1"));
  assert.equal(report.meta.provider, "DataForSEO");
});

test("flags missing essential on-page elements", () => {
  const report = buildReport({ status_code: 200, is_https: false, meta: {}, checks: {} }, "seo audit");
  assert.ok(report.critical.some((item) => item.title === "Missing title tag"));
  assert.ok(report.critical.some((item) => item.title === "Missing H1 tag"));
  assert.ok(report.critical.some((item) => item.title === "Missing meta description"));
});
