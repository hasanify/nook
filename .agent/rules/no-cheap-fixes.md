# No cheap fixes

- Find and fix the root cause. Do not silence errors, add `// @ts-ignore`, `#[allow(...)]`, `unwrap()`, arbitrary sleeps/timeouts, or broad try/catch to make a symptom disappear.
- Do not disable or loosen lint/format/tsconfig rules to get green. If a rule is wrong, explain why and ask first.
- Do not hardcode values to satisfy a single case, and do not special-case a bug away.
- If a Win32 behaviour is uncertain, write down what was observed, how it was verified on a real desktop, and the chosen approach in the README "Known limitations" instead of guessing.
- If the plan is ambiguous or a step cannot be done as written, stop and ask; do not improvise silently.
