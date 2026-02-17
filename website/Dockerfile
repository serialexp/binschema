FROM node:22-alpine AS build

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /workspace

# Copy workspace config and all package.json files for dependency installation
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY website/package.json ./website/
COPY packages/binschema/package.json ./packages/binschema/
COPY packages/binschema/tsconfig.json ./packages/binschema/
COPY packages/zod-metadata-extractor/package.json ./packages/zod-metadata-extractor/
COPY packages/zod-metadata-extractor/tsconfig.json ./packages/zod-metadata-extractor/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code needed for building
COPY packages/zod-metadata-extractor/src/ ./packages/zod-metadata-extractor/src/
COPY packages/binschema/src/ ./packages/binschema/src/

# Build workspace packages
RUN pnpm -r --filter binschema... run build

# Copy website source and repo assets
COPY website/ ./website/
COPY README.md ./README.md
COPY examples/ ./examples/

# Build the static site (prepare-docs generates HTML docs, then Vite builds)
WORKDIR /workspace/website
RUN pnpm run build

FROM nginx:1.27-alpine AS runtime

COPY website/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/website/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
