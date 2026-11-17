const cargo = "--manifest-path src-tauri/Cargo.toml";
export default {
  "*.{ts,tsx}": ["oxlint --deny-warnings", "prettier --write"],
  "*.{json,css,md,yml,yaml}": "prettier --write",
  "src-tauri/**/*.rs": [
    "rustfmt --edition 2021",
    () => `cargo clippy ${cargo} --all-targets -- -D warnings`,
  ],
};
