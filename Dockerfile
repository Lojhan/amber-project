FROM node:24-alpine AS workspace

WORKDIR /workspace

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable && corepack prepare pnpm@10.12.4 --activate

# The build context intentionally includes every workspace and frozen challenge
# dependency stage, so service images never depend on a host bind mount or node_modules.
COPY . .

RUN pnpm install --frozen-lockfile

CMD ["pnpm", "--version"]
