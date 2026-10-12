MoinPDF Browser-Office notices and corresponding-source references
Recovered 2026-10-12; no publication or browser execution was performed.

PINNED ARTIFACT
@matbee/libreoffice-converter 2.7.2
https://registry.npmjs.org/@matbee/libreoffice-converter/-/libreoffice-converter-2.7.2.tgz
Tarball SHA-256:
14d670936fe220ee49becbfd40bf233ceabb94981fa9987fccde345449ee2c3a
Publisher source commit:
https://github.com/matbeedotcom/libreoffice-document-converter/tree/b72a3d584bc28c5111afafcf25def7a24fb5fcb0
The package declares MPL-2.0. MATBEE-SOURCES contains its package declaration,
build recipe, active patch and original TypeScript extracted from npm maps.
The full MPL-2.0 text is in LIBREOFFICE-SOURCES/COPYING.MPL.

LIBREOFFICE AND COMPONENTS
The embedded versionrc identifies core commit:
https://github.com/LibreOffice/core/tree/d1c9e0e4e1ddeb24fe8f93e56860b3765043f8b1
LIBREOFFICE-EMBEDDED-versionrc preserves this binary-side evidence.
LIBREOFFICE-24-LICENSES.html is the complete upstream license.xml at that
commit, with component copyright notices and full license texts. Preserve
this catalogue when distributing the runtime. It is a superset of optional
LibreOffice components, not an exact binary linkage inventory.
LIBREOFFICE-DOWNLOADS.txt records upstream dependency archive names/hashes.
The root COPYING, COPYING.MPL and COPYING.LGPL files are also supplied.

EMSCRIPTEN AND C/C++ RUNTIME
Matbee's checked-in build recipe names Emscripten 3.1.74. Its source commit is:
https://github.com/emscripten-core/emscripten/tree/1092ec30a3fb1d46b1782ff1b4db5094d3d06ae5
EMSCRIPTEN-SOURCES includes LICENSE, AUTHORS and the original musl, libc++,
libc++abi, compiler-rt and libunwind license files. Emscripten LICENSE also
contains the notice for the included Node.js path code.

FONTS
FONT-INVENTORY.json enumerates all 137 embedded font paths (136 distinct
font files). FONT-BINARY-MATCHES.json and FONT-SOURCE-ARCHIVES.json document
byte-for-byte matching against 27 upstream font archives, all verified with
the SHA-256 values from the pinned LibreOffice download.lst.
135 distinct fonts match those archives. The remaining file, OpenSymbol,
occurs twice and matches OPENSYMBOL_SHA256SUM from the same download.lst.
FONT-METADATA.json preserves embedded font copyright and license strings.
font-licenses/ preserves original LICENSE/COPYING/OFL/GPL/README/LICENCE,
AUTHORS/CONTRIBUTORS/FONTLOG documents where present. Paths beginning with
../ inside upstream ZIP files are safely namespaced under their component;
the unmodified archive member path is retained in the source manifest.

Most font families use SIL OFL, but do not label the entire font collection
as OFL or MPL: DejaVu contains Bitstream/Arev terms, Caladea uses Apache-2.0,
and Culmus/Liberation Narrow contain GPL terms and font embedding exceptions.
The full DejaVu license is copied with the eight separately extracted fonts.
Caladea's original archive has no separate license file; CALADEA-NOTICE.txt
preserves the embedded copyright/license declaration and APACHE-2.0.txt
supplies the complete terms. The generic LibreOffice catalogue also contains
a Gentium section; the exact GentiumBasic archive notices are included here.

FONT CORRESPONDING SOURCE
culmus-src-0.133.tar.gz is the original Culmus source archive, SHA-256:
d7bb75031bb91f691d5a0fea438953b960132a53ac9332192b2142ac9ff65309
https://downloads.sourceforge.net/project/culmus/culmus/0.133/culmus-src-0.133.tar.gz
liberation-narrow-fonts-1.07.6.tar.gz is the original font source archive,
SHA-256: 5244818c804dd590d7852d49ab08b18edaaecc54a70e3f79a0779235c5a751c8
https://github.com/liberationfonts/liberation-sans-narrow/files/2579430/liberation-narrow-fonts-1.07.6.tar.gz
OpenSymbol.sfd is the canonical editable source from the pinned core,
SHA-256: aca99a3aacca8e0c6e204a3b332bc3c766c880e81c3322cf511cc8553392f1e0
LIBREOFFICE-SOURCES/extras/source/truetype/symbol/README gives the FontForge
build command. OpenSymbol has no separate license string in the embedded
font; retain the LibreOffice notices/source reference rather than assigning
it an invented SIL OFL license. Source-archive notices are also extracted to
font-licenses-source/.

EVIDENCE AND LIMITS
SOURCES.json records original locations, local hashes and extraction details.
NOTICES.sha256 verifies all files in this notice tree except itself.
The five supplied recovery blobs were restored and verified against their
Git blob SHA-1, including both binary font-source archives.

This evidence does not establish a bit-for-bit reproduction of the WASM
compiler output or an exact static-component SBOM. Upstream's build recipe
defaults to a moving LibreOffice branch; the embedded buildid pins the core
content used for these references, but all compiler/linker options have not
been reconstructed. No compile provenance section was available in the
previous binary inspection. Do not claim a fully reproducible build or a
license clearance based solely on the package's MPL field. When changing
the runtime, regenerate inventory and source mapping against the new bytes.
