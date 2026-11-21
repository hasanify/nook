const cargo = "--manifest-path src-tauri/Cargo.toml";
export default {
  "*.{ts,tsx}": ["prettier --write", "oxlint --deny-warnings"],
  "*.{json,css,md,yml,yaml}": "prettier --write",
  "src-tauri/**/*.rs": [
    "rustfmt --edition 2021",
    () => `cargo clippy ${cargo} --all-targets -- -D warnings`,
  ],
};
