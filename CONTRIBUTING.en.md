# Development and feedback

[Deutsch](CONTRIBUTING.md) · **English** · [← README](README.en.md)

Send general feedback to **[ahoi@moinpdf.de](mailto:ahoi@moinpdf.de)** or use the [German and English issue templates](https://github.com/MoinPDF/moinpdf/issues/new/choose) in this public repository. Report security issues confidentially as described in [SECURITY.en.md](SECURITY.en.md).

## Preparing changes

1. Create a branch from the current `main`.
2. Keep changes focused and update the relevant documentation in **German and English**.
3. Check formatting, types and lint rules.
4. For document-processing changes, use synthetic test files and read back exported results independently.
5. Wait for automated checks before releasing a version.

Setup, tests and build commands are in [docs/DEVELOPMENT.en.md](docs/DEVELOPMENT.en.md). The central version is in `package.json`; update the changelog when changing versions. Docker publication follows the release process described in the development guide.

Do not commit private documents, passwords, certificate private keys, secrets or local runtime data. Preserve existing copyright and licence notices. The project's [licence notice](LICENSE.en.md) remains applicable.
