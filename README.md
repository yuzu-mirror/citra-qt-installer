# Citra Qt Installer Manifest Generator

This is the Citra Qt installer manifest generator. It generates the Qt Installer Framework compatible manifest.

## How to run

You will need Deno, which is a more modern alternative to Node.js. You can install it here: https://deno.land/#installation .

When it's installed, just run the following command:

```bash
deno run --allow-env=PATH --allow-read --allow-write=/citra/nginx/,temp --allow-net=api.github.com --allow-run server.ts
```
