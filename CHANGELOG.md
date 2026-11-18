## [0.11.6](https://github.com/hasanify/nook/compare/v0.11.5...v0.11.6) (2026-11-18)

### Bug Fixes

- **widgets:** fix drag hiding behind wallpaper, smooth resizing, enable no_redirection_bitmap for corner transparency, and fix opacity race condition ([388fbc5](https://github.com/hasanify/nook/commit/388fbc57e6572dda173190020adb4f9a6cddee6c))

## [0.11.5](https://github.com/hasanify/nook/compare/v0.11.4...v0.11.5) (2026-11-18)

### Bug Fixes

- **widgets:** align notes title left, silent autosave, and remove widget bottom padding ([53f882c](https://github.com/hasanify/nook/commit/53f882c0fe1991a8318027362a63af4914beeb08))

## [0.11.4](https://github.com/hasanify/nook/compare/v0.11.3...v0.11.4) (2026-11-18)

### Bug Fixes

- **widgets:** resolve corner transparency, smooth drag and resize, persist opacity, and clean settings padding ([2998398](https://github.com/hasanify/nook/commit/2998398653ed8b2a9efc65a55737b2335ca4e098))

## [0.11.3](https://github.com/hasanify/nook/compare/v0.11.2...v0.11.3) (2026-11-18)

### Bug Fixes

- **widgets:** fix drag and resize pointer capture, remove GDI stalls, and fix corner radius and bottom clipping ([3ef4cb7](https://github.com/hasanify/nook/commit/3ef4cb766aa69b7b7d7f7667943e7bde7c1a005f))

## [0.11.2](https://github.com/hasanify/nook/compare/v0.11.1...v0.11.2) (2026-11-18)

### Bug Fixes

- **ui:** disable browser and webview defaults across all input fields ([29b4b0c](https://github.com/hasanify/nook/commit/29b4b0c832c1d79d843c8811e0a5469dd4f35725))
- **widgets:** fix DPI scaling, remove GDI region clipping, and intercept system menu subclass ([9bae089](https://github.com/hasanify/nook/commit/9bae089db7e334c40a299627f86cada84ca37512))

## [0.11.1](https://github.com/hasanify/nook/compare/v0.11.0...v0.11.1) (2026-11-17)

### Bug Fixes

- **widgets:** disable alt+space system menu and remove duplicate datalist popup ([d490639](https://github.com/hasanify/nook/commit/d490639bc2e7f792fc5f52a932a962b94cb7eaba))

# [0.11.0](https://github.com/hasanify/nook/compare/v0.10.4...v0.11.0) (2026-11-17)

### Features

- **github-repo:** replace aggressive polling with manual refresh button and last updated time ([8a251cc](https://github.com/hasanify/nook/commit/8a251cc63b0ae0d992ca5a5f2b02229736211bcd))

## [0.10.4](https://github.com/hasanify/nook/compare/v0.10.3...v0.10.4) (2026-11-17)

### Bug Fixes

- **settings:** fix bottom clipping in sidebar and inspector ([d986f44](https://github.com/hasanify/nook/commit/d986f4499acbb14e7fa6153864c152bc0fbd1f96))

## [0.10.3](https://github.com/hasanify/nook/compare/v0.10.2...v0.10.3) (2026-11-17)

### Bug Fixes

- **widgets:** apply full background tint, fix border spilling, restore drag/resize and opacity controls ([d3ecb75](https://github.com/hasanify/nook/commit/d3ecb75fe52bac3a74aeecfca65705b90f41788f))

## [0.10.2](https://github.com/hasanify/nook/compare/v0.10.1...v0.10.2) (2026-11-17)

### Bug Fixes

- **settings:** prevent white flash and layout shifts on launch ([73b1b8d](https://github.com/hasanify/nook/commit/73b1b8d2023423ef1fa231e4070f8ba6b07ac5a0))

## [0.10.1](https://github.com/hasanify/nook/compare/v0.10.0...v0.10.1) (2026-11-17)

### Bug Fixes

- **updater:** fallback to public web release redirect when github api is rate-limited ([cbbe012](https://github.com/hasanify/nook/commit/cbbe01227cfd4b7e45ed3630a584b2ba294048de))

# [0.10.0](https://github.com/hasanify/nook/compare/v0.9.1...v0.10.0) (2026-11-17)

### Features

- **weather,widgets:** fix weather provider via rust reqwest, add widget color customization, clean inspector metadata ([884d230](https://github.com/hasanify/nook/commit/884d230a995aa35ce4c42f06c5f04c91f4cf3a3b))

## [0.9.1](https://github.com/hasanify/nook/compare/v0.9.0...v0.9.1) (2026-11-17)

### Bug Fixes

- **ui:** hide scrollbars globally and resolve widget drag/resize lag and snap-back ([6767eb2](https://github.com/hasanify/nook/commit/6767eb2f67265f20d1243f8edd501f5e312240c2))

# [0.9.0](https://github.com/hasanify/nook/compare/v0.8.0...v0.9.0) (2026-11-17)

### Features

- **widgets:** add right-click context menu with edit and delete options, hide static edit button ([dfbd595](https://github.com/hasanify/nook/commit/dfbd595a146d26de9271c5ae9c24a46bfac70198))

# [0.8.0](https://github.com/hasanify/nook/compare/v0.7.1...v0.8.0) (2026-11-17)

### Features

- **widgets:** add domain links and configurable polling intervals for vercel and github widgets ([221abf7](https://github.com/hasanify/nook/commit/221abf7ee29213cb16a743a34653997a9ab40874))

## [0.7.1](https://github.com/hasanify/nook/compare/v0.7.0...v0.7.1) (2026-11-17)

### Bug Fixes

- **ui:** resolve always-on-top serialization mismatch and toggle clipping ([4a71e46](https://github.com/hasanify/nook/commit/4a71e46ed341e82bf0a287482be02b566683ac2c))

# [0.7.0](https://github.com/hasanify/nook/compare/v0.6.5...v0.7.0) (2026-11-17)

### Features

- **widgets:** add clock, weather, and tasks widgets, vercel autocomplete, and fix edit mode ([bd80c84](https://github.com/hasanify/nook/commit/bd80c844a393a4205f01bf6d7bd3d3e87c657817))

## [0.6.5](https://github.com/hasanify/nook/compare/v0.6.4...v0.6.5) (2026-11-17)

### Bug Fixes

- **ui:** disable horizontal overscroll and overflow in settings layout ([d044846](https://github.com/hasanify/nook/commit/d0448465b378bf65a1d792f5f939a5a2df570016))

## [0.6.4](https://github.com/hasanify/nook/compare/v0.6.3...v0.6.4) (2026-11-17)

## [0.6.3](https://github.com/hasanify/nook/compare/v0.6.2...v0.6.3) (2026-11-17)

### Bug Fixes

- preserve desktop pin on win+d, fix drag/resize cancellation, and smooth opacity changes ([edb00b8](https://github.com/hasanify/nook/commit/edb00b82111447f0dd1adf5620b3bf6003ea4f1e))

## [0.6.2](https://github.com/hasanify/nook/compare/v0.6.1...v0.6.2) (2026-11-17)

### Bug Fixes

- resolve widget add crash, position placeholder in top right, and polish settings UI ([df57c4d](https://github.com/hasanify/nook/commit/df57c4d4eb2d57fce46b7d7312c01b85f9f2feef))

## [0.6.1](https://github.com/hasanify/nook/compare/v0.6.0...v0.6.1) (2026-11-17)

# [0.6.0](https://github.com/hasanify/nook/compare/v0.5.0...v0.6.0) (2026-11-17)

### Features

- **ui:** use official nook icon in marketing and settings headers ([935b427](https://github.com/hasanify/nook/commit/935b427a2e1bca8120eacaa02e8cd64abf47725e))

# [0.5.0](https://github.com/hasanify/nook/compare/v0.4.0...v0.5.0) (2026-11-17)

### Features

- **docs:** add minimalist marketing page for github pages ([64bdc2c](https://github.com/hasanify/nook/commit/64bdc2cb1bce835b2d6fd2e3600b437d936f4e00))

# [0.4.0](https://github.com/hasanify/nook/compare/v0.3.1...v0.4.0) (2026-11-17)

### Bug Fixes

- **ui:** disable right-click context menu globally across all windows ([69d6de8](https://github.com/hasanify/nook/commit/69d6de854c3d1cdd5309e62b4906a9e4d067c9b0))

### Features

- **ui:** enhance widgets and settings with modern minimal aesthetic ([63453df](https://github.com/hasanify/nook/commit/63453dff6360d3521eabe7b4d2fd911a3194e368))

## [0.3.1](https://github.com/hasanify/nook/compare/v0.3.0...v0.3.1) (2026-11-17)

### Bug Fixes

- **ui:** improve widget contrast, smooth drag/resize rAF throttling, fix dropdown crash, and add about tab ([a952290](https://github.com/hasanify/nook/commit/a9522905fc7920b47dd0252207d6c1d9a8723974))

# [0.3.0](https://github.com/hasanify/nook/compare/v0.2.3...v0.3.0) (2026-11-17)

### Features

- **settings:** display current app version and in-app update checker ([e49a99d](https://github.com/hasanify/nook/commit/e49a99d84580c3aa8873bbe3ee5f23f12ea6855c))

## [0.2.3](https://github.com/hasanify/nook/compare/v0.2.2...v0.2.3) (2026-11-17)

## [0.2.2](https://github.com/hasanify/nook/compare/v0.2.1...v0.2.2) (2026-11-17)

### Bug Fixes

- **core:** use tauri async runtime and dispatch shell watcher on main thread ([4ac6f4a](https://github.com/hasanify/nook/commit/4ac6f4aae9b5758b2d095943acbe2d9e1a30eb2e))

## [0.2.1](https://github.com/hasanify/nook/compare/v0.2.0...v0.2.1) (2026-11-17)

### Bug Fixes

- **icons:** remove icon padding and configure NSIS installerIcon ([d88399e](https://github.com/hasanify/nook/commit/d88399e0a69cfd071918da311650b4110f86ba02))

# [0.2.0](https://github.com/hasanify/nook/compare/v0.1.0...v0.2.0) (2026-11-17)

### Bug Fixes

- **ci:** add conventional-changelog-conventionalcommits dependency for semantic release ([41974e9](https://github.com/hasanify/nook/commit/41974e9840006d000bc384579bb0e77cae112185))
- **ci:** use standard preset in semantic release configuration ([151976e](https://github.com/hasanify/nook/commit/151976e74ed9b56c6558e3ca829e7b16c0b2e035))

### Features

- **ci:** add semantic release workflow and regenerate icons with reduced padding ([c3e14cd](https://github.com/hasanify/nook/commit/c3e14cd35315806d9606aa4df40857fd7decdace))
