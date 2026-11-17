Course statistics are a local snapshot from the documented [UBCGrades v3 API](https://ubcgrades.com/api-reference/v3). Run `npm run enrich:courses` with Node 22+ and internet access to refresh it. Run `npm run test:statistics` for aggregation and snapshot checks. The browser imports the saved JSON; navigation never calls the API.

The script discovers all catalog entries using the TypeScript AST, skips reference-only entries, fetches CPSC first, then every other catalog subject, and uses UBCV exclusively. All catalog fields remain unchanged. `src/data/course-statistics-report.json` records coverage and every missing/skipped course.

The selected window is the latest three consecutive *fully available and completed academic years*: winter Y followed by summer Y+1, ending August 31. The current snapshot uses 2022W, 2023S, 2023W, 2024S, 2024W and 2025S (September 2022–August 2025). Although 2025W is available, 2026S is not, so the incomplete newer academic year is excluded. Courses with no observations in this common period remain null rather than silently using another period.

Actual verified v3 structures:

- `/course-statistics/UBCV/CPSC/210` is an object with all-time `average` and `average_past_5_yrs`. Neither supplies the requested three-year sample size, so neither is used for the displayed average.
- `/grades/UBCV/2024W/CPSC/210` is an array of sections with `average`, `reported`, `educators`, `year`, `session`, `subject`, `course`, `detail`, `section` and `grades`. Subject-level requests return the same row structure in fewer requests.
- `/course-statistics/teaching-team/UBCV/CPSC/210` is an array containing `name` and a `yearsessions` object. Earlier entries can include TAs. Instead, instructor identities/sessions in this snapshot come directly from v3 section `educators`, restricted to 2022W onward. The v3 documentation states that 2022S+ educator records exclude TAs. Academic rank is not inferred.

The course identity is `subject + " " + course + detail`, so CPSC 436N never gets conflated with CPSC 436 or other suffixes. Unsuffixed CPSC 436 consequently has no exact-match observations in the selected period; its topic variants are not substituted.

Weighting uses `sum(section average × reported) / sum(reported)`, rounded to two decimals in storage and one for display. v3 `reported` is the graded-student count, not total enrolled including withdrawals/audits. Suppressed/null grade histogram bins are never summed to guess the count. A valid OVERALL record is used once per exact course/session; otherwise valid unique sections are combined. OVERALL and its constituent sections are never both counted. Duplicate sections merge educator names; conflicting duplicate statistics fail the refresh. Invalid/null averages and unusable counts are excluded. Samples count graded course registrations, not distinct students across years.

Instructors retain exact source spellings; aliases are not guessed or merged. Their averages use the same period and valid unique sections naming that instructor. Co-taught section averages belong to each named instructor's section history and are not a causal measure of teaching quality. `lastTaught` means latest observed session in this snapshot's window, not latest ever or a future assignment. Historical sessions are stored explicitly.

No Rate My Professors content is scraped. Links are name searches, not verified profiles. Ratings, difficulty, and review counts are null until an authorized source is available; missing review counts are not represented as zero.

Source URLs, available sessions, sample size, period and retrieval timestamp accompany each entry. All-time profile links are labelled separately from exact session data. Transport/schema errors abort without replacing the existing snapshot. A 404 or empty response records unavailable data. New source formats should be inspected before changing parsing; no v2 fallback is needed for the current data.
