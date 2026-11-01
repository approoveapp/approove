// Synthetic local QA helper; the parent harness supplies its disposable database.
import { secureGoogleLink } from "../../lib/google-link";
secureGoogleLink(process.argv[2]).then(
  () => process.exit(0),
  () => { console.error("QA Google-link helper failed"); process.exit(1); }
);
