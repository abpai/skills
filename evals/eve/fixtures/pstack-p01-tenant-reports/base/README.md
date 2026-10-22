# tenant-reports

Nightly job that writes one usage CSV per tenant. The files in `out/` are then
synced to each tenant's download area, keyed by file name.

```sh
bun src/cli.ts data/tenants.json out/
bun test
```
