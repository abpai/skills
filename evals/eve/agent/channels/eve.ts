import { eveChannel } from "eve/channels/eve"
import { none } from "eve/channels/auth"

// Eval-only agent: `eve eval` boots this server on loopback and sends no
// credentials. eve 0.83's default `localDev()` only admits requests when
// EVE_DEV=1, but this lane runs with EVE_DEV=0 to keep sandbox chatter out of
// the logs, so the default walk answers 401. Anonymous access is explicit
// here, and this agent is never deployed.
export default eveChannel({ auth: [none()] })
