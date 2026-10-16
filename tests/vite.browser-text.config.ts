import { mergeConfig } from 'vite';
import selfhost from '../vite.selfhost.config';

// Exercise the browser-only mode used by the hosted Site, including local DOCX
// export. Docker's integrated document service is verified by docker.yml.
export default mergeConfig(selfhost, {
  define: { __MOINPDF_SELF_HOSTED__: false },
});
